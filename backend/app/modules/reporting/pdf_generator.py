import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

# Japanese font registration (uses system font if available)
_FONT_NAME = 'Helvetica'  # fallback


def _try_register_japanese_font():
    global _FONT_NAME
    candidates = [
        '/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf',
        '/usr/share/fonts/opentype/ipafont-gothic/ipagp.ttf',
        '/usr/share/fonts/truetype/fonts-japanese-gothic.ttf',
        '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
        'C:/Windows/Fonts/msgothic.ttc',
        'C:/Windows/Fonts/meiryo.ttc',
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                pdfmetrics.registerFont(TTFont('Japanese', path))
                _FONT_NAME = 'Japanese'
                break
            except Exception:
                pass


_try_register_japanese_font()


def _score_color(score: float) -> tuple:
    if score >= 70:
        return (0.13, 0.55, 0.13)  # green
    if score >= 40:
        return (0.85, 0.65, 0.0)  # amber
    return (0.8, 0.1, 0.1)  # red


def _severity_color(severity: str) -> tuple:
    return {'high': (0.8, 0.1, 0.1), 'medium': (0.85, 0.65, 0.0), 'low': (0.2, 0.6, 0.2)}.get(severity, (0.5, 0.5, 0.5))


def generate_pdf(
    diagnosis: dict,
    client: dict,
    agency: dict,
    report_type: str = 'simple',
) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )

    styles = getSampleStyleSheet()
    font = _FONT_NAME
    W = A4[0] - 40 * mm

    def style(name, size=10, bold=False, color=colors.black, align='LEFT'):
        return ParagraphStyle(
            name,
            fontName=font,
            fontSize=size,
            textColor=color,
            alignment={'LEFT': 0, 'CENTER': 1, 'RIGHT': 2}.get(align, 0),
            spaceAfter=2,
        )

    story = []

    # Header
    primary = colors.HexColor('#4F46E5')
    agency_branding = agency.get('branding', {})
    try:
        primary = colors.HexColor(agency_branding.get('primary_color', '#4F46E5'))
    except Exception:
        pass

    story.append(Table(
        [[Paragraph(f'<b>LLMO Score</b>', style('h', 18, color=primary, align='LEFT')),
          Paragraph(agency.get('name', ''), style('a', 10, align='RIGHT'))]],
        colWidths=[W * 0.6, W * 0.4],
    ))
    story.append(HRFlowable(width=W, color=primary, thickness=2))
    story.append(Spacer(1, 4 * mm))

    report_label = '詳細診断レポート' if report_type == 'detailed' else 'LLMO診断レポート'
    story.append(Paragraph(report_label, style('title', 16, bold=True, align='CENTER')))
    story.append(Spacer(1, 6 * mm))

    # Client info
    client_rows = [
        ['クライアント名', client.get('name', '')],
        ['URL', client.get('url', '')],
        ['業種', client.get('industry', '')],
        ['エリア', client.get('location', '')],
        ['診断日時', diagnosis.get('completed_at', '')[:10] if diagnosis.get('completed_at') else ''],
    ]
    ct = Table(client_rows, colWidths=[40 * mm, W - 40 * mm])
    ct.setStyle(TableStyle([
        ('FONT', (0, 0), (-1, -1), font, 9),
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F3F4F6')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#D1D5DB')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(ct)
    story.append(Spacer(1, 6 * mm))

    # Scores
    scores = diagnosis.get('scores') or {}
    score_labels = {
        'overall': '総合スコア',
        'ai_awareness': 'AI認知度',
        'brand_recognition': 'ブランド認知',
        'content_quality': 'コンテンツ品質',
        'competitor_gap': '競合優位性',
    }
    story.append(Paragraph('診断スコア', style('sh', 13, bold=True)))
    story.append(Spacer(1, 3 * mm))

    score_data = [['項目', 'スコア', '評価']]
    for key, label in score_labels.items():
        val = scores.get(key, 0)
        try:
            val = float(val)
        except (TypeError, ValueError):
            val = 0.0
        grade = 'A' if val >= 80 else 'B' if val >= 60 else 'C' if val >= 40 else 'D'
        score_data.append([label, f'{val:.0f}点', grade])

    st = Table(score_data, colWidths=[W * 0.5, W * 0.25, W * 0.25])
    st_style = [
        ('FONT', (0, 0), (-1, -1), font, 9),
        ('BACKGROUND', (0, 0), (-1, 0), primary),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#D1D5DB')),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('BACKGROUND', (0, 1), (0, 1), colors.HexColor('#EEF2FF')),
        ('FONTSIZE', (0, 1), (-1, 1), 11),
    ]
    for i, (key, _) in enumerate(score_labels.items()):
        val = float(scores.get(key, 0) or 0)
        c = colors.Color(*_score_color(val))
        st_style.append(('TEXTCOLOR', (1, i + 1), (2, i + 1), c))
    st.setStyle(TableStyle(st_style))
    story.append(st)
    story.append(Spacer(1, 6 * mm))

    # Findings
    findings = diagnosis.get('findings', [])
    if findings:
        story.append(Paragraph('診断結果（課題）', style('sh', 13, bold=True)))
        story.append(Spacer(1, 3 * mm))
        for f in findings:
            if isinstance(f, dict):
                severity = f.get('severity', 'medium')
                sv_color = colors.Color(*_severity_color(severity))
                sv_label = {'high': '高', 'medium': '中', 'low': '低'}.get(severity, '中')
                fd = Table(
                    [[Paragraph(f'[{sv_label}] {f.get("title", "")}', style('ft', 10, bold=True, color=sv_color)),
                      Paragraph(f.get('category', ''), style('fc', 9, align='RIGHT'))]],
                    colWidths=[W * 0.7, W * 0.3],
                )
                story.append(fd)
                story.append(Paragraph(f.get('description', ''), style('fd', 9)))
                story.append(Spacer(1, 3 * mm))

    # Recommendations
    recs = diagnosis.get('recommendations', [])
    if recs:
        story.append(Spacer(1, 2 * mm))
        story.append(Paragraph('改善提案', style('sh', 13, bold=True)))
        story.append(Spacer(1, 3 * mm))
        for i, rec in enumerate(recs, 1):
            story.append(Paragraph(f'{i}. {rec}', style('rec', 9)))
            story.append(Spacer(1, 2 * mm))

    # Footer
    story.append(Spacer(1, 6 * mm))
    story.append(HRFlowable(width=W, color=colors.HexColor('#D1D5DB'), thickness=0.5))
    story.append(Paragraph(
        f'Generated by LLMO Score  |  {agency.get("name", "")}  |  {datetime.now().strftime("%Y-%m-%d")}',
        style('footer', 8, color=colors.HexColor('#9CA3AF'), align='CENTER'),
    ))

    doc.build(story)
    return buf.getvalue()
