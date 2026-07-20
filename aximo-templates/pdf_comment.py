#!/usr/bin/env python3
"""
pdf_comment.py — добавляет в PDF НАСТОЯЩИЕ комментарии-аннотации (sticky notes),
а НЕ текст поверх документа. Иконка-заметка ставится на правом поле страницы,
сам комментарий виден во всплывающем окне (как «Комментарии» в Acrobat/Preview).
Так пометки не перекрывают текст договора.

Использование:
    python3 pdf_comment.py вход.pdf выход.pdf комментарии.json

комментарии.json — список:
    [
      {"page": 1, "text": "RED — п.5.2: оплата net-60 без аванса → нужен аванс 50% + этапы, net-15."},
      {"page": 2, "text": "RED — п.8.1/8.3: неограниченная ответственность + штраф 10%/нед → cap = сумма Charges; неустойка ≤5%."}
    ]
(page — номер страницы с 1; на одной странице можно несколько — иконки складываются столбиком, не налезая.)

Зависимость: pypdf (чистый Python, ставится сам при первом запуске; pip-компиляция не нужна).
"""
import sys
import os
import json
import subprocess


def ensure_pypdf():
    try:
        import pypdf  # noqa: F401
        return
    except ImportError:
        print("Ставлю pypdf (одноразово)…")
        subprocess.run([sys.executable, "-m", "pip", "install", "--user", "--quiet", "pypdf"],
                       check=True)


def main():
    if len(sys.argv) < 4:
        print("Использование: python3 pdf_comment.py вход.pdf выход.pdf комментарии.json")
        sys.exit(2)
    inp, outp, cj = sys.argv[1], sys.argv[2], sys.argv[3]
    if not os.path.exists(inp):
        print("Не найден входной PDF:", inp)
        sys.exit(1)
    ensure_pypdf()
    from pypdf import PdfReader, PdfWriter
    from pypdf.annotations import Text

    comments = json.load(open(cj, encoding="utf-8"))
    reader = PdfReader(inp)
    writer = PdfWriter()
    for p in reader.pages:
        writer.add_page(p)

    per_page = {}
    for c in comments:
        pg = int(c.get("page", 1)) - 1
        if pg < 0 or pg >= len(writer.pages):
            pg = 0
        box = writer.pages[pg].mediabox
        x = float(box.right) - 30           # правое поле
        top = float(box.top) - 40
        i = per_page.get(pg, 0)
        per_page[pg] = i + 1
        y = top - i * 28                     # складываем заметки столбиком
        ann = Text(text=c["text"], rect=(x, y - 20, x + 22, y), open=False)
        writer.add_annotation(page_number=pg, annotation=ann)

    os.makedirs(os.path.dirname(os.path.abspath(outp)) or ".", exist_ok=True)
    with open(outp, "wb") as f:
        writer.write(f)
    print("Готов PDF с комментариями:", os.path.abspath(outp))


if __name__ == "__main__":
    main()
