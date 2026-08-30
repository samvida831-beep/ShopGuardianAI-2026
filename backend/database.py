import base64
import hashlib
import hmac
import json
import logging
import os
import secrets
import time
from datetime import datetime
from typing import Optional, List, Dict, Any

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
    inspect,
    text,
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker, synonym

Base = declarative_base()


class AdminUser(Base):
    __tablename__ = "admin_users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(150), nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(150), nullable=True)
    shopkeeper_type = Column(String(100), nullable=True)
    role = Column(String(50), default="admin")
    created_at = Column(DateTime, default=datetime.utcnow)

    shops = relationship("Shop", back_populates="owner")


class Shop(Base):
    __tablename__ = "shops"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("admin_users.id"), nullable=False)
    shop_name = Column(String(200), nullable=False, default="ShopGuardian")
    shop_type = Column(String(100), nullable=True)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    pin_code = Column(String(20), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("AdminUser", back_populates="shops")
    cameras = relationship("CameraConfig", back_populates="shop")
    zones = relationship("SavedZone", back_populates="shop")


class ShopDetails(Base):
    """Legacy table kept for backward compatibility."""
    __tablename__ = "shop_details"

    id = Column(Integer, primary_key=True, index=True)
    shop_name = Column(String(200), nullable=False, default="ShopGuardian")
    owner_name = Column(String(200), nullable=True)
    shop_type = Column(String(100), nullable=True)
    address = Column(Text, nullable=True)
    phone = Column(String(50), nullable=True)
    camera_count = Column(Integer, default=2)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CameraConfig(Base):
    __tablename__ = "camera_configs"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=True)
    camera_number = Column(Integer, nullable=False)
    name = Column(String(150), nullable=True)
    source = Column(String(255), nullable=True)
    ip_address = Column(String(100), nullable=True)
    port = Column(Integer, nullable=True)
    username = Column(String(100), nullable=True)
    password = Column(String(255), nullable=True)
    channel = Column(String(50), nullable=True)
    subtype = Column(String(50), nullable=True)
    mode = Column(String(50), default="demo")
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    shop = relationship("Shop", back_populates="cameras")
    camera_name = synonym("name")


class SavedZone(Base):
    __tablename__ = "saved_zones"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=True)
    camera_number = Column(Integer, nullable=False)
    shape = Column(String(50), nullable=False)
    points = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    shop = relationship("Shop", back_populates="zones")


class CustomerVisit(Base):
    __tablename__ = "customer_visits"

    id = Column(Integer, primary_key=True, index=True)
    camera_number = Column(Integer, nullable=False)
    event_type = Column(String(50), default="entry")
    snapshot_file = Column(String(255), nullable=True)
    customer_label = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class SnapshotRecord(Base):
    __tablename__ = "snapshots"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False, unique=True)
    camera_number = Column(Integer, nullable=True)
    event_type = Column(String(50), nullable=True)
    customer_label = Column(String(100), nullable=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AlertRecord(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    alert_type = Column(String(50), default="info")
    camera_number = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class SystemSetting(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False)
    value = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


ENGINE = None
SessionLocal = None


def get_db_url():
    default_db = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shopguardian.db")
    return os.getenv("SHOPGUARDIAN_DB_URL", f"sqlite:///{default_db}")


def _get_secret_key():
    return os.getenv("SHOPGUARDIAN_SECRET_KEY", "shopguardian-demo-secret").encode("utf-8")


def _hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 200_000)
    return f"pbkdf2_sha256$200000${base64.urlsafe_b64encode(salt).decode('utf-8')}${base64.urlsafe_b64encode(dk).decode('utf-8')}"


def _verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, iterations, salt_b64, digest_b64 = password_hash.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        salt = base64.urlsafe_b64decode(salt_b64.encode("utf-8"))
        expected_digest = base64.urlsafe_b64decode(digest_b64.encode("utf-8"))
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, int(iterations))
        return hmac.compare_digest(dk, expected_digest)
    except Exception:
        return False


def generate_auth_token(user_id: int, expires_in: int = 60 * 60 * 24 * 7) -> str:
    timestamp = str(int(time.time()))
    nonce = secrets.token_urlsafe(16)
    body = f"{user_id}:{timestamp}:{nonce}"
    signature = hmac.new(_get_secret_key(), body.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{body}:{signature}"


def verify_auth_token(token: str) -> Optional[int]:
    try:
        parts = token.split(":")
        if len(parts) != 4:
            return None
        user_id_str, timestamp_str, nonce, signature = parts
        body = f"{user_id_str}:{timestamp_str}:{nonce}"
        expected = hmac.new(_get_secret_key(), body.encode("utf-8"), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature):
            return None
        timestamp = int(timestamp_str)
        if time.time() - timestamp > 60 * 60 * 24 * 7:
            return None
        return int(user_id_str)
    except Exception:
        return None


def _sqlite_column_exists(engine, table_name: str, column_name: str) -> bool:
    inspector = inspect(engine)
    if not inspector.has_table(table_name):
        return False
    columns = inspector.get_columns(table_name)
    for col in columns:
        if isinstance(col, dict):
            if col.get("name") == column_name:
                return True
        elif len(col) > 1 and col[1] == column_name:
            return True
    return False


def _ensure_sqlite_column(engine, table_name: str, column_name: str, column_type: str, default: str = None):
    if engine.dialect.name != "sqlite":
        return
    if not _sqlite_column_exists(engine, table_name, column_name):
        default_clause = f" DEFAULT {default}" if default is not None else ""
        with engine.begin() as conn:
            conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}{default_clause}"))


def init_db(url: Optional[str] = None):
    global ENGINE, SessionLocal
    db_url = url or get_db_url()
    ENGINE = create_engine(db_url, connect_args={"check_same_thread": False} if db_url.startswith("sqlite") else {})
    SessionLocal = sessionmaker(bind=ENGINE, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=ENGINE)

    if os.getenv("SHOPGUARDIAN_SECRET_KEY") is None:
        logging.warning(
            "SHOPGUARDIAN_SECRET_KEY is not set. Using a demo default secret. "
            "Set a strong random value in production so auth tokens cannot be forged."
        )

    if ENGINE.dialect.name == "sqlite":
        _ensure_sqlite_column(ENGINE, "admin_users", "phone", "VARCHAR(50)")
        _ensure_sqlite_column(ENGINE, "admin_users", "email", "VARCHAR(150)")
        _ensure_sqlite_column(ENGINE, "admin_users", "shopkeeper_type", "VARCHAR(100)")
        _ensure_sqlite_column(ENGINE, "shops", "owner_id", "INTEGER")
        _ensure_sqlite_column(ENGINE, "shops", "shop_type", "VARCHAR(100)")
        _ensure_sqlite_column(ENGINE, "shops", "address", "TEXT")
        _ensure_sqlite_column(ENGINE, "shops", "city", "VARCHAR(100)")
        _ensure_sqlite_column(ENGINE, "shops", "state", "VARCHAR(100)")
        _ensure_sqlite_column(ENGINE, "shops", "pin_code", "VARCHAR(20)")
        _ensure_sqlite_column(ENGINE, "camera_configs", "shop_id", "INTEGER")
        _ensure_sqlite_column(ENGINE, "camera_configs", "camera_name", "VARCHAR(150)")
        _ensure_sqlite_column(ENGINE, "camera_configs", "ip_address", "VARCHAR(100)")
        _ensure_sqlite_column(ENGINE, "camera_configs", "port", "INTEGER")
        _ensure_sqlite_column(ENGINE, "camera_configs", "username", "VARCHAR(100)")
        _ensure_sqlite_column(ENGINE, "camera_configs", "password", "VARCHAR(255)")
        _ensure_sqlite_column(ENGINE, "camera_configs", "channel", "VARCHAR(50)")
        _ensure_sqlite_column(ENGINE, "camera_configs", "subtype", "VARCHAR(50)")
        _ensure_sqlite_column(ENGINE, "saved_zones", "shop_id", "INTEGER")
        _ensure_sqlite_column(ENGINE, "snapshots", "shop_id", "INTEGER")

    # Default admin account is created ONLY when explicitly enabled via env
    # (SEED_DEMO_ADMIN=true, default off). Fresh installs should use the
    # standard /api/auth/register flow instead of a built-in credential.
    if os.getenv("SEED_DEMO_ADMIN", "false").lower() == "true":
        with SessionLocal() as session:
            if session.query(AdminUser).count() == 0:
                session.add(
                    AdminUser(
                        username="admin",
                        password_hash=_hash_password("admin"),
                        full_name="Demo Admin",
                        role="admin",
                    )
                )
                session.commit()

    return ENGINE


def get_session():
    if SessionLocal is None:
        init_db()
    return SessionLocal()


# --- User Management ---

def get_admin_user_by_username(username: str) -> Optional[AdminUser]:
    session = get_session()
    user = session.query(AdminUser).filter(AdminUser.username == username).first()
    session.close()
    return user


def get_admin_user_by_id(user_id: int) -> Optional[AdminUser]:
    session = get_session()
    user = session.query(AdminUser).filter(AdminUser.id == user_id).first()
    session.close()
    return user


def create_admin_user(
    username: str,
    password: str,
    full_name: str = "",
    phone: str = "",
    email: str = "",
    shopkeeper_type: str = "",
) -> AdminUser:
    session = get_session()
    user = AdminUser(
        username=username,
        password_hash=_hash_password(password),
        full_name=full_name,
        phone=phone,
        email=email,
        shopkeeper_type=shopkeeper_type,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    session.close()
    return user


def update_admin_user(
    user_id: int,
    full_name: Optional[str] = None,
    phone: Optional[str] = None,
    email: Optional[str] = None,
    shopkeeper_type: Optional[str] = None,
) -> Optional[AdminUser]:
    session = get_session()
    user = session.query(AdminUser).filter(AdminUser.id == user_id).first()
    if not user:
        session.close()
        return None
    if full_name is not None:
        user.full_name = full_name
    if phone is not None:
        user.phone = phone
    if email is not None:
        user.email = email
    if shopkeeper_type is not None:
        user.shopkeeper_type = shopkeeper_type
    session.add(user)
    session.commit()
    session.refresh(user)
    session.close()
    return user


def authenticate_admin(username: str, password: str) -> Optional[AdminUser]:
    session = get_session()
    user = session.query(AdminUser).filter(AdminUser.username == username).first()
    session.close()
    if not user:
        return None
    return user if _verify_password(password, user.password_hash) else None


# --- Shop Management ---

def create_shop_for_owner(
    owner_id: int,
    shop_name: str,
    shop_type: str,
    address: str = "",
    city: str = "",
    state: str = "",
    pin_code: str = "",
) -> Shop:
    session = get_session()
    shop = session.query(Shop).filter(Shop.owner_id == owner_id).first()
    if shop:
        shop.shop_name = shop_name or shop.shop_name
        shop.shop_type = shop_type or shop.shop_type
        shop.address = address or shop.address
        shop.city = city or shop.city
        shop.state = state or shop.state
        shop.pin_code = pin_code or shop.pin_code
    else:
        shop = Shop(
            owner_id=owner_id,
            shop_name=shop_name,
            shop_type=shop_type,
            address=address,
            city=city,
            state=state,
            pin_code=pin_code,
        )
    session.add(shop)
    session.commit()
    session.refresh(shop)
    session.close()
    return shop


def get_shop_by_owner(owner_id: int) -> Optional[Shop]:
    session = get_session()
    shop = session.query(Shop).filter(Shop.owner_id == owner_id).first()
    session.close()
    return shop


def get_shop_by_id(shop_id: int) -> Optional[Shop]:
    session = get_session()
    shop = session.query(Shop).filter(Shop.id == shop_id).first()
    session.close()
    return shop


def upsert_shop_details(
    shop_name: str,
    owner_name: str,
    shop_type: str,
    address: str = "",
    phone: str = "",
    camera_count: int = 2,
) -> ShopDetails:
    session = get_session()
    details = session.query(ShopDetails).first()
    if not details:
        details = ShopDetails()
    details.shop_name = shop_name or details.shop_name or "ShopGuardian"
    details.owner_name = owner_name or details.owner_name or "Owner"
    details.shop_type = shop_type or details.shop_type or "General Retail"
    details.address = address or details.address or ""
    details.phone = phone or details.phone or ""
    details.camera_count = camera_count or details.camera_count or 2
    session.add(details)
    session.commit()
    session.refresh(details)
    session.close()
    return details


def get_shop_details() -> Optional[ShopDetails]:
    session = get_session()
    details = session.query(ShopDetails).first()
    session.close()
    return details


# --- Camera Management ---

def sanitize_camera_config_dict(config: CameraConfig) -> Dict[str, Any]:
    """Return camera details dictionary with passwords obscured for security."""
    return {
        "id": config.id,
        "shop_id": config.shop_id,
        "camera_number": config.camera_number,
        "name": config.name or f"Camera {config.camera_number}",
        "source": config.source or "",
        "ip_address": config.ip_address or "",
        "port": config.port or 554,
        "username": config.username or "",
        "has_password": bool(config.password),
        "channel": config.channel or "1",
        "subtype": config.subtype or "0",
        "mode": config.mode or "demo",
        "enabled": config.enabled if config.enabled is not None else True,
    }


def upsert_camera_config(
    shop_id: Optional[int],
    camera_number: int,
    camera_name: str = "",
    source: str = "",
    ip_address: str = "",
    port: int = 554,
    username: str = "",
    password: str = "",
    channel: str = "1",
    subtype: str = "0",
    mode: str = "demo",
    enabled: bool = True,
) -> CameraConfig:
    session = get_session()
    query = session.query(CameraConfig).filter(CameraConfig.camera_number == camera_number)
    if shop_id is not None:
        query = query.filter(CameraConfig.shop_id == shop_id)
    config = query.first()

    if not config:
        config = CameraConfig(shop_id=shop_id, camera_number=camera_number)

    config.name = camera_name or config.name or f"Camera {camera_number}"
    if source:
        config.source = source
    if ip_address:
        config.ip_address = ip_address
    if port:
        config.port = port
    if username:
        config.username = username
    config.password = password
    if channel:
        config.channel = channel
    if subtype:
        config.subtype = subtype
    config.mode = mode or config.mode or "demo"
    config.enabled = enabled

    session.add(config)
    session.commit()
    session.refresh(config)
    session.close()
    return config


def list_camera_configs(shop_id: Optional[int] = None) -> List[CameraConfig]:
    session = get_session()
    query = session.query(CameraConfig)
    if shop_id is not None:
        query = query.filter(CameraConfig.shop_id == shop_id)
    configs = query.order_by(CameraConfig.camera_number).all()
    session.close()
    return configs


def get_camera_config(camera_number: int, shop_id: Optional[int] = None) -> Optional[CameraConfig]:
    session = get_session()
    query = session.query(CameraConfig).filter(CameraConfig.camera_number == camera_number)
    if shop_id is not None:
        query = query.filter(CameraConfig.shop_id == shop_id)
    config = query.first()
    session.close()
    return config


def delete_camera_config(camera_number: int, shop_id: Optional[int] = None) -> Optional[CameraConfig]:
    session = get_session()
    query = session.query(CameraConfig).filter(CameraConfig.camera_number == camera_number)
    if shop_id is not None:
        query = query.filter(CameraConfig.shop_id == shop_id)
    config = query.first()
    if config:
        session.delete(config)
        session.commit()
    session.close()
    return config


# --- Zone Management ---

def save_zone(camera_number: int, shape: str, points: list) -> SavedZone:
    session = get_session()
    zone = session.query(SavedZone).filter(SavedZone.camera_number == camera_number).first()
    if not zone:
        zone = SavedZone(camera_number=camera_number)
    zone.shape = shape
    zone.points = json.dumps(points)
    session.add(zone)
    session.commit()
    session.refresh(zone)
    session.close()
    return zone


def save_zone_for_shop(shop_id: int, camera_number: int, shape: str, points: list) -> SavedZone:
    session = get_session()
    zone = session.query(SavedZone).filter(SavedZone.shop_id == shop_id, SavedZone.camera_number == camera_number).first()
    if not zone:
        zone = SavedZone(shop_id=shop_id, camera_number=camera_number)
    zone.shape = shape
    zone.points = json.dumps(points)
    session.add(zone)
    session.commit()
    session.refresh(zone)
    session.close()
    return zone


def load_zone(camera_number: int) -> Optional[dict]:
    session = get_session()
    zone = session.query(SavedZone).filter(SavedZone.camera_number == camera_number).first()
    session.close()
    if not zone:
        return None
    return {"shape": zone.shape, "points": json.loads(zone.points)}


def load_zone_for_shop(shop_id: int, camera_number: int) -> Optional[dict]:
    session = get_session()
    zone = session.query(SavedZone).filter(SavedZone.shop_id == shop_id, SavedZone.camera_number == camera_number).first()
    session.close()
    if not zone:
        return None
    return {"shape": zone.shape, "points": json.loads(zone.points)}


# --- Snapshots, Alerts, Visits, Settings ---

def add_snapshot(filename: str, camera_number: Optional[int] = None, event_type: Optional[str] = None, customer_label: Optional[str] = None, shop_id: Optional[int] = None) -> SnapshotRecord:
    session = get_session()
    snapshot = SnapshotRecord(filename=filename, camera_number=camera_number, event_type=event_type, customer_label=customer_label)
    if shop_id is not None:
        snapshot.shop_id = shop_id
    session.add(snapshot)
    session.commit()
    session.refresh(snapshot)
    session.close()
    return snapshot


def list_snapshots(limit: int = 50, shop_id: Optional[int] = None, camera_number: Optional[int] = None) -> List[dict]:
    session = get_session()
    query = session.query(SnapshotRecord)
    if shop_id is not None:
        query = query.filter(SnapshotRecord.shop_id == shop_id)
    if camera_number is not None:
        query = query.filter(SnapshotRecord.camera_number == camera_number)
    rows = query.order_by(SnapshotRecord.created_at.desc()).limit(limit).all()
    session.close()
    return [
        {
            "id": row.id,
            "filename": row.filename,
            "camera_number": row.camera_number,
            "event_type": row.event_type,
            "customer_label": row.customer_label,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in rows
    ]


def delete_snapshot(snapshot_id: int, shop_id: Optional[int] = None) -> Optional[SnapshotRecord]:
    session = get_session()
    query = session.query(SnapshotRecord).filter(SnapshotRecord.id == snapshot_id)
    if shop_id is not None:
        query = query.filter(SnapshotRecord.shop_id == shop_id)
    snapshot = query.first()
    if snapshot:
        session.delete(snapshot)
        session.commit()
    session.close()
    return snapshot


def delete_snapshot_by_filename(filename: str, shop_id: Optional[int] = None) -> bool:
    from sqlalchemy import or_
    session = get_session()
    query = session.query(SnapshotRecord).filter(SnapshotRecord.filename == filename)
    if shop_id is not None:
        # Match records belonging to this shop OR records with no shop_id (legacy/unassigned)
        query = query.filter(
            or_(SnapshotRecord.shop_id == shop_id, SnapshotRecord.shop_id == None)
        )
    records = query.all()
    deleted = False
    for rec in records:
        session.delete(rec)
        deleted = True
    if deleted:
        session.commit()
    session.close()
    return deleted


def add_alert(title: str, message: str, alert_type: str = "info", camera_number: Optional[int] = None) -> AlertRecord:
    session = get_session()
    alert = AlertRecord(title=title, message=message, alert_type=alert_type, camera_number=camera_number)
    session.add(alert)
    session.commit()
    session.refresh(alert)
    session.close()
    return alert


def list_alerts(limit: int = 50) -> List[dict]:
    session = get_session()
    rows = session.query(AlertRecord).order_by(AlertRecord.created_at.desc()).limit(limit).all()
    session.close()
    return [
        {
            "id": row.id,
            "title": row.title,
            "message": row.message,
            "alert_type": row.alert_type,
            "camera_number": row.camera_number,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in rows
    ]


def add_customer_visit(camera_number: int, snapshot_file: str = "", event_type: str = "entry", customer_label: str = "") -> CustomerVisit:
    session = get_session()
    visit = CustomerVisit(camera_number=camera_number, snapshot_file=snapshot_file, event_type=event_type, customer_label=customer_label)
    session.add(visit)
    session.commit()
    session.refresh(visit)
    session.close()
    return visit


def list_customer_visits(limit: int = 20) -> List[dict]:
    session = get_session()
    visits = session.query(CustomerVisit).order_by(CustomerVisit.created_at.desc()).limit(limit).all()
    session.close()
    return [
        {
            "id": visit.id,
            "camera_number": visit.camera_number,
            "event_type": visit.event_type,
            "snapshot_file": visit.snapshot_file,
            "customer_label": visit.customer_label,
            "created_at": visit.created_at.isoformat() if visit.created_at else None,
        }
        for visit in visits
    ]


def set_system_setting(key: str, value: str) -> SystemSetting:
    session = get_session()
    setting = session.query(SystemSetting).filter(SystemSetting.key == key).first()
    if not setting:
        setting = SystemSetting(key=key)
    setting.value = value
    session.add(setting)
    session.commit()
    session.refresh(setting)
    session.close()
    return setting


def get_system_setting(key: str, default: str = "") -> str:
    session = get_session()
    setting = session.query(SystemSetting).filter(SystemSetting.key == key).first()
    session.close()
    return setting.value if setting else default


def get_all_settings() -> Dict[str, str]:
    session = get_session()
    rows = session.query(SystemSetting).all()
    session.close()
    return {row.key: row.value for row in rows}
