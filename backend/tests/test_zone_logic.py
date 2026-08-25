import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from Utils import zone_selector, inside_zone_selector


def test_polygon_zone_contains_point():
    zone_selector.zone = {
        "shape": "polygon",
        "points": [200, 200, 600, 180, 800, 500, 300, 700],
    }

    assert zone_selector.point_inside_zone(400, 300) is True
    assert zone_selector.point_inside_zone(100, 100) is False


def test_rectangle_zone_contains_box_intersection():
    inside_zone_selector.zone = {
        "shape": "rectangle",
        "points": [100, 100, 300, 300],
    }

    assert inside_zone_selector.box_intersects_zone(50, 50, 180, 180) is True
    assert inside_zone_selector.box_intersects_zone(400, 400, 500, 500) is False
