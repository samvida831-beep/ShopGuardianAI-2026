import os
import threading
import uvicorn

from detection import main as detection_main
from api import app


def start_detection():
    detection_main()


def start_api():
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    detection_thread = threading.Thread(target=start_detection, daemon=True)
    detection_thread.start()

    start_api()