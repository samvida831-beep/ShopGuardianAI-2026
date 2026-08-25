from datetime import datetime

shop_state = {
    "occupied": False,
    "shop_status": "Empty",

    "customer_count": 0,

    "last_detection": "",

    "camera1": "Offline",
    "camera2": "Offline",

    "recent_activity": [],

    "latest_snapshot": "",

    "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
}