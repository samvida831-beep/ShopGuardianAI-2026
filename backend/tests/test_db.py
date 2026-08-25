import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import init_db, upsert_shop_details, add_customer_visit, list_customer_visits


def test_shop_and_customer_persistence():
    init_db("sqlite:///:memory:")

    shop = upsert_shop_details(
        shop_name="Demo Shop",
        owner_name="Asha",
        shop_type="Grocery Store",
        address="123 Main Street",
        phone="555-0100",
        camera_count=2,
    )

    assert shop.shop_name == "Demo Shop"
    assert shop.shop_type == "Grocery Store"

    visit = add_customer_visit(
        camera_number=2,
        snapshot_file="demo.jpg",
        event_type="entry",
        customer_label="Customer 1",
    )

    visits = list_customer_visits(limit=5)
    assert len(visits) == 1
    assert visits[0]["camera_number"] == 2
    assert visits[0]["snapshot_file"] == "demo.jpg"
