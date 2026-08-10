from __future__ import annotations

from pathlib import Path
from typing import Iterable

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    HRFlowable,
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = ROOT / "output" / "pdf"
TEMP_DIR = ROOT / "tmp" / "pdfs"

FONT_REGULAR = Path(r"C:\Windows\Fonts\malgun.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\malgunbd.ttf")

INK = colors.HexColor("#1E163B")
MUTED = colors.HexColor("#686178")
PINK = colors.HexColor("#F84C8B")
CYAN = colors.HexColor("#26BFD3")
YELLOW = colors.HexColor("#FFD55A")
PURPLE = colors.HexColor("#7048E8")
CREAM = colors.HexColor("#FFF8EF")
LILAC = colors.HexColor("#F1ECFF")
MINT = colors.HexColor("#E9FAF7")
LIGHT_PINK = colors.HexColor("#FFF0F6")
LINE = colors.HexColor("#DED8EA")
WHITE = colors.white


def register_fonts() -> None:
    for path in (FONT_REGULAR, FONT_BOLD):
        if not path.exists():
            raise FileNotFoundError(f"Required Korean font is missing: {path}")
    pdfmetrics.registerFont(TTFont("Malgun", str(FONT_REGULAR)))
    pdfmetrics.registerFont(TTFont("Malgun-Bold", str(FONT_BOLD)))


def make_styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "cover_kicker": ParagraphStyle(
            "cover_kicker",
            parent=base["Normal"],
            fontName="Malgun-Bold",
            fontSize=10,
            leading=14,
            textColor=PINK,
            spaceAfter=3 * mm,
        ),
        "cover_title": ParagraphStyle(
            "cover_title",
            parent=base["Title"],
            fontName="Malgun-Bold",
            fontSize=30,
            leading=37,
            textColor=INK,
            spaceAfter=3 * mm,
        ),
        "cover_subtitle": ParagraphStyle(
            "cover_subtitle",
            parent=base["Normal"],
            fontName="Malgun",
            fontSize=12,
            leading=19,
            textColor=MUTED,
            spaceAfter=5 * mm,
        ),
        "h1": ParagraphStyle(
            "h1",
            parent=base["Heading1"],
            fontName="Malgun-Bold",
            fontSize=21,
            leading=27,
            textColor=INK,
            spaceBefore=1 * mm,
            spaceAfter=5 * mm,
        ),
        "h2": ParagraphStyle(
            "h2",
            parent=base["Heading2"],
            fontName="Malgun-Bold",
            fontSize=13,
            leading=18,
            textColor=PURPLE,
            spaceBefore=4 * mm,
            spaceAfter=2 * mm,
        ),
        "body": ParagraphStyle(
            "body",
            parent=base["BodyText"],
            fontName="Malgun",
            fontSize=9.5,
            leading=15.5,
            textColor=INK,
            spaceAfter=2.2 * mm,
        ),
        "small": ParagraphStyle(
            "small",
            parent=base["BodyText"],
            fontName="Malgun",
            fontSize=7.5,
            leading=11.5,
            textColor=MUTED,
        ),
        "small_bold": ParagraphStyle(
            "small_bold",
            parent=base["BodyText"],
            fontName="Malgun-Bold",
            fontSize=8,
            leading=12,
            textColor=INK,
        ),
        "table_header": ParagraphStyle(
            "table_header",
            parent=base["BodyText"],
            fontName="Malgun-Bold",
            fontSize=8,
            leading=12,
            alignment=TA_CENTER,
            textColor=WHITE,
        ),
        "code_label": ParagraphStyle(
            "code_label",
            parent=base["BodyText"],
            fontName="Malgun-Bold",
            fontSize=8.5,
            leading=13,
            textColor=WHITE,
        ),
        "code": ParagraphStyle(
            "code",
            parent=base["BodyText"],
            fontName="Malgun",
            fontSize=9,
            leading=15,
            textColor=WHITE,
        ),
        "card_title": ParagraphStyle(
            "card_title",
            parent=base["BodyText"],
            fontName="Malgun-Bold",
            fontSize=11,
            leading=15,
            textColor=INK,
            spaceAfter=1.5 * mm,
        ),
        "card_body": ParagraphStyle(
            "card_body",
            parent=base["BodyText"],
            fontName="Malgun",
            fontSize=8.5,
            leading=13.5,
            textColor=INK,
        ),
        "center": ParagraphStyle(
            "center",
            parent=base["BodyText"],
            fontName="Malgun",
            fontSize=9,
            leading=14,
            alignment=TA_CENTER,
            textColor=INK,
        ),
        "center_bold": ParagraphStyle(
            "center_bold",
            parent=base["BodyText"],
            fontName="Malgun-Bold",
            fontSize=10,
            leading=15,
            alignment=TA_CENTER,
            textColor=INK,
        ),
        "link": ParagraphStyle(
            "link",
            parent=base["BodyText"],
            fontName="Malgun",
            fontSize=8.5,
            leading=13,
            textColor=PURPLE,
            allowWidows=0,
            allowOrphans=0,
        ),
        "callout": ParagraphStyle(
            "callout",
            parent=base["BodyText"],
            fontName="Malgun-Bold",
            fontSize=10.5,
            leading=17,
            textColor=INK,
            alignment=TA_LEFT,
        ),
    }


def p(text: str, styles: dict[str, ParagraphStyle], style: str = "body") -> Paragraph:
    return Paragraph(text, styles[style])


def section_title(number: str, title: str, styles: dict[str, ParagraphStyle]) -> list:
    return [
        p(f"{number}  {title}", styles, "h1"),
        HRFlowable(width="100%", thickness=1.2, color=YELLOW, spaceAfter=4 * mm),
    ]


def bullet_list(items: Iterable[str], styles: dict[str, ParagraphStyle], *, bullet_color: str = "#F84C8B") -> list:
    return [
        Paragraph(
            f'<font color="{bullet_color}">●</font>&nbsp;&nbsp;{item}',
            styles["body"],
        )
        for item in items
    ]


def card(title: str, body: str, styles: dict[str, ParagraphStyle], *, background=CREAM, width=78 * mm) -> Table:
    data = [[p(title, styles, "card_title")], [p(body, styles, "card_body")]]
    table = Table(data, colWidths=[width], hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), background),
                ("BOX", (0, 0), (-1, -1), 0.6, LINE),
                ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
            ]
        )
    )
    return table


def image_box(path: Path, max_width: float, max_height: float, styles: dict[str, ParagraphStyle], caption: str) -> Table:
    if not path.exists():
        return card("이미지 준비 중", caption, styles, background=LIGHT_PINK, width=max_width)
    with PILImage.open(path) as img:
        width_px, height_px = img.size
    scale = min(max_width / width_px, max_height / height_px)
    flowable = Image(str(path), width=width_px * scale, height=height_px * scale)
    flowable.hAlign = "CENTER"
    table = Table([[flowable], [p(caption, styles, "small")]], colWidths=[max_width], hAlign="CENTER")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), WHITE),
                ("BOX", (0, 0), (-1, -1), 0.6, LINE),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 2 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 2 * mm),
                ("TOPPADDING", (0, 0), (-1, 0), 2 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 2 * mm),
                ("TOPPADDING", (0, 1), (-1, 1), 2 * mm),
                ("BOTTOMPADDING", (0, 1), (-1, 1), 2.5 * mm),
            ]
        )
    )
    return table


def stats_table(rows: list[tuple[str, str]], styles: dict[str, ParagraphStyle], widths=(60 * mm, 32 * mm)) -> Table:
    table = Table(
        [[p(key, styles, "small_bold"), p(value, styles, "center_bold")] for key, value in rows],
        colWidths=list(widths),
        hAlign="LEFT",
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), LILAC),
                ("BACKGROUND", (1, 0), (1, -1), WHITE),
                ("GRID", (0, 0), (-1, -1), 0.5, LINE),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 2.3 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.3 * mm),
            ]
        )
    )
    return table


def page_decor(canvas, doc, short_title: str) -> None:
    canvas.saveState()
    width, height = A4
    canvas.setFillColor(INK)
    canvas.rect(0, height - 8 * mm, width, 8 * mm, fill=1, stroke=0)
    if doc.page > 1:
        canvas.setFont("Malgun-Bold", 7.5)
        canvas.setFillColor(colors.HexColor("#DAD2F6"))
        canvas.drawString(16 * mm, height - 5.3 * mm, short_title)
    canvas.setStrokeColor(LINE)
    canvas.line(16 * mm, 13 * mm, width - 16 * mm, 13 * mm)
    canvas.setFont("Malgun", 7)
    canvas.setFillColor(MUTED)
    canvas.drawString(16 * mm, 8.5 * mm, "NHN 게임 제작 해커톤 사전 제출본 · 2026-08-10")
    canvas.drawRightString(width - 16 * mm, 8.5 * mm, f"{doc.page}")
    canvas.restoreState()


def cover_status(styles: dict[str, ParagraphStyle], text: str) -> Table:
    table = Table([[p(text, styles, "small_bold")]], colWidths=[78 * mm], hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), YELLOW),
                ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#D8B229")),
                ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 2.5 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5 * mm),
            ]
        )
    )
    return table


def build_game_guide(styles: dict[str, ParagraphStyle]) -> Path:
    output = OUTPUT_DIR / "뭐_먹을_거냥_게임_소개_및_설명_사전본.pdf"
    doc = SimpleDocTemplate(
        str(output),
        pagesize=A4,
        rightMargin=16 * mm,
        leftMargin=16 * mm,
        topMargin=15 * mm,
        bottomMargin=18 * mm,
        title="뭐 먹을 거냥? - 게임 소개 및 설명 문서",
        author="뭐 먹을 거냥? 프로젝트",
        subject="NHN 게임 제작 해커톤 사전 제출물",
    )
    title_screen = ROOT / "docs" / "evidence" / "screenshots" / "title-screen-mwo-meogeul-geonyang-320x568.png"
    gameplay = ROOT / "docs" / "evidence" / "food-visual-slice-gameplay.png"
    lobby = ROOT / "docs" / "evidence" / "screenshots" / "bright-room-lobby-412x915.png"
    results = ROOT / "docs" / "evidence" / "screenshots" / "bright-room-results-412x915.png"
    story: list = []

    story += [
        Spacer(1, 8 * mm),
        p("POP ARCADE MENU BATTLE", styles, "cover_kicker"),
        p("뭐 먹을 거냥?", styles, "cover_title"),
        p("먹고 싶은 메뉴는 포획하고,<br/>나머지는 정확히 반으로 썰어보세요.", styles, "cover_subtitle"),
        cover_status(styles, "사전 제출본 · GitHub Pages와 YouTube 링크 최종 확인 전"),
        Spacer(1, 7 * mm),
    ]
    cover_images = Table(
        [[
            image_box(title_screen, 74 * mm, 99 * mm, styles, "타이틀 화면"),
            image_box(gameplay, 98 * mm, 99 * mm, styles, "실제 음식 실루엣 베기 플레이"),
        ]],
        colWidths=[78 * mm, 103 * mm],
        hAlign="CENTER",
    )
    cover_images.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    story += [cover_images, Spacer(1, 7 * mm)]
    story += [
        p(
            "먹고 싶은 메뉴는 포획하고 나머지는 정확히 반으로 썰어, 최대 8명의 식사 내기 순위와 메뉴 취향을 함께 확인하는 모바일 우선 브라우저 파티게임.",
            styles,
            "callout",
        ),
        Spacer(1, 4 * mm),
        stats_table(
            [("플랫폼", "모바일·PC 웹"), ("플레이 인원", "1명 / 2~8명"), ("한 판", "약 45~60초"), ("출제", "50종 중 20종")],
            styles,
            widths=(44 * mm, 44 * mm),
        ),
        PageBreak(),
    ]

    story += section_title("01", "게임의 목표와 핵심 재미", styles)
    story += [
        p(
            "한 판에는 전체 음식 50종 중 중복 없는 20종이 등장한다. 플레이어는 나머지 음식을 실제 그림의 실루엣 기준으로 최대한 정확히 반으로 가르고, 먹고 싶은 음식은 최대 2개까지 길게 눌러 포획한다.",
            styles,
        ),
        Spacer(1, 2 * mm),
    ]
    cards = Table(
        [[
            card("베는 손맛", "음식 알파 실루엣의 양쪽 면적을 직접 비교해 50:50에 가까울수록 높은 점수.", styles, background=LIGHT_PINK, width=55 * mm),
            card("메뉴 선택", "먹고 싶은 음식은 점수 경쟁에서 빼고 최대 2개까지 내 취향으로 포획.", styles, background=MINT, width=55 * mm),
            card("짧은 파티", "같은 20종으로 최대 8명이 경쟁하고 순위·겹친 취향·고정 내기를 함께 확인.", styles, background=LILAC, width=55 * mm),
        ]],
        colWidths=[59 * mm, 59 * mm, 59 * mm],
        hAlign="CENTER",
    )
    cards.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story += [cards, Spacer(1, 7 * mm), p("점수 계산", styles, "h2")]
    formula = Table(
        [[p("베기 정확도", styles, "center_bold"), p("100 × (1 - |A - B| ÷ (A + B))", styles, "center_bold")]],
        colWidths=[42 * mm, 120 * mm],
        hAlign="CENTER",
    )
    formula.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, 0), PINK),
                ("TEXTCOLOR", (0, 0), (0, 0), WHITE),
                ("BACKGROUND", (1, 0), (1, 0), CREAM),
                ("BOX", (0, 0), (-1, -1), 0.8, PINK),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 4 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4 * mm),
            ]
        )
    )
    story += [formula, Spacer(1, 4 * mm)]
    story += bullet_list(
        [
            "A와 B는 베기 선 양쪽에 남은 실제 음식의 가중 알파 면적이다.",
            "놓친 음식은 0점, 포획한 음식은 평균 계산에서 제외된다.",
            "포획 0·1·2개일 때 평균의 분모는 각각 20·19·18이다.",
            "20개를 베기·포획·놓침 중 하나로 모두 처리하면 라운드가 끝난다.",
        ],
        styles,
    )
    story += [PageBreak()]

    story += section_title("02", "조작과 라운드 진행", styles)
    controls = Table(
        [[
            card("1. 드래그해서 베기", "음식 한쪽 테두리에서 반대쪽 테두리까지 드래그한다. 입력 중에도 음식은 계속 낙하한다.", styles, background=LIGHT_PINK, width=82 * mm),
            card("2. 0.32초 길게 눌러 포획", "먹고 싶은 음식 위에서 움직이지 않고 누른다. 한 판에 최대 2개이며 사용하지 않아도 된다.", styles, background=MINT, width=82 * mm),
        ], [
            card("3. 움직이면 즉시 베기로 전환", "길게 누르는 중 시작점에서 14px 이상 움직이면 포획 대기를 취소하고 같은 입력을 베기로 해석한다.", styles, background=LILAC, width=82 * mm),
            card("4. 짧은 탭은 무효", "짧은 탭과 취소 입력은 라운드 진행이나 포획 슬롯을 소비하지 않는다.", styles, background=CREAM, width=82 * mm),
        ]],
        colWidths=[87 * mm, 87 * mm],
        hAlign="CENTER",
    )
    controls.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 2 * mm), ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * mm)]))
    story += [controls, Spacer(1, 5 * mm), p("점점 빨라지는 20개", styles, "h2")]
    pace = Table(
        [[p("구간", styles, "table_header"), p("낙하 시간", styles, "table_header"), p("움직임", styles, "table_header")],
         [p("1~5", styles, "center"), p("2.6초", styles, "center"), p("회전 없음", styles, "center")],
         [p("6~15", styles, "center"), p("2.2초", styles, "center"), p("회전 증가", styles, "center")],
         [p("16~20", styles, "center"), p("1.8초", styles, "center"), p("회전 + 마지막 2개 좌우 이동", styles, "center")]],
        colWidths=[48 * mm, 48 * mm, 75 * mm],
        hAlign="CENTER",
    )
    pace.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), INK), ("TEXTCOLOR", (0, 0), (-1, 0), WHITE), ("GRID", (0, 0), (-1, -1), 0.5, LINE), ("BACKGROUND", (0, 1), (-1, -1), CREAM), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("TOPPADDING", (0, 0), (-1, -1), 3 * mm), ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm)]))
    story += [pace, Spacer(1, 5 * mm), p("16번째 음식 전에는 FINAL 5 안내가 나타난다. 정확도 등급은 95점 이상 '칼각', 80점 이상 '훌륭', 60점 이상 '좋아', 그 아래 '아쉬워'로 표시된다.", styles)]
    story += [PageBreak()]

    story += section_title("03", "혼자 또는 2~8명이 함께", styles)
    room_images = Table(
        [[
            image_box(lobby, 79 * mm, 89 * mm, styles, "방 코드·QR·초대 링크를 제공하는 대기실"),
            image_box(results, 79 * mm, 89 * mm, styles, "전체 순위와 포획 메뉴를 보여주는 공동 결과"),
        ]],
        colWidths=[85 * mm, 85 * mm],
        hAlign="CENTER",
    )
    room_images.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story += [room_images, Spacer(1, 5 * mm)]
    story += bullet_list(
        [
            "방 생성 후 QR 코드, 초대 링크 또는 8자리 코드로 참가한다.",
            "준비 버튼 없이 방장이 시작하면 참가자 명단을 잠그고 같은 20종 덱을 선로딩한다.",
            "자동 선로딩 뒤 공통 4초 카운트다운으로 시작한다.",
            "최고 평균 정확도가 1등, 최저 평균 정확도가 꼴찌이며 동점은 공동 순위다.",
            "결과에서 개인 포획 메뉴, 1등의 포획 메뉴, 정확히 겹친 메뉴 또는 가까운 카테고리 취향을 확인한다.",
            "고정 내기: 꼴찌가 1등의 식사 1인분을 부담한다. 공동 순위일 때는 참가자가 부담 방식을 합의한다.",
            "게임은 최종 식사 메뉴를 자동으로 강제하지 않는다.",
        ],
        styles,
    )
    story += [PageBreak()]

    story += section_title("04", "실행 방법과 제출 링크", styles)
    story += [p("브라우저에서 바로 플레이", styles, "h2")]
    story += bullet_list(
        [
            "최신 Chrome, Edge, Safari 등에서 플레이 링크를 연다.",
            "소리·나레이션·진동은 기본 ON이며 설정에서 끌 수 있다.",
            "QR 카메라 스캔은 HTTPS에서 사용한다. 링크·8자리 코드 참가는 카메라 없이 가능하다.",
        ],
        styles,
    )
    story += [p("소스에서 실행", styles, "h2")]
    code = Table(
        [[p("Node.js 20.19 이상", styles, "code_label")], [p("npm ci<br/>npm run dev<br/><br/>npm run build<br/>npm run preview", styles, "code")]],
        colWidths=[120 * mm],
        hAlign="LEFT",
    )
    code.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#211A35")), ("TEXTCOLOR", (0, 0), (-1, -1), WHITE), ("BOX", (0, 0), (-1, -1), 0.6, INK), ("LEFTPADDING", (0, 0), (-1, -1), 5 * mm), ("RIGHTPADDING", (0, 0), (-1, -1), 5 * mm), ("TOPPADDING", (0, 0), (-1, -1), 3 * mm), ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm)]))
    story += [code, Spacer(1, 6 * mm)]
    links = Table(
        [
            [p("소스 코드", styles, "small_bold"), p('<link href="https://github.com/h200082/oneul-mwo-sseol">https://github.com/h200082/oneul-mwo-sseol</link>', styles, "link")],
            [p("플레이 링크", styles, "small_bold"), p('<link href="https://h200082.github.io/oneul-mwo-sseol/">https://h200082.github.io/oneul-mwo-sseol/</link><br/><font color="#C14A2A">실제 배포·시크릿 창·모바일 접속 확인 전</font>', styles, "link")],
            [p("플레이 영상", styles, "small_bold"), p('<font color="#C14A2A">YouTube 업로드 후 공개 또는 일부 공개 링크 입력</font>', styles, "link")],
        ],
        colWidths=[34 * mm, 136 * mm],
        hAlign="CENTER",
    )
    links.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.6, LINE), ("BACKGROUND", (0, 0), (0, -1), LILAC), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm), ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm), ("TOPPADDING", (0, 0), (-1, -1), 3 * mm), ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm)]))
    story += [links, Spacer(1, 6 * mm)]
    final_check = card(
        "최종 제출 전 교체·확인",
        "GitHub Pages workflow 성공 → 시크릿 창·PC·실제 모바일 접속 → 서로 다른 2개 브라우저/기기의 방 플레이 → YouTube 링크 입력 → PDF 다시 생성 → 모든 링크 클릭 검사.",
        styles,
        background=LIGHT_PINK,
        width=170 * mm,
    )
    story += [final_check, Spacer(1, 6 * mm), p("개인 참가이므로 팀원 롤 기술서는 제출 대상에서 제외한다.", styles, "small")]

    doc.build(story, onFirstPage=lambda c, d: page_decor(c, d, "뭐 먹을 거냥? · 게임 소개"), onLaterPages=lambda c, d: page_decor(c, d, "뭐 먹을 거냥? · 게임 소개"))
    return output


def pipeline_row(labels: list[tuple[str, str]], styles: dict[str, ParagraphStyle]) -> Table:
    cells = []
    widths = []
    for index, (title, body) in enumerate(labels):
        cells.append(card(title, body, styles, background=[LIGHT_PINK, LILAC, MINT, CREAM][index % 4], width=37 * mm))
        widths.append(41 * mm)
        if index < len(labels) - 1:
            cells.append(p("→", styles, "center_bold"))
            widths.append(6 * mm)
    table = Table([cells], colWidths=widths, hAlign="CENTER")
    table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    return table


def build_ai_technical(styles: dict[str, ParagraphStyle]) -> Path:
    output = OUTPUT_DIR / "뭐_먹을_거냥_AI_활용_기술_문서_사전본.pdf"
    doc = SimpleDocTemplate(
        str(output),
        pagesize=A4,
        rightMargin=16 * mm,
        leftMargin=16 * mm,
        topMargin=15 * mm,
        bottomMargin=18 * mm,
        title="뭐 먹을 거냥? - AI 활용 기술 문서",
        author="뭐 먹을 거냥? 프로젝트",
        subject="NHN 게임 제작 해커톤 AI 활용 기술 문서",
    )
    story: list = []
    story += [
        Spacer(1, 15 * mm),
        p("AI UTILIZATION TECHNICAL DOCUMENT", styles, "cover_kicker"),
        p("뭐 먹을 거냥?", styles, "cover_title"),
        p("AI 활용 기술 문서", styles, "cover_subtitle"),
        cover_status(styles, "사전 제출본 · 최종 배포 링크와 commit SHA 확정 전"),
        Spacer(1, 14 * mm),
        p("제작 단계에서는 적극적으로, 실행 중에는 호출하지 않게.", styles, "callout"),
        p(
            "AI를 기획·구현·이미지·음성 제작과 검증에 사용하되, 규칙과 최종 자산은 사람이 결정했다. 게임 런타임에는 생성형 AI 호출, Azure 키·엔드포인트·Speech SDK가 없다.",
            styles,
        ),
        Spacer(1, 9 * mm),
    ]
    headline_stats = Table(
        [[
            card("50", "AI 생성·교정 음식 이미지", styles, background=LIGHT_PINK, width=40 * mm),
            card("50", "활성 AI 합성 나레이션", styles, background=MINT, width=40 * mm),
            card("705", "최신 단위 테스트 통과", styles, background=LILAC, width=40 * mm),
            card("0", "런타임 생성형 AI 호출", styles, background=CREAM, width=40 * mm),
        ]],
        colWidths=[43 * mm] * 4,
        hAlign="CENTER",
    )
    headline_stats.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story += [headline_stats, Spacer(1, 14 * mm)]
    story += [
        p("사람의 책임 범위", styles, "h2"),
        p("게임 규칙, 프롬프트의 금지 조건, 이미지·음성 선택, 로컬 편집 승인, 테스트 기준, 저작권·라이선스 기록과 최종 제출 판단은 참가자가 직접 수행했다.", styles),
        PageBreak(),
    ]

    story += section_title("01", "도구와 적용 범위", styles)
    tool_rows = [
        [p("도구", styles, "table_header"), p("활용", styles, "table_header"), p("최종 반영", styles, "table_header")],
        [p("OpenAI Codex", styles, "card_title"), p("기획 구조화, TypeScript 구현, 테스트, 디버깅, 문서·프롬프트 기록", styles, "card_body"), p("사람이 diff·실행 결과·회귀를 검토한 소스만 채택", styles, "card_body")],
        [p("Codex 내장 ImageGen", styles, "card_title"), p("음식 50종과 타이틀 고양이 셰프 시안", styles, "card_body"), p("사람이 선별하고 로컬 후처리한 투명 WebP", styles, "card_body")],
        [p("Azure AI Speech", styles, "card_title"), p("한국어 음식 나레이션 후보", styles, "card_body"), p("A/B·블라인드 청취 후 정적 MP3/WAV 50개", styles, "card_body")],
        [p("Pillow 12.3.0", styles, "card_title"), p("크로마키 제거, despill, 알파 크롭, 리사이즈, WebP 검사", styles, "card_body"), p("로컬 재현 가능한 스크립트", styles, "card_body")],
    ]
    tools_table = Table(tool_rows, colWidths=[36 * mm, 68 * mm, 68 * mm], repeatRows=1, hAlign="CENTER")
    tools_table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), INK), ("TEXTCOLOR", (0, 0), (-1, 0), WHITE), ("GRID", (0, 0), (-1, -1), 0.5, LINE), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("BACKGROUND", (0, 1), (-1, -1), CREAM), ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm), ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm), ("TOPPADDING", (0, 0), (-1, -1), 3 * mm), ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm)]))
    story += [tools_table, Spacer(1, 6 * mm), p("개발 구조", styles, "h2")]
    story += [pipeline_row([("DOM", "AppController"), ("게임", "Phaser PrototypeScene"), ("도메인", "점수·기하·방·결과"), ("게이트웨이", "Local / Firebase")], styles)]
    story += [Spacer(1, 4 * mm)]
    story += bullet_list(
        [
            "RoomGateway가 localStorage·BroadcastChannel과 Firebase Anonymous Auth·Firestore를 같은 계약으로 추상화한다.",
            "QR은 qrcode로 생성하고 브라우저 BarcodeDetector가 지원되면 카메라 스캔을 제공한다.",
            "Web Audio·Vibration API·정적 나레이션이 감각 피드백을 담당한다.",
            "TypeScript·Vite 빌드를 GitHub Pages 배포 artifact로 만든다.",
        ],
        styles,
    )
    story += [PageBreak()]

    story += section_title("02", "Codex 개발 협업과 프롬프트", styles)
    story += [
        p("Codex에는 결과만 요청하지 않고 목표, 금지 조건, 변경 범위와 검증 기준을 함께 제공했다. 제안된 구현은 사람의 선택과 자동 테스트를 모두 통과한 경우에만 반영했다.", styles),
        Spacer(1, 3 * mm),
    ]
    prompt_cards = Table(
        [[
            card("규칙을 순수 함수로", "“게임 규칙은 프레임워크에서 분리하고 경계값을 자동 테스트한다.”<br/><br/>포획 제외 평균, 놓침 0점, 순위·내기 규칙을 별도 도메인으로 고정.", styles, background=LIGHT_PINK, width=80 * mm),
            card("조작 충돌 제거", "“드래그 중 음식이 멈추지 않게 하고 베기와 포획 입력이 충돌하지 않도록 한다.”<br/><br/>더블클릭·일시정지를 제외하고 0.32초 hold + 14px 이동 전환을 채택.", styles, background=MINT, width=80 * mm),
        ], [
            card("실제 실루엣 점수", "“원형이 아닌 음식 그림 그대로 판정하고 그 차이를 점수로 전달한다.”<br/><br/>128×128 가중 알파 마스크, 실제 픽셀 hit, 양쪽 면적 점수와 chord 검증.", styles, background=LILAC, width=80 * mm),
            card("모바일 LAN 회귀", "“모바일에서 혼자 하기를 눌러도 시작되지 않는 원인을 수정한다.”<br/><br/>비보안 HTTP에서 randomUUID 미지원 시 getRandomValues 기반 UUID v4 폴백.", styles, background=CREAM, width=80 * mm),
        ]],
        colWidths=[86 * mm, 86 * mm],
        hAlign="CENTER",
    )
    prompt_cards.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 2 * mm), ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * mm)]))
    story += [prompt_cards, Spacer(1, 5 * mm)]
    story += [p("사람이 거절한 대안", styles, "h2")]
    story += bullet_list(
        [
            "더블클릭 포획: 이동하는 음식에서 두 번째 명중이 어려워 제외.",
            "포획 대기 중 일시정지: 점수·시간 악용과 리듬 중단 위험으로 제외.",
            "원형 판정: 비원형 음식에서 보이는 그림과 점수 범위가 달라 알파 실루엣으로 교체.",
            "음성의 단일 자동 지표 승인: 발음·강세·문장 연결을 놓쳐 사람 청취와 블라인드 비교로 교체.",
        ],
        styles,
    )
    story += [PageBreak()]

    story += section_title("03", "AI 음식 이미지 50종", styles)
    story += [pipeline_row([("프롬프트", "식별성·먹음직스러움"), ("ImageGen", "8 유지 + 42 생성·교정"), ("로컬 후처리", "크로마키·알파·WebP"), ("실게임 QA", "50종 전수 고정 실행")], styles), Spacer(1, 5 * mm)]
    story += bullet_list(
        [
            "녹색·자홍색 크로마키를 감지해 제거하고 despill·soft matte를 적용했다.",
            "알파 32 이상 외곽을 기준으로 크롭하고 원본 종횡비를 보존한 채 긴 변을 512px로 맞췄다.",
            "파일당 120KB 이하, 전체 3.5MB 이하, 가장 큰 20종 합계 1.5MB 이하를 자동 검사했다.",
            "카탈로그·이미지 50종 완전 일치, 투명 WebP, 비정사각 자산과 덱 20종 부분 선로딩을 검증했다.",
            "실제 Phaser 첫 라운드에 메뉴를 하나씩 고정해 텍스처·알파 마스크·표시 크기·베기/포획 중심을 전수 확인했다.",
        ],
        styles,
    )
    image_stats = stats_table(
        [("음식 이미지", "50개"), ("기존 승인 / 신규·교정", "8 / 42"), ("전체 용량", "2,316,336 B"), ("최대 파일", "74,432 B"), ("가장 큰 20종", "1,149,052 B"), ("타이틀 자산", "5개 / 152,150 B")],
        styles,
        widths=(72 * mm, 48 * mm),
    )
    story += [Spacer(1, 3 * mm), image_stats, Spacer(1, 5 * mm), p("사람의 선별", styles, "h2")]
    story += [p("짜장면의 과도한 면 리프트, 삼계탕의 집게, 비빔밥의 부자연스러운 젓가락 양, 순대국의 숟가락, 삼겹살의 과도한 비계·넘침 등을 제거하거나 다시 생성했다. 반대로 식별성과 역동성이 좋았던 볶음밥 시안은 유지했다.", styles)]
    story += [PageBreak()]

    story += section_title("04", "AI 합성 나레이션 50종", styles)
    narration_pipeline = pipeline_row([("문구·연기", "메뉴별 exact text/profile"), ("Azure 생성", "no-overwrite·retry 0"), ("사람 청취", "A/B·블라인드·재합성"), ("정적 연결", "MP3/WAV + provenance")], styles)
    story += [narration_pipeline, Spacer(1, 5 * mm)]
    narration_stats = Table(
        [[stats_table([("활성 음성", "50"), ("historical", "3"), ("물리 파일", "53 / 3,092,792 B"), ("활성 모델", "Flash 45 / Full 5"), ("물리 모델", "Flash 48 / Full 5")], styles, widths=(59 * mm, 42 * mm)),
          card("Azure 설정", "Standard S0 · southeastasia<br/><br/>Haena MAI-Voice-2-Flash<br/>Junho MAI-Voice-2-Flash<br/>Junho MAI-Voice-2", styles, background=LILAC, width=63 * mm)]],
        colWidths=[107 * mm, 67 * mm],
        hAlign="CENTER",
    )
    narration_stats.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story += [narration_stats, Spacer(1, 5 * mm)]
    story += bullet_list(
        [
            "합성 전 카탈로그·기존 파일 hash·voice/style·비용 상한을 검사한다.",
            "파일 덮어쓰기 금지, 클립당 1회 요청, retry 0, 키와 문구가 포함된 오류 redaction을 강제한다.",
            "길이만으로 승인하지 않고 발음, 자연스러운 연결, 코미디 강세를 직접 듣는다.",
            "Flash와 Full을 모델명이 보이지 않게 비교하고, 구조가 다른 후보끼리는 별도 결선으로 평가했다.",
            "로컬 trim은 승인된 무음·저에너지 PCM에만 적용하고 retained PCM·hash·구간을 기록했다.",
            "음성 복제, 실제 인물·방송·캐릭터 성대모사는 사용하지 않았다.",
        ],
        styles,
    )
    disclosure = card("게임 내 AI 음성 고지", "이 게임의 일부 음식 나레이션은 Microsoft Azure AI Speech로 생성한 AI 합성 음성입니다. 실제 인물의 녹음이나 성대모사가 아닙니다.", styles, background=YELLOW, width=170 * mm)
    story += [Spacer(1, 4 * mm), disclosure, PageBreak()]

    story += section_title("05", "런타임 분리와 보안", styles)
    story += [p("제작용 AI와 게임 실행을 물리적으로 분리했다.", styles, "callout"), Spacer(1, 3 * mm)]
    security = Table(
        [[
            card("제작 환경", "Codex·ImageGen·Azure 후보 생성<br/>로컬 후처리·사람 승인<br/>manifest·SHA-256 provenance", styles, background=LIGHT_PINK, width=74 * mm),
            p("→", styles, "center_bold"),
            card("배포 빌드", "정적 WebP 50종<br/>정적 나레이션 50종<br/>Azure 키·endpoint·SDK 0", styles, background=MINT, width=74 * mm),
        ]],
        colWidths=[78 * mm, 10 * mm, 78 * mm],
        hAlign="CENTER",
    )
    security.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    story += [security, Spacer(1, 6 * mm)]
    story += bullet_list(
        [
            "게임 실행 중 생성형 AI나 Azure API를 호출하지 않는다.",
            "현재 라운드의 20종 덱에 필요한 이미지와 음원만 선로딩한다.",
            "나레이션은 한 번에 하나만 재생하고 BGM을 -6dB 낮춘 뒤 복구한다.",
            "오디오 load·decode 실패 시 게임을 멈추지 않고 자막만 표시한다.",
            "Firebase 웹 클라이언트 설정은 공개 식별자이며 관리자·서비스 계정 비밀키를 번들에 넣지 않는다.",
        ],
        styles,
    )
    story += [p("멀티플레이 신뢰 경계", styles, "h2")]
    story += [p("Firestore 규칙은 인증 사용자, 허용 필드, 상태 전이, 방장 권한, 결과 문서의 작성자·불변성과 값 범위를 검증한다. 개인 점수·포획 메뉴는 현재 클라이언트 신뢰이며 서버 리플레이 판정과 App Check는 후속 보강 항목이다.", styles)]
    story += [PageBreak()]

    story += section_title("06", "검증 결과와 남은 QA", styles)
    qa_rows = [
        [p("검증", styles, "table_header"), p("결과", styles, "table_header"), p("범위", styles, "table_header")],
        [p("TypeScript", styles, "card_body"), p("재실행 필요", styles, "center_bold"), p("연출 변경분 선언 정합화 후 제출 commit에서 최종 확인", styles, "card_body")],
        [p("단위 테스트", styles, "card_body"), p("705 pass / 13 skip", styles, "center_bold"), p("기하·규칙·방·결과·Firebase 코덱·자산·나레이션", styles, "card_body")],
        [p("배포 빌드", styles, "card_body"), p("Vite 통과", styles, "center_bold"), p("dist 생성 완료, npm run build는 타입 검사와 함께 최종 재실행", styles, "card_body")],
        [p("음식 50종", styles, "card_body"), p("통과", styles, "center_bold"), p("카탈로그·알파·용량·덱 선로딩·실제 Phaser 전수 QA", styles, "card_body")],
        [p("Firestore 규칙", styles, "card_body"), p("통과", styles, "center_bold"), p("인증·전이·180초 deadline·늦은 제출 거부·결과 불변", styles, "card_body")],
        [p("나레이션 E2E", styles, "card_body"), p("통과", styles, "center_bold"), p("데스크톱 시나리오 3 pass, 모바일 프로젝트 3 intentional skip", styles, "card_body")],
    ]
    qa = Table(qa_rows, colWidths=[36 * mm, 43 * mm, 93 * mm], repeatRows=1, hAlign="CENTER")
    qa.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), INK), ("TEXTCOLOR", (0, 0), (-1, 0), WHITE), ("GRID", (0, 0), (-1, -1), 0.5, LINE), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("BACKGROUND", (0, 1), (-1, -1), CREAM), ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm), ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm), ("TOPPADDING", (0, 0), (-1, -1), 2.5 * mm), ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5 * mm)]))
    story += [qa, Spacer(1, 6 * mm), p("제출 전 실기기 QA", styles, "h2")]
    story += bullet_list(
        [
            "실제 3~8대 기기의 네트워크 지연·재접속·공동 결과 동기화",
            "모바일 카메라 권한과 QR 스캔, Firebase App Check 적용",
            "iOS·Android에서 50개 음원의 체감 음량과 BGM duck 편차",
            "기기 시각 차이에 따른 카운트다운 표시와 클라이언트 결과 신뢰 보강",
        ],
        styles,
        bullet_color="#7048E8",
    )
    story += [PageBreak()]

    story += section_title("07", "외부 에셋·오픈소스·증빙", styles)
    story += [p("게임 런타임에는 제3자의 음식·배경 이미지, 녹음 음성, 사운드 샘플, 외부 폰트를 사용하지 않았다. 효과음과 128 BPM·64-step 배경음은 외부 저장 음원 없이 Web Audio로 실행 중 생성한다. 제출 PDF는 ReportLab(BSD)·pypdf(BSD-3-Clause)와 Windows 기본 맑은 고딕으로 제작했으며 게임 빌드에는 포함하지 않았다.", styles)]
    license_rows = [
        [p("라이선스", styles, "table_header"), p("구성 요소", styles, "table_header")],
        [p("MIT", styles, "card_body"), p("Phaser 4.2.1, Vite 8.1.5, Vitest 4.1.10, qrcode 1.5.4, 타입 정의, Firebase CLI", styles, "card_body")],
        [p("Apache-2.0", styles, "card_body"), p("TypeScript 7.0.2, Playwright 1.62.0, Firebase JavaScript SDK 12.16.0, Rules Unit Testing", styles, "card_body")],
        [p("MIT-CMU", styles, "card_body"), p("Pillow 12.3.0", styles, "card_body")],
        [p("서비스 약관", styles, "card_body"), p("OpenAI Terms of Use - ImageGen 결과, Microsoft Azure 계정·public preview 조건 - 합성 음성", styles, "card_body")],
    ]
    licenses = Table(license_rows, colWidths=[40 * mm, 132 * mm], repeatRows=1, hAlign="CENTER")
    licenses.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), INK), ("TEXTCOLOR", (0, 0), (-1, 0), WHITE), ("GRID", (0, 0), (-1, -1), 0.5, LINE), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("BACKGROUND", (0, 1), (-1, -1), CREAM), ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm), ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm), ("TOPPADDING", (0, 0), (-1, -1), 3 * mm), ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm)]))
    story += [licenses, Spacer(1, 6 * mm), p("재현·감사 가능한 근거", styles, "h2")]
    evidence = Table(
        [
            [p("AI 활용 원장", styles, "small_bold"), p("docs/source/ai-usage.md", styles, "link")],
            [p("에셋·라이선스", styles, "small_bold"), p("docs/evidence/asset-licenses.md", styles, "link")],
            [p("프롬프트 로그", styles, "small_bold"), p("docs/evidence/ai-prompts/ (25개 작업 기록)", styles, "link")],
            [p("음성 생성 이력", styles, "small_bold"), p("docs/source/narration-generation.md, scripts/narration/", styles, "link")],
            [p("소스 저장소", styles, "small_bold"), p('<link href="https://github.com/h200082/oneul-mwo-sseol">https://github.com/h200082/oneul-mwo-sseol</link>', styles, "link")],
        ],
        colWidths=[40 * mm, 132 * mm],
        hAlign="CENTER",
    )
    evidence.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.5, LINE), ("BACKGROUND", (0, 0), (0, -1), LILAC), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm), ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm), ("TOPPADDING", (0, 0), (-1, -1), 2.5 * mm), ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5 * mm)]))
    story += [evidence, Spacer(1, 6 * mm)]
    story += [cover_status(styles, "최종본 반영 항목: GitHub Pages 실제 URL · YouTube URL · 최종 commit SHA · 제출일")]

    doc.build(story, onFirstPage=lambda c, d: page_decor(c, d, "뭐 먹을 거냥? · AI 활용"), onLaterPages=lambda c, d: page_decor(c, d, "뭐 먹을 거냥? · AI 활용"))
    return output


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    TEMP_DIR.mkdir(parents=True, exist_ok=True)
    register_fonts()
    styles = make_styles()
    outputs = [build_game_guide(styles), build_ai_technical(styles)]
    for output in outputs:
        print(output)


if __name__ == "__main__":
    main()
