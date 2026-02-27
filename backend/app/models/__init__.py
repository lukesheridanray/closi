# Import all models here so Alembic can detect them
from app.models.organization import Organization  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.contact import Contact  # noqa: F401
from app.models.pipeline import Pipeline, PipelineStage  # noqa: F401
from app.models.deal import Deal  # noqa: F401
from app.models.stage_history import StageHistory  # noqa: F401
from app.models.activity import Activity  # noqa: F401
from app.models.task import Task, TaskComment  # noqa: F401
from app.models.calendar_sync import CalendarSync  # noqa: F401
from app.models.quote import Quote  # noqa: F401
from app.models.contract import Contract  # noqa: F401
from app.models.subscription import Subscription  # noqa: F401
from app.models.invoice import Invoice  # noqa: F401
from app.models.payment import Payment  # noqa: F401
from app.models.product import Product  # noqa: F401
from app.models.inventory import InventoryLocation, InventoryStock, InventoryTransaction  # noqa: F401
from app.models.referral import Referral  # noqa: F401
from app.models.raw_inbound_log import RawInboundLog  # noqa: F401
from app.models.payment_provider import PaymentProviderConfig, CustomerPaymentProfile, PaymentWebhookLog  # noqa: F401
from app.models.import_template import ImportTemplate  # noqa: F401
