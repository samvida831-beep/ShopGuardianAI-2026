# Utils/config.py
import os


PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ZONE_DIR = os.path.join(PROJECT_DIR, "Zones")

ZONE_FILE = os.path.join(ZONE_DIR, "camera1.json")
INSIDE_ZONE_FILE = os.path.join(ZONE_DIR, "camera2.json")

ENTRY_RTSP_URL = os.getenv("ENTRY_RTSP_URL", "")
INSIDE_RTSP_URL = os.getenv("INSIDE_RTSP_URL", "")

EMPTY_CONFIRM_TIME = 1.0
EMPTY_RESET_TIME = 3
CONFIDENCE = 0.35
CAMERA1_MIN_OVERLAP = 0.15
CAMERA_MODE = os.getenv("CAMERA_MODE", "demo")      # Options: "live", "demo", "webcam"

DEMO_CAMERA1 = "DemoVideos/camera1.mp4"
DEMO_CAMERA2 = "DemoVideos/camera2.mp4"
