#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Пересборка board.html из data.js — Python-версия _build.js (тот же результат).
Вшивает данные в шаблон → САМОДОСТАТОЧНЫЙ board.html, который открывается
двойным кликом из file:// без сервера и без CORS.

Запуск:  python3 _build.py   (из папки aximo-crm)

Зачем дубль на Python: на компе ученика гарантированно есть Python (ставим в L1),
а Node — нет. Вывод байт-в-байт совпадает с `node _build.js`, поэтому переключение
между сборщиками не «дёргает» board.html.

Файлы:
- data.js                — ИСТОЧНИК ПРАВДЫ (его читает/правит Claude в уроках)
- _board.template.html   — шаблон доски (разметка + рендер, со ссылкой на data.js)
- board.html             — СГЕНЕРИРОВАННЫЙ снимок (данные внутри), его открывает ученик
"""
import os

dir = os.path.dirname(os.path.abspath(__file__))

# newline='' — отключаем трансляцию переводов строк, чтобы байты совпадали с node на любой ОС
with open(os.path.join(dir, 'data.js'), encoding='utf-8', newline='') as f:
    data = f.read()
with open(os.path.join(dir, '_board.template.html'), encoding='utf-8', newline='') as f:
    board = f.read()

marker = '<script src="data.js"></script>'
if marker not in board:
    raise SystemExit('В шаблоне не найдена строка ' + marker)

board = board.replace(
    marker,
    '<script>\n/* данные вшиты из data.js — board.html самодостаточен. Источник правды: data.js. Пересобрать: node _build.js */\n' + data + '</script>',
    1,
)

if 'window.AXIMO_CRM' not in board:
    raise SystemExit('Инлайн данных не удался')
if 'src="data.js"' in board:
    raise SystemExit('Внешняя ссылка осталась')

with open(os.path.join(dir, 'board.html'), 'w', encoding='utf-8', newline='') as f:
    f.write(board)
print('board.html пересобран из data.js (' + str(len(board)) + ' символов)')
