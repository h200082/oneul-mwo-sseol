from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = ROOT / "output" / "pdf"
TEMP_DIR = ROOT / "tmp" / "pdfs" / "fillable"

FONT_REGULAR = Path(r"C:\Windows\Fonts\malgun.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\malgunbd.ttf")

INK = colors.HexColor("#1E163B")
MUTED = colors.HexColor("#686178")
PINK = colors.HexColor("#F84C8B")
PURPLE = colors.HexColor("#7048E8")
YELLOW = colors.HexColor("#FFD55A")
CREAM = colors.HexColor("#FFF8EF")
LILAC = colors.HexColor("#F1ECFF")
LINE = colors.HexColor("#CFC6E6")
WHITE = colors.white


@dataclass(frozen=True)
class DocumentSpec:
    source: Path
    output: Path
    document_label: str
    field_prefix: str
    include_youtube: bool


def register_fonts() -> None:
    for path in (FONT_REGULAR, FONT_BOLD):
        if not path.exists():
            raise FileNotFoundError(path)
    pdfmetrics.registerFont(TTFont("Malgun", str(FONT_REGULAR)))
    pdfmetrics.registerFont(TTFont("Malgun-Bold", str(FONT_BOLD)))


def draw_wrapped_text(
    c: canvas.Canvas,
    text: str,
    x: float,
    y: float,
    width: float,
    *,
    font_name: str = "Malgun",
    font_size: float = 8.5,
    leading: float = 13,
    color=MUTED,
) -> float:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if pdfmetrics.stringWidth(candidate, font_name, font_size) <= width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    c.setFont(font_name, font_size)
    c.setFillColor(color)
    cursor = y
    for line in lines:
        c.drawString(x, cursor, line)
        cursor -= leading
    return cursor


def draw_label(c: canvas.Canvas, label: str, x: float, y: float) -> None:
    c.setFont("Malgun-Bold", 8.5)
    c.setFillColor(INK)
    c.drawString(x, y, label)


def draw_text_field(
    c: canvas.Canvas,
    *,
    name: str,
    label: str,
    x: float,
    y: float,
    width: float,
    value: str = "",
    height: float = 9 * mm,
    multiline: bool = False,
) -> float:
    draw_label(c, label, x, y)
    field_y = y - height - 2.5 * mm
    kwargs = {
        "name": name,
        "tooltip": label,
        "x": x,
        "y": field_y,
        "width": width,
        "height": height,
        "value": value,
        "borderStyle": "solid",
        "borderWidth": 1,
        "borderColor": PURPLE,
        "fillColor": WHITE,
        "textColor": INK,
        "forceBorder": True,
        "fontName": "Helvetica",
        "fontSize": 9,
    }
    if multiline:
        kwargs["fieldFlags"] = "multiline"
    c.acroForm.textfield(**kwargs)
    return field_y - 6 * mm


def draw_checkbox(c: canvas.Canvas, *, name: str, label: str, x: float, y: float) -> None:
    c.acroForm.checkbox(
        name=name,
        tooltip=label,
        x=x,
        y=y - 1.5 * mm,
        size=4.5 * mm,
        buttonStyle="check",
        borderWidth=1,
        borderColor=PURPLE,
        fillColor=WHITE,
        textColor=PINK,
        checked=False,
        forceBorder=True,
    )
    c.setFont("Malgun", 8.5)
    c.setFillColor(INK)
    c.drawString(x + 7 * mm, y, label)


def build_form_page(spec: DocumentSpec, output: Path) -> None:
    c = canvas.Canvas(str(output), pagesize=A4)
    width, height = A4
    c.setTitle(f"{spec.document_label} - 편집 가능한 제출 정보")
    c.setAuthor("뭐 먹을 거냥? 프로젝트")

    c.setFillColor(INK)
    c.rect(0, height - 12 * mm, width, 12 * mm, fill=1, stroke=0)
    c.setFillColor(PINK)
    c.roundRect(16 * mm, height - 38 * mm, 48 * mm, 10 * mm, 2 * mm, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("Malgun-Bold", 9)
    c.drawCentredString(40 * mm, height - 34.3 * mm, "직접 입력 가능")

    c.setFillColor(INK)
    c.setFont("Malgun-Bold", 23)
    c.drawString(16 * mm, height - 51 * mm, "최종 제출 정보")
    c.setFont("Malgun", 10)
    c.setFillColor(MUTED)
    c.drawString(16 * mm, height - 59 * mm, spec.document_label)

    instruction_y = height - 72 * mm
    c.setFillColor(CREAM)
    c.roundRect(16 * mm, instruction_y - 21 * mm, width - 32 * mm, 25 * mm, 3 * mm, fill=1, stroke=0)
    draw_wrapped_text(
        c,
        "보라색 테두리 입력란을 클릭해 수정한 뒤 다른 이름으로 저장하세요. Chrome·Edge·Adobe Acrobat의 PDF 양식 입력을 지원합니다. 본문은 평면 이미지가 아니라 선택 가능한 PDF 텍스트로 유지됩니다.",
        21 * mm,
        instruction_y - 4 * mm,
        width - 42 * mm,
        color=INK,
    )

    x_left = 16 * mm
    x_right = 108 * mm
    field_width = 81 * mm
    start_y = instruction_y - 34 * mm

    left_y = start_y
    left_y = draw_text_field(
        c,
        name=f"{spec.field_prefix}_submitter_name",
        label="개인 제출자 이름",
        x=x_left,
        y=left_y,
        width=field_width,
    )
    left_y = draw_text_field(
        c,
        name=f"{spec.field_prefix}_github_url",
        label="GitHub 저장소 URL",
        x=x_left,
        y=left_y,
        width=field_width,
        value="https://github.com/h200082/oneul-mwo-sseol",
    )
    left_y = draw_text_field(
        c,
        name=f"{spec.field_prefix}_play_url",
        label="실제 플레이 URL",
        x=x_left,
        y=left_y,
        width=field_width,
        value="https://h200082.github.io/oneul-mwo-sseol/",
    )
    if spec.include_youtube:
        left_y = draw_text_field(
            c,
            name=f"{spec.field_prefix}_youtube_url",
            label="YouTube 플레이 영상 URL",
            x=x_left,
            y=left_y,
            width=field_width,
        )

    right_y = start_y
    right_y = draw_text_field(
        c,
        name=f"{spec.field_prefix}_commit_sha",
        label="최종 Git commit SHA",
        x=x_right,
        y=right_y,
        width=field_width,
    )
    right_y = draw_text_field(
        c,
        name=f"{spec.field_prefix}_document_date",
        label="최종 문서 생성일",
        x=x_right,
        y=right_y,
        width=field_width,
        value="2026-08-10",
    )
    right_y = draw_text_field(
        c,
        name=f"{spec.field_prefix}_submission_date",
        label="실제 제출일·시각",
        x=x_right,
        y=right_y,
        width=field_width,
    )
    right_y = draw_text_field(
        c,
        name=f"{spec.field_prefix}_notes",
        label="최종 메모",
        x=x_right,
        y=right_y,
        width=field_width,
        height=27 * mm,
        multiline=True,
        value="",
    )

    check_top = 79 * mm
    c.setFillColor(LILAC)
    c.roundRect(16 * mm, 24 * mm, width - 32 * mm, 59 * mm, 3 * mm, fill=1, stroke=0)
    c.setFillColor(PURPLE)
    c.setFont("Malgun-Bold", 11)
    c.drawString(21 * mm, check_top - 5 * mm, "최종 확인")
    checkbox_labels = [
        "GitHub와 Pages 링크를 시크릿 창에서 확인했다.",
        "PC와 실제 모바일에서 플레이를 확인했다.",
        "PDF 안의 링크와 표·이미지·글꼴을 확인했다.",
        "외부 에셋·오픈소스 라이선스와 AI 활용 내역을 확인했다.",
    ]
    if spec.include_youtube:
        checkbox_labels.insert(2, "YouTube 영상이 30~60초이며 로그인 없이 재생된다.")
    box_y = check_top - 15 * mm
    for index, label in enumerate(checkbox_labels):
        draw_checkbox(
            c,
            name=f"{spec.field_prefix}_check_{index + 1}",
            label=label,
            x=22 * mm,
            y=box_y,
        )
        box_y -= 8 * mm

    c.setStrokeColor(LINE)
    c.line(16 * mm, 15 * mm, width - 16 * mm, 15 * mm)
    c.setFillColor(MUTED)
    c.setFont("Malgun", 7)
    c.drawString(16 * mm, 10 * mm, "편집 가능한 AcroForm · 입력 후 다른 이름으로 저장 권장")
    c.drawRightString(width - 16 * mm, 10 * mm, "개인 참가")
    c.save()


def append_form_page(spec: DocumentSpec) -> None:
    form_page = TEMP_DIR / f"{spec.field_prefix}-form-page.pdf"
    build_form_page(spec, form_page)

    writer = PdfWriter()
    writer.append(str(spec.source))
    writer.append(str(form_page))
    writer.set_need_appearances_writer(False)
    writer.add_metadata(
        {
            "/Title": spec.document_label,
            "/Author": "뭐 먹을 거냥? 프로젝트",
            "/Subject": "직접 편집 가능한 사전 제출본",
            "/Creator": "ReportLab + pypdf",
        }
    )
    with spec.output.open("wb") as stream:
        writer.write(stream)


def expected_fields(spec: DocumentSpec) -> set[str]:
    names = {
        f"{spec.field_prefix}_submitter_name",
        f"{spec.field_prefix}_github_url",
        f"{spec.field_prefix}_play_url",
        f"{spec.field_prefix}_commit_sha",
        f"{spec.field_prefix}_document_date",
        f"{spec.field_prefix}_submission_date",
        f"{spec.field_prefix}_notes",
    }
    if spec.include_youtube:
        names.add(f"{spec.field_prefix}_youtube_url")
        checkbox_count = 5
    else:
        checkbox_count = 4
    names.update(f"{spec.field_prefix}_check_{index}" for index in range(1, checkbox_count + 1))
    return names


def validate_form(spec: DocumentSpec) -> None:
    reader = PdfReader(str(spec.output))
    fields = reader.get_fields() or {}
    expected = expected_fields(spec)
    missing = expected - set(fields)
    extra = set(fields) - expected
    if missing or extra:
        raise ValueError(f"field tree mismatch for {spec.output.name}: missing={sorted(missing)}, extra={sorted(extra)}")

    widget_names: set[str] = set()
    missing_appearance: list[str] = []
    for page in reader.pages:
        for annotation_ref in page.get("/Annots") or []:
            annotation = annotation_ref.get_object()
            if annotation.get("/Subtype") != "/Widget":
                continue
            parent = annotation.get("/Parent")
            parent_object = parent.get_object() if parent else None
            name = annotation.get("/T") or (parent_object.get("/T") if parent_object else None)
            if name:
                widget_names.add(str(name))
                appearance = annotation.get("/AP")
                if not appearance or not appearance.get("/N"):
                    missing_appearance.append(str(name))

    if widget_names != expected:
        raise ValueError(f"widget mismatch for {spec.output.name}: {sorted(widget_names ^ expected)}")
    if missing_appearance:
        raise ValueError(f"widgets without appearance streams: {sorted(missing_appearance)}")

    if len(reader.pages) != len(PdfReader(str(spec.source)).pages) + 1:
        raise ValueError(f"unexpected page count for {spec.output.name}")


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    TEMP_DIR.mkdir(parents=True, exist_ok=True)
    register_fonts()
    specs = [
        DocumentSpec(
            source=OUTPUT_DIR / "뭐_먹을_거냥_게임_소개_및_설명_사전본.pdf",
            output=OUTPUT_DIR / "뭐_먹을_거냥_게임_소개_및_설명_편집가능.pdf",
            document_label="뭐 먹을 거냥? - 게임 소개 및 설명 문서",
            field_prefix="game",
            include_youtube=True,
        ),
        DocumentSpec(
            source=OUTPUT_DIR / "뭐_먹을_거냥_AI_활용_기술_문서_사전본.pdf",
            output=OUTPUT_DIR / "뭐_먹을_거냥_AI_활용_기술_문서_편집가능.pdf",
            document_label="뭐 먹을 거냥? - AI 활용 기술 문서",
            field_prefix="ai",
            include_youtube=False,
        ),
    ]
    for spec in specs:
        if not spec.source.exists():
            raise FileNotFoundError(spec.source)
        append_form_page(spec)
        validate_form(spec)
        print(spec.output)


if __name__ == "__main__":
    main()
