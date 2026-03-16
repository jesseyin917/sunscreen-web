#!/usr/bin/env python3
"""Lightweight Markdown -> PDF converter for course reports.

Goal: readable PDF without external tooling (pandoc). We support the subset used in
our course templates:

- Headings: # .. ######
- Paragraphs
- Bullet lists: - / *
- Blockquotes: lines starting with '>'
- Fenced code blocks: ```
- Inline formatting: **bold**, *italic*, `code`
- Simple markdown tables: rendered as monospaced text blocks

Implementation uses reportlab Paragraph (HTML-like markup).
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Preformatted


def _escape_html(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _inline_md_to_rl(text: str) -> str:
    """Convert a small subset of inline markdown to reportlab Paragraph markup."""
    s = _escape_html(text)

    # code first (avoid messing with * inside code)
    # Use a built-in mono font family that ReportLab can map.
    s = re.sub(r"`([^`]+)`", r"<font face='Courier'>\1</font>", s)

    # bold and italic
    s = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", s)
    # italic: single asterisks
    s = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<i>\1</i>", s)

    return s


def _looks_like_table_row(line: str) -> bool:
    stripped = line.strip()
    return stripped.startswith("|") and stripped.endswith("|") and stripped.count("|") >= 2


def md_to_story(md: str):
    styles = getSampleStyleSheet()

    # Headings
    heading_styles = {
        1: ParagraphStyle("H1", parent=styles["Heading1"], spaceAfter=10),
        2: ParagraphStyle("H2", parent=styles["Heading2"], spaceAfter=8),
        3: ParagraphStyle("H3", parent=styles["Heading3"], spaceAfter=6),
        4: ParagraphStyle("H4", parent=styles["Heading4"], spaceAfter=6),
        5: ParagraphStyle("H5", parent=styles["Heading5"], spaceAfter=4),
        6: ParagraphStyle("H6", parent=styles["Heading6"], spaceAfter=4),
    }

    body = ParagraphStyle("Body", parent=styles["BodyText"], leading=14, spaceAfter=4)
    bullet = ParagraphStyle("Bullet", parent=body, leftIndent=14, bulletIndent=6)
    quote = ParagraphStyle(
        "Quote",
        parent=body,
        leftIndent=12,
        textColor="#444444",
        italic=True,
    )

    story = []

    in_code = False
    code_lines: list[str] = []

    def flush_code():
        nonlocal code_lines
        if code_lines:
            story.append(Preformatted("\n".join(code_lines), styles["Code"]))
            story.append(Spacer(1, 4))
            code_lines = []

    lines = md.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i].rstrip("\n")

        # fenced code blocks
        if line.strip().startswith("```"):
            if in_code:
                in_code = False
                flush_code()
            else:
                in_code = True
            i += 1
            continue

        if in_code:
            code_lines.append(line)
            i += 1
            continue

        # blank line
        if not line.strip():
            story.append(Spacer(1, 4))
            i += 1
            continue

        # markdown tables (very simple): consecutive |...| rows
        if _looks_like_table_row(line):
            table_block = [line]
            j = i + 1
            while j < len(lines) and _looks_like_table_row(lines[j]):
                table_block.append(lines[j])
                j += 1
            story.append(Preformatted("\n".join(table_block), styles["Code"]))
            story.append(Spacer(1, 6))
            i = j
            continue

        # headings
        m = re.match(r"^(#{1,6})\s+(.*)$", line)
        if m:
            level = len(m.group(1))
            txt = _inline_md_to_rl(m.group(2).strip())
            story.append(Paragraph(txt, heading_styles.get(level, heading_styles[3])))
            i += 1
            continue

        # blockquote
        if line.lstrip().startswith(">"):
            txt = line.lstrip()[1:].lstrip()
            story.append(Paragraph(_inline_md_to_rl(txt), quote))
            i += 1
            continue

        # bullets
        m = re.match(r"^\s*[-*]\s+(.*)$", line)
        if m:
            txt = _inline_md_to_rl(m.group(1).strip())
            story.append(Paragraph(f"• {txt}", bullet))
            i += 1
            continue

        # horizontal rule
        if line.strip() in {"---", "***"}:
            story.append(Spacer(1, 6))
            i += 1
            continue

        # normal paragraph
        story.append(Paragraph(_inline_md_to_rl(line.strip()), body))
        i += 1

    if in_code:
        flush_code()

    return story


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: md_to_simple_pdf.py <input.md> <output.pdf>")
        return 2

    src = Path(sys.argv[1])
    out = Path(sys.argv[2])

    md = src.read_text(encoding="utf-8")

    doc = SimpleDocTemplate(
        str(out),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=src.stem,
        author="TeamApex",
    )

    story = md_to_story(md)
    doc.build(story)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
