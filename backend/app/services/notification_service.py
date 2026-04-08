"""
Notification service -- Email sending via Resend.

Uses the Resend SDK when RESEND_API_KEY is configured.
Falls back to logging when no API key is set (development mode).
"""

import logging
from html import escape as html_escape

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
    from_email: str = "LSRV CRM <noreply@foodenough.app>",
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
            <h1 style="color: white; margin: 0; font-size: 20px;">LSRV CRM</h1>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1a1a2e; margin-top: 0;">Invoice #{invoice_number}</h2>
            <p style="color: #1a1a2e;">Amount due: <strong>${amount:.2f}</strong></p>
            <p style="color: #1a1a2e;">Due date: <strong>{due_date}</strong></p>
            {f'<p><a href="{pdf_url}" style="color: #6C63FF; font-weight: 600;">View Invoice PDF</a></p>' if pdf_url else ''}
        </div>
        <p style="color: #6b7280; font-size: 12px; text-align: center; margin-top: 16px;">
            Sent via LSRV CRM
        </p>
    </div>
    """
    return await send_email(to, subject, html_body)


async def send_payment_receipt_email(
    to: str,
    contact_name: str,
    invoice_number: str,
    amount: float,
    description: str,
    payment_method: str = "",
    payment_date: str = "",
) -> bool:
    """Send a payment receipt/confirmation email after a charge."""
    safe_name = html_escape(contact_name)
    safe_desc = html_escape(description)
    safe_method = html_escape(payment_method)
    subject = f"Payment Receipt - {invoice_number} - ${amount:.2f}"
    html_body = f"""
    <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #6C63FF; padding: 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">LSRV CRM</h1>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1a1a2e; margin-top: 0;">Payment Receipt</h2>
            <p style="color: #1a1a2e;">Hi {safe_name},</p>
            <p style="color: #1a1a2e;">This confirms your payment has been processed successfully.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                <tr style="border-bottom: 1px solid #e5e7eb;">
                    <td style="padding: 8px 0; color: #6b7280;">Invoice</td>
                    <td style="padding: 8px 0; color: #1a1a2e; text-align: right; font-weight: 600;">#{invoice_number}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e5e7eb;">
                    <td style="padding: 8px 0; color: #6b7280;">Description</td>
                    <td style="padding: 8px 0; color: #1a1a2e; text-align: right;">{safe_desc}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e5e7eb;">
                    <td style="padding: 8px 0; color: #6b7280;">Amount</td>
                    <td style="padding: 8px 0; color: #1a1a2e; text-align: right; font-weight: 600;">${amount:.2f}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e5e7eb;">
                    <td style="padding: 8px 0; color: #6b7280;">Payment Method</td>
                    <td style="padding: 8px 0; color: #1a1a2e; text-align: right;">{safe_method or 'On file'}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Date</td>
                    <td style="padding: 8px 0; color: #1a1a2e; text-align: right;">{payment_date}</td>
                </tr>
            </table>
            <p style="color: #6b7280; font-size: 13px;">If you have questions about this charge, please contact us.</p>
        </div>
        <p style="color: #6b7280; font-size: 12px; text-align: center; margin-top: 16px;">
            Sent via LSRV CRM
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
            <h1 style="color: white; margin: 0; font-size: 20px;">LSRV CRM</h1>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1a1a2e; margin-top: 0;">Payment Reminder</h2>
            <p style="color: #1a1a2e;">Invoice <strong>#{invoice_number}</strong> for <strong>${amount:.2f}</strong> is due on <strong>{due_date}</strong>.</p>
            <p style="color: #1a1a2e;">Please arrange payment at your earliest convenience.</p>
            {f'<p><a href="{pdf_url}" style="color: #6C63FF; font-weight: 600;">View Invoice PDF</a></p>' if pdf_url else ''}
        </div>
        <p style="color: #6b7280; font-size: 12px; text-align: center; margin-top: 16px;">
            Sent via LSRV CRM
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
    subject = f"You've been invited to {org_name} on LSRV CRM"
    html_body = f"""
    <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #6C63FF; padding: 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">LSRV CRM</h1>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1a1a2e; margin-top: 0;">You're invited!</h2>
            <p style="color: #1a1a2e;">{inviter_name} has invited you to join <strong>{org_name}</strong> on LSRV CRM CRM.</p>
            <p style="margin-top: 24px;">
                <a href="{invite_url}" style="background: #6C63FF; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
                    Accept Invitation
                </a>
            </p>
        </div>
        <p style="color: #6b7280; font-size: 12px; text-align: center; margin-top: 16px;">
            Sent via LSRV CRM
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
            <h1 style="color: white; margin: 0; font-size: 20px;">LSRV CRM</h1>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <h2 style="color: #dc2626; margin-top: 0;">Payment Overdue</h2>
            <p style="color: #1a1a2e;">Invoice <strong>#{invoice_number}</strong> for <strong>${amount:.2f}</strong> is <strong>{days_overdue} day(s) overdue</strong>.</p>
            <p style="color: #1a1a2e;">Please arrange payment immediately to avoid service interruption.</p>
        </div>
        <p style="color: #6b7280; font-size: 12px; text-align: center; margin-top: 16px;">
            Sent via LSRV CRM
        </p>
    </div>
    """
    return await send_email(to, subject, html_body)


async def send_quote_email(
    to: str,
    contact_name: str,
    quote_title: str,
    org_name: str,
    equipment_lines: list[dict] | None = None,
    equipment_total: float = 0,
    monthly_amount: float = 0,
    notes: str | None = None,
    pdf_url: str | None = None,
    accept_url: str | None = None,
    decline_url: str | None = None,
) -> bool:
    """Send a quote to a contact with full line item details."""
    safe_name = html_escape(contact_name)
    safe_title = html_escape(quote_title)
    safe_org = html_escape(org_name)

    # Build equipment lines HTML
    lines_html = ""
    if equipment_lines:
        rows = ""
        for line in equipment_lines:
            name = html_escape(str(line.get("product_name", "Item")))
            qty = int(line.get("quantity", 1))
            price = float(line.get("unit_price", 0))
            discount = float(line.get("discount", 0))
            total = float(line.get("total", qty * price))
            discount_html = ""
            if discount > 0:
                original = qty * price
                discount_html = f'<span style="color: #16a34a; font-size: 12px; margin-left: 4px;">({int(discount)}% off)</span>'
            rows += f"""
            <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px 0; color: #1a1a2e;">{name}</td>
                <td style="padding: 8px 0; color: #6b7280; text-align: center;">{qty}</td>
                <td style="padding: 8px 0; color: #1a1a2e; text-align: right; font-weight: 600;">${total:,.2f}{discount_html}</td>
            </tr>"""
        lines_html = f"""
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr style="border-bottom: 2px solid #e5e7eb;">
                <th style="padding: 8px 0; color: #6b7280; text-align: left; font-size: 12px; text-transform: uppercase;">Item</th>
                <th style="padding: 8px 0; color: #6b7280; text-align: center; font-size: 12px; text-transform: uppercase;">Qty</th>
                <th style="padding: 8px 0; color: #6b7280; text-align: right; font-size: 12px; text-transform: uppercase;">Price</th>
            </tr>
            {rows}
            <tr>
                <td colspan="2" style="padding: 10px 0; color: #1a1a2e; font-weight: 700;">Equipment Total</td>
                <td style="padding: 10px 0; color: #1a1a2e; font-weight: 700; text-align: right;">${equipment_total:,.2f}</td>
            </tr>
        </table>"""

    monitoring_html = ""
    if monthly_amount > 0:
        monitoring_html = f"""
        <div style="background: #f3f4f6; padding: 12px 16px; border-radius: 6px; margin: 16px 0;">
            <span style="color: #6b7280; font-size: 14px;">Monthly Monitoring:</span>
            <span style="color: #1a1a2e; font-weight: 700; font-size: 16px; margin-left: 8px;">${monthly_amount:,.2f}/mo</span>
        </div>"""

    notes_html = ""
    if notes:
        safe_notes = html_escape(notes)
        notes_html = f'<p style="color: #6b7280; font-size: 13px; margin-top: 16px; font-style: italic;">{safe_notes}</p>'

    pdf_link_html = ""
    if pdf_url:
        pdf_link_html = f'<p style="margin-top: 16px;"><a href="{pdf_url}" style="color: #6C63FF; font-weight: 600; font-size: 14px;">View Quote PDF</a></p>'

    response_buttons_html = ""
    if accept_url and decline_url:
        response_buttons_html = (
            '<div style="margin-top: 24px; text-align: center;">'
            f'<a href="{accept_url}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px; margin-right: 12px;">Accept Quote</a>'
            f'<a href="{decline_url}" style="display: inline-block; background: #e5e7eb; color: #374151; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">Decline</a>'
            '</div>'
        )

    subject = f"Your Quote from {safe_org}"
    html_body = f"""
    <div style="font-family: Inter, -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #6C63FF; padding: 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">{safe_org}</h1>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1a1a2e; margin-top: 0; font-size: 18px;">Hi {safe_name},</h2>
            <p style="color: #1a1a2e; font-size: 14px;">Thank you for your interest. Here is your quote for <strong>{safe_title}</strong>.</p>
            {lines_html}
            {monitoring_html}
            {notes_html}
            {pdf_link_html}
            {response_buttons_html}
            <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">If you have any questions, please don't hesitate to reach out. We look forward to working with you.</p>
        </div>
        <p style="color: #6b7280; font-size: 11px; text-align: center; margin-top: 16px;">
            Sent by {safe_org}
        </p>
    </div>
    """
    return await send_email(to, subject, html_body)
