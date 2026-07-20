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
if node:
    res = subprocess.run([node, os.path.join(dir, '_build.js')], cwd=dir)
    sys.exit(res.returncode)

# --- Фолбэк без Node: собираем доску по-старому, данные вшиваем, но статически не рисуем.
# Это нормально для работы на своём компьютере: там доску открывает НАСТОЯЩИЙ браузер,
# он выполняет скрипт и рисует всё сам. Статический рендер нужен только там, где скрипты
# не выполняются (превью в мобильном/облачном Claude), а в облаке Node есть всегда.
with open(os.path.join(dir, 'data.js'), encoding='utf-8', newline='') as f:
    data = f.read()
with open(os.path.join(dir, '_board.template.html'), encoding='utf-8', newline='') as f:
    board = f.read()

marker = '<script src="data.js"></script>'
if marker not in board:
    sys.exit('В шаблоне не найдена строка ' + marker)

board = board.replace(
    marker,
    '<script>\n/* данные вшиты из data.js — board.html самодостаточен. Источник правды: data.js. */\n' + data + '</script>',
    1,
)
if 'window.AXIMO_CRM' not in board or 'src="data.js"' in board:
    sys.exit('Инлайн данных не удался')

with open(os.path.join(dir, 'board.html'), 'w', encoding='utf-8', newline='') as f:
    f.write(board)
print('board.html пересобран из data.js (' + str(len(board)) + ' символов; '
      'без Node — доска рисуется скриптом при открытии в браузере)')
