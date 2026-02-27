"""
Notification service -- Email sending via Resend.

Uses the Resend SDK when RESEND_API_KEY is configured.
Falls back to logging when no API key is set (development mode).
"""

import logging

import resend

from app.config import get_settings

logger = logging.getLogger(__name__)

_settings = get_settings()

# Configure Resend SDK
if _settings.resend_api_key:
    resend.api_key = _settings.resend_api_key
    logger.info("Resend API key configured -- emails will be sent.")
else:
    logger.info("No Resend API key -- emails will be logged only.")


# ── Email Sending ────────────────────────────────────


async def send_email(
    to: str,
    subject: str,
    html_body: str,
    *,
    from_email: str = "CLOSI CRM <noreply@closi.app>",
) -> bool:
    """Send an email via Resend.

    Returns True if sent successfully, False otherwise.
    Falls back to logging when no Resend API key is configured.
    """
    if not _settings.resend_api_key:
        logger.info(f"[EMAIL STUB] To: {to}, Subject: {subject}")
        return True

    try:
        params: resend.Emails.SendParams = {
            "from": from_email,
            "to": [to],
            "subject": subject,
            "html": html_body,
        }
        resend.Emails.send(params)
        logger.info(f"Email sent to {to}: {subject}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to}: {e}")
        return False


async def send_invoice_email(
    to: str,
    invoice_number: str,
    amount: float,
    due_date: str,
    pdf_url: str | None = None,
) -> bool:
    """Send an invoice notification email."""
    subject = f"Invoice #{invoice_number} - ${amount:.2f} due {due_date}"
    html_body = f"""
    <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #6C63FF; padding: 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">CLOSI</h1>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1a1a2e; margin-top: 0;">Invoice #{invoice_number}</h2>
            <p style="color: #1a1a2e;">Amount due: <strong>${amount:.2f}</strong></p>
            <p style="color: #1a1a2e;">Due date: <strong>{due_date}</strong></p>
            {f'<p><a href="{pdf_url}" style="color: #6C63FF; font-weight: 600;">View Invoice PDF</a></p>' if pdf_url else ''}
        </div>
        <p style="color: #6b7280; font-size: 12px; text-align: center; margin-top: 16px;">
            Sent via CLOSI CRM
        </p>
    </div>
    """
    return await send_email(to, subject, html_body)


async def send_invoice_reminder(
    to: str,
    invoice_number: str,
    amount: float,
    due_date: str,
    pdf_url: str | None = None,
) -> bool:
    """Send an invoice payment reminder email."""
    subject = f"Payment Reminder - Invoice #{invoice_number}"
    html_body = f"""
    <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #6C63FF; padding: 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">CLOSI</h1>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1a1a2e; margin-top: 0;">Payment Reminder</h2>
            <p style="color: #1a1a2e;">Invoice <strong>#{invoice_number}</strong> for <strong>${amount:.2f}</strong> is due on <strong>{due_date}</strong>.</p>
            <p style="color: #1a1a2e;">Please arrange payment at your earliest convenience.</p>
            {f'<p><a href="{pdf_url}" style="color: #6C63FF; font-weight: 600;">View Invoice PDF</a></p>' if pdf_url else ''}
        </div>
        <p style="color: #6b7280; font-size: 12px; text-align: center; margin-top: 16px;">
            Sent via CLOSI CRM
        </p>
    </div>
    """
    return await send_email(to, subject, html_body)


async def send_invite_email(
    to: str,
    inviter_name: str,
    org_name: str,
    invite_url: str,
) -> bool:
    """Send a user invitation email."""
    subject = f"You've been invited to {org_name} on Closi"
    html_body = f"""
    <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #6C63FF; padding: 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">CLOSI</h1>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1a1a2e; margin-top: 0;">You're invited!</h2>
            <p style="color: #1a1a2e;">{inviter_name} has invited you to join <strong>{org_name}</strong> on Closi CRM.</p>
            <p style="margin-top: 24px;">
                <a href="{invite_url}" style="background: #6C63FF; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
                    Accept Invitation
                </a>
            </p>
        </div>
        <p style="color: #6b7280; font-size: 12px; text-align: center; margin-top: 16px;">
            Sent via CLOSI CRM
        </p>
    </div>
    """
    return await send_email(to, subject, html_body)


async def send_overdue_reminder(
    to: str,
    invoice_number: str,
    amount: float,
    days_overdue: int,
) -> bool:
    """Send an overdue payment reminder."""
    subject = f"Payment Overdue - Invoice #{invoice_number}"
    html_body = f"""
    <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #6C63FF; padding: 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">CLOSI</h1>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <h2 style="color: #dc2626; margin-top: 0;">Payment Overdue</h2>
            <p style="color: #1a1a2e;">Invoice <strong>#{invoice_number}</strong> for <strong>${amount:.2f}</strong> is <strong>{days_overdue} day(s) overdue</strong>.</p>
            <p style="color: #1a1a2e;">Please arrange payment immediately to avoid service interruption.</p>
        </div>
        <p style="color: #6b7280; font-size: 12px; text-align: center; margin-top: 16px;">
            Sent via CLOSI CRM
        </p>
    </div>
    """
    return await send_email(to, subject, html_body)


async def send_quote_email(
    to: str,
    contact_name: str,
    quote_title: str,
    org_name: str,
    pdf_url: str | None = None,
) -> bool:
    """Send a quote to a contact."""
    subject = f"Quote from {org_name}: {quote_title}"
    html_body = f"""
    <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #6C63FF; padding: 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">CLOSI</h1>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1a1a2e; margin-top: 0;">Hi {contact_name},</h2>
            <p style="color: #1a1a2e;">Please find your quote for <strong>{quote_title}</strong> from {org_name}.</p>
            {f'<p><a href="{pdf_url}" style="color: #6C63FF; font-weight: 600;">View Quote PDF</a></p>' if pdf_url else ''}
        </div>
        <p style="color: #6b7280; font-size: 12px; text-align: center; margin-top: 16px;">
            Sent via CLOSI CRM
        </p>
    </div>
    """
    return await send_email(to, subject, html_body)
