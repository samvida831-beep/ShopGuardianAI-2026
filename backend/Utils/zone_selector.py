# Utils/zone_selector.py
import json
import os
import math

import cv2

from Utils.config import ZONE_FILE


drawing = False
center = None
radius = 0
zone = None


def _point_in_polygon(point, polygon):
    x, y = point
    inside = False
    j = len(polygon) - 2

    for i in range(0, len(polygon), 2):
        xi = polygon[i]
        yi = polygon[i + 1]
        xj = polygon[j]
        yj = polygon[j + 1]

        intersect = ((yi > y) != (yj > y)) and (
            x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi
        )
        if intersect:
            inside = not inside
        j = i

    return inside


def _zone_shape(zone_data):
    if isinstance(zone_data, dict):
        return zone_data.get("shape")
    return None


def _zone_points(zone_data):
    if isinstance(zone_data, dict):
        return zone_data.get("points", [])
    return []


def mouse_callback(event, x, y, flags, param):
    """Create an entry circle from its center by clicking and dragging."""
    global drawing, center, radius, zone

    if event == cv2.EVENT_LBUTTONDOWN:
        drawing = True
        center = (x, y)
        radius = 0
    elif event == cv2.EVENT_MOUSEMOVE and drawing:
        radius = int(math.hypot(x - center[0], y - center[1]))
    elif event == cv2.EVENT_LBUTTONUP and drawing:
        drawing = False
        radius = int(math.hypot(x - center[0], y - center[1]))
        zone = (center[0], center[1], radius)
        print("Entry zone selected. Press S to save it.")


def draw_zone(frame):
    """Draw the in-progress circle and the currently selected entry zone."""
    if drawing and center is not None:
        cv2.circle(frame, center, radius, (0, 255, 255), 2)

    if zone is None:
        return

    shape = _zone_shape(zone)
    points = _zone_points(zone)

    if shape == "circle" and len(points) >= 3:
        center_x, center_y, zone_radius = int(points[0]), int(points[1]), int(points[2])
        cv2.circle(frame, (center_x, center_y), zone_radius, (0, 255, 0), 2)
        cv2.putText(
            frame,
            "ENTRY ZONE",
            (center_x - zone_radius, max(25, center_y - zone_radius - 10)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 255, 0),
            2,
        )
    elif shape == "rectangle" and len(points) >= 4:
        x1, y1, x2, y2 = [int(v) for v in points[:4]]
        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
    elif shape == "polygon" and len(points) >= 6:
        polygon = [(int(points[i]), int(points[i + 1])) for i in range(0, len(points), 2)]
        cv2.polylines(frame, [polygon], True, (0, 255, 0), 2)


def save_zone():
    """Persist the selected entry zone to camera1.json."""
    if zone is None:
        print("No zone selected.")
        return False

    with open(ZONE_FILE, "w", encoding="utf-8") as zone_file:
        json.dump(zone, zone_file, indent=4)

    print("Zone saved successfully.")
    return True


def load_zone():
    """Load the Camera 1 zone saved by the dashboard."""
    global zone

    if not os.path.exists(ZONE_FILE):
        zone = None
        print("Camera 1 zone file not found.")
        return False

    try:
        with open(ZONE_FILE, "r", encoding="utf-8") as zone_file:
            data = json.load(zone_file)

        shape = data.get("shape")
        points = data.get("points", [])

        if shape == "circle" and len(points) >= 3:
            zone = {"shape": "circle", "points": [int(points[0]), int(points[1]), int(points[2])]}
            print("Camera 1 dashboard zone loaded.")
            return True

        if shape == "rectangle" and len(points) >= 4:
            zone = {"shape": "rectangle", "points": [int(v) for v in points[:4]]}
            print("Camera 1 dashboard zone loaded.")
            return True

        if shape == "polygon" and len(points) >= 6:
            zone = {"shape": "polygon", "points": [int(v) for v in points]}
            print("Camera 1 dashboard zone loaded.")
            return True

        print(f"Unsupported Camera 1 zone: {shape}")
        zone = None
        return False

    except (OSError, ValueError, TypeError, KeyError, json.JSONDecodeError) as error:
        zone = None
        print(f"Failed to load Camera 1 zone: {error}")
        return False


def zone_is_loaded():
    return zone is not None


def point_inside_zone(x, y):
    """Return True only when a bottom-center person point is inside the saved zone."""
    if zone is None:
        return False

    shape = _zone_shape(zone)
    points = _zone_points(zone)

    if shape == "circle" and len(points) >= 3:
        center_x, center_y, zone_radius = int(points[0]), int(points[1]), int(points[2])
        return (x - center_x) ** 2 + (y - center_y) ** 2 <= zone_radius ** 2

    if shape == "rectangle" and len(points) >= 4:
        x1, y1, x2, y2 = [int(v) for v in points[:4]]
        return x1 <= x <= x2 and y1 <= y <= y2

    if shape == "polygon" and len(points) >= 6:
        return _point_in_polygon((x, y), [int(v) for v in points])

    return False


def box_intersects_zone(x1, y1, x2, y2):
    """Trigger only when roughly 15% of the person has entered the zone."""
    if zone is None:
        return False

    shape = _zone_shape(zone)
    points = _zone_points(zone)

    if shape == "circle" and len(points) >= 3:
        center_x, center_y, zone_radius = int(points[0]), int(points[1]), int(points[2])
        foot_x = (x1 + x2) // 2
        person_height = y2 - y1
        foot_y = y2 - int(person_height * 0.15)
        return (foot_x - center_x) ** 2 + (foot_y - center_y) ** 2 <= zone_radius ** 2

    if shape == "rectangle" and len(points) >= 4:
        x1z, y1z, x2z, y2z = [int(v) for v in points[:4]]
        return (
            x1 <= x2z and x2 >= x1z and y1 <= y2z and y2 >= y1z
        )

    if shape == "polygon" and len(points) >= 6:
        polygon = [int(v) for v in points]
        poly_x = (x1 + x2) // 2
        poly_y = y2 - int((y2 - y1) * 0.15)
        return _point_in_polygon((poly_x, poly_y), polygon)

    return False
