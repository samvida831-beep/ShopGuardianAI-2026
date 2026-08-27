import logging
import os
import re
import threading
import uvicorn

from detection import main as detection_main
from api import app
from Utils.retention import start_retention_loop

# Security: uvicorn access logs include full URLs with query strings, which
# would persist ?token=... values for media endpoints. Redact them before
# they reach any handler/log file. All other access info is preserved.
_TOKEN_RE = re.compile(r"(token=)[^&\s]+")


class _TokenRedactionFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.args, tuple) and record.args:
            record.args = tuple(
                _TOKEN_RE.sub(r"\1REDACTED", arg) if isinstance(arg, str) else arg
                for arg in record.args
            )
        elif isinstance(record.msg, str):
            record.msg = _TOKEN_RE.sub(r"\1REDACTED", record.msg)
        return True


logging.getLogger("uvicorn.access").addFilter(_TokenRedactionFilter())


def start_detection():
    detection_main()


def start_api():
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    detection_thread = threading.Thread(target=start_detection, daemon=True)
    detection_thread.start()

    # Automated data retention: starts ~15s after boot, then every 6 hours.
    start_retention_loop()

    start_api()
