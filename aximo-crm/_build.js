/* =========================================================================
   Пересборка board.html из data.js.

   Делает ДВЕ вещи:
   1) вшивает данные в шаблон → board.html самодостаточен (открывается из file://
      двойным кликом, без сервера и без CORS);
   2) СТАТИЧЕСКИ отрисовывает доску, статистику и таблицы прямо в разметку.

   Зачем п.2: превью HTML в мобильном/облачном Claude НЕ выполняет JavaScript.
   Раньше доска строилась скриптом в момент открытия — поэтому на телефоне была
   видна только шапка, а колонки и карточки нет. Теперь разметка уже готова в файле
   и доска видна без единой строчки JS. Скрипт в board.html остаётся: на десктопе он
   перерисовывает то же самое поверх и даёт интерактив (перетаскивание карточек,
   модалка сделки, сортировка таблиц).

   Запуск:  node _build.js   (из папки aximo-crm)

   Файлы:
   - data.js                — ИСТОЧНИК ПРАВДЫ (его читает/правит Claude в уроках)
   - _board.template.html   — шаблон доски
   - board.html             — СГЕНЕРИРОВАННЫЙ снимок (данные внутри), его открывает ученик
   ========================================================================= */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const dir = __dirname;

const data = fs.readFileSync(path.join(dir, 'data.js'), 'utf8');
let board = fs.readFileSync(path.join(dir, '_board.template.html'), 'utf8');

// ---- 1. данные внутрь файла ------------------------------------------------
const marker = '<script src="data.js"></script>';
if (board.indexOf(marker) === -1) throw new Error('В шаблоне не найдена строка ' + marker);
board = board.replace(
  marker,
  '<script>\n/* данные вшиты из data.js — board.html самодостаточен. Источник правды: data.js. Пересобрать: node _build.js */\n' + data + '</script>'
);

// ---- 2. статический рендер -------------------------------------------------
// data.js — JS-файл (комментарии, ключи без кавычек), поэтому исполняем его в песочнице,
// а не парсим как JSON.
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(data, sandbox);
const CRM = sandbox.window.AXIMO_CRM;
if (!CRM) throw new Error('В data.js не найден window.AXIMO_CRM');

const LABEL = { New: 'Новые', Qualified: 'Квалификация', Demo: 'Демо', Proposal: 'КП', Negotiation: 'Переговоры', Invoice: 'Счёт выставлен', 'Closed Won': 'Выиграно', 'Closed Lost': 'Проиграно' };
const COLOR = { New: 'var(--s-new)', Qualified: 'var(--s-qual)', Demo: 'var(--s-demo)', Proposal: 'var(--s-prop)', Negotiation: 'var(--s-nego)', Invoice: 'var(--s-inv)', 'Closed Won': 'var(--s-won)', 'Closed Lost': 'var(--s-lost)' };
const OWNER = { You: { i: 'Я', c: 'var(--you)' }, 'Serj Ivanov': { i: 'SI', c: 'var(--serj)' }, 'Max Petrov': { i: 'MP', c: 'var(--max)' } };

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const money = (n) => '$' + (n || 0).toLocaleString('en-US');
const now = new Date();
const companyById = Object.fromEntries(CRM.companies.map((c) => [c.id, c]));

function offDate(d, p) {
  if (d[p + 'HoursAgo'] != null) return new Date(now - d[p + 'HoursAgo'] * 3600e3);
  if (d[p + 'DaysAgo'] != null) return new Date(now - d[p + 'DaysAgo'] * 86400e3);
  return null;
}
function rel(date) {
  if (!date) return '';
  const h = Math.round((now - date) / 3600e3);
  if (h < 1) return 'только что';
  if (h < 24) return h + ' ч';
  const d = Math.round(h / 24);
  if (d < 14) return d + ' дн';
  if (d < 60) return Math.round(d / 7) + ' нед';
  return Math.round(d / 30) + ' мес';
}

const absd = (date) => (date ? date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: '2-digit' }) : '');
const contactById = Object.fromEntries(CRM.contacts.map((c) => [c.id, c]));

// Разворот карточки — то же, что показывает модалка на десктопе, минус смена стадии
// (она требует скрипта). Без JS модалку не открыть, поэтому детали живут внутри <details>.
function dealDetails(d) {
  const c = d.companyId ? companyById[d.companyId] : null;
  const created = offDate(d, 'created');
  const last = offDate(d, 'lastActivity');
  const closed = offDate(d, 'closed');
  const contacts = (d.contactIds || []).map((id) => contactById[id]).filter(Boolean);
  let h = '<div class="dsec">' +
    '<div class="dkv">👤 Ответственный: <b>' + esc(d.owner) + '</b></div>' +
    '<div class="dkv">📅 Создано: <b>' + absd(created) + '</b>' +
    (closed ? ' · 🏁 закрыто: <b>' + absd(closed) + '</b>' : ' · активность: <b>' + absd(last) + '</b>') + '</div>' +
    (d.nextStep ? '<div class="dkv">➡️ <b>Next step:</b> ' + esc(d.nextStep) + '</div>' : '') +
    (d.invoiceNumber ? '<div class="dkv">🧾 <b>Счёт ' + esc(d.invoiceNumber) + ':</b> ' + money(d.amountUSD) +
      ', условия net-' + esc(d.paymentTermsDays) + ', выставлен ' + absd(offDate(d, 'invoiceIssued')) + '</div>' : '') +
    (d.closeReason ? '<div class="dkv">❌ <b>Причина:</b> ' + esc(d.closeReason) + '</div>' : '') +
    '</div>';
  h += '<div class="dsec"><h4>Компания</h4><div class="dkv">' +
    (c ? '<b>' + esc(c.name) + '</b> · ' + esc(c.industry || 'индустрия не указана') + ' · ' + esc(c.country) : 'не указана') +
    '</div></div>';
  h += '<div class="dsec"><h4>Контакты (' + contacts.length + ')</h4>' +
    (contacts.length
      ? contacts.map((p) => '<div class="dkv"><b>' + esc(p.firstName + ' ' + p.lastName) + '</b> — ' + esc(p.title) +
          '<br>' + esc(p.email) + (p.phone ? ' · ' + esc(p.phone) : '') + '</div>').join('')
      : '<div class="dkv">нет</div>') + '</div>';
  const notes = d.notes || [];
  if (notes.length) {
    h += '<div class="dsec"><h4>Заметки (' + notes.length + ')</h4>' +
      notes.map((n) => '<div class="note"><div class="h">' + esc(n.author) + ' · ' +
        rel(new Date(now - n.daysAgo * 86400e3)) + ' назад</div>' + esc(n.text) + '</div>').join('') + '</div>';
  }
  const corr = d.correspondence || [];
  if (corr.length) {
    h += '<div class="dsec"><h4>Переписка (' + corr.length + ')</h4>' +
      corr.map((m) => '<div class="msg ' + esc(m.direction) + '"><div class="h">' +
        (m.direction === 'in' ? '⬅ входящее' : '➡ исходящее') + ' · ' + esc(m.from) + ' · ' +
        rel(new Date(now - m.daysAgo * 86400e3)) + ' назад</div><b>' + esc(m.subject) + '</b><br>' +
        esc(m.body) + '</div>').join('') + '</div>';
  }
  return h;
}

function cardHtml(d) {
  const co = d.companyId ? (companyById[d.companyId] || {}).name : '';
  const last = offDate(d, 'lastActivity') || offDate(d, 'created');
  const ow = OWNER[d.owner] || { i: '?', c: '#999' };
  let ovd = '';
  if (d.stage === 'Invoice' && d.invoiceIssuedDaysAgo != null) {
    const days = d.invoiceIssuedDaysAgo - (d.paymentTermsDays || 0);
    ovd = days > 0
      ? '<div class="ovd">просрочка ' + days + ' дн · ' + esc(d.invoiceNumber || '') + '</div>'
      : '<div class="ovd" style="color:var(--muted)">' + esc(d.invoiceNumber || '') + '</div>';
  }
  return '<details class="card" style="border-left-color:' + COLOR[d.stage] + '"><summary>' +
    '<div class="nm">' + esc(d.name) + '</div>' +
    (co ? '<div class="co">' + esc(co) + '</div>' : '') +
    '<div class="amt">' + money(d.amountUSD) + '</div>' + ovd +
    '<div class="ft"><div class="av" style="background:' + ow.c + '" title="' + esc(d.owner) + '">' + ow.i + '</div>' +
    '<span class="date">' + rel(last) + '</span></div>' +
    '<div class="more">нажми, чтобы раскрыть ▾</div>' +
    '</summary>' + dealDetails(d) + '</details>';
}

const columns = [].concat(CRM.meta.activeStages, CRM.meta.closedStages);
const boardHtml = columns.map((st) => {
  const ds = CRM.deals.filter((d) => d.stage === st);
  const sum = ds.reduce((a, d) => a + (d.amountUSD || 0), 0);
  return '<div class="col">' +
    '<div class="col-h"><div class="ttl"><span class="dot" style="background:' + COLOR[st] + '"></span>' + LABEL[st] + '</div>' +
    '<span class="cnt">' + ds.length + '</span></div>' +
    '<div class="col-sum">' + money(sum) + '</div>' +
    '<div class="col-body">' + ds.map(cardHtml).join('') + '</div></div>';
}).join('');

const sumStages = (arr) => CRM.deals.filter((d) => arr.indexOf(d.stage) !== -1).reduce((a, d) => a + (d.amountUSD || 0), 0);

function tableHtml(cols, rows, countLabel) {
  return '<div class="cnt-row">' + rows.length + ' ' + countLabel + ' · клик по заголовку — сортировка</div>' +
    '<table><thead><tr>' + cols.map((c) => '<th data-k="' + c.key + '">' + c.label + '</th>').join('') + '</tr></thead><tbody>' +
    rows.map((r) => '<tr>' + cols.map((c) => {
      const v = c.val(r);
      const empty = v == null || v === '';
      return '<td' + (empty ? ' class="mt"' : '') + '>' + (empty ? '—' : esc(v)) + '</td>';
    }).join('') + '</tr>').join('') +
    '</tbody></table>';
}

const companiesHtml = tableHtml([
  { key: 'name', label: 'Компания', val: (r) => r.name },
  { key: 'domain', label: 'Домен', val: (r) => r.domain },
  { key: 'industry', label: 'Индустрия', val: (r) => r.industry },
  { key: 'country', label: 'Страна', val: (r) => r.country },
  { key: 'size', label: 'Размер', val: (r) => r.size },
  { key: 'inn', label: 'ИНН', val: (r) => r.inn },
], CRM.companies, 'компаний');

const contactsHtml = tableHtml([
  { key: 'name', label: 'Имя', val: (r) => r.firstName + ' ' + r.lastName },
  { key: 'title', label: 'Должность', val: (r) => r.title },
  { key: 'company', label: 'Компания', val: (r) => (r.companyId ? (companyById[r.companyId] || {}).name : null) },
  { key: 'email', label: 'Email', val: (r) => r.email },
  { key: 'phone', label: 'Телефон', val: (r) => r.phone },
  { key: 'linkedin', label: 'LinkedIn', val: (r) => r.linkedin },
], CRM.contacts, 'контактов');

// ---- 3. подстановка в разметку ---------------------------------------------
const put = (from, to) => {
  if (board.indexOf(from) === -1) throw new Error('В шаблоне не найдено: ' + from);
  board = board.replace(from, to);
};
put('<div class="board" id="board"></div>', '<div class="board" id="board">' + boardHtml + '</div>');
put('<div class="tableview" id="view-companies"></div>', '<div class="tableview" id="view-companies">' + companiesHtml + '</div>');
put('<div class="tableview" id="view-contacts"></div>', '<div class="tableview" id="view-contacts">' + contactsHtml + '</div>');
put('<b id="sOpen">—</b>', '<b id="sOpen">' + money(sumStages(['New', 'Qualified', 'Demo', 'Proposal', 'Negotiation'])) + '</b>');
put('<b id="sInv">—</b>', '<b id="sInv">' + money(sumStages(['Invoice'])) + '</b>');
put('<b id="sWon">—</b>', '<b id="sWon">' + money(sumStages(['Closed Won'])) + '</b>');

if (board.indexOf('window.AXIMO_CRM') === -1) throw new Error('Инлайн данных не удался');
if (board.indexOf('src="data.js"') !== -1) throw new Error('Внешняя ссылка осталась');

fs.writeFileSync(path.join(dir, 'board.html'), board);
console.log('board.html пересобран из data.js (' + board.length + ' байт, ' +
  CRM.deals.length + ' сделок отрисовано статически)');
