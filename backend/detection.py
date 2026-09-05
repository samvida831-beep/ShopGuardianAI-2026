import os
import json
import time
import threading
from datetime import datetime
from state import shop_state, latest_frames
import cv2
try:
    import winsound
except ImportError:
    winsound = None
from ultralytics import YOLO

from camera import CameraStream
from Utils.config import (
    CONFIDENCE,
    EMPTY_CONFIRM_TIME,
    EMPTY_RESET_TIME,
    ENTRY_RTSP_URL,
    INSIDE_RTSP_URL,
    CAMERA_MODE,
    DEMO_CAMERA1,
    DEMO_CAMERA2,
)
from Utils.inside_zone_selector import (
    box_intersects_zone as box_intersects_camera2_zone,
    draw_zone as draw_camera2_zone,
    load_zone as load_camera2_zone,
    mouse_callback as camera2_mouse_callback,
    save_zone as save_camera2_zone,
    zone_is_loaded as camera2_zone_is_loaded,
)
from Utils.zone_selector import (
    box_intersects_zone as box_intersects_camera1_zone,
    draw_zone as draw_camera1_zone,
    load_zone as load_camera1_zone,
    mouse_callback as camera1_mouse_callback,
    save_zone as save_camera1_zone,
    zone_is_loaded as camera1_zone_is_loaded,
)


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SNAPSHOT_DIR = os.path.join(BASE_DIR, "Snapshots")
LOG_DIR = os.path.join(BASE_DIR, "Logs")
LOG_FILE = os.path.join(LOG_DIR, "ShopGuardian_Log.txt")
STATE_FILE = os.path.join(BASE_DIR, "shared_state.json")
WINDOW_NAME = "ShopGuardian AI"
CAMERA2_WINDOW_NAME = "ShopGuardian AI - Camera 2"
ENTRY_DEBOUNCE_SECONDS = 1.0
CAMERA2_EARLY_MARGIN = 40


def save_snapshot(frame):
    """Save the single snapshot associated with a confirmed customer entry."""
    filename = datetime.now().strftime("%Y-%m-%d_%H-%M-%S_%f.jpg")
    filepath = os.path.join(SNAPSHOT_DIR, filename)
    cv2.imwrite(filepath, frame)
    print("Snapshot saved:", filepath)
    return filename


def write_entry_log(filename):
    """Append one log record for a confirmed customer entry."""
    log_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(LOG_FILE, "a", encoding="utf-8") as log:
        log.write(f"{log_time} - Customer Entered - Normal Mode - {filename}\n")
def save_shared_state():
    shop_state["last_updated"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(shop_state, f, indent=4)

def draw_detected_boxes(frame, boxes):
    """Draw bounding boxes and labels for detected persons."""
    for x1, y1, x2, y2, inside_zone in boxes:
        bottom_center_x = (x1 + x2) // 2
        bottom_center_y = y2
        color = (0, 255, 0) if inside_zone else (0, 0, 255)
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        cv2.circle(frame, (bottom_center_x, bottom_center_y), 5, color, -1)
        cv2.putText(
            frame,
            "Person",
            (x1, max(25, y1 - 10)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            color,
            2,
        )


def detect_people(model, frame, zone_intersects, early_margin=0):
    """Detect people, annotate their boxes, and report zone presence."""
    any_person_detected = False
    person_in_zone = False
    detected_boxes = []

    try:
        results = model(frame, classes=[0], conf=CONFIDENCE, verbose=False)
    except Exception as error:
        print(f"Person detection failed: {error}")
        return False, False, []

    frame_height, frame_width = frame.shape[:2]
    for result in results:
        for box in result.boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            inside_zone = zone_intersects(x1, y1, x2, y2)

            if early_margin:
                inside_zone = inside_zone or zone_intersects(
                    max(0, x1 - early_margin),
                    max(0, y1 - early_margin),
                    min(frame_width, x2 + early_margin),
                    min(frame_height, y2 + early_margin),
                )

            detected_boxes.append((x1, y1, x2, y2, inside_zone))
            any_person_detected = True
            person_in_zone = person_in_zone or inside_zone

    draw_detected_boxes(frame, detected_boxes)
    return any_person_detected, person_in_zone, detected_boxes


def draw_status(frame, customer_count, shop_occupied, zone_loaded):
    """Draw shared shop status information on each camera window."""
    shop_status = "OCCUPIED" if shop_occupied else "EMPTY"
    shop_color = (0, 255, 0) if shop_occupied else (0, 0, 255)
    cv2.putText(frame, f"Customers Today: {customer_count}", (20, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
    cv2.putText(frame, f"Shop Status: {shop_status}", (20, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.8, shop_color, 2)
    cv2.putText(frame, f"Zone Loaded: {'YES' if zone_loaded else 'NO'}", (20, 105), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
    cv2.putText(frame, "S = Save Camera 1 Zone | I = Save Camera 2 Zone | Q = Quit", (20, 140), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)


def main():
    try:
        _run_detection()
    except BaseException:
        import traceback
        print("===== DETECTION THREAD CRASH =====", flush=True)
        traceback.print_exc()
        print("===== END DETECTION THREAD CRASH =====", flush=True)
        raise


def _run_detection():
    os.makedirs(SNAPSHOT_DIR, exist_ok=True)
    os.makedirs(LOG_DIR, exist_ok=True)
    FRAME_DIR = os.path.join(BASE_DIR, "Frames")
    os.makedirs(FRAME_DIR, exist_ok=True)

    model = YOLO(os.path.join(BASE_DIR, "yolov8n.pt"))

    for _demo_name in (DEMO_CAMERA1, DEMO_CAMERA2):
        _demo_path = os.path.join(BASE_DIR, _demo_name)
        _exists = os.path.isfile(_demo_path)
        _size = os.path.getsize(_demo_path) if _exists else -1
        _cap = cv2.VideoCapture(_demo_path)
        _opened = _cap.isOpened()
        _ret = False
        _shape = None
        if _opened:
            _ret, _frame = _cap.read()
            _shape = None if _frame is None else _frame.shape
        _cap.release()
        print(
            f"[DEMO_DIAG] {_demo_name} exists={_exists} size={_size} "
            f"isOpened={_opened} read_ok={_ret} frame_shape={_shape}",
            flush=True,
        )

    if CAMERA_MODE == "live":
        camera1 = CameraStream(ENTRY_RTSP_URL)
        camera2 = CameraStream(INSIDE_RTSP_URL)

    elif CAMERA_MODE == "demo":
        camera1 = CameraStream(os.path.join(BASE_DIR, DEMO_CAMERA1))
        camera2 = CameraStream(os.path.join(BASE_DIR, DEMO_CAMERA2))

    elif CAMERA_MODE == "webcam":
        camera1 = CameraStream(0)
        camera2 = CameraStream(0)

    else:
        raise ValueError(f"Unknown CAMERA_MODE: {CAMERA_MODE}")
    load_camera1_zone()
    load_camera2_zone()

    # Headless by default on every platform: cloud/Linux hosts have no display and
    # cv2.namedWindow would crash the detection thread. Set HEADLESS=false locally
    # to enable the OpenCV preview/zone-editor windows.
    headless = os.getenv("HEADLESS", "true").lower() == "true"
    if not headless:
        try:
            cv2.namedWindow(WINDOW_NAME)
            cv2.setMouseCallback(WINDOW_NAME, camera1_mouse_callback)
            cv2.namedWindow(CAMERA2_WINDOW_NAME)
            cv2.setMouseCallback(CAMERA2_WINDOW_NAME, camera2_mouse_callback)
        except cv2.error as gui_error:
            print(f"GUI unavailable, continuing headless: {gui_error}")
            headless = True

    customer_count = 0
    shop_occupied = False

    # Initialize shared frontend state
    shop_state["occupied"] = False
    shop_state["shop_status"] = "Empty"
    shop_state["customer_count"] = 0
    shop_state["camera1"] = "Online"
    shop_state["camera2"] = "Online"

    last_any_person_time = None
    last_entry_time = None
    no_person_start = None

    def handle_entry(person_in_any_zone, triggering_frame, now):
        """Handle one shared entry event and prevent duplicate counts."""
        nonlocal customer_count, shop_occupied, last_entry_time

        if not person_in_any_zone or shop_occupied:
            return
        if last_entry_time is not None and now - last_entry_time < ENTRY_DEBOUNCE_SECONDS:
            return

        def play_chime():
            if winsound is None:
                return
            try:
                winsound.Beep(1000, 500)
                winsound.Beep(1000, 500)
            except Exception as error:
                print(f"Audio chime error: {error}")

        threading.Thread(target=play_chime, daemon=True).start()
        shop_occupied = True
        shop_state["occupied"] = True
        shop_state["shop_status"] = "Occupied"
        last_entry_time = now
        print("Customer entered. Shop occupied.")

        try:
            filename = save_snapshot(triggering_frame)
            write_entry_log(filename)
            shop_state["latest_snapshot"] = filename
            save_shared_state()

            # Safely persist snapshot record in database (non-blocking fallback)
            try:
                from database import add_snapshot
                add_snapshot(filename=filename, event_type="Customer Entry")
            except Exception as db_err:
                print(f"Database snapshot record insert failed (non-blocking): {db_err}")

        except OSError as error:
            print(f"Entry snapshot or log failed: {error}")
        finally:
            customer_count += 1
            shop_state["customer_count"] = customer_count
            shop_state["last_detection"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            shop_state["recent_activity"].insert(
                0,
                f"Customer entered at {shop_state['last_detection']}"
            )

            # Keep only the latest 10 events
            shop_state["recent_activity"] = shop_state["recent_activity"][:10]

    last_cam1_id = -1
    last_cam2_id = -1
    last_frame_save_time = 0.0

    cam_turn = 1
    cam1_person_detected, cam1_in_zone, cam1_boxes = False, False, []
    cam2_person_detected, cam2_in_zone, cam2_boxes = False, False, []

    try:
        while True:
            # Skip redundant YOLO inference and frame allocations if no new frame arrived from either camera
            if camera1.frame_id == last_cam1_id and camera2.frame_id == last_cam2_id:
                time.sleep(0.01)
                continue

            camera1_ret, camera1_frame, cam1_id = camera1.read_with_id()
            camera2_ret, camera2_frame, cam2_id = camera2.read_with_id()
            shop_state["camera1"] = "Online" if camera1_ret else "Offline"
            shop_state["camera2"] = "Online" if camera2_ret else "Offline"

            last_cam1_id = cam1_id
            last_cam2_id = cam2_id

            if camera1_frame is None or camera2_frame is None:
                time.sleep(0.03)
                continue

            now = time.monotonic()

            # Publish raw frames to /api/frame BEFORE YOLO so a YOLO/OOM
            # failure cannot starve the live stream endpoint.
            ret1, buf1 = cv2.imencode('.jpg', camera1_frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            if ret1:
                latest_frames.set_frame(1, buf1.tobytes())

            ret2, buf2 = cv2.imencode('.jpg', camera2_frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            if ret2:
                latest_frames.set_frame(2, buf2.tobytes())

            try:
                if cam_turn == 1:
                    cam1_person_detected, cam1_in_zone, cam1_boxes = detect_people(
                        model, camera1_frame, box_intersects_camera1_zone
                    )
                    draw_detected_boxes(camera2_frame, cam2_boxes)
                    cam_turn = 2
                else:
                    cam2_person_detected, cam2_in_zone, cam2_boxes = detect_people(
                        model,
                        camera2_frame,
                        box_intersects_camera2_zone,
                        early_margin=CAMERA2_EARLY_MARGIN,
                    )
                    draw_detected_boxes(camera1_frame, cam1_boxes)
                    cam_turn = 1

                camera1_person_detected = cam1_person_detected
                person_in_camera1_zone = cam1_in_zone
                camera2_person_detected = cam2_person_detected
                person_in_camera2_zone = cam2_in_zone

                any_person_detected = camera1_person_detected or camera2_person_detected
                person_in_any_zone = person_in_camera1_zone or person_in_camera2_zone
                triggering_frame = camera1_frame if person_in_camera1_zone else camera2_frame
                handle_entry(person_in_any_zone, triggering_frame, now)

                if person_in_any_zone:
                    last_any_person_time = now
                    no_person_start = None

                elif shop_occupied:

                    if no_person_start is None:
                        no_person_start = now

                    elif now - no_person_start >= EMPTY_CONFIRM_TIME:

                        if last_any_person_time is not None and \
                            now - last_any_person_time >= EMPTY_RESET_TIME:

                            shop_occupied = False
                            shop_state["occupied"] = False
                            shop_state["shop_status"] = "Empty"
                            save_shared_state()

                            shop_state["recent_activity"].insert(
                                0,
                                f"Shop became empty at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
                            )

                            # Keep only the latest 10 events
                            shop_state["recent_activity"] = shop_state["recent_activity"][:10]

                            no_person_start = None
                            print("Shop empty. Resetting occupancy.")

                draw_status(camera1_frame, customer_count, shop_occupied, camera1_zone_is_loaded())
                draw_status(camera2_frame, customer_count, shop_occupied, camera2_zone_is_loaded())
                draw_camera1_zone(camera1_frame)
                draw_camera2_zone(camera2_frame)
            except Exception as _yolo_err:
                print(f"[DET] YOLO/detection pass failed (continuing): {_yolo_err}", flush=True)

            if not headless:
                try:
                    cv2.imshow(WINDOW_NAME, camera1_frame)
                    cv2.imshow(CAMERA2_WINDOW_NAME, camera2_frame)
                    key = cv2.waitKey(1) & 0xFF
                    if key in (ord("s"), ord("S")):
                        save_camera1_zone()
                    elif key in (ord("i"), ord("I")):
                        save_camera2_zone()
                    elif key in (ord("q"), ord("Q")):
                        break
                except Exception:
                    pass

            # Rate-limit frame saves to disk (max 10 fps) to maintain fallback /api/frame compatibility
            if now - last_frame_save_time >= 0.1:
                cv2.imwrite(os.path.join(FRAME_DIR, "camera1.jpg"), camera1_frame)
                cv2.imwrite(os.path.join(FRAME_DIR, "camera2.jpg"), camera2_frame)
                last_frame_save_time = now
    finally:
        camera1.release()
        camera2.release()
        try:
            cv2.destroyAllWindows()
        except Exception:
            pass


if __name__ == "__main__":
    main()
