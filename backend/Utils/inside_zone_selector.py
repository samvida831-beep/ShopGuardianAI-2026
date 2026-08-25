import json
import os

import cv2

from Utils.config import INSIDE_ZONE_FILE


drawing = False
start_point = None
end_point = None
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


def _normalize_zone_data(data):
    """Normalize dashboard and legacy zone representations."""
    if isinstance(data, dict):
        return data

    if isinstance(data, list):
        if len(data) == 4 and all(isinstance(value, (int, float)) for value in data):
            return {"shape": "rectangle", "points": [int(value) for value in data]}

        if len(data) == 1 and isinstance(data[0], dict):
            return data[0]

    return None


def mouse_callback(event, x, y, flags, param):
    """Create a Camera 2 rectangle by clicking and dragging."""
    global drawing, start_point, end_point, zone

    if event == cv2.EVENT_LBUTTONDOWN:
        drawing = True
        start_point = (x, y)
        end_point = (x, y)

    elif event == cv2.EVENT_MOUSEMOVE and drawing:
        end_point = (x, y)

    elif event == cv2.EVENT_LBUTTONUP and drawing:
        drawing = False
        end_point = (x, y)

        x1, y1 = start_point
        x2, y2 = end_point

        zone = (
            min(x1, x2),
            min(y1, y2),
            max(x1, x2),
            max(y1, y2),
        )

        print("Camera 2 zone selected. Press I to save it.")


def draw_zone(frame):
    """Draw the in-progress rectangle and saved Camera 2 zone."""

    if drawing and start_point is not None and end_point is not None:
        cv2.rectangle(
            frame,
            start_point,
            end_point,
            (0, 255, 255),
            2,
        )

    if zone is None:
        return

    shape = _zone_shape(zone)
    points = _zone_points(zone)

    if shape == "rectangle" and len(points) >= 4:
        x1, y1, x2, y2 = [int(v) for v in points[:4]]
        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
        cv2.putText(frame, "CAMERA 2 ZONE", (x1, max(25, y1 - 10)), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
    elif shape == "polygon" and len(points) >= 6:
        polygon = [(int(points[i]), int(points[i + 1])) for i in range(0, len(points), 2)]
        cv2.polylines(frame, [polygon], True, (0, 255, 0), 2)


def save_zone():
    """Save Camera 2 zone using the dashboard-compatible format."""

    if zone is None:
        print("No Camera 2 zone selected.")
        return False

    with open(INSIDE_ZONE_FILE, "w", encoding="utf-8") as zone_file:
        json.dump(zone, zone_file, indent=4)

    print("Camera 2 zone saved successfully.")
    return True


def load_zone():
    """Load the Camera 2 zone saved by the dashboard."""

    global zone

    if not os.path.exists(INSIDE_ZONE_FILE):
        zone = None
        print("Camera 2 zone file not found.")
        return False

    try:
        with open(INSIDE_ZONE_FILE, "r", encoding="utf-8") as zone_file:
            data = json.load(zone_file)

        normalized_zone = _normalize_zone_data(data)
        if normalized_zone is None:
            print(f"Unsupported Camera 2 zone data format: {type(data).__name__}")
            zone = None
            return False

        shape = normalized_zone.get("shape")
        points = normalized_zone.get("points", [])

        if shape == "rectangle" and len(points) >= 4:
            x1 = int(points[0])
            y1 = int(points[1])
            x2 = int(points[2])
            y2 = int(points[3])
            zone = {"shape": "rectangle", "points": [min(x1, x2), min(y1, y2), max(x1, x2), max(y1, y2)]}
            print("Camera 2 dashboard zone loaded.")
            return True

        if shape == "polygon" and len(points) >= 6:
            zone = {"shape": "polygon", "points": [int(v) for v in points]}
            print("Camera 2 dashboard zone loaded.")
            return True

        print(f"Unsupported Camera 2 zone: {shape}")
        zone = None
        return False

    except (OSError, ValueError, TypeError, KeyError, json.JSONDecodeError) as error:
        zone = None
        print(f"Failed to load Camera 2 zone: {error}")
        return False


def zone_is_loaded():
    return zone is not None


def point_inside_zone(x, y):
    """Return True when a point is inside the Camera 2 zone."""

    if zone is None:
        return False

    shape = _zone_shape(zone)
    points = _zone_points(zone)

    if shape == "rectangle" and len(points) >= 4:
        x1, y1, x2, y2 = [int(v) for v in points[:4]]
        return x1 <= x <= x2 and y1 <= y <= y2

    if shape == "polygon" and len(points) >= 6:
        return _point_in_polygon((x, y), [int(v) for v in points])

    return False


def box_intersects_zone(x1, y1, x2, y2):
    """Return True when a person box overlaps the Camera 2 zone."""

    if zone is None:
        return False

    shape = _zone_shape(zone)
    points = _zone_points(zone)

    if shape == "rectangle" and len(points) >= 4:
        zone_x1, zone_y1, zone_x2, zone_y2 = [int(v) for v in points[:4]]
        return (
            x1 <= zone_x2
            and x2 >= zone_x1
            and y1 <= zone_y2
            and y2 >= zone_y1
        )

    if shape == "polygon" and len(points) >= 6:
        polygon = [int(v) for v in points]
        center_x = (x1 + x2) // 2
        center_y = y2 - int((y2 - y1) * 0.15)
        return _point_in_polygon((center_x, center_y), polygon)

    return False
