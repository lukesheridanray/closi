"""
Seed script for CLOSI CRM.

Populates the database with realistic home security dealer data.
Run with: python seed.py

Requires a running PostgreSQL instance with the initial schema migrated.
"""

import os
import uuid
import random
from datetime import datetime, timedelta

from dotenv import load_dotenv
from passlib.context import CryptContext
from sqlalchemy import (
    create_engine,
    Column,
    String,
    Boolean,
    DateTime,
    Float,
    Integer,
    Text,
    ForeignKey,
    text,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Session, DeclarativeBase

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL_SYNC", "postgresql://closi:closi@localhost:5433/closi"
)

engine = create_engine(DATABASE_URL, echo=False)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ---------------------------------------------------------------------------
# Base & table definitions (mirrors future model files)
# ---------------------------------------------------------------------------

class Base(DeclarativeBase):
    pass


class Organization(Base):
    __tablename__ = "organizations"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(50))
    address_line1 = Column(String(255))
    address_line2 = Column(String(255))
    city = Column(String(100))
    state = Column(String(50))
    zip = Column(String(20))
    logo_url = Column(String(500))
    timezone = Column(String(50), default="America/Chicago")
    currency = Column(String(10), default="usd")
    plan = Column(String(50), default="free")
    settings = Column(JSONB, default=dict)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)


class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    phone = Column(String(50))
    role = Column(String(50), nullable=False, default="sales_rep")
    avatar_url = Column(String(500))
    is_active = Column(Boolean, default=True)
    refresh_token = Column(String(500))
    last_login_at = Column(DateTime)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)


# --- New tables (created by this script) ---

class Contact(Base):
    __tablename__ = "contacts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255))
    phone = Column(String(50))
    company = Column(String(255))
    address_line1 = Column(String(255))
    city = Column(String(100))
    state = Column(String(50))
    zip = Column(String(20))
    lead_source = Column(String(50))
    status = Column(String(50), default="new")
    property_type = Column(String(50))
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    tags = Column(JSONB, default=list)
    notes = Column(Text)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)


class Pipeline(Base):
    __tablename__ = "pipelines"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    is_default = Column(Boolean, default=True)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)


class PipelineStage(Base):
    __tablename__ = "pipeline_stages"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pipeline_id = Column(UUID(as_uuid=True), ForeignKey("pipelines.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    color = Column(String(20), nullable=False)
    position = Column(Integer, nullable=False)
    is_won = Column(Boolean, default=False)
    is_lost = Column(Boolean, default=False)
    stale_days = Column(Integer, default=7)
    created_at = Column(DateTime, nullable=False)


class Deal(Base):
    __tablename__ = "deals"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    pipeline_id = Column(UUID(as_uuid=True), ForeignKey("pipelines.id"), nullable=False)
    stage_id = Column(UUID(as_uuid=True), ForeignKey("pipeline_stages.id"), nullable=False)
    contact_id = Column(UUID(as_uuid=True), ForeignKey("contacts.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    value = Column(Float, nullable=False, default=0)
    probability = Column(Integer, default=0)
    expected_close_date = Column(DateTime)
    source = Column(String(100))
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    notes = Column(Text)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)


class StageHistory(Base):
    __tablename__ = "stage_history"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    deal_id = Column(UUID(as_uuid=True), ForeignKey("deals.id", ondelete="CASCADE"), nullable=False, index=True)
    from_stage_id = Column(UUID(as_uuid=True), ForeignKey("pipeline_stages.id"), nullable=True)
    to_stage_id = Column(UUID(as_uuid=True), ForeignKey("pipeline_stages.id"), nullable=False)
    moved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    moved_at = Column(DateTime, nullable=False)


class Task(Base):
    __tablename__ = "tasks"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    contact_id = Column(UUID(as_uuid=True), ForeignKey("contacts.id"), nullable=True)
    deal_id = Column(UUID(as_uuid=True), ForeignKey("deals.id"), nullable=True)
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    type = Column(String(50), nullable=False)
    priority = Column(String(20), default="medium")
    status = Column(String(20), default="pending")
    due_date = Column(DateTime)
    completed_at = Column(DateTime)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)


class Contract(Base):
    __tablename__ = "contracts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    contact_id = Column(UUID(as_uuid=True), ForeignKey("contacts.id"), nullable=False)
    deal_id = Column(UUID(as_uuid=True), ForeignKey("deals.id"), nullable=True)
    contract_number = Column(String(50), unique=True, nullable=False)
    title = Column(String(255), nullable=False)
    monthly_amount = Column(Float, nullable=False)
    term_months = Column(Integer, nullable=False)
    total_value = Column(Float, nullable=False)
    status = Column(String(50), default="active")
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    signed_at = Column(DateTime)
    cancelled_at = Column(DateTime)
    cancellation_reason = Column(Text)
    stripe_customer_id = Column(String(255))
    stripe_subscription_id = Column(String(255))
    notes = Column(Text)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)


class Activity(Base):
    __tablename__ = "activities"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    contact_id = Column(UUID(as_uuid=True), ForeignKey("contacts.id"), nullable=False, index=True)
    deal_id = Column(UUID(as_uuid=True), ForeignKey("deals.id"), nullable=True)
    type = Column(String(50), nullable=False)
    subject = Column(String(255), nullable=False)
    description = Column(Text)
    performed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    performed_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, nullable=False)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

NOW = datetime.utcnow()

def ago(days: int, hours: int = 0) -> datetime:
    return NOW - timedelta(days=days, hours=hours)

def uid() -> uuid.UUID:
    return uuid.uuid4()

def pick(lst):
    return random.choice(lst)

# ---------------------------------------------------------------------------
# Seed data
# ---------------------------------------------------------------------------

def seed():
    # Create new tables (organizations & users already exist from migration)
    new_tables = [
        Contact.__table__,
        Pipeline.__table__,
        PipelineStage.__table__,
        Deal.__table__,
        StageHistory.__table__,
        Task.__table__,
        Contract.__table__,
        Activity.__table__,
    ]
    for table in new_tables:
        table.create(engine, checkfirst=True)

    with Session(engine) as db:
        # Clean existing seed data (reverse FK order)
        for tbl in ["activities", "stage_history", "tasks", "contracts", "deals",
                     "pipeline_stages", "pipelines", "contacts", "users", "organizations"]:
            db.execute(text(f"DELETE FROM {tbl}"))
        db.commit()

        # ── Organization ──────────────────────────────────
        org_id = uid()
        org = Organization(
            id=org_id,
            name="Shield Home Security LLC",
            slug="shield-home-security",
            email="office@shieldhomesecurity.com",
            phone="(214) 555-0100",
            address_line1="4200 Commerce Street, Suite 300",
            city="Dallas",
            state="TX",
            zip="75201",
            timezone="America/Chicago",
            currency="usd",
            plan="professional",
            is_active=True,
            created_at=ago(180),
            updated_at=ago(1),
        )
        db.add(org)
        db.flush()

        # ── Users (5) ────────────────────────────────────
        pw = pwd_context.hash("Password1!")

        marcus_id = uid()
        danielle_id = uid()
        jake_id = uid()
        priya_id = uid()
        carlos_id = uid()

        users_data = [
            User(id=marcus_id, organization_id=org_id, email="marcus@shieldhomesecurity.com", password_hash=pw, first_name="Marcus", last_name="Reed", phone="(214) 555-0101", role="owner", is_active=True, created_at=ago(180), updated_at=ago(1)),
            User(id=danielle_id, organization_id=org_id, email="danielle@shieldhomesecurity.com", password_hash=pw, first_name="Danielle", last_name="Hayes", phone="(214) 555-0102", role="admin", is_active=True, created_at=ago(170), updated_at=ago(1)),
            User(id=jake_id, organization_id=org_id, email="jake@shieldhomesecurity.com", password_hash=pw, first_name="Jake", last_name="Thornton", phone="(214) 555-0103", role="sales_rep", is_active=True, created_at=ago(160), updated_at=ago(1)),
            User(id=priya_id, organization_id=org_id, email="priya@shieldhomesecurity.com", password_hash=pw, first_name="Priya", last_name="Kapoor", phone="(214) 555-0104", role="sales_rep", is_active=True, created_at=ago(155), updated_at=ago(1)),
            User(id=carlos_id, organization_id=org_id, email="carlos@shieldhomesecurity.com", password_hash=pw, first_name="Carlos", last_name="Mendez", phone="(214) 555-0105", role="technician", is_active=True, created_at=ago(150), updated_at=ago(1)),
        ]
        db.add_all(users_data)
        db.flush()

        reps = [jake_id, priya_id]

        # ── Pipeline & Stages ─────────────────────────────
        pipeline_id = uid()
        db.add(Pipeline(
            id=pipeline_id, organization_id=org_id, name="Sales Pipeline",
            is_default=True, created_at=ago(180), updated_at=ago(180),
        ))
        db.flush()

        stage_ids = {}
        stages_data = [
            ("New Lead",                "#6C63FF", 0, False, False, 3),
            ("Contacted",               "#3B82F6", 1, False, False, 5),
            ("Site Survey Scheduled",   "#8B5CF6", 2, False, False, 7),
            ("Site Survey Complete",    "#A855F7", 3, False, False, 5),
            ("Quote Sent",              "#F59E0B", 4, False, False, 7),
            ("Negotiation",             "#F97316", 5, False, False, 10),
            ("Install Scheduled",       "#22C55E", 6, False, False, 14),
            ("Installed",               "#14B8A6", 7, False, False, 7),
            ("Contract Signed",         "#10B981", 8, True,  False, 30),
            ("Lost",                    "#EF4444", 9, False, True,  30),
        ]
        for name, color, pos, is_won, is_lost, stale in stages_data:
            sid = uid()
            stage_ids[name] = sid
            db.add(PipelineStage(
                id=sid, pipeline_id=pipeline_id, name=name, color=color,
                position=pos, is_won=is_won, is_lost=is_lost,
                stale_days=stale, created_at=ago(180),
            ))
        db.flush()

        # ── Contacts (30) ────────────────────────────────
        contact_records = [
            # name, email, phone, company, addr, city, state, zip, source, status, property, tags, notes
            ("James", "Wilson", "james.wilson@email.com", "(972) 555-1001", None, "742 Evergreen Terrace", "Plano", "TX", "75023", "google_ads", "customer", "single_family", ["monitoring", "cameras"], "Long-term customer. Pro package with 6 cameras."),
            ("Maria", "Garcia", "maria.garcia@email.com", "(469) 555-1002", None, "1234 Oak Street", "Frisco", "TX", "75034", "referral", "customer", "single_family", ["monitoring"], "Referred by James Wilson. Basic monitoring package."),
            ("Robert", "Chen", "robert.chen@techcorp.com", "(214) 555-1003", "TechCorp Inc.", "500 Innovation Drive", "Dallas", "TX", "75201", "website", "active", "commercial", ["commercial", "access-control"], "Commercial office - needs keycard access + 8 cameras."),
            ("Sarah", "Thompson", "sarah.t@email.com", "(817) 555-1004", None, "88 Maple Avenue", "Fort Worth", "TX", "76102", "google_ads", "active", "single_family", ["smart-home"], "Interested in smart locks and doorbell camera."),
            ("Michael", "Johnson", "mjohnson@email.com", "(972) 555-1005", "Johnson & Sons HVAC", "312 Pine Road", "Richardson", "TX", "75080", "referral", "active", "commercial", ["multi-location"], "Multi-location business. 3 sites need alarm systems."),
            ("Emily", "Davis", "emily.d@email.com", "(469) 555-1006", None, "1567 Cedar Lane", "McKinney", "TX", "75069", "facebook", "active", "single_family", ["cameras"], "Outdoor camera system, worried about package theft."),
            ("David", "Martinez", "david.m@email.com", "(214) 555-1007", "Martinez Properties", "445 Birch Street", "Irving", "TX", "75060", "website", "customer", "single_family", ["monitoring", "rental"], "Rental property monitoring. 3 properties."),
            ("Jennifer", "Lee", "jlee@email.com", "(817) 555-1008", None, "789 Willow Way", "Arlington", "TX", "76010", "google_ads", "active", "condo", [], "Condo - basic alarm + doorbell cam."),
            ("Andrew", "Brown", "andrew.b@email.com", "(972) 555-1009", "Brown Construction", "2100 Elm Boulevard", "Garland", "TX", "75040", "walk_in", "active", "commercial", ["commercial", "temporary"], "Construction site security. Temporary 6-month install."),
            ("Lisa", "Anderson", "lisa.a@email.com", "(469) 555-1010", None, "33 Spruce Court", "Allen", "TX", "75002", "referral", "customer", "single_family", ["full-package", "monitoring"], "Full home security: alarm, 4 cameras, smart locks, monitoring."),
            ("Kevin", "Patel", "kevin.patel@email.com", "(214) 555-1011", "Patel Medical Group", "900 Health Parkway", "Dallas", "TX", "75230", "google_ads", "new", "commercial", ["commercial", "medical"], "Medical office. HIPAA compliance requirements for security."),
            ("Rachel", "Kim", "rachel.kim@email.com", "(972) 555-1012", None, "2204 Sunset Blvd", "Plano", "TX", "75024", "facebook", "new", "apartment", [], "Apartment - smart lock + interior camera."),
            ("Thomas", "Wright", "twright@email.com", "(817) 555-1013", "Wright Auto Group", "1050 Motor Mile", "Fort Worth", "TX", "76108", "walk_in", "active", "commercial", ["commercial", "auto"], "Auto dealership lot. Perimeter cameras + alarm."),
            ("Amanda", "Foster", "amanda.foster@email.com", "(469) 555-1014", None, "678 Lakeside Drive", "Prosper", "TX", "75078", "referral", "customer", "single_family", ["monitoring", "vip"], "VIP customer. Premium Protection package."),
            ("Carlos", "Rivera", "carlos.r@email.com", "(214) 555-1015", "Rivera Restaurant Group", "345 Main Street", "Dallas", "TX", "75202", "website", "inactive", "commercial", ["commercial", "restaurant"], "Paused project. May resume Q2."),
            ("Brittany", "Nguyen", "brittany.n@email.com", "(972) 555-1016", None, "410 Harvest Lane", "Murphy", "TX", "75094", "google_ads", "new", "single_family", ["cameras"], "Google Ads lead. Interested in exterior cameras."),
            ("Derek", "Coleman", "derek.coleman@email.com", "(469) 555-1017", None, "82 Ridgewood Drive", "Wylie", "TX", "75098", "facebook", "active", "townhouse", ["smart-home"], "Townhouse. Wants doorbell cam and smart lock."),
            ("Stephanie", "Morris", "stephanie.m@email.com", "(817) 555-1018", None, "1200 Oakmont Circle", "Southlake", "TX", "76092", "referral", "active", "single_family", ["full-package"], "Large home, 6,000 sq ft. Needs comprehensive coverage."),
            ("Frank", "Patterson", "frank.p@email.com", "(214) 555-1019", "Patterson Law Firm", "700 Commerce Tower", "Dallas", "TX", "75201", "website", "active", "commercial", ["commercial", "access-control"], "Law firm. Access control for server room + 4 cameras."),
            ("Angela", "Simmons", "angela.s@email.com", "(972) 555-1020", None, "55 Magnolia Court", "Lucas", "TX", "75002", "google_ads", "new", "single_family", [], "New build. Wants security pre-wired during construction."),
            ("Raymond", "Tucker", "ray.tucker@email.com", "(469) 555-1021", None, "320 Pecan Street", "Celina", "TX", "75009", "walk_in", "active", "single_family", ["cameras", "monitoring"], "Walk-in. Saw our truck in the neighborhood."),
            ("Nicole", "Barnes", "nicole.b@email.com", "(817) 555-1022", None, "1450 Sycamore Lane", "Keller", "TX", "76248", "referral", "active", "single_family", ["smart-home"], "Referred by Amanda Foster. Interested in smart home."),
            ("Greg", "Henderson", "greg.h@email.com", "(214) 555-1023", "Henderson Dental", "300 Medical Drive", "Plano", "TX", "75075", "google_ads", "active", "commercial", ["commercial", "medical"], "Dental office. Camera system + after-hours alarm."),
            ("Michelle", "Cooper", "michelle.c@email.com", "(972) 555-1024", None, "2800 Bluebonnet Trail", "Sachse", "TX", "75048", "facebook", "new", "single_family", [], "Facebook ad lead. Recent break-in on her street."),
            ("Brandon", "Russell", "brandon.r@email.com", "(469) 555-1025", "Russell Fitness", "180 Gym Way", "Frisco", "TX", "75033", "website", "active", "commercial", ["commercial"], "Gym - after-hours alarm + entrance camera."),
            ("Tina", "Price", "tina.price@email.com", "(817) 555-1026", None, "625 Hillcrest Road", "Colleyville", "TX", "76034", "referral", "customer", "single_family", ["monitoring", "cameras"], "Premium Protection with 8 cameras. 48-month contract."),
            ("Victor", "Ramirez", "victor.r@email.com", "(214) 555-1027", "Ramirez Landscaping", "4100 Industrial Blvd", "Dallas", "TX", "75207", "walk_in", "active", "commercial", ["commercial", "yard"], "Equipment yard security. Perimeter sensors + cameras."),
            ("Heather", "Murphy", "heather.m@email.com", "(972) 555-1028", None, "1900 Cottonwood Drive", "Rowlett", "TX", "75088", "google_ads", "new", "single_family", ["smart-home"], "Google lead. Smart home starter package inquiry."),
            ("Jason", "Bell", "jason.bell@email.com", "(469) 555-1029", None, "740 Creekview Lane", "Rockwall", "TX", "75087", "facebook", "active", "single_family", ["cameras"], "Lakefront property. Dock cameras + standard package."),
            ("Diana", "Ward", "diana.ward@email.com", "(817) 555-1030", None, "50 Garden Gate", "Mansfield", "TX", "76063", "referral", "active", "single_family", [], "Elderly mother's home. Simple alarm with medical alert."),
        ]

        contact_ids = []
        for fn, ln, email, phone, company, addr, city, state, zp, src, status, prop, tags, notes in contact_records:
            cid = uid()
            contact_ids.append(cid)
            rep = pick(reps)
            days_created = random.randint(5, 90)
            db.add(Contact(
                id=cid, organization_id=org_id, first_name=fn, last_name=ln,
                email=email, phone=phone, company=company, address_line1=addr,
                city=city, state=state, zip=zp, lead_source=src, status=status,
                property_type=prop, assigned_to=rep, tags=tags, notes=notes,
                created_at=ago(days_created), updated_at=ago(random.randint(0, days_created)),
            ))
        db.flush()

        # ── Deals (20) ───────────────────────────────────
        deal_templates = [
            # (contact_idx, title, value, stage, prob, days_ago_created, source, notes)
            (0,  "Wilson - Smart Home Starter",         1800, "Contract Signed",       100, 58, "google_ads",   "Equipment: panel, 2 door sensors, motion, key fob. $39.99/mo monitoring."),
            (1,  "Garcia - Basic Monitoring Package",   1500, "Contract Signed",       100, 52, "referral",     "Entry-level package. Panel + 3 sensors. $29.99/mo."),
            (2,  "TechCorp - Commercial Access Control",4800, "Quote Sent",             55, 40, "website",      "8 cameras, 2 keycard readers, commercial panel. $59.99/mo."),
            (3,  "Thompson - Smart Home Bundle",        2400, "Site Survey Scheduled",  30, 18, "google_ads",   "Smart locks (2), doorbell cam, 2 window sensors."),
            (4,  "Johnson HVAC - Multi-Site Alarm",     5000, "Negotiation",            65, 35, "referral",     "3 locations. Basic alarm per site. Volume discount discussed."),
            (5,  "Davis - Exterior Camera Package",     2200, "Contacted",              20, 12, "facebook",     "4 outdoor cameras with night vision, NVR, app access."),
            (6,  "Martinez - Rental Monitoring",        3600, "Contract Signed",       100, 70, "website",      "3 rental properties. Basic monitoring each. $44.99/mo total."),
            (7,  "Lee - Condo Essential",               1500, "Site Survey Complete",   40, 22, "google_ads",   "Doorbell cam, 2 door sensors, glass break detector."),
            (8,  "Brown Construction - Temp Site Security", 3200, "Install Scheduled",  80, 30, "walk_in",      "6-month temp install. 4 cameras + motion-activated lights."),
            (9,  "Anderson - Premium Protection",       4200, "Contract Signed",       100, 65, "referral",     "Full package: 4 cameras, smart locks, panel, monitoring. $54.99/mo."),
            (10, "Patel Medical - Office Security",     4500, "New Lead",               10,  4, "google_ads",   "Medical office security inquiry. HIPAA-compliant access logging needed."),
            (11, "Kim - Apartment Smart Lock",          1200, "New Lead",               10,  2, "facebook",     "Single smart lock + interior cam. Budget-conscious."),
            (12, "Wright Auto - Lot Cameras",           4800, "Installed",              90, 45, "walk_in",      "16 exterior cameras covering lot, showroom entrance, service bays."),
            (13, "Foster - Premium Protection Plus",    3800, "Contract Signed",       100, 80, "referral",     "Premium package + garage sensor + smoke detectors. $49.99/mo."),
            (14, "Rivera Restaurant - Hold",            3500, "Lost",                    0, 50, "website",      "Project paused due to renovation delays. May re-engage Q2."),
            (15, "Nguyen - Camera Package",             2000, "New Lead",               10,  3, "google_ads",   "Exterior camera inquiry from Google Ads. Awaiting callback."),
            (16, "Coleman - Townhouse Smart Home",      1800, "Contacted",              20, 10, "facebook",     "Doorbell cam, smart lock, 2 sensors. Townhouse HOA restrictions noted."),
            (17, "Morris - Estate Security",            5200, "Quote Sent",             50, 28, "referral",     "6,000 sq ft home. 8 cameras, panel, smart locks, full monitoring. $59.99/mo."),
            (18, "Patterson Law - Access Control",      3800, "Site Survey Scheduled",  35, 15, "website",      "Server room access control. 4 cameras. After-hours alarm."),
            (19, "Simmons - New Construction Pre-Wire", 2800, "New Lead",               10,  1, "google_ads",   "New build. Wants pre-wire for security during construction phase."),
        ]

        deal_ids = []
        deal_contact_map = {}
        deal_stage_map = {}
        deal_rep_map = {}

        for ci, title, value, stage_name, prob, days_created, source, notes in deal_templates:
            did = uid()
            deal_ids.append(did)
            contact_id = contact_ids[ci]
            stage_id = stage_ids[stage_name]
            rep = pick(reps)
            deal_contact_map[did] = contact_id
            deal_stage_map[did] = stage_name
            deal_rep_map[did] = rep

            exp_close = None
            if stage_name not in ("Contract Signed", "Lost"):
                exp_close = NOW + timedelta(days=random.randint(10, 45))

            db.add(Deal(
                id=did, organization_id=org_id, pipeline_id=pipeline_id,
                stage_id=stage_id, contact_id=contact_id, title=title,
                value=value, probability=prob, expected_close_date=exp_close,
                source=source, assigned_to=rep, notes=notes,
                created_at=ago(days_created), updated_at=ago(random.randint(0, min(days_created, 5))),
            ))
        db.flush()

        # ── Stage History (realistic progression over 60 days) ──
        stage_order = [
            "New Lead", "Contacted", "Site Survey Scheduled", "Site Survey Complete",
            "Quote Sent", "Negotiation", "Install Scheduled", "Installed", "Contract Signed",
        ]

        for i, did in enumerate(deal_ids):
            stage_name = deal_stage_map[did]
            rep = deal_rep_map[did]
            _, _, _, _, _, days_created, _, _ = deal_templates[i]

            if stage_name == "Lost":
                # Lost deals: went through a few stages then lost
                path = stage_order[:random.randint(2, 5)] + ["Lost"]
            elif stage_name in stage_order:
                target_idx = stage_order.index(stage_name)
                path = stage_order[:target_idx + 1]
            else:
                path = ["New Lead"]

            # Distribute transitions across the time window
            if len(path) <= 1:
                intervals = [0]
            else:
                total_days = days_created
                intervals = sorted(random.sample(range(1, max(total_days, len(path) + 1)), min(len(path) - 1, max(total_days - 1, 1))))
                intervals = [0] + intervals

            prev_stage = None
            for j, sname in enumerate(path):
                day_offset = intervals[j] if j < len(intervals) else intervals[-1] + j
                db.add(StageHistory(
                    id=uid(), deal_id=did,
                    from_stage_id=stage_ids.get(prev_stage),
                    to_stage_id=stage_ids[sname],
                    moved_by=rep,
                    moved_at=ago(days_created - day_offset),
                ))
                prev_stage = sname
        db.flush()

        # ── Tasks (15) ───────────────────────────────────
        tasks_data = [
            # (contact_idx, deal_idx, title, desc, type, priority, status, due_days_from_now, completed)
            (3,  3,  "Schedule site survey - Thompson",         "Smart home bundle assessment. Confirm access to all entry points.", "site_visit",  "high",   "pending",    2,  False),
            (5,  5,  "Follow-up call - Emily Davis",            "Called once, no answer. Try again this week.",                      "call",        "medium", "pending",    1,  False),
            (10, 10, "Call Patel Medical for requirements",      "Discuss HIPAA compliance needs for camera system.",                "call",        "high",   "pending",    0,  False),
            (8,  8,  "Coordinate install date - Brown Construction", "Confirm equipment delivery and site access for temp install.", "install",     "high",   "pending",    3,  False),
            (11, 11, "Callback Rachel Kim",                      "She submitted a form. Quick discovery call for apartment lock.",   "call",        "low",    "pending",   -1,  False),
            (17, 17, "Send revised quote - Morris estate",       "She wants to add 2 more cameras. Update quote and resend.",        "follow_up",   "medium", "pending",    4,  False),
            (18, 18, "Site survey - Patterson Law Firm",         "Access control assessment. Meet with office manager at 2pm.",      "site_visit",  "high",   "pending",    5,  False),
            (0,  0,  "Annual system check - Wilson",             "Yearly maintenance inspection. Test all sensors and cameras.",     "site_visit",  "low",    "completed", -10, True),
            (1,  1,  "Welcome call - Garcia",                    "Post-install check-in. Ensure she knows how to use the app.",      "call",        "medium", "completed", -8,  True),
            (9,  9,  "Install completion walkthrough - Anderson","Walk through system with homeowner. Demonstrate app and zones.",   "install",     "high",   "completed", -5,  True),
            (6,  6,  "Rental property 3 - key handoff",          "Meet tenant at 3rd property for system orientation.",              "site_visit",  "medium", "completed", -12, True),
            (4,  4,  "Follow-up - Johnson multi-site quote",     "He wanted a week to review. Call for decision.",                   "follow_up",   "high",   "pending",   -2,  False),
            (2,  2,  "TechCorp proposal follow-up",              "Quote sent 10 days ago. Check if they have questions.",            "follow_up",   "medium", "pending",   -3,  False),
            (15, 15, "Call Brittany Nguyen - new Google lead",   "New lead from Google Ads. Initial discovery call.",                "call",        "high",   "pending",    0,  False),
            (12, 12, "Post-install check - Wright Auto",         "System installed last week. Verify all 16 cameras are recording.", "site_visit",  "medium", "completed", -4,  True),
        ]

        for ci, di, title, desc, ttype, priority, status, due_days, completed in tasks_data:
            completed_at = ago(-due_days + 1) if completed else None
            db.add(Task(
                id=uid(), organization_id=org_id,
                contact_id=contact_ids[ci], deal_id=deal_ids[di],
                assigned_to=pick(reps + [carlos_id]),
                title=title, description=desc, type=ttype,
                priority=priority, status=status,
                due_date=NOW + timedelta(days=due_days),
                completed_at=completed_at,
                created_at=ago(abs(due_days) + random.randint(2, 7)),
                updated_at=ago(max(0, -due_days)) if completed else ago(0),
            ))
        db.flush()

        # ── Contracts (5) ─────────────────────────────────
        contracts_data = [
            # (contact_idx, deal_idx, number, title, monthly, term, signed_days_ago)
            (0,  0,  "SHS-2025-001", "Wilson - Smart Home Starter Monitoring",    39.99, 36, 55),
            (1,  1,  "SHS-2025-002", "Garcia - Basic Monitoring Agreement",       29.99, 36, 48),
            (6,  6,  "SHS-2025-003", "Martinez - Multi-Property Monitoring",      44.99, 36, 65),
            (9,  9,  "SHS-2025-004", "Anderson - Premium Protection Monitoring",  54.99, 48, 60),
            (13, 13, "SHS-2025-005", "Foster - Premium Protection Plus Monitoring", 49.99, 48, 75),
        ]

        for ci, di, num, title, monthly, term, signed_ago in contracts_data:
            start = ago(signed_ago)
            end = start + timedelta(days=term * 30)
            db.add(Contract(
                id=uid(), organization_id=org_id,
                contact_id=contact_ids[ci], deal_id=deal_ids[di],
                contract_number=num, title=title,
                monthly_amount=monthly, term_months=term,
                total_value=round(monthly * term, 2),
                status="active", start_date=start, end_date=end,
                signed_at=start, notes=f"{term}-month monitoring agreement at ${monthly}/mo.",
                created_at=start, updated_at=start,
            ))
        db.flush()

        # ── Activities (10) ──────────────────────────────
        activities_data = [
            # (contact_idx, deal_idx, type, subject, desc, performed_by, days_ago)
            (0,  0,  "call",  "Annual check-in with James Wilson",
             "System running perfectly. Mentioned neighbor interested in cameras. Will send referral info.", jake_id, 10),
            (2,  2,  "email", "Sent TechCorp commercial proposal",
             "Emailed detailed proposal: 8 cameras, 2 keycard readers, commercial panel. $4,800 equipment + $59.99/mo.", jake_id, 8),
            (3,  3,  "call",  "Discovery call - Sarah Thompson",
             "Discussed smart home needs. Wants 2 smart locks, doorbell cam, 2 window sensors. Scheduled site survey for Thursday.", priya_id, 15),
            (4,  4,  "note",  "Johnson negotiation update",
             "Michael wants a 10% volume discount for 3 locations. Checking with Marcus on approval.", jake_id, 5),
            (5,  5,  "call",  "First outreach to Emily Davis",
             "Left voicemail. She submitted a website form about package theft cameras. Will try again tomorrow.", priya_id, 11),
            (8,  8,  "note",  "Brown Construction - equipment ordered",
             "Ordered 4 temporary cameras and motion-activated light kit. Expected delivery in 3 business days.", carlos_id, 6),
            (9,  9,  "call",  "Post-install follow-up - Anderson",
             "Lisa loves the system. App is working great. She wants to add a garage sensor next month.", jake_id, 3),
            (12, 12, "note",  "Wright Auto install complete",
             "All 16 cameras installed and recording. NVR in manager office. Staff trained on app access.", carlos_id, 7),
            (17, 17, "email", "Sent Morris estate quote - Premium package",
             "Detailed quote for 6,000 sq ft home: 8 cameras, smart locks, panel, full monitoring. $5,200 equipment + $59.99/mo.", priya_id, 4),
            (10, 10, "email", "Welcome email sent to Patel Medical",
             "Sent intro email with commercial security brochure and HIPAA-compliant system options.", priya_id, 3),
        ]

        for ci, di, atype, subject, desc, by_user, days in activities_data:
            db.add(Activity(
                id=uid(), organization_id=org_id,
                contact_id=contact_ids[ci],
                deal_id=deal_ids[di] if di is not None else None,
                type=atype, subject=subject, description=desc,
                performed_by=by_user,
                performed_at=ago(days),
                created_at=ago(days),
            ))
        db.flush()

        db.commit()

    print()
    print("  Seed complete!")
    print()
    print("  Organization : Shield Home Security LLC")
    print("  Users        : 5  (owner, admin, 2 sales reps, technician)")
    print("  Contacts     : 30")
    print("  Deals        : 20")
    print("  Tasks        : 15 (5 completed, 10 pending/overdue)")
    print("  Contracts    : 5  (active monitoring subscriptions)")
    print("  Activities   : 10")
    print("  Stage History: entries for all 20 deals")
    print()
    print("  All users password: Password1!")
    print("  Login emails:")
    print("    marcus@shieldhomesecurity.com   (owner)")
    print("    danielle@shieldhomesecurity.com (admin)")
    print("    jake@shieldhomesecurity.com     (sales_rep)")
    print("    priya@shieldhomesecurity.com    (sales_rep)")
    print("    carlos@shieldhomesecurity.com   (technician)")
    print()


if __name__ == "__main__":
    seed()
