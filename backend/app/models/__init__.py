# Import all models here so Alembic can detect them
# Models will be added as they are built in each step:
from app.models.organization import Organization  # noqa: F401
from app.models.user import User  # noqa: F401
# from app.models.contact import Contact
# from app.models.deal import Deal
# from app.models.stage_history import StageHistory
# from app.models.pipeline import Pipeline, PipelineStage
# from app.models.task import Task
# from app.models.quote import Quote
# from app.models.contract import Contract
# from app.models.subscription import Subscription
# from app.models.invoice import Invoice
# from app.models.payment import Payment
# from app.models.product import Product
# from app.models.inventory import InventoryLocation, InventoryStock, InventoryTransaction
# from app.models.integration_source import IntegrationSource
# from app.models.field_mapping import FieldMapping
# from app.models.raw_inbound_log import RawInboundLog
# from app.models.payment_provider import PaymentProviderConfig
