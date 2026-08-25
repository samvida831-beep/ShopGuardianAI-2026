import json
import os

from database import (
    init_db,
    create_admin_user,
    Shop,
    CameraConfig,
    SavedZone,
    get_session,
)


def test_user_shop_camera_zone_relationships():
    init_db("sqlite:///:memory:")

    session = get_session()
    user = create_admin_user("user1", "hash", full_name="User One")

    shop = Shop(owner_id=user.id, shop_name="Test Shop", shop_type="Retail", address="101 Test Ave", city="Testville", state="TS", pin_code="12345")
    session.add(shop)
    session.commit()
    session.refresh(shop)

    camera = CameraConfig(shop_id=shop.id, camera_number=1, camera_name="Entrance", source="rtsp://demo", mode="demo", enabled=True)
    session.add(camera)
    session.commit()
    session.refresh(camera)

    zone = SavedZone(shop_id=shop.id, camera_number=1, shape="rectangle", points=json.dumps([10, 10, 200, 200]))
    session.add(zone)
    session.commit()
    session.refresh(zone)

    assert user.id == shop.owner_id
    assert shop.id == camera.shop_id
    assert shop.id == zone.shop_id
    assert camera.camera_number == 1
    assert zone.shape == "rectangle"

    session.close()
