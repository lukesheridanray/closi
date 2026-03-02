"""
Seed script for Medley & Sons Security demo.

Populates the CRM with 4 months of realistic data for an ADT authorized
dealer in Louisville, KY.

Run with: python seed_medley.py

Idempotent: running again drops and recreates all seed data.
Requires a running PostgreSQL instance with migrations applied.
"""

import os
import uuid
import random
from datetime import datetime, timedelta, date, time

# Shim for passlib + bcrypt 4.x compatibility
import bcrypt as _bcrypt_mod
if not hasattr(_bcrypt_mod, "__about__"):
    _bcrypt_mod.__about__ = type("about", (), {"__version__": _bcrypt_mod.__version__})()

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
            name="Medley & Sons Security",
            slug="medley-sons-security",
            email="ethan@medleyandsons.com",
            phone="(502) 645-7947",
            address_line1="1415 Bardstown Rd, Ste 12",
            city="Louisville",
            state="KY",
            zip="40204",
            timezone="America/New_York",
            currency="usd",
            plan="professional",
            is_active=True,
            created_at=ago(365),
            updated_at=ago(1),
        )
        db.add(org)
        db.flush()

        # ── Users (5) ────────────────────────────────────
        pw = pwd_context.hash("Demo1234!")

        ethan_id = uid()
        jordan_id = uid()
        marcus_id = uid()
        sarah_id = uid()
        tyler_id = uid()

        users_data = [
            User(id=ethan_id, organization_id=org_id, email="ethan@medleyandsons.com",
                 password_hash=pw, first_name="Ethan", last_name="Medley",
                 phone="(502) 645-7947", role="owner", is_active=True,
                 created_at=ago(365), updated_at=ago(1)),
            User(id=jordan_id, organization_id=org_id, email="jordan@medleyandsons.com",
                 password_hash=pw, first_name="Jordan", last_name="Medley",
                 phone="(502) 645-7948", role="admin", is_active=True,
                 created_at=ago(350), updated_at=ago(1)),
            User(id=marcus_id, organization_id=org_id, email="marcus@medleyandsons.com",
                 password_hash=pw, first_name="Marcus", last_name="Williams",
                 phone="(502) 645-7949", role="sales_rep", is_active=True,
                 created_at=ago(300), updated_at=ago(1)),
            User(id=sarah_id, organization_id=org_id, email="sarah@medleyandsons.com",
                 password_hash=pw, first_name="Sarah", last_name="Chen",
                 phone="(502) 645-7950", role="sales_rep", is_active=True,
                 created_at=ago(280), updated_at=ago(1)),
            User(id=tyler_id, organization_id=org_id, email="tyler@medleyandsons.com",
                 password_hash=pw, first_name="Tyler", last_name="Brooks",
                 phone="(502) 645-7951", role="technician", is_active=True,
                 created_at=ago(260), updated_at=ago(1)),
        ]
        db.add_all(users_data)
        db.flush()

        reps = [marcus_id, sarah_id]

        # ── Pipeline & Stages ─────────────────────────────
        pipeline_id = uid()
        db.add(Pipeline(
            id=pipeline_id, organization_id=org_id, name="Sales Pipeline",
            is_default=True, sort_order=0,
            created_at=ago(365), updated_at=ago(365),
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
            ("Won",                     "#10B981", 8, True,  False, 30),
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
                created_at=ago(365),
            ))
        db.flush()

        # ── Contacts (35) ────────────────────────────────
        contact_records = [
            # idx 0-11: customers (status=customer)
            ("Danny",    "Crawford",  "danny.crawford@gmail.com",      "(502) 555-2001", None,                   "245 Cherokee Rd",           "Louisville", "KY", "40204", "referral",    "customer",  "single_family", ["monitoring", "cameras"],        "Original customer. Full ADT system with 6 cameras. Refers a lot of business."),
            ("Rebecca",  "Thornton",  "rebecca.thornton@yahoo.com",    "(502) 555-2002", None,                   "1820 Longest Ave",          "Louisville", "KY", "40204", "google_ads",  "customer",  "single_family", ["monitoring"],                   "Basic ADT package. Panel + 3 sensors. Happy with service."),
            ("Marcus",   "Hale",      "marcus.hale@outlook.com",       "(502) 555-2003", None,                   "3410 Trevilian Way",        "Louisville", "KY", "40205", "website",     "customer",  "single_family", ["smart-home", "monitoring"],     "Smart home bundle: locks, doorbell cam, panel. $49.99/mo."),
            ("Linda",    "Prescott",  "linda.prescott@gmail.com",      "(502) 555-2004", None,                   "2005 Bonnycastle Ave",      "Louisville", "KY", "40205", "referral",    "customer",  "single_family", ["cameras", "monitoring"],        "Premium package. 8 cameras on 4,500 sq ft home. Referred by Danny Crawford."),
            ("Greg",     "Whitfield", "greg.whitfield@hotmail.com",    "(502) 555-2005", "Whitfield Plumbing",   "890 Baxter Ave",            "Louisville", "KY", "40204", "walk_in",     "customer",  "commercial",    ["commercial", "monitoring"],     "Plumbing shop + warehouse. Commercial system with after-hours alarm."),
            ("Tamara",   "Ellis",     "tamara.ellis@gmail.com",        "(502) 555-2006", None,                   "4501 Shelbyville Rd",       "Louisville", "KY", "40207", "facebook",    "customer",  "single_family", ["monitoring", "smart-home"],     "ADT smart home package. Very tech-savvy, uses app daily."),
            ("Joe",      "Brantley",  "joe.brantley@yahoo.com",        "(502) 555-2007", None,                   "1144 Eastern Pkwy",         "Louisville", "KY", "40217", "google_ads",  "customer",  "single_family", ["monitoring"],                   "Basic monitoring. Signed 36-month contract Nov 2025."),
            ("Patricia", "Odom",      "patricia.odom@gmail.com",       "(502) 555-2008", None,                   "3309 Lexington Rd",         "Louisville", "KY", "40206", "referral",    "customer",  "single_family", ["monitoring", "cameras"],        "6 cameras + panel. Contract started Dec 2025. Referred by Tamara Ellis."),
            ("Derek",    "Watts",     "derek.watts@outlook.com",       "(502) 555-2009", "Watts Electric LLC",   "5600 Bardstown Rd",         "Louisville", "KY", "40291", "website",     "customer",  "commercial",    ["commercial", "access-control"],"Electrical contractor shop. Access control + cameras. $59.99/mo."),
            ("Shawna",   "Pittman",   "shawna.pittman@gmail.com",      "(502) 555-2010", None,                   "7702 Westport Rd",          "Louisville", "KY", "40222", "google_ads",  "customer",  "townhouse",     ["monitoring"],                   "Townhouse alarm system. Basic $39.99/mo monitoring."),
            ("Keith",    "Ingram",    "keith.ingram@yahoo.com",        "(502) 555-2011", None,                   "220 Breckenridge Ln",       "Louisville", "KY", "40207", "referral",    "customer",  "single_family", ["monitoring", "cameras"],        "Full system. 4 cameras, panel, door sensors. Signed Jan 2026."),
            ("Vanessa",  "Mack",      "vanessa.mack@gmail.com",        "(502) 555-2012", None,                   "1405 Bardstown Rd",         "Louisville", "KY", "40204", "walk_in",     "customer",  "condo",         ["monitoring"],                   "Condo next to our office. Walk-in customer. Basic alarm + doorbell cam."),

            # idx 12-21: active leads (status=active)
            ("Brian",    "Norwood",   "brian.norwood@gmail.com",       "(502) 555-2013", "Norwood Dental",       "4920 Brownsboro Rd",        "Louisville", "KY", "40222", "google_ads",  "active",    "commercial",    ["commercial", "dental"],         "Dental office needs camera system + after-hours alarm. Site visit done."),
            ("Anita",    "Combs",     "anita.combs@yahoo.com",         "(502) 555-2014", None,                   "8350 Shelbyville Rd",       "Louisville", "KY", "40222", "facebook",    "active",    "single_family", ["cameras"],                      "Wants outdoor cameras after package thefts in neighborhood."),
            ("Tony",     "Riddle",    "tony.riddle@outlook.com",       "(502) 555-2015", "Riddle Construction",  "3800 Cane Run Rd",          "Louisville", "KY", "40216", "website",     "active",    "commercial",    ["commercial", "temporary"],      "Construction site security. Temporary 6-month camera install."),
            ("Cynthia",  "Harmon",    "cynthia.harmon@gmail.com",      "(502) 555-2016", None,                   "2200 Douglass Blvd",        "Louisville", "KY", "40205", "referral",    "active",    "single_family", ["full-package"],                 "Large Highlands home. Wants comprehensive security + smart home. Referred by Linda Prescott."),
            ("Jermaine", "Buckner",   "jermaine.buckner@hotmail.com",  "(502) 555-2017", None,                   "6204 Outer Loop",           "Louisville", "KY", "40228", "google_ads",  "active",    "single_family", ["cameras", "monitoring"],        "Google lead. Interested in basic package with 2 outdoor cameras."),
            ("Kelly",    "Sparks",    "kelly.sparks@gmail.com",        "(502) 555-2018", None,                   "5502 New Cut Rd",           "Louisville", "KY", "40214", "facebook",    "active",    "single_family", ["smart-home"],                   "Interested in smart locks and doorbell camera. No alarm needed."),
            ("Randall",  "Pope",      "randall.pope@yahoo.com",        "(502) 555-2019", "Pope Auto Sales",      "4300 Dixie Hwy",            "Louisville", "KY", "40216", "walk_in",     "active",    "commercial",    ["commercial", "auto"],           "Used car lot. Perimeter cameras + night vision. Budget-conscious."),
            ("Monica",   "Shafer",    "monica.shafer@gmail.com",       "(502) 555-2020", None,                   "1855 Frankfort Ave",        "Louisville", "KY", "40206", "referral",    "active",    "townhouse",     ["smart-home"],                   "Crescent Hill townhouse. Doorbell cam and smart lock. HOA approved."),
            ("Dwayne",   "Pratt",     "dwayne.pratt@outlook.com",      "(502) 555-2021", "Pratt Law Group",      "600 W Main St",             "Louisville", "KY", "40202", "website",     "active",    "commercial",    ["commercial", "access-control"], "Law firm downtown. Server room access control + 6 cameras."),
            ("Courtney", "Gibbons",   "courtney.gibbons@gmail.com",    "(502) 555-2022", None,                   "9210 Taylorsville Rd",      "Louisville", "KY", "40299", "google_ads",  "active",    "single_family", ["monitoring", "cameras"],        "Google Ads lead from Jan. Wants cameras and monitoring. Quote pending."),

            # idx 22-29: new leads (status=new)
            ("Travis",   "Bowman",    "travis.bowman@gmail.com",       "(502) 555-2023", None,                   "3700 Poplar Level Rd",      "Louisville", "KY", "40213", "google_ads",  "new",       "single_family", [],                               "Google Ads lead. Clicked camera ad. No contact yet."),
            ("Ashley",   "Vance",     "ashley.vance@yahoo.com",        "(502) 555-2024", None,                   "1100 Cherokee Pkwy",        "Louisville", "KY", "40204", "facebook",    "new",       "apartment",     [],                               "Apartment renter. Interested in smart lock + indoor cam."),
            ("Omar",     "Dunlap",    "omar.dunlap@hotmail.com",       "(502) 555-2025", "Dunlap Properties",    "7400 Preston Hwy",          "Louisville", "KY", "40219", "website",     "new",       "commercial",    ["commercial", "multi-location"], "Property manager. 5 rental units need basic alarm systems."),
            ("Brittany", "Yates",     "brittany.yates@gmail.com",      "(502) 555-2026", None,                   "4805 Crestwood Dr",         "Louisville", "KY", "40207", "referral",    "new",       "single_family", ["cameras"],                      "Referred by Keith Ingram. Wants same camera setup. Awaiting callback."),
            ("Ray",      "Lyons",     "ray.lyons@outlook.com",         "(502) 555-2027", None,                   "2340 Payne St",             "Louisville", "KY", "40206", "google_ads",  "new",       "single_family", [],                               "Google lead. Recent break-in on his street. Urgent."),
            ("Heather",  "Rowan",     "heather.rowan@gmail.com",       "(502) 555-2028", None,                   "6600 Manslick Rd",          "Louisville", "KY", "40214", "facebook",    "new",       "single_family", ["smart-home"],                   "Facebook lead. Interested in smart home starter package."),
            ("Wesley",   "Greer",     "wesley.greer@yahoo.com",        "(502) 555-2029", "Greer Fitness",        "3050 Bardstown Rd",         "Louisville", "KY", "40205", "walk_in",     "new",       "commercial",    ["commercial"],                   "Gym owner. Walked in asking about after-hours alarm + entrance camera."),
            ("Denise",   "Pennington","denise.pennington@gmail.com",   "(502) 555-2030", None,                   "8800 Smyrna Pkwy",          "Louisville", "KY", "40228", "google_ads",  "new",       "single_family", [],                               "Google lead. Elderly parent's home. Simple alarm + medical alert."),

            # idx 30-34: inactive leads (status=inactive)
            ("Frank",    "Dugan",     "frank.dugan@hotmail.com",       "(502) 555-2031", "Dugan Restaurant Group","2130 S Preston St",          "Louisville", "KY", "40217", "website",     "inactive",  "commercial",    ["commercial", "restaurant"],     "Restaurant owner. Paused project due to renovation delays."),
            ("Carmen",   "Swift",     "carmen.swift@gmail.com",        "(502) 555-2032", None,                   "1975 Bonnycastle Ave",      "Louisville", "KY", "40205", "google_ads",  "inactive",  "single_family", [],                               "Was interested but went with a competitor. Price was deciding factor."),
            ("Howard",   "Stokes",    "howard.stokes@yahoo.com",       "(502) 555-2033", None,                   "5100 Bardstown Rd",         "Louisville", "KY", "40291", "referral",    "inactive",  "single_family", [],                               "Decided to wait until spring. May re-engage in April."),
            ("Tanya",    "Frost",     "tanya.frost@gmail.com",         "(502) 555-2034", None,                   "420 S 4th St",              "Louisville", "KY", "40202", "facebook",    "inactive",  "condo",         [],                               "Condo building already has security. Individual unit options too limited."),
            ("Lloyd",    "Kemp",      "lloyd.kemp@outlook.com",        "(502) 555-2035", "Kemp Storage",         "9500 Bluegrass Pkwy",       "Louisville", "KY", "40299", "walk_in",     "inactive",  "commercial",    ["commercial"],                   "Storage facility. Budget too tight right now. Follow up in Q2."),
        ]

        contact_ids = []
        for fn, ln, email, phone, company, addr, city, state, zp, src, status, prop, tags, notes in contact_records:
            cid = uid()
            contact_ids.append(cid)
            rep = pick(reps)
            # Customers: created 60-120 days ago; active: 10-60; new: 1-10; inactive: 40-90
            if status == "customer":
                days_created = random.randint(60, 120)
            elif status == "active":
                days_created = random.randint(10, 60)
            elif status == "new":
                days_created = random.randint(1, 10)
            else:
                days_created = random.randint(40, 90)
            db.add(Contact(
                id=cid, organization_id=org_id, first_name=fn, last_name=ln,
                email=email, phone=phone, company=company, address=addr,
                city=city, state=state, zip=zp, lead_source=src, status=status,
                property_type=prop, assigned_to=rep, tags=tags, notes=notes,
                is_deleted=False,
                created_at=ago(days_created), updated_at=ago(random.randint(0, min(days_created, 5))),
            ))
        db.flush()

        # ── Deals (25) ───────────────────────────────────
        deal_templates = [
            # (contact_idx, title, value, stage, days_ago_created, notes)
            # Won deals (5)
            (0,  "Crawford - Full ADT System",                  4200, "Won",        105, "6 cameras, panel, sensors, smart locks. Equipment + install paid. $54.99/mo monitoring."),
            (1,  "Thornton - Basic ADT Package",                1500, "Won",         95, "Panel + 3 door/window sensors. Equipment + install paid. $39.99/mo monitoring."),
            (2,  "Hale - Smart Home Bundle",                    2800, "Won",         88, "Smart locks, doorbell cam, panel, 2 cameras. Equipment + install paid. $49.99/mo."),
            (3,  "Prescott - Premium 8-Camera System",          5800, "Won",         80, "8 cameras, panel, smart locks, glass break, smoke/CO. Equipment + install paid. $59.99/mo."),
            (4,  "Whitfield Plumbing - Commercial System",      3500, "Won",         75, "Commercial panel, 4 cameras, access control. Equipment + install paid. $54.99/mo."),

            # Lost deals (3)
            (31, "Swift - Basic Home Security",                 1500, "Lost",                    55, "Went with competitor. Said our price was $200 higher."),
            (30, "Dugan Restaurant - Commercial Hold",          4200, "Lost",                    50, "Renovation delays. Project cancelled for now."),
            (32, "Stokes - Camera System",                      2400, "Lost",                    60, "Decided to wait until spring. Quote expired."),

            # Active pipeline deals
            (5,  "Ellis - Smart Home Upgrade",                  1800, "Installed",               45, "Adding 2 more cameras to existing system. Install complete, awaiting first monitoring bill."),
            (6,  "Brantley - Basic Monitoring",                 1200, "Install Scheduled",       42, "Panel + 2 sensors. Install date confirmed for next week."),
            (7,  "Odom - 6-Camera Package",                    3200, "Install Scheduled",       38, "6 cameras + panel + smart lock. Install crew assigned."),
            (12, "Norwood Dental - Office Security",           4500, "Quote Sent",              35, "Commercial: 6 cameras, alarm panel, after-hours monitoring. $64.99/mo."),
            (13, "Combs - Outdoor Camera Package",             2200, "Quote Sent",              30, "4 outdoor cameras with night vision. Package theft prevention."),
            (15, "Harmon - Highlands Estate Security",         6200, "Quote Sent",              25, "Comprehensive: 10 cameras, panel, smart locks, glass break, monitoring. $64.99/mo."),
            (14, "Riddle Construction - Temp Site Security",   3000, "Negotiation",             28, "6-month temp install. 4 cameras + motion lights. Negotiating monthly rate."),
            (20, "Pratt Law - Access Control",                 4800, "Negotiation",             22, "Server room access control + 6 cameras. Discussing HIPAA compliance."),
            (16, "Buckner - Basic Camera Package",             1800, "Consultation Complete",   18, "2 outdoor cameras + panel. Completed home walkthrough."),
            (17, "Sparks - Smart Lock & Doorbell",             1200, "Consultation Complete",   15, "Smart lock + video doorbell. No alarm system needed."),
            (18, "Pope Auto - Lot Cameras",                    3800, "Consultation Scheduled",  12, "Used car lot. 8 perimeter cameras + night vision. Site visit Thursday."),
            (19, "Shafer - Townhouse Smart Home",              1400, "Consultation Scheduled",  10, "Doorbell cam + smart lock. HOA already approved."),
            (21, "Gibbons - Home Security Package",            2400, "Contacted",                8, "Wants cameras and monitoring. Scheduled discovery call."),
            (8,  "Watts Electric - Camera Upgrade",            2000, "Contacted",                6, "Adding 2 more cameras to existing commercial system."),
            (9,  "Pittman - System Upgrade",                   1600, "Contacted",                5, "Wants to add cameras to existing alarm-only system."),
            (22, "Bowman - Camera System",                     2000, "New Lead",                 3, "Google Ads lead. Clicked camera ad. Not yet contacted."),
            (23, "Vance - Apartment Security",                 900,  "New Lead",                 2, "Facebook lead. Smart lock + indoor camera for apartment."),
            (24, "Dunlap Properties - Multi-Unit Alarms",      4500, "New Lead",                 1, "Property manager. 5 rental units need basic alarms. High value."),
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
            if stage_name == "Won":
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
            "Quote Sent", "Negotiation", "Install Scheduled", "Installed", "Won",
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

        # ── Tasks (20) ────────────────────────────────────
        tasks_data = [
            # (ci, di, title, desc, type, priority, status, due_days_from_now, completed)
            # Completed tasks (8)
            (0,  0,  "System test - Crawford home",              "Quarterly system check. Test all 6 cameras, panel, sensors.",       "site_visit",  "low",    "completed", -21, True),
            (1,  1,  "Welcome call - Thornton",                  "Post-install check-in. Walk through ADT app features.",             "call",        "medium", "completed", -18, True),
            (2,  2,  "Hale smart lock programming",              "Program 4 user codes for smart locks. Test auto-lock schedule.",    "install",     "medium", "completed", -14, True),
            (3,  3,  "Prescott 8-camera walkthrough",            "Final walkthrough with homeowner. Demo app zones and alerts.",      "site_visit",  "high",   "completed", -12, True),
            (4,  4,  "Whitfield commercial alarm test",          "Monthly alarm test with monitoring center. All zones clear.",       "site_visit",  "medium", "completed",  -8, True),
            (5,  8,  "Ellis camera install complete",            "Installed 2 additional outdoor cameras. Tested night vision.",      "install",     "high",   "completed",  -5, True),
            (10, 11, "Ingram system orientation",                "Walk Keith through panel operation and app setup.",                 "install",     "medium", "completed",  -3, True),
            (11, None, "Mack doorbell cam install",              "Installed video doorbell at Vanessa's condo unit.",                 "install",     "low",    "completed",  -2, True),

            # Pending tasks (10)
            (12, 11, "Follow up on Norwood Dental quote",        "Quote sent 5 days ago. Check if Dr. Norwood has questions.",       "follow_up",   "high",   "pending",    1,  False),
            (15, 13, "Harmon estate - revised quote",            "Cynthia wants to add 2 more cameras. Update and resend quote.",    "follow_up",   "medium", "pending",    2,  False),
            (14, 14, "Riddle construction site visit",           "Survey construction site for camera mounting locations.",           "site_visit",  "high",   "pending",    3,  False),
            (18, 18, "Pope Auto lot - site survey",              "Measure perimeter for camera placement. Meet Randall at lot.",      "site_visit",  "high",   "pending",    4,  False),
            (20, 15, "Pratt Law follow-up call",                 "Discuss access control options and HIPAA requirements.",            "call",        "high",   "pending",    2,  False),
            (6,  9,  "Brantley install - prep equipment",        "Prep panel, 2 sensors, wiring kit for Thursday install.",          "install",     "medium", "pending",    5,  False),
            (7,  10, "Odom install - 6 cameras",                 "Full day install. 6 cameras, panel, smart lock. Crew of 2.",       "install",     "high",   "pending",    7,  False),
            (21, 20, "Call Gibbons - discovery",                 "Initial discovery call. She wants cameras and monitoring.",         "call",        "medium", "pending",    1,  False),
            (25, None, "Callback Brittany Yates",                "Referred by Keith Ingram. Wants same camera setup.",               "call",        "medium", "pending",    0,  False),
            (26, None, "Call Ray Lyons - urgent lead",           "Recent break-in on his street. Wants security ASAP.",              "call",        "high",   "pending",   -1,  False),

            # Overdue tasks (2)
            (13, 12, "Combs quote follow-up",                    "Quote sent 10 days ago. Need to check in on decision.",            "follow_up",   "high",   "pending",   -3,  False),
            (16, 16, "Buckner - send quote",                     "Home walkthrough complete. Need to build and send quote.",         "follow_up",   "medium", "pending",   -2,  False),
        ]

        for ci, di, title, desc, ttype, priority, status, due_days, completed in tasks_data:
            completed_at = ago(-due_days + 1) if completed else None
            completed_by = pick(reps + [tyler_id]) if completed else None
            assignee = pick(reps + [tyler_id])
            days_before = abs(due_days) + random.randint(2, 7)
            db.add(Task(
                id=uid(), organization_id=org_id,
                contact_id=contact_ids[ci],
                deal_id=deal_ids[di] if di is not None else None,
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

        # ── Quotes (10) ──────────────────────────────────
        quote_data = [
            # (ci, di, title, equip_total, monthly, term, status, equip_lines, days_ago)
            # Accepted (3) -- linked to won deals
            (0, 0, "Crawford - Full ADT Home Security", 4200, 54.99, 36, "accepted", [
                {"product_name": "ADT Command Smart Security Panel", "quantity": 1, "unit_price": 299, "total": 299},
                {"product_name": "Outdoor Camera", "quantity": 4, "unit_price": 250, "total": 1000},
                {"product_name": "Indoor Camera", "quantity": 2, "unit_price": 150, "total": 300},
                {"product_name": "Video Doorbell Pro", "quantity": 1, "unit_price": 229, "total": 229},
                {"product_name": "Smart Lock", "quantity": 2, "unit_price": 189, "total": 378},
                {"product_name": "Door/Window Sensor", "quantity": 8, "unit_price": 45, "total": 360},
                {"product_name": "Motion Detector", "quantity": 3, "unit_price": 75, "total": 225},
                {"product_name": "Glass Break Detector", "quantity": 2, "unit_price": 89, "total": 178},
                {"product_name": "Smoke/CO Detector", "quantity": 2, "unit_price": 95, "total": 190},
                {"product_name": "Installation Labor", "quantity": 1, "unit_price": 599, "total": 599},
            ], 108),
            (3, 3, "Prescott - Premium 8-Camera Package", 5800, 59.99, 48, "accepted", [
                {"product_name": "Outdoor Camera", "quantity": 6, "unit_price": 250, "total": 1500},
                {"product_name": "Indoor Camera", "quantity": 2, "unit_price": 150, "total": 300},
                {"product_name": "ADT Command Smart Security Panel", "quantity": 1, "unit_price": 299, "total": 299},
                {"product_name": "Video Doorbell Pro", "quantity": 1, "unit_price": 229, "total": 229},
                {"product_name": "Smart Lock", "quantity": 3, "unit_price": 189, "total": 567},
                {"product_name": "Door/Window Sensor", "quantity": 12, "unit_price": 45, "total": 540},
                {"product_name": "Glass Break Detector", "quantity": 4, "unit_price": 89, "total": 356},
                {"product_name": "Smoke/CO Detector", "quantity": 3, "unit_price": 95, "total": 285},
                {"product_name": "Motion Detector", "quantity": 4, "unit_price": 75, "total": 300},
                {"product_name": "Installation Labor", "quantity": 1, "unit_price": 599, "total": 599},
            ], 85),
            (4, 4, "Whitfield Plumbing - Commercial Security", 3500, 54.99, 36, "accepted", [
                {"product_name": "Commercial Alarm Panel", "quantity": 1, "unit_price": 499, "total": 499},
                {"product_name": "Outdoor Camera", "quantity": 4, "unit_price": 250, "total": 1000},
                {"product_name": "Indoor Camera", "quantity": 2, "unit_price": 150, "total": 300},
                {"product_name": "Door/Window Sensor", "quantity": 6, "unit_price": 45, "total": 270},
                {"product_name": "Motion Detector", "quantity": 4, "unit_price": 75, "total": 300},
                {"product_name": "Glass Break Detector", "quantity": 2, "unit_price": 89, "total": 178},
                {"product_name": "Installation Labor", "quantity": 1, "unit_price": 499, "total": 499},
            ], 78),

            # Sent (3) -- pending customer response
            (12, 11, "Norwood Dental - Office Security Package", 4500, 64.99, 36, "sent", [
                {"product_name": "Commercial Alarm Panel", "quantity": 1, "unit_price": 499, "total": 499},
                {"product_name": "Outdoor Camera", "quantity": 2, "unit_price": 250, "total": 500},
                {"product_name": "Indoor Camera", "quantity": 4, "unit_price": 150, "total": 600},
                {"product_name": "Door/Window Sensor", "quantity": 6, "unit_price": 45, "total": 270},
                {"product_name": "Motion Detector", "quantity": 3, "unit_price": 75, "total": 225},
                {"product_name": "Smart Lock", "quantity": 2, "unit_price": 189, "total": 378},
                {"product_name": "Smoke/CO Detector", "quantity": 2, "unit_price": 95, "total": 190},
                {"product_name": "Installation Labor", "quantity": 1, "unit_price": 599, "total": 599},
            ], 8),
            (13, 12, "Combs - Outdoor Camera Package", 2200, 39.99, 36, "sent", [
                {"product_name": "Outdoor Camera", "quantity": 4, "unit_price": 250, "total": 1000},
                {"product_name": "Video Doorbell Pro", "quantity": 1, "unit_price": 229, "total": 229},
                {"product_name": "ADT Command Smart Security Panel", "quantity": 1, "unit_price": 299, "total": 299},
                {"product_name": "Door/Window Sensor", "quantity": 4, "unit_price": 45, "total": 180},
                {"product_name": "Installation Labor", "quantity": 1, "unit_price": 299, "total": 299},
            ], 10),
            (15, 13, "Harmon - Highlands Estate Security", 6200, 64.99, 48, "sent", [
                {"product_name": "Outdoor Camera", "quantity": 8, "unit_price": 250, "total": 2000},
                {"product_name": "Indoor Camera", "quantity": 2, "unit_price": 150, "total": 300},
                {"product_name": "ADT Command Smart Security Panel", "quantity": 1, "unit_price": 299, "total": 299},
                {"product_name": "Video Doorbell Pro", "quantity": 2, "unit_price": 229, "total": 458},
                {"product_name": "Smart Lock", "quantity": 4, "unit_price": 189, "total": 756},
                {"product_name": "Door/Window Sensor", "quantity": 16, "unit_price": 45, "total": 720},
                {"product_name": "Glass Break Detector", "quantity": 6, "unit_price": 89, "total": 534},
                {"product_name": "Smoke/CO Detector", "quantity": 4, "unit_price": 95, "total": 380},
                {"product_name": "Motion Detector", "quantity": 5, "unit_price": 75, "total": 375},
                {"product_name": "Installation Labor", "quantity": 1, "unit_price": 599, "total": 599},
            ], 5),

            # Draft (2)
            (16, 16, "Buckner - Basic Camera Package", 1800, 39.99, 36, "draft", [
                {"product_name": "Outdoor Camera", "quantity": 2, "unit_price": 250, "total": 500},
                {"product_name": "ADT Command Smart Security Panel", "quantity": 1, "unit_price": 299, "total": 299},
                {"product_name": "Door/Window Sensor", "quantity": 4, "unit_price": 45, "total": 180},
                {"product_name": "Motion Detector", "quantity": 2, "unit_price": 75, "total": 150},
                {"product_name": "Installation Labor", "quantity": 1, "unit_price": 299, "total": 299},
            ], 2),
            (17, 17, "Sparks - Smart Lock & Doorbell", 1200, 0, 0, "draft", [
                {"product_name": "Smart Lock", "quantity": 2, "unit_price": 189, "total": 378},
                {"product_name": "Video Doorbell Pro", "quantity": 1, "unit_price": 229, "total": 229},
                {"product_name": "Indoor Camera", "quantity": 1, "unit_price": 150, "total": 150},
                {"product_name": "Installation Labor", "quantity": 1, "unit_price": 199, "total": 199},
            ], 1),

            # Rejected (1)
            (31, 5, "Swift - Basic Home Security", 1500, 39.99, 36, "rejected", [
                {"product_name": "ADT Command Smart Security Panel", "quantity": 1, "unit_price": 299, "total": 299},
                {"product_name": "Door/Window Sensor", "quantity": 6, "unit_price": 45, "total": 270},
                {"product_name": "Motion Detector", "quantity": 2, "unit_price": 75, "total": 150},
                {"product_name": "Smoke/CO Detector", "quantity": 2, "unit_price": 95, "total": 190},
                {"product_name": "Installation Labor", "quantity": 1, "unit_price": 299, "total": 299},
            ], 58),

            # Expired (1)
            (32, 7, "Stokes - Home Camera System", 2400, 44.99, 36, "expired", [
                {"product_name": "Outdoor Camera", "quantity": 4, "unit_price": 250, "total": 1000},
                {"product_name": "ADT Command Smart Security Panel", "quantity": 1, "unit_price": 299, "total": 299},
                {"product_name": "Door/Window Sensor", "quantity": 4, "unit_price": 45, "total": 180},
                {"product_name": "Motion Detector", "quantity": 2, "unit_price": 75, "total": 150},
                {"product_name": "Installation Labor", "quantity": 1, "unit_price": 399, "total": 399},
            ], 65),
        ]

        quote_ids = []
        for ci, di, title, equip_total, monthly, term, qstatus, equip_lines, days in quote_data:
            qid = uid()
            quote_ids.append(qid)
            total_contract_value = round(equip_total + (monthly * term), 2) if term > 0 else float(equip_total)
            accepted_at = ago(days - 2) if qstatus == "accepted" else None
            sent_at = ago(days) if qstatus in ("sent", "accepted", "rejected", "expired") else None
            valid_until = NOW + timedelta(days=30) if qstatus in ("draft", "sent") else ago(days - 30)
            db.add(Quote(
                id=qid, organization_id=org_id,
                deal_id=deal_ids[di] if di is not None else None,
                contact_id=contact_ids[ci],
                created_by=pick(reps), title=title, status=qstatus,
                equipment_total=equip_total,
                monthly_monitoring_amount=monthly,
                contract_term_months=term if term > 0 else 36,
                auto_renewal=True,
                total_contract_value=total_contract_value,
                equipment_lines=equip_lines,
                valid_until=valid_until,
                sent_at=sent_at, accepted_at=accepted_at,
                created_at=ago(days + 2), updated_at=ago(max(0, days - 1)),
            ))
        db.flush()

        # ── Subscriptions (monthly monitoring - no formal contracts) ──
        # Medley & Sons doesn't do contracts. Customers pay:
        #   1) One-time: equipment + install (invoiced at time of sale)
        #   2) Recurring: monthly monitoring bill
        # Subscriptions track the recurring monthly monitoring.
        monitoring_customers = [
            # (contact_idx, monthly_amount, started_days_ago)
            (0,  54.99, 100),  # Crawford - full system
            (1,  39.99,  90),  # Thornton - basic
            (2,  49.99,  82),  # Hale - smart home
            (3,  59.99,  75),  # Prescott - premium
            (4,  54.99,  70),  # Whitfield - commercial
            (5,  49.99,  40),  # Ellis - upgraded
            (6,  39.99,  35),  # Brantley - basic (just installed)
            (7,  44.99,  30),  # Odom - 6 cameras
            (8,  59.99,  65),  # Watts - commercial
            (9,  39.99,  55),  # Pittman - townhouse
            (10, 44.99,  25),  # Ingram - cameras + panel
            (11, 39.99,  20),  # Mack - condo doorbell
        ]

        subscription_ids = []
        sub_contact_map = {}  # sub_id -> contact_id
        sub_monthly_map = {}  # sub_id -> monthly amount

        for ci, monthly, started_ago in monitoring_customers:
            sid = uid()
            subscription_ids.append(sid)
            sub_contact_map[sid] = contact_ids[ci]
            sub_monthly_map[sid] = monthly

            db.add(Subscription(
                id=sid, organization_id=org_id,
                contract_id=None, contact_id=contact_ids[ci],
                status="active", amount=monthly, currency="usd",
                billing_interval="monthly", billing_interval_count=1,
                billing_anchor_day=1,
                current_period_start=ago_date(28),
                current_period_end=ago_date(0),
                next_billing_date=ago_date(-1),
                failed_payment_count=0,
                last_payment_at=ago(28),
                created_at=ago(started_ago), updated_at=ago(1),
            ))
        db.flush()

        # ── Invoices ────────────────────────────────────
        # Two types:
        #   A) Equipment + install invoices (one-time, paid at sale)
        #   B) Monthly monitoring invoices (recurring)
        invoice_records = []
        inv_num = 1

        # A) One-time equipment invoices for won customers (paid)
        equipment_invoices = [
            # (contact_idx, amount, description, days_ago_paid)
            (0,  4200, "Equipment and installation - Full ADT System (6 cameras, panel, sensors, smart locks)", 98),
            (1,  1500, "Equipment and installation - Basic ADT Package (panel, 3 sensors)",                      88),
            (2,  2800, "Equipment and installation - Smart Home Bundle (locks, doorbell, panel, 2 cameras)",     80),
            (3,  5800, "Equipment and installation - Premium 8-Camera Package",                                  73),
            (4,  3500, "Equipment and installation - Commercial System (Whitfield Plumbing)",                    68),
            (5,  1800, "Equipment and installation - Smart Home Upgrade (2 additional cameras)",                 38),
            (10, 1600, "Equipment and installation - Camera + Panel Package (Ingram)",                           23),
            (11,  650, "Equipment and installation - Video Doorbell + Sensors (Mack condo)",                     18),
        ]

        for ci, amount, desc, days_ago in equipment_invoices:
            invoice_records.append((
                contact_ids[ci], None, None,
                f"INV-2025-{inv_num:04d}", "paid", amount,
                ago_date(days_ago), ago_date(days_ago - 15), None, None,
                desc,
            ))
            inv_num += 1

        # B) Monthly monitoring invoices
        # For each active subscriber: paid Dec, paid Jan, current Feb
        for sub_idx, (ci, monthly, started_ago) in enumerate(monitoring_customers):
            sid = subscription_ids[sub_idx]

            # Only create past invoices if the customer has been active long enough
            if started_ago >= 88:
                # Paid - December 2025
                invoice_records.append((
                    contact_ids[ci], None, sid,
                    f"INV-2025-{inv_num:04d}", "paid", monthly,
                    ago_date(88), ago_date(58), ago_date(88), ago_date(58),
                    f"Monthly monitoring - December 2025",
                ))
                inv_num += 1

            if started_ago >= 58:
                # Paid - January 2026
                invoice_records.append((
                    contact_ids[ci], None, sid,
                    f"INV-2026-{inv_num:04d}", "paid", monthly,
                    ago_date(58), ago_date(28), ago_date(58), ago_date(28),
                    f"Monthly monitoring - January 2026",
                ))
                inv_num += 1

            if started_ago >= 28:
                # February 2026 - mix of sent and past_due
                feb_status = "past_due" if sub_idx in (2, 7) else "sent"
                invoice_records.append((
                    contact_ids[ci], None, sid,
                    f"INV-2026-{inv_num:04d}", feb_status, monthly,
                    ago_date(28), ago_date(0), ago_date(28), ago_date(0),
                    f"Monthly monitoring - February 2026",
                ))
                inv_num += 1

        # 2 draft invoices (upcoming March for longest customers)
        for sub_idx in [0, 3]:
            ci = monitoring_customers[sub_idx][0]
            monthly = monitoring_customers[sub_idx][1]
            sid = subscription_ids[sub_idx]
            invoice_records.append((
                contact_ids[ci], None, sid,
                f"INV-2026-{inv_num:04d}", "draft", monthly,
                ago_date(0), ago_date(-30), ago_date(0), ago_date(-30),
                f"Monthly monitoring - March 2026 (draft)",
            ))
            inv_num += 1

        # 2 void invoices (billing corrections)
        invoice_records.append((
            contact_ids[2], None, subscription_ids[2],
            f"INV-2025-{inv_num:04d}", "void", 49.99,
            ago_date(60), ago_date(30), ago_date(60), ago_date(30),
            "VOIDED - Duplicate billing correction",
        ))
        inv_num += 1
        invoice_records.append((
            contact_ids[4], None, subscription_ids[4],
            f"INV-2025-{inv_num:04d}", "void", 54.99,
            ago_date(45), ago_date(15), ago_date(45), ago_date(15),
            "VOIDED - Wrong amount, re-issued",
        ))

        invoice_ids_data = []
        for contact_id, cid_c, sid, inv_number, inv_status, amount, inv_date, due_dt, period_start, period_end, memo in invoice_records:
            iid = uid()
            paid_at = ago(random.randint(1, 5)) if inv_status == "paid" else None
            amt_paid = float(amount) if inv_status == "paid" else 0
            amt_due = 0 if inv_status in ("paid", "void") else float(amount)
            sent_at = ago(30) if inv_status not in ("draft",) else None
            voided_at = ago(random.randint(10, 30)) if inv_status == "void" else None

            # Build line items based on invoice type
            if amount > 500:
                # Equipment invoice - use memo as description
                line_items = [{"description": memo, "quantity": 1, "unit_price": float(amount), "amount": float(amount)}]
            else:
                # Monitoring invoice
                line_items = [{"description": "Monthly ADT Monitoring Service", "quantity": 1, "unit_price": float(amount), "amount": float(amount)}]

            invoice_ids_data.append((iid, inv_status, amount, contact_id, cid_c, sid))
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
                line_items=line_items,
                memo=memo,
                sent_at=sent_at, paid_at=paid_at, voided_at=voided_at,
                created_at=ago(max(35, 1)), updated_at=ago(1),
            ))
        db.flush()

        # ── Payments (for paid invoices) ─────────────────
        card_last4s = ["4242", "1881", "9012", "3456", "7890", "5555", "2468", "1357", "8024", "6611"]
        pay_idx = 0
        for iid, inv_status, amount, contact_id, cid_c, sid in invoice_ids_data:
            if inv_status == "paid":
                db.add(Payment(
                    id=uid(), organization_id=org_id,
                    contact_id=contact_id, contract_id=cid_c,
                    subscription_id=sid, invoice_id=iid,
                    status="succeeded", amount=float(amount), amount_refunded=0,
                    currency="usd",
                    payment_method_type="card",
                    payment_method_last4=card_last4s[pay_idx % len(card_last4s)],
                    payment_date=ago_date(random.randint(1, 10)),
                    attempt_number=1,
                    created_at=ago(random.randint(1, 10)),
                ))
                pay_idx += 1
        db.flush()

        # ── Activities (30) ──────────────────────────────
        activities_data = [
            # Early pipeline activities
            (0,  0,  "call",    "Initial consultation - Danny Crawford",       "Walked through home. 6 camera locations identified. Very interested in full ADT package.", marcus_id, 110),
            (0,  0,  "email",   "Sent Crawford quote",                         "Emailed full system quote: $4,200 equipment + $54.99/mo monitoring.",                      marcus_id, 108),
            (0,  0,  "note",    "Crawford - sold, install scheduled",          "Accepted quote. Equipment paid. Install scheduled for next Tuesday. $54.99/mo monitoring.", marcus_id, 100),
            (1,  1,  "call",    "Thornton discovery call",                     "Basic needs: alarm + 3 sensors. Budget-conscious. Offered basic package.",                  sarah_id,  98),
            (1,  1,  "note",    "Thornton install complete",                   "Install done. Panel + 3 sensors. Showed Rebecca the ADT app.",                             tyler_id,  88),
            (3,  3,  "meeting", "Prescott home walkthrough",                   "4,500 sq ft home in Highlands. Mapped 8 camera positions. Premium package.",               marcus_id, 86),
            (3,  3,  "email",   "Sent Prescott premium quote",                 "Emailed quote: 8 cameras, smart locks, full sensor suite. $5,800 + $59.99/mo.",            marcus_id, 85),
            (4,  4,  "meeting", "Whitfield Plumbing site survey",              "Surveyed shop + warehouse. 4 camera positions, after-hours alarm zones.",                   sarah_id,  80),
            (2,  2,  "call",    "Hale smart home consultation",                "Marcus walked through smart home options. Wants locks, doorbell cam, and panel.",           marcus_id, 90),
            (2,  2,  "note",    "Hale install complete",                       "Smart locks programmed, doorbell cam live, panel connected to monitoring.",                 tyler_id,  78),

            # Recent pipeline activities
            (12, 11, "meeting", "Norwood Dental - site survey",                "Surveyed dental office. 6 camera positions, alarm panel behind reception.",                 sarah_id,  12),
            (12, 11, "email",   "Sent Norwood Dental quote",                   "Commercial package: $4,500 equipment + install. $64.99/mo monitoring.",                     sarah_id,   8),
            (13, 12, "call",    "Combs discovery call",                        "Anita worried about package thefts. Wants 4 outdoor cameras with night vision.",            marcus_id, 32),
            (13, 12, "email",   "Sent Combs camera quote",                     "4 outdoor cameras + doorbell + panel. $2,200 + $39.99/mo.",                                marcus_id, 10),
            (15, 13, "meeting", "Harmon Highlands estate walkthrough",         "6,000+ sq ft home. 10 camera positions, 4 smart locks, full sensor coverage.",             sarah_id,   8),
            (15, 13, "email",   "Sent Harmon estate quote",                    "Comprehensive package: $6,200 equipment + install. $64.99/mo monitoring.",                  sarah_id,   5),
            (14, 14, "call",    "Riddle Construction initial call",            "Construction site needs temporary security. 4 cameras + motion lights. 6-month term.",      marcus_id, 28),
            (20, 15, "meeting", "Pratt Law office meeting",                    "Met with office manager. Server room access control + 6 cameras. HIPAA discussion.",        sarah_id,  22),
            (18, 18, "call",    "Pope Auto lot inquiry",                       "Randall wants perimeter cameras for used car lot. Budget is tight. Scheduling site visit.", marcus_id, 12),
            (19, 19, "email",   "Shafer HOA confirmation",                     "HOA approved doorbell cam + smart lock install. Scheduling consultation.",                  sarah_id,  10),

            # Customer follow-ups
            (5,  8,  "note",    "Ellis camera upgrade complete",               "Installed 2 additional outdoor cameras. Night vision verified working.",                    tyler_id,   5),
            (6,  9,  "call",    "Brantley pre-install confirmation",           "Confirmed Thursday install. Panel + 2 sensors. Tyler will handle.",                         marcus_id,  7),
            (7,  10, "call",    "Odom install scheduling",                     "Full day install confirmed. 6 cameras + panel + smart lock. 2-person crew.",               sarah_id,   6),
            (10, None, "call",  "Ingram post-install check-in",               "Keith loves the system. App working great. Referred Brittany Yates.",                        marcus_id,  3),
            (11, None, "note",  "Mack doorbell install done",                  "Video doorbell installed at Vanessa's condo. Quick 45-min job.",                            tyler_id,   2),

            # New lead activities
            (21, 20, "call",    "Gibbons initial outreach",                    "Left voicemail. She wants cameras and monitoring. Will try again tomorrow.",                sarah_id,   4),
            (22, 23, "note",    "Bowman - Google Ads lead received",           "New Google Ads conversion. Clicked outdoor camera ad. Need to call.",                       marcus_id,  3),
            (24, 25, "email",   "Dunlap Properties inquiry response",         "Responded to website form. Property manager needs alarms for 5 rental units.",              sarah_id,   1),
            (26, None, "note",  "Lyons - urgent lead noted",                  "Recent break-in on Ray's street. Marked as high priority. Call ASAP.",                       marcus_id,  1),
            (9,  22, "call",    "Pittman upgrade discussion",                  "Shawna wants to add cameras to her townhouse alarm system. Scheduling walkthrough.",        sarah_id,   5),
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
    print("  Medley & Sons Security - Seed Complete!")
    print()
    print("  Organization : Medley & Sons Security")
    print("                 1415 Bardstown Rd, Ste 12, Louisville, KY 40204")
    print()
    print("  Users        : 5")
    print("    ethan@medleyandsons.com    (owner)     - Ethan Medley")
    print("    jordan@medleyandsons.com   (admin)     - Jordan Medley")
    print("    marcus@medleyandsons.com   (sales_rep) - Marcus Williams")
    print("    sarah@medleyandsons.com    (sales_rep) - Sarah Chen")
    print("    tyler@medleyandsons.com    (technician)- Tyler Brooks")
    print()
    print("  All passwords: Demo1234!")
    print()
    print("  Data:")
    print("    Contacts     : 35  (12 customers, 10 active, 8 new, 5 inactive)")
    print("    Pipeline     : 1   (10 stages -- won stage = 'Won', no contracts)")
    print("    Deals        : 26  (5 won, 3 lost, 18 active)")
    print("    Quotes       : 10  (3 accepted, 3 sent, 2 draft, 1 rejected, 1 expired)")
    print("    Contracts    : 0   (Medley does not use formal contracts)")
    print("    Subscriptions: 12  (monthly monitoring for all 12 customers)")
    print("    Invoices     : ~30 (equipment one-time + monthly monitoring recurring)")
    print("    Payments     : for all paid invoices (succeeded)")
    print("    Tasks        : 20  (8 completed, 10 pending, 2 overdue)")
    print("    Activities   : 30")
    print()


if __name__ == "__main__":
    seed()
