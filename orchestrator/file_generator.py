import csv as csv_module
import io
import os
import re
import uuid

GENERATED_FILES_DIR = "generated_files"
os.makedirs(GENERATED_FILES_DIR, exist_ok=True)

MAX_SLUG_LENGTH = 50  # leaves room for the unique suffix + extension

_TABLE_ROW_RE = re.compile(r"^\s*\|(.+)\|\s*$")
_TABLE_SEPARATOR_RE = re.compile(r"^\s*\|?[\s:|-]+\|?\s*$")
_HEADING_RE = re.compile(r"^(#{1,6})\s+(.*)$")
_IMAGE_RE = re.compile(r"^\s*\[\[IMAGE\s+(\d+)\]\]\s*$", re.IGNORECASE)  # ADDED: where a picture goes


def _slugify(title: str) -> str:
    """
    Turns arbitrary user-request text into a filesystem-safe name fragment.
    Windows forbids \\ / : * ? " < > | in filenames - a raw title containing
    any of these would crash on save.
    """
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return slug[:MAX_SLUG_LENGTH] or "document"


def _build_file_name(title: str, fmt: str) -> str:
    """
    Readable-but-collision-safe file name: a slug of the user's actual
    request, plus a short random suffix, so two similar requests never
    silently overwrite each other's files.
    """
    slug = _slugify(title)
    suffix = uuid.uuid4().hex[:8]
    return f"{slug}-{suffix}.{fmt}"


def _split_table_row(line: str) -> list[str]:
    inner = line.strip().strip("|")
    return [cell.strip() for cell in inner.split("|")]


def _normalize_image(data: bytes) -> bytes | None:
    """
    ADDED: re-saves any picture (jpg, png, webp, gif...) as a PNG of sensible
    size, so Word, PDF and Excel can all use it. Needs Pillow (pip install pillow).
    Returns None if the picture cannot be read.
    """
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(data))
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGB")
        img.thumbnail((1600, 1600))
        out = io.BytesIO()
        img.save(out, format="PNG")
        return out.getvalue()
    except Exception as e:
        print(f"[file_generation] could not use a picture: {type(e).__name__}: {e}")
        return None


def _image_at(images: list[bytes] | None, index: int) -> bytes | None:
    if images and 0 <= index < len(images):
        return images[index]
    return None


def parse_structured_content(content: str, image_count: int = 0) -> list[dict]:
    """
    Turns model output into a list of blocks:
      {"type": "heading", "level": int, "text": str}
      {"type": "table", "rows": list[list[str]]}   # rows[0] is the header row
      {"type": "paragraph", "text": str}            # one or more lines, joined
      {"type": "image", "index": int}               # ADDED: a line like [[IMAGE 1]]
    Table detection: two or more consecutive '|...|' lines, where the second
    line is a separator row (---/:---/---:) gets treated as a real table and
    that separator row is dropped from the output rows. A lone '|...|' line
    with no separator underneath it is NOT treated as a table - falls through
    to a normal paragraph, since that's more likely stray text than a real
    table the model intended.
    Any attached picture the model did not place with [[IMAGE n]] is added at the end.
    """
    lines = content.split("\n")
    blocks = []
    paragraph_buffer = []
    i = 0

    def _flush_paragraph():
        if paragraph_buffer:
            text = "\n".join(paragraph_buffer).strip()
            if text:
                blocks.append({"type": "paragraph", "text": text})
            paragraph_buffer.clear()

    while i < len(lines):
        line = lines[i]

        image_match = _IMAGE_RE.match(line)
        if image_match:
            _flush_paragraph()
            blocks.append({"type": "image", "index": int(image_match.group(1)) - 1})
            i += 1
            continue

        heading_match = _HEADING_RE.match(line)
        if heading_match:
            _flush_paragraph()
            blocks.append({
                "type": "heading",
                "level": len(heading_match.group(1)),
                "text": heading_match.group(2).strip(),
            })
            i += 1
            continue

        if _TABLE_ROW_RE.match(line) and i + 1 < len(lines) and _TABLE_SEPARATOR_RE.match(lines[i + 1]):
            _flush_paragraph()
            rows = [_split_table_row(line)]
            i += 2  # skip the header row and the separator row
            while i < len(lines) and _TABLE_ROW_RE.match(lines[i]):
                rows.append(_split_table_row(lines[i]))
                i += 1
            blocks.append({"type": "table", "rows": rows})
            continue

        if line.strip():
            paragraph_buffer.append(line)
        else:
            _flush_paragraph()
        i += 1

    _flush_paragraph()

    placed = {b["index"] for b in blocks if b["type"] == "image"}
    for n in range(image_count):
        if n not in placed:
            blocks.append({"type": "image", "index": n})
    return blocks


def generate_docx(content: str, title: str, file_name: str, images: list[bytes] | None = None) -> None:
    from docx import Document  # python-docx
    from docx.shared import Inches

    doc = Document()
    doc.add_heading(title, level=1)

    for block in parse_structured_content(content, len(images or [])):
        if block["type"] == "heading":
            doc.add_heading(block["text"], level=min(block["level"] + 1, 9))
        elif block["type"] == "table":
            rows = block["rows"]
            table = doc.add_table(rows=len(rows), cols=len(rows[0]))
            table.style = "Light Grid Accent 1"
            for r, row_data in enumerate(rows):
                for c, cell_text in enumerate(row_data):
                    cell = table.cell(r, c)
                    cell.text = cell_text
                    if r == 0:
                        for p in cell.paragraphs:
                            for run in p.runs:
                                run.bold = True
        elif block["type"] == "image":
            data = _image_at(images, block["index"])
            if data:
                doc.add_picture(io.BytesIO(data), width=Inches(5.5))
        else:
            doc.add_paragraph(block["text"])

    doc.save(os.path.join(GENERATED_FILES_DIR, file_name))


def generate_pdf(content: str, title: str, file_name: str, images: list[bytes] | None = None) -> None:
    from reportlab.lib.pagesizes import letter  # reportlab
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.platypus import Image as RLImage
    from reportlab.lib.utils import ImageReader
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib import colors

    file_path = os.path.join(GENERATED_FILES_DIR, file_name)
    styles = getSampleStyleSheet()
    story = [Paragraph(title, styles["Title"]), Spacer(1, 12)]

    heading_styles = {1: "Heading1", 2: "Heading2", 3: "Heading3"}

    for block in parse_structured_content(content, len(images or [])):
        if block["type"] == "heading":
            style_name = heading_styles.get(block["level"], "Heading4")
            story.append(Paragraph(block["text"], styles[style_name]))
            story.append(Spacer(1, 6))
        elif block["type"] == "table":
            table = Table(block["rows"])
            table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e0e0e0")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]))
            story.append(table)
            story.append(Spacer(1, 12))
        elif block["type"] == "image":
            data = _image_at(images, block["index"])
            if data:
                iw, ih = ImageReader(io.BytesIO(data)).getSize()
                scale = min(450 / iw, 600 / ih, 1)  # keep it inside the page margins
                story.append(RLImage(io.BytesIO(data), width=iw * scale, height=ih * scale))
                story.append(Spacer(1, 12))
        else:
            story.append(Paragraph(block["text"].replace("\n", "<br/>"), styles["Normal"]))
            story.append(Spacer(1, 6))

    doc = SimpleDocTemplate(file_path, pagesize=letter)
    doc.build(story)


def generate_xlsx(content: str, title: str, file_name: str, images: list[bytes] | None = None) -> None:
    from openpyxl import Workbook  # openpyxl
    from openpyxl.styles import Font
    from openpyxl.drawing.image import Image as XLImage

    wb = Workbook()
    ws = wb.active
    ws.title = title[:31] or "Sheet1"  # Excel sheet names cap at 31 chars

    row_num = 1
    for block in parse_structured_content(content, len(images or [])):
        if block["type"] == "heading":
            cell = ws.cell(row=row_num, column=1, value=block["text"])
            cell.font = Font(bold=True, size=14 - block["level"])
            row_num += 1
        elif block["type"] == "table":
            for r, row_data in enumerate(block["rows"]):
                for c, cell_text in enumerate(row_data, start=1):
                    cell = ws.cell(row=row_num, column=c, value=cell_text)
                    if r == 0:
                        cell.font = Font(bold=True)
                row_num += 1
        elif block["type"] == "image":
            data = _image_at(images, block["index"])
            if data:
                picture = XLImage(io.BytesIO(data))
                scale = min(1, 480 / picture.width)
                picture.width, picture.height = picture.width * scale, picture.height * scale
                ws.add_image(picture, f"A{row_num}")
                row_num += int(picture.height / 20) + 1  # leave room so rows below do not sit under the picture
        else:
            for line in block["text"].split("\n"):
                if line.strip():
                    ws.cell(row=row_num, column=1, value=line)
                    row_num += 1
        row_num += 1  # blank row between blocks

    wb.save(os.path.join(GENERATED_FILES_DIR, file_name))


def generate_csv(content: str, title: str, file_name: str, images: list[bytes] | None = None) -> None:
    file_path = os.path.join(GENERATED_FILES_DIR, file_name)
    with open(file_path, "w", newline="", encoding="utf-8") as f:
        writer = csv_module.writer(f)
        for block in parse_structured_content(content):  # a CSV file cannot hold pictures
            if block["type"] == "heading":
                writer.writerow([block["text"]])
            elif block["type"] == "table":
                for row_data in block["rows"]:
                    writer.writerow(row_data)
            else:
                for line in block["text"].split("\n"):
                    if line.strip():
                        writer.writerow([line])


_FILE_GENERATORS = {
    "docx": generate_docx,
    "pdf": generate_pdf,
    "xlsx": generate_xlsx,
    "csv": generate_csv,
}


def generate_file(content: str, fmt: str, title: str = "Document",
                  images: list[bytes] | None = None) -> tuple[str, str]:
    """
    Dispatches to the right format-specific generator. The file name is
    built once, here, from the user's actual request (via title).
    images: raw bytes of pictures the user attached; they are placed where the
    content says [[IMAGE 1]], [[IMAGE 2]]... or at the end if not placed.
    Returns (public_url_path, file_name).
    """
    generator = _FILE_GENERATORS.get(fmt)
    if generator is None:
        raise ValueError(f"Unsupported file format: {fmt!r}")

    usable = [p for p in (_normalize_image(raw) for raw in (images or [])) if p]

    file_name = _build_file_name(title, fmt)
    generator(content, title, file_name, usable)
    return f"/files/{file_name}", file_name