"""
Seed script for LSRV CRM.

Populates the database with realistic home security dealer data.
Run with: python seed.py

Idempotent: running again drops and recreates all seed data.
Requires a running PostgreSQL instance with migrations applied.
"""

import os
import uuid
import random
from datetime import datetime, timedelta, date, time

from dotenv import load_dotenv
from passlib.context import CryptContext
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL_SYNC", "postgresql://lsrv:lsrv@localhost:5433/lsrv"
)

engine = create_engine(DATABASE_URL, echo=False)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Import actual models
from app.models.organization import Organization
from app.models.user import User
from app.models.contact import Contact
from app.models.pipeline import Pipeline, PipelineStage
from app.models.deal import Deal
from app.models.stage_history import StageHistory
from app.models.task import Task
from app.models.activity import Activity
from app.models.quote import Quote
from app.models.contract import Contract
from app.models.subscription import Subscription
from app.models.invoice import Invoice
from app.models.payment import Payment


# ── Helpers ──────────────────────────────────────────

NOW = datetime.utcnow()
TODAY = date.today()


def ago(days: int, hours: int = 0) -> datetime:
    return NOW - timedelta(days=days, hours=hours)


def ago_date(days: int) -> date:
    return TODAY - timedelta(days=days)


def uid() -> uuid.UUID:
    return uuid.uuid4()


def pick(lst):
    return random.choice(lst)


# ── Seed ─────────────────────────────────────────────


def seed():
    with Session(engine) as db:
        # Clean existing seed data (reverse FK order)
        tables = [
            "payments", "invoices", "subscriptions", "contracts", "quotes",
            "task_comments", "activities", "stage_history", "tasks", "deals",
            "pipeline_stages", "pipelines", "contacts", "users", "organizations",
        ]
        for tbl in tables:
            db.execute(text(f'DELETE FROM "{tbl}"'))
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

        mike_id = uid()
        sarah_id = uid()
        jake_id = uid()
        amanda_id = uid()
        carlos_id = uid()

        users_data = [
            User(id=mike_id, organization_id=org_id, email="mike@shieldhomesecurity.com",
                 password_hash=pw, first_name="Mike", last_name="Reynolds",
                 phone="(214) 555-0101", role="owner", is_active=True,
                 created_at=ago(180), updated_at=ago(1)),
            User(id=sarah_id, organization_id=org_id, email="sarah@shieldhomesecurity.com",
                 password_hash=pw, first_name="Sarah", last_name="Mitchell",
                 phone="(214) 555-0102", role="admin", is_active=True,
                 created_at=ago(170), updated_at=ago(1)),
            User(id=jake_id, organization_id=org_id, email="jake@shieldhomesecurity.com",
                 password_hash=pw, first_name="Jake", last_name="Torres",
                 phone="(214) 555-0103", role="sales_rep", is_active=True,
                 created_at=ago(160), updated_at=ago(1)),
            User(id=amanda_id, organization_id=org_id, email="amanda@shieldhomesecurity.com",
                 password_hash=pw, first_name="Amanda", last_name="Foster",
                 phone="(214) 555-0104", role="sales_rep", is_active=True,
                 created_at=ago(155), updated_at=ago(1)),
            User(id=carlos_id, organization_id=org_id, email="carlos@shieldhomesecurity.com",
                 password_hash=pw, first_name="Carlos", last_name="Rivera",
                 phone="(214) 555-0105", role="technician", is_active=True,
                 created_at=ago(150), updated_at=ago(1)),
        ]
        db.add_all(users_data)
        db.flush()

        reps = [jake_id, amanda_id]

        # ── Pipeline & Stages ─────────────────────────────
        pipeline_id = uid()
        db.add(Pipeline(
            id=pipeline_id, organization_id=org_id, name="Sales Pipeline",
            is_default=True, sort_order=0,
            created_at=ago(180), updated_at=ago(180),
        ))
        db.flush()

        stage_ids = {}
        stages_data = [
            ("New Lead",                "#6C63FF", 0, False, False, 3),
            ("Contacted",               "#3B82F6", 1, False, False, 5),
            ("Consultation Scheduled",  "#8B5CF6", 2, False, False, 7),
            ("Consultation Complete",   "#A855F7", 3, False, False, 5),
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
                id=sid, organization_id=org_id, pipeline_id=pipeline_id,
                name=name, color=color, sort_order=pos,
                is_won_stage=is_won, is_lost_stage=is_lost,
                stale_days=stale, is_active=True,
                created_at=ago(180),
            ))
        db.flush()

        # ── Contacts (30) ────────────────────────────────
        contact_records = [
            # (fn, ln, email, phone, company, addr, city, state, zip, source, status, property, tags, notes)
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
            ("Amanda", "Foster", "amanda.f@email.com", "(469) 555-1014", None, "678 Lakeside Drive", "Prosper", "TX", "75078", "referral", "customer", "single_family", ["monitoring", "vip"], "VIP customer. Premium Protection package."),
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
                email=email, phone=phone, company=company, address=addr,
                city=city, state=state, zip=zp, lead_source=src, status=status,
                property_type=prop, assigned_to=rep, tags=tags, notes=notes,
                is_deleted=False,
                created_at=ago(days_created), updated_at=ago(random.randint(0, days_created)),
            ))
        db.flush()

        # ── Deals (20) ───────────────────────────────────
        deal_templates = [
            # (contact_idx, title, value, stage, days_ago_created, notes)
            (0,  "Wilson - Smart Home Starter",          1800, "Contract Signed",        58, "Equipment: panel, 2 door sensors, motion, key fob. $39.99/mo monitoring."),
            (1,  "Garcia - Basic Monitoring Package",    1500, "Contract Signed",        52, "Entry-level package. Panel + 3 sensors. $29.99/mo."),
            (2,  "TechCorp - Commercial Access Control", 4800, "Quote Sent",             40, "8 cameras, 2 keycard readers, commercial panel. $59.99/mo."),
            (3,  "Thompson - Smart Home Bundle",         2400, "Consultation Scheduled",  18, "Smart locks (2), doorbell cam, 2 window sensors."),
            (4,  "Johnson HVAC - Multi-Site Alarm",      5000, "Negotiation",             35, "3 locations. Basic alarm per site. Volume discount discussed."),
            (5,  "Davis - Exterior Camera Package",      2200, "Contacted",               12, "4 outdoor cameras with night vision, NVR, app access."),
            (6,  "Martinez - Rental Monitoring",         3600, "Contract Signed",         70, "3 rental properties. Basic monitoring each. $44.99/mo total."),
            (7,  "Lee - Condo Essential",                1500, "Consultation Complete",    22, "Doorbell cam, 2 door sensors, glass break detector."),
            (8,  "Brown Construction - Temp Site Security", 3200, "Install Scheduled",     30, "6-month temp install. 4 cameras + motion-activated lights."),
            (9,  "Anderson - Premium Protection",        4200, "Contract Signed",         65, "Full package: 4 cameras, smart locks, panel, monitoring. $54.99/mo."),
            (10, "Patel Medical - Office Security",      4500, "New Lead",                 4, "Medical office security inquiry. HIPAA-compliant access logging needed."),
            (11, "Kim - Apartment Smart Lock",           1200, "New Lead",                 2, "Single smart lock + interior cam. Budget-conscious."),
            (12, "Wright Auto - Lot Cameras",            4800, "Installed",                45, "16 exterior cameras covering lot, showroom entrance, service bays."),
            (13, "Foster - Premium Protection Plus",     3800, "Contract Signed",          80, "Premium package + garage sensor + smoke detectors. $49.99/mo."),
            (14, "Rivera Restaurant - Hold",             3500, "Lost",                     50, "Project paused due to renovation delays. May re-engage Q2."),
            (15, "Nguyen - Camera Package",              2000, "New Lead",                  3, "Exterior camera inquiry from Google Ads. Awaiting callback."),
            (16, "Coleman - Townhouse Smart Home",       1800, "Contacted",                10, "Doorbell cam, smart lock, 2 sensors. Townhouse HOA restrictions noted."),
            (17, "Morris - Estate Security",             5200, "Quote Sent",               28, "6,000 sq ft home. 8 cameras, panel, smart locks, full monitoring. $59.99/mo."),
            (18, "Patterson Law - Access Control",       3800, "Consultation Scheduled",   15, "Server room access control. 4 cameras. After-hours alarm."),
            (19, "Simmons - New Construction Pre-Wire",  2800, "New Lead",                  1, "New build. Wants pre-wire for security during construction phase."),
        ]

        deal_ids = []
        deal_contact_map = {}
        deal_stage_map = {}
        deal_rep_map = {}

        for ci, title, value, stage_name, days_created, notes in deal_templates:
            did = uid()
            deal_ids.append(did)
            contact_id = contact_ids[ci]
            stage_id = stage_ids[stage_name]
            rep = pick(reps)
            deal_contact_map[did] = contact_id
            deal_stage_map[did] = stage_name
            deal_rep_map[did] = rep

            exp_close = None
            closed_at = None
            if stage_name in ("Contract Signed",):
                closed_at = ago(days_created - random.randint(1, 5))
            elif stage_name == "Lost":
                closed_at = ago(days_created - random.randint(1, 5))
            else:
                exp_close = NOW + timedelta(days=random.randint(10, 45))

            db.add(Deal(
                id=did, organization_id=org_id, pipeline_id=pipeline_id,
                stage_id=stage_id, contact_id=contact_id, title=title,
                estimated_value=value, expected_close_date=exp_close,
                closed_at=closed_at, assigned_to=rep, notes=notes,
                is_deleted=False,
                created_at=ago(days_created),
                updated_at=ago(random.randint(0, min(days_created, 5))),
            ))
        db.flush()

        # ── Stage History ─────────────────────────────────
        stage_order = [
            "New Lead", "Contacted", "Consultation Scheduled", "Consultation Complete",
            "Quote Sent", "Negotiation", "Install Scheduled", "Installed", "Contract Signed",
        ]

        for i, did in enumerate(deal_ids):
            stage_name = deal_stage_map[did]
            rep = deal_rep_map[did]
            _, _, _, _, days_created, _ = deal_templates[i]

            if stage_name == "Lost":
                path = stage_order[:random.randint(2, 5)] + ["Lost"]
            elif stage_name in stage_order:
                target_idx = stage_order.index(stage_name)
                path = stage_order[:target_idx + 1]
            else:
                path = ["New Lead"]

            if len(path) <= 1:
                intervals = [0]
            else:
                total_days = days_created
                max_range = max(total_days, len(path) + 1)
                sample_count = min(len(path) - 1, max_range - 1)
                intervals = sorted(random.sample(range(1, max_range), sample_count))
                intervals = [0] + intervals

            prev_stage = None
            for j, sname in enumerate(path):
                day_offset = intervals[j] if j < len(intervals) else intervals[-1] + j
                db.add(StageHistory(
                    id=uid(), organization_id=org_id, deal_id=did,
                    from_stage_id=stage_ids.get(prev_stage),
                    to_stage_id=stage_ids[sname],
                    moved_by=rep,
                    moved_at=ago(days_created - day_offset),
                    created_at=ago(days_created - day_offset),
                ))
                prev_stage = sname
        db.flush()

        # ── Tasks (15) ────────────────────────────────────
        tasks_data = [
            # (ci, di, title, desc, type, priority, status, due_days_from_now, completed)
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
            completed_by = pick(reps + [carlos_id]) if completed else None
            assignee = pick(reps + [carlos_id])
            days_before = abs(due_days) + random.randint(2, 7)
            db.add(Task(
                id=uid(), organization_id=org_id,
                contact_id=contact_ids[ci], deal_id=deal_ids[di],
                assigned_to=assignee, created_by=pick(reps),
                title=title, description=desc, type=ttype,
                priority=priority, status=status,
                due_date=TODAY + timedelta(days=due_days),
                due_time=time(random.randint(8, 17), 0),
                duration_minutes=random.choice([30, 60, 90, 120]),
                is_all_day=False,
                recurrence="none",
                completed_at=completed_at, completed_by=completed_by,
                is_deleted=False,
                created_at=ago(days_before),
                updated_at=ago(max(0, -due_days)) if completed else ago(0),
            ))
        db.flush()

        # ── Quotes (5) ───────────────────────────────────
        quote_data = [
            # (ci, di, title, equip_total, monthly, term, status, equip_lines, days_ago)
            (2, 2, "TechCorp Commercial Security Package", 4800, 59.99, 36, "sent", [
                {"product_name": "Commercial HD Camera", "quantity": 8, "unit_price": 350, "total": 2800},
                {"product_name": "Keycard Access Reader", "quantity": 2, "unit_price": 450, "total": 900},
                {"product_name": "Commercial Alarm Panel", "quantity": 1, "unit_price": 800, "total": 800},
                {"product_name": "Installation Labor", "quantity": 1, "unit_price": 300, "total": 300},
            ], 10),
            (17, 17, "Morris Estate Security Package", 5200, 59.99, 48, "sent", [
                {"product_name": "4K Security Camera", "quantity": 8, "unit_price": 400, "total": 3200},
                {"product_name": "Smart Lock - Deadbolt", "quantity": 3, "unit_price": 250, "total": 750},
                {"product_name": "Security Panel Pro", "quantity": 1, "unit_price": 650, "total": 650},
                {"product_name": "Installation Labor", "quantity": 1, "unit_price": 600, "total": 600},
            ], 5),
            (0, 0, "Wilson Smart Home Starter", 1800, 39.99, 36, "accepted", [
                {"product_name": "HD Doorbell Camera", "quantity": 1, "unit_price": 200, "total": 200},
                {"product_name": "Door/Window Sensor", "quantity": 4, "unit_price": 50, "total": 200},
                {"product_name": "Motion Detector", "quantity": 2, "unit_price": 75, "total": 150},
                {"product_name": "Security Panel", "quantity": 1, "unit_price": 500, "total": 500},
                {"product_name": "Indoor Camera", "quantity": 2, "unit_price": 175, "total": 350},
                {"product_name": "Key Fob", "quantity": 2, "unit_price": 50, "total": 100},
                {"product_name": "Installation Labor", "quantity": 1, "unit_price": 300, "total": 300},
            ], 60),
            (9, 9, "Anderson Premium Protection Bundle", 4200, 54.99, 48, "accepted", [
                {"product_name": "4K Security Camera", "quantity": 4, "unit_price": 400, "total": 1600},
                {"product_name": "Smart Lock - Deadbolt", "quantity": 2, "unit_price": 250, "total": 500},
                {"product_name": "Security Panel Pro", "quantity": 1, "unit_price": 650, "total": 650},
                {"product_name": "Door/Window Sensor", "quantity": 6, "unit_price": 50, "total": 300},
                {"product_name": "Glass Break Detector", "quantity": 2, "unit_price": 80, "total": 160},
                {"product_name": "Smoke/CO Detector", "quantity": 3, "unit_price": 90, "total": 270},
                {"product_name": "Installation Labor", "quantity": 1, "unit_price": 720, "total": 720},
            ], 67),
            (7, 7, "Lee Condo Essential Package", 1500, 34.99, 36, "draft", [
                {"product_name": "HD Doorbell Camera", "quantity": 1, "unit_price": 200, "total": 200},
                {"product_name": "Door/Window Sensor", "quantity": 3, "unit_price": 50, "total": 150},
                {"product_name": "Glass Break Detector", "quantity": 1, "unit_price": 80, "total": 80},
                {"product_name": "Security Panel", "quantity": 1, "unit_price": 500, "total": 500},
                {"product_name": "Motion Detector", "quantity": 1, "unit_price": 75, "total": 75},
                {"product_name": "Installation Labor", "quantity": 1, "unit_price": 495, "total": 495},
            ], 3),
        ]

        quote_ids = []
        for ci, di, title, equip_total, monthly, term, qstatus, equip_lines, days in quote_data:
            qid = uid()
            quote_ids.append(qid)
            total_contract_value = round(equip_total + (monthly * term), 2)
            accepted_at = ago(days - 2) if qstatus == "accepted" else None
            sent_at = ago(days) if qstatus in ("sent", "accepted") else None
            db.add(Quote(
                id=qid, organization_id=org_id,
                deal_id=deal_ids[di], contact_id=contact_ids[ci],
                created_by=pick(reps), title=title, status=qstatus,
                equipment_total=equip_total,
                monthly_monitoring_amount=monthly,
                contract_term_months=term,
                auto_renewal=True,
                total_contract_value=total_contract_value,
                equipment_lines=equip_lines,
                valid_until=NOW + timedelta(days=30),
                sent_at=sent_at, accepted_at=accepted_at,
                created_at=ago(days + 2), updated_at=ago(days),
            ))
        db.flush()

        # ── Contracts (5) ─────────────────────────────────
        monthly_amounts = [39.99, 29.99, 44.99, 54.99, 49.99]
        contract_data = [
            # (ci, di, qi_or_none, title, monthly, equip, term, signed_days_ago)
            (0,  0,  2, "Wilson - Smart Home Starter Monitoring",      39.99, 1800, 36, 55),
            (1,  1,  None, "Garcia - Basic Monitoring Agreement",      29.99, 1500, 36, 48),
            (6,  6,  None, "Martinez - Multi-Property Monitoring",     44.99, 3600, 36, 65),
            (9,  9,  3, "Anderson - Premium Protection Monitoring",    54.99, 4200, 48, 60),
            (13, 13, None, "Foster - Premium Protection Plus Monitoring", 49.99, 3800, 48, 75),
        ]

        contract_ids = []
        contract_contact_map = {}
        for ci, di, qi, title, monthly, equip, term, signed_ago in contract_data:
            cid_c = uid()
            contract_ids.append(cid_c)
            contract_contact_map[cid_c] = contact_ids[ci]
            start = ago(signed_ago)
            total_val = round(monthly * term + equip, 2)
            quote_id = quote_ids[qi] if qi is not None else None
            db.add(Contract(
                id=cid_c, organization_id=org_id,
                contact_id=contact_ids[ci], deal_id=deal_ids[di],
                quote_id=quote_id, title=title,
                monthly_amount=monthly, equipment_total=equip,
                term_months=term, total_value=total_val,
                status="active", start_date=start,
                end_date=start + timedelta(days=term * 30),
                signed_at=start,
                notes=f"{term}-month monitoring agreement at ${monthly}/mo.",
                created_at=start, updated_at=start,
            ))
        db.flush()

        # ── Subscriptions (5) ────────────────────────────
        subscription_ids = []
        for idx, (cid_c, monthly) in enumerate(zip(contract_ids, monthly_amounts)):
            sid = uid()
            subscription_ids.append(sid)
            contact_id = contract_contact_map[cid_c]
            days_active = contract_data[idx][7]  # signed_days_ago
            db.add(Subscription(
                id=sid, organization_id=org_id,
                contract_id=cid_c, contact_id=contact_id,
                status="active", amount=monthly, currency="usd",
                billing_interval="monthly", billing_interval_count=1,
                billing_anchor_day=1,
                current_period_start=ago_date(30),
                current_period_end=ago_date(0),
                next_billing_date=ago_date(-1),  # tomorrow
                failed_payment_count=0,
                last_payment_at=ago(30),
                created_at=ago(days_active), updated_at=ago(1),
            ))
        db.flush()

        # ── Invoices (10) ────────────────────────────────
        invoice_data = []
        inv_num = 1
        for idx, (cid_c, monthly) in enumerate(zip(contract_ids, monthly_amounts)):
            contact_id = contract_contact_map[cid_c]
            sid = subscription_ids[idx]
            # 2 invoices per contract: one paid, one current
            # Paid invoice (last month)
            invoice_data.append((
                contact_id, cid_c, sid,
                f"INV-2025-{inv_num:04d}", "paid", monthly,
                ago_date(60), ago_date(30), ago_date(60), ago_date(30),
            ))
            inv_num += 1
            # Current invoice
            statuses = ["sent", "sent", "past_due", "sent", "sent"]
            invoice_data.append((
                contact_id, cid_c, sid,
                f"INV-2025-{inv_num:04d}", statuses[idx], monthly,
                ago_date(30), ago_date(0), ago_date(30), ago_date(0),
            ))
            inv_num += 1

        invoice_ids = []
        for contact_id, cid_c, sid, inv_number, inv_status, amount, inv_date, due_dt, period_start, period_end in invoice_data:
            iid = uid()
            invoice_ids.append((iid, inv_status, amount, contact_id, cid_c, sid))
            paid_at = ago(random.randint(1, 5)) if inv_status == "paid" else None
            amt_paid = amount if inv_status == "paid" else 0
            amt_due = 0 if inv_status == "paid" else amount
            sent_at = ago(30) if inv_status != "draft" else None
            db.add(Invoice(
                id=iid, organization_id=org_id,
                contact_id=contact_id, contract_id=cid_c,
                subscription_id=sid,
                invoice_number=inv_number, status=inv_status,
                invoice_date=inv_date, due_date=due_dt,
                period_start=period_start, period_end=period_end,
                subtotal=amount, tax_amount=0, total=amount,
                amount_paid=amt_paid, amount_due=amt_due,
                currency="usd",
                line_items=[{"description": "Monthly Monitoring Service", "quantity": 1, "unit_price": float(amount), "amount": float(amount)}],
                sent_at=sent_at, paid_at=paid_at,
                created_at=ago(35), updated_at=ago(1),
            ))
        db.flush()

        # ── Payments (for paid invoices) ──────────────────
        for iid, inv_status, amount, contact_id, cid_c, sid in invoice_ids:
            if inv_status == "paid":
                db.add(Payment(
                    id=uid(), organization_id=org_id,
                    contact_id=contact_id, contract_id=cid_c,
                    subscription_id=sid, invoice_id=iid,
                    status="succeeded", amount=amount, amount_refunded=0,
                    currency="usd",
                    payment_method_type="card",
                    payment_method_last4=str(random.randint(1000, 9999)),
                    payment_date=ago_date(random.randint(1, 5)),
                    period_start=ago_date(60), period_end=ago_date(30),
                    attempt_number=1,
                    created_at=ago(random.randint(1, 5)),
                ))
        db.flush()

        # ── Activities (20) ──────────────────────────────
        activities_data = [
            (0,  0,  "call",    "Annual check-in with James Wilson",             "System running perfectly. Mentioned neighbor interested in cameras.", jake_id, 10),
            (2,  2,  "email",   "Sent TechCorp commercial proposal",            "Emailed detailed proposal: 8 cameras, 2 keycard readers. $4,800 + $59.99/mo.", jake_id, 8),
            (3,  3,  "call",    "Discovery call - Sarah Thompson",              "Discussed smart home needs. Wants 2 smart locks, doorbell cam. Scheduled consultation.", amanda_id, 15),
            (4,  4,  "note",    "Johnson negotiation update",                   "Michael wants 10% volume discount for 3 locations. Checking with Mike.", jake_id, 5),
            (5,  5,  "call",    "First outreach to Emily Davis",                "Left voicemail about package theft cameras. Will try again tomorrow.", amanda_id, 11),
            (8,  8,  "note",    "Brown Construction - equipment ordered",       "Ordered 4 temporary cameras and motion light kit. Delivery in 3 days.", carlos_id, 6),
            (9,  9,  "call",    "Post-install follow-up - Anderson",            "Lisa loves the system. App is working great. Wants garage sensor next month.", jake_id, 3),
            (12, 12, "note",    "Wright Auto install complete",                 "All 16 cameras installed and recording. NVR in manager office.", carlos_id, 7),
            (17, 17, "email",   "Sent Morris estate quote",                     "Quote for 6,000 sq ft home: 8 cameras, smart locks, monitoring. $5,200 + $59.99/mo.", amanda_id, 4),
            (10, 10, "email",   "Welcome email sent to Patel Medical",          "Sent intro email with commercial security brochure and HIPAA-compliant options.", amanda_id, 3),
            (1,  1,  "call",    "Garcia post-install check-in",                "Maria confirmed system working well. Showed her mobile app features.", jake_id, 45),
            (6,  6,  "meeting", "Martinez rental property walkthrough",         "Toured all 3 rental properties. Identified sensor placement for each unit.", amanda_id, 62),
            (13, 13, "call",    "Foster premium package check-in",              "Amanda is happy with the system. Referred Nicole Barnes.", jake_id, 20),
            (21, None, "call",  "Initial call with Nicole Barnes",              "Referred by Amanda Foster. Interested in smart home package. Scheduling consultation.", amanda_id, 8),
            (16, 16, "email",   "Coleman HOA research",                         "Researched HOA restrictions for exterior cameras. Doorbell cam is approved.", jake_id, 7),
            (25, None, "call",  "Tina Price contract renewal discussion",       "Contract renewal coming up in 6 months. Discussed upgrade options.", amanda_id, 15),
            (20, None, "call",  "Raymond Tucker callback",                      "Saw our truck in neighborhood. Wants cameras and monitoring. Scheduling consultation.", jake_id, 5),
            (29, None, "call",  "Diana Ward - medical alert inquiry",           "Discussed medical alert pendant option for elderly mother. Simple system.", amanda_id, 3),
            (22, None, "email",  "Henderson Dental security proposal",           "Sent dental office security proposal: cameras + after-hours alarm.", jake_id, 6),
            (28, None, "call",  "Jason Bell lakefront consultation",            "Discussed dock camera options for lakefront property. Unique mounting needed.", amanda_id, 4),
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
    print("  Users        : 5  (Mike Reynolds/owner, Sarah Mitchell/admin,")
    print("                     Jake Torres/sales_rep, Amanda Foster/sales_rep,")
    print("                     Carlos Rivera/technician)")
    print("  Contacts     : 30")
    print("  Pipeline     : 1  (10 stages)")
    print("  Deals        : 20")
    print("  Stage History: entries for all 20 deals")
    print("  Tasks        : 15 (5 completed, 10 pending/overdue)")
    print("  Quotes       : 5  (2 draft/sent, 2 accepted, 1 draft)")
    print("  Contracts    : 5  (active monitoring subscriptions)")
    print("  Subscriptions: 5  ($29.99, $39.99, $44.99, $49.99, $54.99/mo)")
    print("  Invoices     : 10 (5 paid, 4 sent, 1 past_due)")
    print("  Payments     : 5  (for paid invoices)")
    print("  Activities   : 20")
    print()
    print("  All users password: Password1!")
    print("  Login emails:")
    print("    mike@shieldhomesecurity.com    (owner)")
    print("    sarah@shieldhomesecurity.com   (admin)")
    print("    jake@shieldhomesecurity.com    (sales_rep)")
    print("    amanda@shieldhomesecurity.com  (sales_rep)")
    print("    carlos@shieldhomesecurity.com  (technician)")
    print()


if __name__ == "__main__":
    seed()
