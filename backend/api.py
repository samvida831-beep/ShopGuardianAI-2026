import json
import os
import threading
import cv2
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr
from fastapi.middleware.cors import CORSMiddleware

from state import shop_state
from database import (
    AdminUser,
    Shop,
    add_alert,
    add_customer_visit,
    add_snapshot,
    authenticate_admin,
    create_admin_user,
    create_shop_for_owner,
    delete_camera_config,
    generate_auth_token,
    get_admin_user_by_id,
    get_admin_user_by_username,
    get_all_settings,
    get_camera_config,
    get_shop_by_owner,
    get_shop_details,
    get_system_setting,
    init_db,
    list_alerts,
    list_camera_configs,
    list_customer_visits,
    list_snapshots,
    load_zone,
    load_zone_for_shop,
    save_zone,
    save_zone_for_shop,
    sanitize_camera_config_dict,
    set_system_setting,
    update_admin_user,
    upsert_camera_config,
    upsert_shop_details,
    verify_auth_token,
)

# Initialize Database tables and safe migrations
init_db()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRAME_DIR = os.path.join(BASE_DIR, "Frames")
STATE_FILE = os.path.join(BASE_DIR, "shared_state.json")
ZONE_DIR = os.path.join(BASE_DIR, "Zones")
os.makedirs(ZONE_DIR, exist_ok=True)


# --- Pydantic Schemas ---

class RegisterPayload(BaseModel):
    username: str
    password: str
    confirm_password: Optional[str] = None
    full_name: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    shopkeeper_type: Optional[str] = ""


class LoginPayload(BaseModel):
    username: str
    password: str


class ShopSetupPayload(BaseModel):
    shop_name: str
    shop_type: str = "General Retail"
    owner_name: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""
    city: Optional[str] = ""
    state: Optional[str] = ""
    pin_code: Optional[str] = ""
    camera_count: Optional[int] = 2


class CameraConfigPayload(BaseModel):
    camera_number: int
    name: Optional[str] = ""
    source: Optional[str] = ""
    ip_address: Optional[str] = ""
    port: Optional[int] = 554
    username: Optional[str] = ""
    password: Optional[str] = ""
    channel: Optional[str] = "1"
    subtype: Optional[str] = "0"
    mode: Optional[str] = "demo"
    enabled: Optional[bool] = True


class TestCameraPayload(BaseModel):
    mode: str = "demo"
    ip_address: Optional[str] = ""
    port: Optional[int] = 554
    username: Optional[str] = ""
    password: Optional[str] = ""
    channel: Optional[str] = "1"
    subtype: Optional[str] = "0"
    camera_number: Optional[int] = 1


class ZoneData(BaseModel):
    camera: int
    shape: str
    points: list


class SettingsPayload(BaseModel):
    key: str
    value: str


# --- Auth Dependencies ---

def get_current_user_optional(authorization: Optional[str] = Header(None)) -> Optional[AdminUser]:
    if not authorization:
        return None
    token = authorization.replace("Bearer ", "").strip()
    user_id = verify_auth_token(token)
    if not user_id:
        return None
    return get_admin_user_by_id(user_id)


def get_current_user(authorization: Optional[str] = Header(None)) -> AdminUser:
    user = get_current_user_optional(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication token missing, invalid or expired.")
    return user


# --- Helper Functions ---

def load_state():
    if not os.path.exists(STATE_FILE):
        return {
            "occupied": False,
            "shop_status": "Empty",
            "customer_count": 0,
            "camera1": "Online",
            "camera2": "Online",
            "recent_activity": [],
            "latest_snapshot": "",
            "last_updated": "",
        }
    try:
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {
            "occupied": False,
            "shop_status": "Empty",
            "customer_count": 0,
            "camera1": "Online",
            "camera2": "Online",
            "recent_activity": [],
            "latest_snapshot": "",
            "last_updated": "",
        }


def get_camera_frame_dimensions(camera_id: int):
    filename = f"camera{camera_id}.jpg"
    frame_path = os.path.join(FRAME_DIR, filename)
    if os.path.exists(frame_path):
        frame = cv2.imread(frame_path, cv2.IMREAD_COLOR)
        if frame is not None:
            height, width = frame.shape[:2]
            return {"width": int(width), "height": int(height)}
    return {"width": 1280, "height": 720}


# --- RTSP connection-test resource guard ---
#
# A Python thread cannot be forcibly killed. thread.join(timeout=...) only
# stops the HTTP handler from waiting on the worker -- it does NOT stop the
# worker itself. Against an unreachable/misbehaving RTSP host, cv2.VideoCapture
# .open()/.read() can in some cases (e.g. DNS or TCP-level hangs) block longer
# than the CAP_PROP_*_TIMEOUT_MSEC hints below are able to guarantee. If every
# failed "Test Connection" click were allowed to spawn an unbounded worker on
# top of ones that are still stuck, each stuck worker keeps its own open
# VideoCapture/FFmpeg decoder context alive indefinitely -- this is what
# produced the accumulated native memory exhaustion ("Insufficient memory").
#
# This semaphore puts a hard ceiling on how many test workers (and therefore
# how many open VideoCapture handles) can exist at once, independent of
# whether OpenCV/FFmpeg honors its own timeout. Two concurrent tests (Camera 1
# + Camera 2) are expected during normal onboarding, so the cap leaves room
# for that plus one spare slot. release() is guaranteed via `finally` inside
# the worker regardless of how it exits.
MAX_CONCURRENT_CAMERA_TESTS = 3
_camera_test_semaphore = threading.Semaphore(MAX_CONCURRENT_CAMERA_TESTS)


def test_rtsp_connection(rtsp_url: str, timeout_sec: float = 3.0) -> bool:
    # If we're already at the concurrency ceiling (e.g. earlier tests are
    # stuck waiting on an unresponsive camera), refuse to spawn another
    # worker rather than piling on top of the leak.
    if not _camera_test_semaphore.acquire(blocking=False):
        return False

    result = [False]

    def _test():
        cap = cv2.VideoCapture()
        try:
            # Must be set before open() to take effect. These bound how long
            # OpenCV/FFmpeg will wait to connect and to read a single frame,
            # so this worker is expected to finish and release on its own
            # shortly after timeout_sec even though nothing external can
            # interrupt it if the call hangs anyway.
            timeout_ms = int(timeout_sec * 1000)
            cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, timeout_ms)
            cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, timeout_ms)

            opened = cap.open(rtsp_url, cv2.CAP_FFMPEG)
            if opened:
                ret, frame = cap.read()
                if ret and frame is not None:
                    result[0] = True
        except Exception:
            pass
        finally:
            # Guaranteed release on every exit path -- this, not the join
            # below, is what actually prevents the native memory leak.
            try:
                cap.release()
            except Exception:
                pass
            _camera_test_semaphore.release()

    thread = threading.Thread(target=_test, daemon=True)
    thread.start()
    # This bounds how long the HTTP request waits for a result. It does NOT
    # terminate the worker thread -- the worker keeps running in the
    # background until its own OpenCV-level timeout fires, at which point it
    # releases its VideoCapture and semaphore slot itself (see finally above).
    thread.join(timeout=timeout_sec + 1.0)
    return result[0]


# --- App Setup ---

app = FastAPI(title="ShopGuardian AI API")

dev_origins = [
    "http://localhost:8080",
    "http://localhost:5173",
    "http://127.0.0.1:8080",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8000",
]
cors_env = os.getenv("CORS_ORIGINS", "")
allowed_origins = list(dev_origins)
if cors_env:
    allowed_origins.extend([o.strip() for o in cors_env.split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {"message": "ShopGuardian AI API is Running"}


# --- Authentication Endpoints ---

@app.post("/api/auth/register")
async def register(payload: RegisterPayload):
    if not payload.username or not payload.password:
        raise HTTPException(status_code=400, detail="Username and password are required.")
    if payload.confirm_password and payload.password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match.")
    
    existing = get_admin_user_by_username(payload.username.strip())
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists. Please login or choose another username.")

    user = create_admin_user(
        username=payload.username.strip(),
        password=payload.password,
        full_name=payload.full_name or "",
        phone=payload.phone or "",
        email=payload.email or "",
        shopkeeper_type=payload.shopkeeper_type or "",
    )

    token = generate_auth_token(user.id)
    return {
        "success": True,
        "token": token,
        "user": {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name or user.username,
            "phone": user.phone or "",
            "email": user.email or "",
            "shopkeeper_type": user.shopkeeper_type or "",
        },
    }


@app.post("/api/auth/login")
async def login(payload: LoginPayload):
    user = authenticate_admin(payload.username.strip(), payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = generate_auth_token(user.id)
    shop = get_shop_by_owner(user.id)

    shop_data = None
    if shop:
        shop_data = {
            "id": shop.id,
            "shop_name": shop.shop_name,
            "shop_type": shop.shop_type or "General Retail",
            "address": shop.address or "",
            "city": shop.city or "",
            "state": shop.state or "",
            "pin_code": shop.pin_code or "",
        }

    return {
        "success": True,
        "token": token,
        "user": {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name or user.username,
            "phone": user.phone or "",
            "email": user.email or "",
            "shopkeeper_type": user.shopkeeper_type or "",
        },
        "shop": shop_data,
    }


@app.get("/api/auth/me")
async def me(user: AdminUser = Depends(get_current_user)):
    shop = get_shop_by_owner(user.id)
    shop_data = None
    if shop:
        shop_data = {
            "id": shop.id,
            "shop_name": shop.shop_name,
            "shop_type": shop.shop_type or "General Retail",
            "address": shop.address or "",
            "city": shop.city or "",
            "state": shop.state or "",
            "pin_code": shop.pin_code or "",
        }

    return {
        "user": {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name or user.username,
            "phone": user.phone or "",
            "email": user.email or "",
            "shopkeeper_type": user.shopkeeper_type or "",
        },
        "shop": shop_data,
    }


# --- Shop Management Endpoints ---

@app.post("/api/shop/setup")
async def shop_setup(payload: ShopSetupPayload, user: AdminUser = Depends(get_current_user)):
    if not payload.shop_name or not payload.shop_name.strip():
        raise HTTPException(status_code=400, detail="Shop name is required.")

    # Update owner info if provided
    update_admin_user(
        user.id,
        full_name=payload.owner_name if payload.owner_name else None,
        phone=payload.phone if payload.phone else None,
        email=payload.email if payload.email else None,
    )

    shop = create_shop_for_owner(
        owner_id=user.id,
        shop_name=payload.shop_name.strip(),
        shop_type=payload.shop_type or "General Retail",
        address=payload.address or "",
        city=payload.city or "",
        state=payload.state or "",
        pin_code=payload.pin_code or "",
    )

    # Legacy fallback update
    upsert_shop_details(
        shop_name=shop.shop_name,
        owner_name=user.full_name or user.username,
        shop_type=shop.shop_type,
        address=shop.address,
        phone=user.phone,
        camera_count=payload.camera_count or 2,
    )

    return {
        "success": True,
        "shop": {
            "id": shop.id,
            "shop_name": shop.shop_name,
            "shop_type": shop.shop_type,
            "address": shop.address,
            "city": shop.city,
            "state": shop.state,
            "pin_code": shop.pin_code,
        },
    }


@app.get("/api/shop/details")
async def shop_details(user_opt: Optional[AdminUser] = Depends(get_current_user_optional)):
    if user_opt:
        shop = get_shop_by_owner(user_opt.id)
        if shop:
            return {
                "id": shop.id,
                "shop_name": shop.shop_name,
                "owner_name": user_opt.full_name or user_opt.username,
                "shop_type": shop.shop_type or "General Retail",
                "address": shop.address or "",
                "city": shop.city or "",
                "state": shop.state or "",
                "pin_code": shop.pin_code or "",
                "phone": user_opt.phone or "",
                "email": user_opt.email or "",
            }

    # Fallback to legacy single-tenant table if unauthenticated request
    details = get_shop_details()
    if not details:
        return {}
    return {
        "shop_name": details.shop_name,
        "owner_name": details.owner_name,
        "shop_type": details.shop_type,
        "address": details.address,
        "phone": details.phone,
        "camera_count": details.camera_count,
    }


# --- Camera Setup & Testing Endpoints ---

@app.post("/api/cameras/test-connection")
async def test_camera_connection_endpoint(payload: TestCameraPayload):
    mode = (payload.mode or "demo").lower()

    if mode == "demo":
        cam_num = payload.camera_number or 1
        demo_file1 = os.path.join(BASE_DIR, f"DemoVideos/camera{cam_num}.mp4")
        demo_file2 = os.path.join(BASE_DIR, "DemoVideos/camera1.mp4")

        if os.path.exists(demo_file1) or os.path.exists(demo_file2):
            return {
                "success": True,
                "message": f"Demo Video source for Camera {cam_num} verified successfully!",
            }
        return {
            "success": True,
            "message": "Demo mode selected (Simulated camera active).",
        }

    # Live RTSP Mode
    ip = (payload.ip_address or "").strip()
    port = payload.port or 554
    username = (payload.username or "").strip()
    password = (payload.password or "").strip()
    channel = (payload.channel or "1").strip()
    subtype = (payload.subtype or "0").strip()

    if not ip:
        raise HTTPException(status_code=400, detail="Camera IP Address is required for Live Mode.")

    if username and password:
        rtsp_url = f"rtsp://{username}:{password}@{ip}:{port}/cam/realmonitor?channel={channel}&subtype={subtype}"
    else:
        rtsp_url = f"rtsp://{ip}:{port}/cam/realmonitor?channel={channel}&subtype={subtype}"

    # Perform connection test safely without logging credentials
    connected = test_rtsp_connection(rtsp_url, timeout_sec=3.0)

    if connected:
        return {
            "success": True,
            "message": f"Successfully connected to camera at {ip}:{port}!",
        }

    return {
        "success": False,
        "message": f"Failed to connect to camera at {ip}:{port}. Please verify camera IP, RTSP credentials, port, and network connection.",
    }


@app.post("/api/cameras")
async def save_camera(payload: CameraConfigPayload, user: AdminUser = Depends(get_current_user)):
    shop = get_shop_by_owner(user.id)
    shop_id = shop.id if shop else None

    # Construct source URL if live mode
    source = payload.source or ""
    if payload.mode == "live" and payload.ip_address:
        ip = payload.ip_address.strip()
        port = payload.port or 554
        user_name = (payload.username or "").strip()
        pwd = (payload.password or "").strip()
        ch = (payload.channel or "1").strip()
        sub = (payload.subtype or "0").strip()
        if user_name and pwd:
            source = f"rtsp://{user_name}:{pwd}@{ip}:{port}/cam/realmonitor?channel={ch}&subtype={sub}"
        else:
            source = f"rtsp://{ip}:{port}/cam/realmonitor?channel={ch}&subtype={sub}"
    elif payload.mode == "demo":
        source = f"DemoVideos/camera{payload.camera_number}.mp4"

    config = upsert_camera_config(
        shop_id=shop_id,
        camera_number=payload.camera_number,
        camera_name=payload.name or f"Camera {payload.camera_number}",
        source=source,
        ip_address=payload.ip_address or "",
        port=payload.port or 554,
        username=payload.username or "",
        password=payload.password or "",
        channel=payload.channel or "1",
        subtype=payload.subtype or "0",
        mode=payload.mode or "demo",
        enabled=payload.enabled if payload.enabled is not None else True,
    )

    return {
        "success": True,
        "camera": sanitize_camera_config_dict(config),
    }


@app.get("/api/cameras")
async def list_cameras(user_opt: Optional[AdminUser] = Depends(get_current_user_optional)):
    shop_id = None
    if user_opt:
        shop = get_shop_by_owner(user_opt.id)
        if shop:
            shop_id = shop.id

    cameras = list_camera_configs(shop_id=shop_id)
    return [sanitize_camera_config_dict(row) for row in cameras]


# --- Status, Activity & Frame Endpoints ---

@app.get("/api/status")
def get_status():
    return load_state()


@app.get("/api/activity")
def get_activity():
    return load_state()["recent_activity"]


@app.get("/api/snapshot")
def get_snapshot():
    return {"latest_snapshot": load_state()["latest_snapshot"]}


@app.get("/api/snapshot-image")
def get_snapshot_image(file: str):
    image_path = os.path.join(BASE_DIR, "Snapshots", file)
    if not os.path.exists(image_path):
        return {"error": "Image not found"}
    return FileResponse(image_path, media_type="image/jpeg")


@app.get("/api/snapshots")
def get_snapshots(user_opt: Optional[AdminUser] = Depends(get_current_user_optional)):
    shop_id = None
    if user_opt:
        shop = get_shop_by_owner(user_opt.id)
        if shop:
            shop_id = shop.id
    
    try:
        rows = list_snapshots(limit=100, shop_id=shop_id)
        if rows:
            return [row["filename"] for row in rows if row.get("filename")]
    except Exception as error:
        print(f"Database snapshot query error: {error}")

    # Fallback to Snapshot directory scan if DB empty or query fails
    snapshot_dir = os.path.join(BASE_DIR, "Snapshots")
    if not os.path.exists(snapshot_dir):
        return []
    files = [f for f in os.listdir(snapshot_dir) if f.lower().endswith((".jpg", ".jpeg", ".png"))]
    files.sort(key=lambda x: os.path.getmtime(os.path.join(snapshot_dir, x)), reverse=True)
    return files


@app.get("/api/frame")
def get_frame(camera: int):
    if camera == 1:
        filename = "camera1.jpg"
    elif camera == 2:
        filename = "camera2.jpg"
    else:
        return {"error": "Invalid camera number"}

    path = os.path.join(FRAME_DIR, filename)
    if not os.path.exists(path):
        return {"error": "Frame not available"}
    return FileResponse(path, media_type="image/jpeg")


@app.get("/api/camera-info")
def get_camera_info():
    return {
        "camera1": get_camera_frame_dimensions(1),
        "camera2": get_camera_frame_dimensions(2),
    }


# --- Zone Endpoints ---

@app.post("/api/save-zone")
async def save_zone_endpoint(zone: ZoneData, user_opt: Optional[AdminUser] = Depends(get_current_user_optional)):
    # 1. Save to JSON for immediate detection engine reading
    filename = os.path.join(ZONE_DIR, f"camera{zone.camera}.json")
    with open(filename, "w", encoding="utf-8") as f:
        json.dump({"shape": zone.shape, "points": zone.points}, f, indent=4)

    # 2. Save to Database
    if user_opt:
        shop = get_shop_by_owner(user_opt.id)
        if shop:
            save_zone_for_shop(shop.id, zone.camera, zone.shape, zone.points)
        else:
            save_zone(zone.camera, zone.shape, zone.points)
    else:
        save_zone(zone.camera, zone.shape, zone.points)

    return {"success": True}


@app.get("/api/load-zone")
async def load_zone_endpoint(camera: int, user_opt: Optional[AdminUser] = Depends(get_current_user_optional)):
    filename = os.path.join(ZONE_DIR, f"camera{camera}.json")
    if os.path.exists(filename):
        with open(filename, encoding="utf-8") as f:
            return json.load(f)

    if user_opt:
        shop = get_shop_by_owner(user_opt.id)
        if shop:
            db_zone = load_zone_for_shop(shop.id, camera)
            if db_zone:
                return db_zone

    db_zone = load_zone(camera)
    if db_zone:
        return db_zone

    return {}


# --- Alert & Customers Endpoints ---

@app.get("/api/customers")
async def customers():
    return list_customer_visits(limit=50)


@app.get("/api/alerts")
async def alerts():
    return list_alerts(limit=50)


@app.post("/api/alerts")
async def create_alert(payload: dict):
    alert = add_alert(
        payload.get("title", "Alert"),
        payload.get("message", ""),
        payload.get("alert_type", "info"),
        payload.get("camera_number"),
    )
    return {"success": True, "alert": {"id": alert.id}}


@app.get("/api/settings")
async def settings():
    return get_all_settings()


@app.post("/api/settings")
async def save_setting(payload: SettingsPayload):
    set_system_setting(payload.key, payload.value)
    return {"success": True}


@app.post("/api/snapshots")
async def save_snapshot_record(payload: dict, user_opt: Optional[AdminUser] = Depends(get_current_user_optional)):
    shop_id = None
    if user_opt:
        shop = get_shop_by_owner(user_opt.id)
        if shop:
            shop_id = shop.id

    record = add_snapshot(
        payload.get("filename", ""),
        payload.get("camera_number"),
        payload.get("event_type"),
        payload.get("customer_label"),
        shop_id=shop_id,
    )
    return {"success": True, "snapshot": {"id": record.id, "filename": record.filename}}