#!/usr/bin/env python3
"""Very small Markdown -> PDF converter for course reports.

Supports:
- # / ## / ### headings
- bullet lists starting with '-' or '*'
- fenced code blocks (rendered monospaced)

This avoids external tools like pandoc.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Preformatted


def md_to_story(md: str):
    styles = getSampleStyleSheet()

    h1 = ParagraphStyle("H1", parent=styles["Heading1"], spaceAfter=10)
    h2 = ParagraphStyle("H2", parent=styles["Heading2"], spaceAfter=8)
    h3 = ParagraphStyle("H3", parent=styles["Heading3"], spaceAfter=6)
    body = ParagraphStyle("Body", parent=styles["BodyText"], leading=14, spaceAfter=4)
    bullet = ParagraphStyle("Bullet", parent=body, leftIndent=14, bulletIndent=6)

    story = []

    in_code = False
    code_lines = []

    def flush_code():
        nonlocal code_lines
        if code_lines:
            story.append(Preformatted("\n".join(code_lines), styles["Code"]))
            story.append(Spacer(1, 4))
            code_lines = []

    for raw in md.splitlines():
        line = raw.rstrip("\n")

        if line.strip().startswith("```"):
            if in_code:
                in_code = False
                flush_code()
            else:
                in_code = True
            continue

        if in_code:
            code_lines.append(line)
            continue

        if not line.strip():
            story.append(Spacer(1, 4))
            continue

        # headings
        m = re.match(r"^(#{1,3})\s+(.*)$", line)
        if m:
            level = len(m.group(1))
            txt = m.group(2)
            # basic escaping for reportlab Paragraph
            txt = (
                txt.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
            )
            story.append(Paragraph(txt, {1: h1, 2: h2, 3: h3}[level]))
            continue

        # bullets
        m = re.match(r"^\s*[-*]\s+(.*)$", line)
        if m:
            txt = m.group(1)
            txt = (
                txt.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
            )
            story.append(Paragraph(f"• {txt}", bullet))
            continue

        # horizontal rule
        if line.strip() in {"---", "***"}:
            story.append(Spacer(1, 6))
            continue

        # normal paragraph
        txt = line
        txt = (
            txt.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
        )
        story.append(Paragraph(txt, body))

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
