/* =========================================================================
   Пересборка board.html из data.js.
   Вшивает данные в шаблон → получается САМОДОСТАТОЧНЫЙ board.html,
   который открывается двойным кликом из file:// без сервера и без CORS.

   Запуск:  node _build.js   (из папки aximo-crm)

   Файлы:
   - data.js                — ИСТОЧНИК ПРАВДЫ (его читает/правит Claude в уроках)
   - _board.template.html   — шаблон доски (разметка + рендер, со ссылкой на data.js)
   - board.html             — СГЕНЕРИРОВАННЫЙ снимок (данные внутри), его открывает ученик

   Если node недоступен — Claude может пересобрать вручную: взять _board.template.html
   и заменить строку <script src="data.js"></script> на <script>…содержимое data.js…</script>.
   ========================================================================= */
const fs = require('fs');
const path = require('path');
const dir = __dirname;

const data = fs.readFileSync(path.join(dir, 'data.js'), 'utf8');
let board = fs.readFileSync(path.join(dir, '_board.template.html'), 'utf8');

const marker = '<script src="data.js"></script>';
if (board.indexOf(marker) === -1) throw new Error('В шаблоне не найдена строка ' + marker);

board = board.replace(
  marker,
  '<script>\n/* данные вшиты из data.js — board.html самодостаточен. Источник правды: data.js. Пересобрать: node _build.js */\n' + data + '</script>'
);

if (board.indexOf('window.AXIMO_CRM') === -1) throw new Error('Инлайн данных не удался');
if (board.indexOf('src="data.js"') !== -1) throw new Error('Внешняя ссылка осталась');

fs.writeFileSync(path.join(dir, 'board.html'), board);
console.log('board.html пересобран из data.js (' + board.length + ' байт)');
