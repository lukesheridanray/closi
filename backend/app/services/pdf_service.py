"""
PDF generation service using ReportLab.
Generates branded PDFs for quotes and invoices.
"""

import io
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER


LSRV_PRIMARY = colors.HexColor("#6C63FF")
LSRV_PRIMARY_LIGHT = colors.HexColor("#E8E7FF")
GRAY_600 = colors.HexColor("#6b7280")
GRAY_200 = colors.HexColor("#e5e7eb")
DARK = colors.HexColor("#1a1a2e")


def _get_styles():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        "Brand", parent=styles["Title"], fontSize=24, textColor=LSRV_PRIMARY,
        spaceAfter=2, fontName="Helvetica-Bold",
    ))
    styles.add(ParagraphStyle(
        "DocType", parent=styles["Heading1"], fontSize=18, textColor=DARK,
        alignment=TA_RIGHT, fontName="Helvetica-Bold",
    ))
    styles.add(ParagraphStyle(
        "SubLabel", fontSize=8, textColor=GRAY_600, fontName="Helvetica-Bold",
        spaceAfter=4, spaceBefore=8,
    ))
    styles.add(ParagraphStyle(
        "AddressText", fontSize=10, textColor=DARK, fontName="Helvetica",
        leading=14,
    ))
    styles.add(ParagraphStyle(
        "TotalLabel", fontSize=10, textColor=DARK, fontName="Helvetica",
    ))
    styles.add(ParagraphStyle(
        "TotalValue", fontSize=10, textColor=DARK, fontName="Helvetica",
        alignment=TA_RIGHT,
    ))
    styles.add(ParagraphStyle(
        "GrandTotal", fontSize=13, textColor=LSRV_PRIMARY, fontName="Helvetica-Bold",
    ))
    styles.add(ParagraphStyle(
        "GrandTotalValue", fontSize=13, textColor=LSRV_PRIMARY, fontName="Helvetica-Bold",
        alignment=TA_RIGHT,
    ))
    styles.add(ParagraphStyle(
        "NotesText", fontSize=9, textColor=DARK, fontName="Helvetica",
        leading=13,
    ))
    styles.add(ParagraphStyle(
        "Footer", fontSize=7, textColor=GRAY_600, fontName="Helvetica",
        alignment=TA_CENTER,
    ))
    styles.add(ParagraphStyle(
        "SectionTitle", fontSize=12, textColor=DARK, fontName="Helvetica-Bold",
        spaceAfter=8, spaceBefore=4,
    ))
    styles.add(ParagraphStyle(
        "MonitoringText", fontSize=10, textColor=LSRV_PRIMARY, fontName="Helvetica-Bold",
    ))
    return styles


def _fmt(amount: float) -> str:
    return f"${amount:,.2f}"


def _build_header(styles, org_name: str, doc_type: str, meta_lines: list[str]):
    """Build a two-column header with brand on left, doc info on right."""
    brand_content = [
        Paragraph("LSRV CRM", styles["Brand"]),
        Paragraph(org_name, ParagraphStyle("OrgName", fontSize=9, textColor=GRAY_600)),
    ]
    info_content = [Paragraph(doc_type, styles["DocType"])]
    for line in meta_lines:
        info_content.append(Paragraph(line, ParagraphStyle(
            "MetaLine", fontSize=9, textColor=GRAY_600, alignment=TA_RIGHT,
        )))

    header_data = [[brand_content, info_content]]
    header_table = Table(header_data, colWidths=[3.5 * inch, 3.5 * inch])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    return header_table


def _build_addresses(styles, from_name: str, from_addr: str, to_label: str, to_name: str, to_addr: str):
    """Build two-column address block."""
    left = [
        Paragraph("FROM", styles["SubLabel"]),
        Paragraph(f"<b>{from_name}</b><br/>{from_addr}", styles["AddressText"]),
    ]
    right = [
        Paragraph(to_label.upper(), styles["SubLabel"]),
        Paragraph(f"<b>{to_name}</b><br/>{to_addr}", styles["AddressText"]),
    ]
    addr_data = [[left, right]]
    addr_table = Table(addr_data, colWidths=[3.5 * inch, 3.5 * inch])
    addr_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    return addr_table


def _build_line_items_table(headers: list[str], rows: list[list[str]]):
    """Build a styled table for line items."""
    data = [headers] + rows
    col_count = len(headers)
    # Auto-size: first column wider, others equal
    col_widths = [3.5 * inch] + [1.17 * inch] * (col_count - 1)

    table = Table(data, colWidths=col_widths, repeatRows=1)
    style_commands = [
        # Header row
        ("BACKGROUND", (0, 0), (-1, 0), LSRV_PRIMARY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        # Body
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 1), (-1, -1), 9),
        ("TEXTCOLOR", (0, 1), (-1, -1), DARK),
        # Alignment: right-align numeric columns
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("ALIGN", (0, 0), (0, -1), "LEFT"),
        # Grid
        ("LINEBELOW", (0, 0), (-1, 0), 1, LSRV_PRIMARY),
        ("LINEBELOW", (0, 1), (-1, -2), 0.5, GRAY_200),
        # Padding
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]
    # Alternate row shading
    for i in range(1, len(data)):
        if i % 2 == 0:
            style_commands.append(("BACKGROUND", (0, i), (-1, i), colors.HexColor("#f9fafb")))

    table.setStyle(TableStyle(style_commands))
    return table


def generate_quote_pdf(
    org_name: str,
    org_address: str,
    contact_name: str,
    contact_address: str,
    quote_title: str,
    quote_status: str,
    equipment_lines: list[dict] | None,
    equipment_total: float,
    monthly_monitoring: float,
    term_months: int,
    auto_renewal: bool,
    total_contract_value: float,
    valid_until: str | None,
    notes: str | None,
    created_at: str,
) -> bytes:
    """Generate a branded quote PDF. Returns PDF bytes."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter, leftMargin=0.6 * inch, rightMargin=0.6 * inch,
                            topMargin=0.5 * inch, bottomMargin=0.5 * inch)
    styles = _get_styles()
    elements = []

    # Header
    meta_lines = [
        f"Status: {quote_status.upper()}",
        f"Date: {created_at[:10]}",
    ]
    if valid_until:
        meta_lines.append(f"Valid until: {valid_until}")
    elements.append(_build_header(styles, org_name, "QUOTE", meta_lines))
    elements.append(HRFlowable(width="100%", thickness=2, color=LSRV_PRIMARY, spaceAfter=16, spaceBefore=8))

    # Addresses
    elements.append(_build_addresses(styles, org_name, org_address, "To", contact_name, contact_address))
    elements.append(Spacer(1, 16))

    # Title
    elements.append(Paragraph(quote_title, styles["SectionTitle"]))
    elements.append(Spacer(1, 8))

    # Equipment table
    rows = []
    for line in (equipment_lines or []):
        rows.append([
            line.get("product_name", ""),
            str(line.get("quantity", 0)),
            _fmt(line.get("unit_price", 0)),
            _fmt(line.get("total", 0)),
        ])
    if rows:
        elements.append(_build_line_items_table(["Product", "Qty", "Unit Price", "Total"], rows))
        elements.append(Spacer(1, 8))

    # Totals
    totals_data = [
        [Paragraph("Equipment Subtotal", styles["TotalLabel"]), Paragraph(_fmt(equipment_total), styles["TotalValue"])],
        [Paragraph("Total Contract Value", styles["GrandTotal"]), Paragraph(_fmt(total_contract_value), styles["GrandTotalValue"])],
    ]
    totals_table = Table(totals_data, colWidths=[5 * inch, 2 * inch])
    totals_table.setStyle(TableStyle([
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("LINEABOVE", (0, -1), (-1, -1), 2, LSRV_PRIMARY),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(totals_table)
    elements.append(Spacer(1, 12))

    # Monitoring
    if monthly_monitoring and monthly_monitoring > 0:
        renewal_text = " (auto-renewal)" if auto_renewal else ""
        elements.append(Paragraph(
            f"Monitoring: {_fmt(monthly_monitoring)}/month for {term_months} months{renewal_text}",
            styles["MonitoringText"],
        ))
        elements.append(Spacer(1, 12))

    # Notes
    if notes:
        elements.append(Paragraph("NOTES", styles["SubLabel"]))
        elements.append(Paragraph(notes, styles["NotesText"]))
        elements.append(Spacer(1, 12))

    # Footer
    elements.append(Spacer(1, 24))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=GRAY_200, spaceAfter=8))
    elements.append(Paragraph(f"Generated by LSRV CRM &bull; {org_name}", styles["Footer"]))

    doc.build(elements)
    return buf.getvalue()


def generate_invoice_pdf(
    org_name: str,
    org_address: str,
    contact_name: str,
    contact_address: str,
    invoice_number: str,
    invoice_status: str,
    invoice_date: str,
    due_date: str,
    line_items: list[dict] | None,
    subtotal: float,
    tax_amount: float,
    total: float,
    amount_paid: float,
    amount_due: float,
    memo: str | None,
) -> bytes:
    """Generate a branded invoice PDF. Returns PDF bytes."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter, leftMargin=0.6 * inch, rightMargin=0.6 * inch,
                            topMargin=0.5 * inch, bottomMargin=0.5 * inch)
    styles = _get_styles()
    elements = []

    # Header
    meta_lines = [
        f"<b>{invoice_number}</b>",
        f"Status: {invoice_status.upper()}",
    ]
    elements.append(_build_header(styles, org_name, "INVOICE", meta_lines))
    elements.append(HRFlowable(width="100%", thickness=2, color=LSRV_PRIMARY, spaceAfter=16, spaceBefore=8))

    # Addresses
    elements.append(_build_addresses(styles, org_name, org_address, "Bill To", contact_name, contact_address))
    elements.append(Spacer(1, 12))

    # Dates
    elements.append(Paragraph(f"<b>Invoice Date:</b> {invoice_date} &nbsp;&nbsp; <b>Due Date:</b> {due_date}",
                              ParagraphStyle("Dates", fontSize=10, textColor=DARK)))
    elements.append(Spacer(1, 16))

    # Line items table
    rows = []
    for item in (line_items or []):
        rows.append([
            item.get("description", ""),
            str(item.get("quantity", 0)),
            _fmt(item.get("unit_price", 0)),
            _fmt(item.get("amount", 0)),
        ])
    if rows:
        elements.append(_build_line_items_table(["Description", "Qty", "Unit Price", "Amount"], rows))
        elements.append(Spacer(1, 8))

    # Totals
    totals_data = [
        [Paragraph("Subtotal", styles["TotalLabel"]), Paragraph(_fmt(subtotal), styles["TotalValue"])],
        [Paragraph("Tax", styles["TotalLabel"]), Paragraph(_fmt(tax_amount), styles["TotalValue"])],
        [Paragraph("Total", styles["GrandTotal"]), Paragraph(_fmt(total), styles["GrandTotalValue"])],
        [Paragraph("Amount Paid", styles["TotalLabel"]), Paragraph(_fmt(amount_paid), styles["TotalValue"])],
        [Paragraph("Amount Due", styles["GrandTotal"]), Paragraph(_fmt(amount_due), styles["GrandTotalValue"])],
    ]
    totals_table = Table(totals_data, colWidths=[5 * inch, 2 * inch])
    totals_table.setStyle(TableStyle([
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("LINEABOVE", (0, 2), (-1, 2), 2, LSRV_PRIMARY),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(totals_table)
    elements.append(Spacer(1, 12))

    # Memo
    if memo:
        elements.append(Paragraph("MEMO", styles["SubLabel"]))
        elements.append(Paragraph(memo, styles["NotesText"]))
        elements.append(Spacer(1, 12))

    # Footer
    elements.append(Spacer(1, 24))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=GRAY_200, spaceAfter=8))
    elements.append(Paragraph(f"Generated by LSRV CRM &bull; {org_name}", styles["Footer"]))

    doc.build(elements)
    return buf.getvalue()
