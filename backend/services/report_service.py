import io
import os
import uuid
from datetime import datetime
from typing import Optional
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.enums import TA_CENTER, TA_LEFT

REPORTS_DIR = '/root/llmo/reports'

def ensure_reports_dir():
    os.makedirs(REPORTS_DIR, exist_ok=True)

def generate_report_pdf(diagnosis_data: dict, report_type: str = 'simple') -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=20*mm, leftMargin=20*mm, topMargin=20*mm, bottomMargin=20*mm)

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title', parent=styles['Normal'], fontSize=24, fontName='Helvetica-Bold', alignment=TA_CENTER, spaceAfter=8)
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=12, textColor=colors.HexColor('#888888'), alignment=TA_CENTER, spaceAfter=20)
    h2_style = ParagraphStyle('H2', parent=styles['Normal'], fontSize=16, fontName='Helvetica-Bold', spaceBefore=16, spaceAfter=8)
    body_style = ParagraphStyle('Body', parent=styles['Normal'], fontSize=11, leading=18, spaceAfter=6)
    score_label_style = ParagraphStyle('ScoreLabel', parent=styles['Normal'], fontSize=10, textColor=colors.HexColor('#888888'), alignment=TA_CENTER)
    score_value_style = ParagraphStyle('ScoreValue', parent=styles['Normal'], fontSize=36, fontName='Helvetica-Bold', alignment=TA_CENTER)

    story = []
    scores = diagnosis_data.get('scores', {})
    findings = diagnosis_data.get('findings', [])
    recommendations = diagnosis_data.get('recommendations', [])

    # Header
    story.append(Paragraph('AI認知度診断レポート', title_style))
    story.append(Paragraph(f"{diagnosis_data.get('companyName', '')} — {diagnosis_data.get('industry', '')}", subtitle_style))
    story.append(Paragraph(f"診断日: {datetime.now().strftime('%Y年%m月%d日')}", subtitle_style))
    story.append(HRFlowable(width='100%', thickness=1, color=colors.HexColor('#E0E0E0')))
    story.append(Spacer(1, 12))

    # Scores grid
    story.append(Paragraph('スコアサマリー', h2_style))
    score_labels = [('AI認知度', 'aiAwareness'), ('ブランド認識', 'brandRecognition'), ('コンテンツ品質', 'contentQuality'), ('競合ギャップ', 'competitorGap')]
    score_data = []
    row_labels = []
    row_values = []
    for label, key in score_labels:
        val = scores.get(key, 0)
        color = colors.HexColor('#22c55e') if val >= 80 else colors.HexColor('#f59e0b') if val >= 60 else colors.HexColor('#ef4444')
        row_labels.append(Paragraph(label, score_label_style))
        row_values.append(Paragraph(f'<font color="{color.hexval()}">{val}</font>', score_value_style))
    score_data = [row_labels, row_values]
    t = Table(score_data, colWidths=[40*mm] * 4)
    t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('BACKGROUND', (0, 0), (-1, -1), colors.white), ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#E0E0E0')), ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#E0E0E0')), ('ROWBACKGROUNDS', (0, 0), (-1, -1), [colors.HexColor('#F5F5F5'), colors.white])]))
    story.append(t)
    story.append(Spacer(1, 16))

    # Findings (detailed report only shows all)
    story.append(Paragraph('発見事項', h2_style))
    for f in findings[:5 if report_type == 'simple' else len(findings)]:
        sev = {'high': '高', 'medium': '中', 'low': '低'}.get(f.get('severity', ''), '中')
        sev_color = {'high': '#ef4444', 'medium': '#f59e0b', 'low': '#64748b'}.get(f.get('severity', ''), '#64748b')
        story.append(Paragraph(f'<font color="{sev_color}">[{sev}]</font> <b>{f.get("title", "")}</b>', body_style))
        story.append(Paragraph(f.get('description', ''), body_style))
        story.append(Spacer(1, 4))

    # Recommendations
    story.append(Paragraph('改善推奨事項', h2_style))
    for i, rec in enumerate(recommendations[:3 if report_type == 'simple' else len(recommendations)], 1):
        story.append(Paragraph(f'{i}. {rec}', body_style))

    story.append(Spacer(1, 20))
    story.append(HRFlowable(width='100%', thickness=0.5, color=colors.HexColor('#E0E0E0')))
    story.append(Paragraph('本レポートは LLMO Score (llmo.fact-ally.com) にて生成されました。', ParagraphStyle('Footer', parent=styles['Normal'], fontSize=9, textColor=colors.HexColor('#888888'), alignment=TA_CENTER)))

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()

def save_report(report_id: str, pdf_bytes: bytes) -> str:
    ensure_reports_dir()
    path = os.path.join(REPORTS_DIR, f'{report_id}.pdf')
    with open(path, 'wb') as f:
        f.write(pdf_bytes)
    return path
