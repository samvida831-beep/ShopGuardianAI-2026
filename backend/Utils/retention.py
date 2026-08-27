# Utils/retention.py
"""Automated Data Retention & Storage Management for ShopGuardian AI.

Runs in its own daemon thread (started from main.py ~15s after boot, then
every CLEANUP_INTERVAL_HOURS). Completely decoupled from the detection /
camera / MJPEG pipeline -- it only touches:

  * auto-generated snapshot JPEGs in backend/Snapshots/ (strict name pattern)
  * SnapshotRecord rows whose files were removed
  * CustomerVisit / AlertRecord rows older than the retention window
  * ShopGuardian_Log.txt lines older than the retention window

Timestamp conventions are preserved exactly as the rest of the project uses:
snapshot filenames are LOCAL time (see detection.save_snapshot), database
created_at columns are naive UTC (SQLAlchemy datetime.utcnow defaults).
"""

import json
import os
import re
import threading
import time
from datetime import datetime, timedelta, timezone

from state import shop_state
from database import (
    AlertRecord,
    CustomerVisit,
    SnapshotRecord,
    get_session,
    get_system_setting,
    set_system_setting,
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # backend/
SNAPSHOT_DIR = os.path.join(BASE_DIR, "Snapshots")
LOG_DIR = os.path.join(BASE_DIR, "Logs")
LOG_FILE = os.path.join(LOG_DIR, "ShopGuardian_Log.txt")
STATE_FILE = os.path.join(BASE_DIR, "shared_state.json")

# Retention policy (env-overridable, sensible hackathon defaults)
SCREENSHOT_RETENTION_DAYS = int(os.getenv("SCREENSHOT_RETENTION_DAYS", "7"))
MAX_SCREENSHOTS = int(os.getenv("MAX_SCREENSHOTS", "500"))
LOG_RETENTION_DAYS = int(os.getenv("LOG_RETENTION_DAYS", "30"))
CLEANUP_INTERVAL_HOURS = float(os.getenv("CLEANUP_INTERVAL_HOURS", "6"))
INITIAL_DELAY_SECONDS = 15.0

# Only files produced by detection.save_snapshot() may ever be deleted.
SNAPSHOT_NAME_RE = re.compile(r"^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.(jpg|jpeg|png)$")
_SNAPSHOT_TS_FORMAT = "%Y-%m-%d_%H-%M-%S"

_LOG_LINE_RE = re.compile(r"^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) - ")
_LOG_TS_FORMAT = "%Y-%m-%d %H:%M:%S"


def _list_snapshots(snapshot_dir=None):
    """Return [(filename, filepath, parsed_local_ts)] for legitimate snapshots only."""
    directory = snapshot_dir or SNAPSHOT_DIR
    try:
        entries = os.listdir(directory)
    except OSError:
        return []
    result = []
    for name in entries:
        if not SNAPSHOT_NAME_RE.match(name):
            continue
        path = os.path.join(directory, name)
        if not os.path.isfile(path):
            continue
        try:
            ts = datetime.strptime(name.rsplit(".", 1)[0], _SNAPSHOT_TS_FORMAT)
        except ValueError:
            continue
        result.append((name, path, ts))
    return result


def cleanup_screenshots(snapshot_dir=None):
    """Enforce age retention (oldest-than-N-days removed) then the max-count cap
    (oldest removed first). Returns the list of deleted filenames."""
    cutoff = datetime.now() - timedelta(days=SCREENSHOT_RETENTION_DAYS)
    snapshots = _list_snapshots(snapshot_dir)
    deleted = []

    # 1) Age-based removal -- recent screenshots can never match this rule.
    for name, path, ts in snapshots:
        if ts < cutoff:
            try:
                os.remove(path)
                deleted.append(name)
            except OSError as error:
                print(f"Retention: could not remove {name}: {error}")

    # 2) Count-based removal -- delete oldest first until within MAX_SCREENSHOTS.
    remaining = sorted(
        (item for item in snapshots if item[0] not in set(deleted)),
        key=lambda item: item[2],
    )
    excess = len(remaining) - MAX_SCREENSHOTS
    if excess > 0:
        for name, path, _ts in remaining[:excess]:
            try:
                os.remove(path)
                deleted.append(name)
            except OSError as error:
                print(f"Retention: could not remove {name}: {error}")

    if deleted:
        _prune_snapshot_records(set(deleted))
        _clear_latest_snapshot_if_missing(set(deleted))
    return deleted


def _prune_snapshot_records(deleted_names):
    """Remove SnapshotRecord rows whose snapshot files were deleted (ORM, parameterized)."""
    if not deleted_names:
        return
    try:
        session = get_session()
        session.query(SnapshotRecord).filter(
            SnapshotRecord.filename.in_(deleted_names)
        ).delete(synchronize_session=False)
        session.commit()
        session.close()
    except Exception as error:
        print(f"Retention: snapshot record prune failed: {error}")


def _clear_latest_snapshot_if_missing(deleted_names=None):
    """Safely clear shop_state['latest_snapshot'] when its file no longer exists."""
    latest = shop_state.get("latest_snapshot") or ""
    if not latest:
        return
    if deleted_names is not None and latest not in deleted_names:
        return
    if os.path.isfile(os.path.join(SNAPSHOT_DIR, latest)):
        return
    try:
        shop_state["latest_snapshot"] = ""
        shop_state["last_updated"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(STATE_FILE, "w", encoding="utf-8") as handle:
            json.dump(shop_state, handle, indent=4)
        print("Retention: cleared stale latest_snapshot reference.")
    except OSError as error:
        print(f"Retention: failed to update shared state: {error}")


def cleanup_activity_records():
    """Delete CustomerVisit/AlertRecord rows older than LOG_RETENTION_DAYS.
    Database timestamps are naive UTC (project convention), so the cutoff is
    computed in naive UTC as well. Returns (visits_deleted, alerts_deleted)."""
    cutoff_utc = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=LOG_RETENTION_DAYS)
    visits_deleted = alerts_deleted = 0
    try:
        session = get_session()
        visits_deleted = (
            session.query(CustomerVisit)
            .filter(CustomerVisit.created_at < cutoff_utc)
            .delete(synchronize_session=False)
        )
        alerts_deleted = (
            session.query(AlertRecord)
            .filter(AlertRecord.created_at < cutoff_utc)
            .delete(synchronize_session=False)
        )
        session.commit()
        session.close()
    except Exception as error:
        print(f"Retention: activity record cleanup failed: {error}")
    return visits_deleted, alerts_deleted


def cleanup_text_log(log_file=None):
    """Trim ShopGuardian_Log.txt lines older than LOG_RETENTION_DAYS.
    Lines without a parsable leading timestamp are preserved (fail-safe).
    Uses write-to-temp + atomic replace so partial failures never corrupt the log."""
    target = log_file or LOG_FILE
    if not os.path.isfile(target):
        return 0
    cutoff = datetime.now() - timedelta(days=LOG_RETENTION_DAYS)
    try:
        with open(target, "r", encoding="utf-8") as handle:
            lines = handle.readlines()
        kept = []
        removed = 0
        for line in lines:
            match = _LOG_LINE_RE.match(line)
            if match:
                try:
                    ts = datetime.strptime(match.group(1), _LOG_TS_FORMAT)
                    if ts < cutoff:
                        removed += 1
                        continue
                except ValueError:
                    pass  # unparsable timestamp -> keep the line
            kept.append(line)
        if removed:
            tmp_path = target + ".tmp"
            with open(tmp_path, "w", encoding="utf-8") as handle:
                handle.writelines(kept)
            os.replace(tmp_path, target)
        return removed
    except OSError as error:
        print(f"Retention: log cleanup failed: {error}")
        return 0


def run_retention_cleanup():
    """Run one full cleanup pass and persist the last-cleanup timestamp."""
    deleted_snapshots = cleanup_screenshots()
    visits_deleted, alerts_deleted = cleanup_activity_records()
    log_lines_removed = cleanup_text_log()
    cleaned_at = datetime.now().strftime(_LOG_TS_FORMAT)
    try:
        set_system_setting("last_cleanup", cleaned_at)
    except Exception as error:
        print(f"Retention: could not persist last_cleanup: {error}")
    summary = {
        "snapshots_deleted": len(deleted_snapshots),
        "visits_deleted": visits_deleted,
        "alerts_deleted": alerts_deleted,
        "log_lines_removed": log_lines_removed,
        "cleaned_at": cleaned_at,
    }
    print(f"Retention cleanup complete: {summary}")
    return summary


def start_retention_loop(
    initial_delay=INITIAL_DELAY_SECONDS, interval_hours=CLEANUP_INTERVAL_HOURS
):
    """Start the background daemon cleanup thread (non-blocking)."""

    def _loop():
        time.sleep(initial_delay)  # let model/cameras/API come up first
        while True:
            try:
                run_retention_cleanup()
            except Exception as error:
                print(f"Retention: unexpected cleanup error: {error}")
            time.sleep(interval_hours * 3600.0)

    thread = threading.Thread(target=_loop, daemon=True, name="retention-cleanup")
    thread.start()
    return thread


def get_storage_status():
    """Read-only counters for the dashboard/settings storage card."""
    snapshots = _list_snapshots()
    session = get_session()
    try:
        visit_count = session.query(CustomerVisit).count()
        alert_count = session.query(AlertRecord).count()
    finally:
        session.close()
    return {
        "screenshots_used": len(snapshots),
        "screenshots_max": MAX_SCREENSHOTS,
        "customer_visit_records": visit_count,
        "alert_records": alert_count,
        "screenshot_retention_days": SCREENSHOT_RETENTION_DAYS,
        "log_retention_days": LOG_RETENTION_DAYS,
        "last_cleanup": get_system_setting("last_cleanup", ""),
    }