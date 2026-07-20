#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Пересборка board.html из data.js — Python-обёртка над _build.js.

Запуск:  python3 _build.py   (из папки aximo-crm)

Почему обёртка, а не вторая реализация: доска теперь отрисовывается СТАТИЧЕСКИ
(колонки и карточки готовой разметкой), потому что превью HTML в мобильном/облачном
Claude не выполняет JavaScript. Чтобы отрисовать, нужно прочитать data.js — а это
JS-файл с комментариями и ключами без кавычек, его нельзя разобрать как JSON.
Разбирать его умеет сам Node, поэтому вся логика живёт в _build.js, а здесь только вызов.

Зачем тогда этот файл: в уроках команда пересборки даётся под Python (он есть на
машине ученика гарантированно). Если Node не найден — честно говорим об этом, а не
собираем тихо «половинчатую» доску.

Файлы:
- data.js                — ИСТОЧНИК ПРАВДЫ (его читает/правит Claude в уроках)
- _board.template.html   — шаблон доски
- board.html             — СГЕНЕРИРОВАННЫЙ снимок, его открывает ученик
"""
import os
import shutil
import subprocess
import sys

dir = os.path.dirname(os.path.abspath(__file__))

node = shutil.which('node') or shutil.which('nodejs')
if not node:
    sys.exit(
        'Не найден Node.js — им собирается доска.\n'
        'В облачной сессии он есть всегда; на своём компьютере поставь его с nodejs.org\n'
        'либо запусти сборку напрямую: node _build.js'
    )

res = subprocess.run([node, os.path.join(dir, '_build.js')], cwd=dir)
sys.exit(res.returncode)
