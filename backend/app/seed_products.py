"""
Seed script -- populate default Medley & Sons Security product catalog.

Usage:
    from app.seed_products import seed_products
    await seed_products(db, org_id)
"""

import uuid

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product

PRODUCTS = [
    # Panels & Controllers
    {"name": "Alarm.com Smart Security Hub", "sku": "PNL-001", "category": "panel", "unit_cost": 120, "retail_price": 199},
    {"name": "Alarm.com ADC-T4000 Touchscreen", "sku": "PNL-002", "category": "panel", "unit_cost": 180, "retail_price": 299},

    # Sensors
    {"name": "Door/Window Sensor", "sku": "SEN-001", "category": "sensor", "unit_cost": 8, "retail_price": 25},
    {"name": "Motion Detector", "sku": "SEN-002", "category": "sensor", "unit_cost": 15, "retail_price": 40},
    {"name": "Glass Break Sensor", "sku": "SEN-003", "category": "sensor", "unit_cost": 18, "retail_price": 45},
    {"name": "Smoke/Heat Detector", "sku": "SEN-004", "category": "sensor", "unit_cost": 22, "retail_price": 55},
    {"name": "CO Detector", "sku": "SEN-005", "category": "sensor", "unit_cost": 22, "retail_price": 55},
    {"name": "Water/Flood Sensor", "sku": "SEN-006", "category": "sensor", "unit_cost": 12, "retail_price": 35},
    {"name": "Garage Door Tilt Sensor", "sku": "SEN-007", "category": "sensor", "unit_cost": 10, "retail_price": 30},

    # Cameras
    {"name": "Indoor Wi-Fi Camera", "sku": "CAM-001", "category": "camera", "unit_cost": 45, "retail_price": 99},
    {"name": "Outdoor Wi-Fi Camera", "sku": "CAM-002", "category": "camera", "unit_cost": 75, "retail_price": 149},
    {"name": "Video Doorbell Camera", "sku": "CAM-003", "category": "camera", "unit_cost": 85, "retail_price": 179},
    {"name": "4-Camera NVR System", "sku": "CAM-004", "category": "camera", "unit_cost": 350, "retail_price": 699},

    # Smart Home
    {"name": "Smart Door Lock (Z-Wave)", "sku": "SH-001", "category": "smart_home", "unit_cost": 80, "retail_price": 165},
    {"name": "Smart Thermostat", "sku": "SH-002", "category": "smart_home", "unit_cost": 65, "retail_price": 129},
    {"name": "Smart Light Switch", "sku": "SH-003", "category": "smart_home", "unit_cost": 18, "retail_price": 45},
    {"name": "Smart Garage Controller", "sku": "SH-004", "category": "smart_home", "unit_cost": 30, "retail_price": 65},

    # Services
    {"name": "Standard Installation (up to 8 zones)", "sku": "SVC-001", "category": "service", "unit_cost": 0, "retail_price": 199},
    {"name": "Extended Installation (9-16 zones)", "sku": "SVC-002", "category": "service", "unit_cost": 0, "retail_price": 349},
    {"name": "Camera Installation (per camera)", "sku": "SVC-003", "category": "service", "unit_cost": 0, "retail_price": 75},
    {"name": "System Takeover / Rewire", "sku": "SVC-004", "category": "service", "unit_cost": 0, "retail_price": 149},

    # Monitoring Plans (monthly)
    {"name": "Basic Monitoring (24/7 dispatch)", "sku": "MON-001", "category": "monitoring", "unit_cost": 8, "retail_price": 29.99},
    {"name": "Interactive Monitoring (app control + alerts)", "sku": "MON-002", "category": "monitoring", "unit_cost": 12, "retail_price": 39.99},
    {"name": "Video Monitoring (cameras + cloud storage)", "sku": "MON-003", "category": "monitoring", "unit_cost": 18, "retail_price": 49.99},
]


async def seed_products(db: AsyncSession, org_id: uuid.UUID) -> int:
    """
    Insert default products for an org if none exist yet.

    Returns the number of products inserted (0 if already seeded).
    """
    count_q = select(func.count()).select_from(
        select(Product.id)
        .where(Product.organization_id == org_id)
        .subquery()
    )
    existing = (await db.execute(count_q)).scalar_one()

    if existing > 0:
        return 0

    for item in PRODUCTS:
        product = Product(organization_id=org_id, **item)
        db.add(product)

    await db.flush()
    return len(PRODUCTS)
