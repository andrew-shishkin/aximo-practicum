/* =========================================================================
   AXIMO CRM — источник правды (data.js)
   -------------------------------------------------------------------------
   Это «база данных» нашей навайбкоженной CRM. Её читает и обновляет Claude
   по ходу практикума, и из неё рендерится доска board.html.

   ДАТЫ хранятся как ОТНОСИТЕЛЬНЫЕ СМЕЩЕНИЯ (createdDaysAgo, lastActivityDaysAgo,
   closedDaysAgo, createdHoursAgo). Реальные даты вычисляются от «сегодня» в
   момент открытия доски — поэтому пайплайн всегда выглядит «живым», когда бы
   ученик ни запустил практикум.

   ПЕРВЫЙ НАБОР (v0.1): 12 открытых + 6 закрытых сделок. Будет расширен до
   ~20 открытых + ~20 закрытых после апрува формата и тона.

   Поля, начинающиеся с "_", — служебные (для авторов курса), доска их игнорирует.
   ========================================================================= */

window.AXIMO_CRM = {
  meta: {
    company: "Aximo",
    currency: "USD",
    activeStages: ["New", "Qualified", "Demo", "Proposal", "Negotiation", "Invoice"],
    closedStages: ["Closed Won", "Closed Lost"],
    owners: ["You", "Serj Ivanov", "Max Petrov"],

    // --- служебное: какие «дефекты» заложены и в каком уроке их чиним ---
    // ПРИМ.: нумерация уроков сдвинута на −1 после слияния старых L8+L9 в новый L8 «Email Copy». Курс теперь L1–L24.
    _defects: {
      dealsWithoutCompany: [],                     // L14 (чистка CRM): orphan-сделку без компании заведём при сборке L14 (бывш. Wise/d3 → заменён на Wazzup24-лид)
      missingCompanyToCreate: [],                  // L14: TBD при сборке
      duplicateCompanies: [["c6", "c13"], ["c1", "c14"]], // L14: схлопнуть дубли
      leadsToEnrich: ["d1", "d2"],                 // L6: в заявке только имя+корп.емейл (p17/p18) → домен→сайт→ЛПР/ИНН
      companiesMissingFields: ["c13", "c5", "c12"] // L6: дозаполнить поля
    },

    // --- служебное: сделки, которые «создаются» по ходу уроков ---
    _dealsCreatedDuringCourse: {
      L6:  "Входящий лид на квалификацию + обогащение",
      L9:  "2 компании от CEO → найти ЛПР и написать в холодную (outbound)",
      L17: "Сделки из визиток с конференции (CSV-импорт)",
      L18: "Лиды, спарсенные с портала конференции"
    },

    // --- служебное: компании с «жирными» триггерами для L7/L22 ---
    _juicyTriggers: ["c7 (Monzo — Head of AI)", "c12 (Revolut — AI-найм/новости)", "c16 (Deel — новости)", "c3 (Dodo — новости)"]
  },

  /* ============================ КОМПАНИИ ============================ */
  companies: [
    { id: "c1",  name: "VkusVill",       domain: "vkusvill.ru",    industry: "Retail / Grocery",   country: "RU", size: "5000+", inn: null, enrichmentTarget: "datanewton", website: "https://vkusvill.ru" },
    { id: "c2",  name: "Skyeng",         domain: "skyeng.com",     industry: "EdTech",             country: "RU", size: "1000+", inn: null, enrichmentTarget: "datanewton", website: "https://skyeng.com" },
    { id: "c3",  name: "Dodo Brands",    domain: "dodobrands.io",  industry: "FoodTech",           country: "RU/Intl", size: "1000+", inn: null, enrichmentTarget: "datanewton", website: "https://dodobrands.io" },
    { id: "c4",  name: "Kontur",         domain: "kontur.ru",      industry: "B2B SaaS",           country: "RU", size: "1000+", inn: null, enrichmentTarget: "datanewton", website: "https://kontur.ru" },
    { id: "c5",  name: "Delimobil",      domain: "delimobil.ru",   industry: null,                 country: "RU", size: null,   inn: null, enrichmentTarget: null,         website: "https://delimobil.ru" },
    { id: "c6",  name: "Pipedrive",      domain: "pipedrive.com",  industry: "SaaS / CRM",         country: "EE", size: "1000+", inn: null, enrichmentTarget: "apollo",     website: "https://pipedrive.com" },
    { id: "c7",  name: "Monzo",          domain: "monzo.com",      industry: "Fintech",            country: "UK", size: "3000+", inn: null, enrichmentTarget: "linkedin",   website: "https://monzo.com" },
    { id: "c8",  name: "GoCardless",     domain: "gocardless.com", industry: "Fintech",            country: "UK", size: "700+",  inn: null, enrichmentTarget: "apollo",     website: "https://gocardless.com" },
    { id: "c9",  name: "Pleo",           domain: "pleo.io",        industry: "Fintech",            country: "DK", size: "900+",  inn: null, enrichmentTarget: null,         website: "https://pleo.io" },
    { id: "c10", name: "Hotjar",         domain: "hotjar.com",     industry: "SaaS / Analytics",   country: "MT", size: "300+",  inn: null, enrichmentTarget: null,         website: "https://hotjar.com" },
    { id: "c11", name: "Typeform",       domain: "typeform.com",   industry: "SaaS",               country: "ES", size: "500+",  inn: null, enrichmentTarget: "linkedin",   website: "https://typeform.com" },
    { id: "c12", name: "Revolut",        domain: "revolut.com",    industry: null,                 country: "UK", size: null,   inn: null, enrichmentTarget: "linkedin",   website: "https://revolut.com" },
    { id: "c15", name: "Samokat",        domain: "samokat.ru",     industry: "Q-commerce",         country: "RU", size: "5000+", inn: null, enrichmentTarget: null,         website: "https://samokat.ru" },
    { id: "c16", name: "Deel",           domain: "deel.com",       industry: "HR Tech",            country: "US", size: "3000+", inn: null, enrichmentTarget: null,         website: "https://deel.com" },

    // --- свежие входящие лиды (L6): сырые, только имя+корп.емейл у контакта; всё остальное обогащаем ---
    { id: "c17", name: "Whizz",          domain: null,             industry: null,                 country: null, size: null,   inn: null, enrichmentTarget: "apollo",     website: null },
    { id: "c18", name: "HR-Link",        domain: null,             industry: null,                 country: null, size: null,   inn: null, enrichmentTarget: "datanewton", website: null },
    { id: "c19", name: "Wazzup24",       domain: null,             industry: null,                 country: null, size: null,   inn: null, enrichmentTarget: "datanewton", website: null },

    // --- компании по закрытым сделкам (история) ---
    { id: "c20", name: "Lamoda",         domain: "lamoda.ru",      industry: "E-commerce / Fashion", country: "RU", size: "5000+", inn: null, enrichmentTarget: null, website: "https://lamoda.ru" },
    { id: "c21", name: "inDrive",        domain: "indrive.com",    industry: "Mobility",           country: "RU/Intl", size: "3000+", inn: null, enrichmentTarget: null, website: "https://indrive.com" },
    { id: "c22", name: "HeadHunter",     domain: "hh.ru",          industry: "HR / Jobs",          country: "RU", size: "3000+", inn: null, enrichmentTarget: null, website: "https://hh.ru" },
    { id: "c23", name: "Ozon",           domain: "ozon.ru",        industry: "E-commerce",         country: "RU", size: "5000+", inn: null, enrichmentTarget: null, website: "https://ozon.ru" },
    { id: "c24", name: "Aviasales",      domain: "aviasales.ru",   industry: "Travel",             country: "RU", size: "500+",  inn: null, enrichmentTarget: null, website: "https://aviasales.ru" },
    { id: "c25", name: "Personio",       domain: "personio.com",   industry: "HR Tech",            country: "DE", size: "1500+", inn: null, enrichmentTarget: null, website: "https://personio.com" },
    { id: "c26", name: "Qonto",          domain: "qonto.com",      industry: "Fintech",            country: "FR", size: "1400+", inn: null, enrichmentTarget: null, website: "https://qonto.com" },
    { id: "c27", name: "Spendesk",       domain: "spendesk.com",   industry: "Fintech",            country: "FR", size: "600+",  inn: null, enrichmentTarget: null, website: "https://spendesk.com" },
    { id: "c28", name: "GoStudent",      domain: "gostudent.org",  industry: "EdTech",             country: "AT", size: "1000+", inn: null, enrichmentTarget: null, website: "https://gostudent.org" },
    { id: "c29", name: "Trade Republic", domain: "traderepublic.com", industry: "Fintech",         country: "DE", size: "900+",  inn: null, enrichmentTarget: null, website: "https://traderepublic.com" },
    { id: "c30", name: "Glovo",          domain: "glovoapp.com",   industry: "Delivery",           country: "ES", size: "3000+", inn: null, enrichmentTarget: null, website: "https://glovoapp.com" },
    { id: "c31", name: "Bolt",           domain: "bolt.eu",        industry: "Mobility",           country: "EE", size: "4000+", inn: null, enrichmentTarget: null, website: "https://bolt.eu" },
    { id: "c32", name: "ЛогистПро",      domain: "logistpro-spb.ru", industry: "Логистика",        country: "RU", size: "11-50", inn: null, enrichmentTarget: "datanewton", website: "https://logistpro-spb.ru" },

    // --- ДУБЛИ (чиним в уроке про чистку CRM) ---
    { id: "c13", name: "Pipedrive OÜ",   domain: null,             industry: null,                 country: "EE", size: null,   inn: null, enrichmentTarget: null, _duplicateOf: "c6" },
    { id: "c14", name: "ООО Вкусвилл",   domain: "vkusvill.ru",    industry: "Ритейл",             country: "RU", size: null,   inn: null, enrichmentTarget: null, _duplicateOf: "c1" }
  ],

  /* ============================ КОНТАКТЫ ============================ */
  contacts: [
    { id: "p1",  companyId: "c6",  firstName: "Lukas",      lastName: "Horvath",   title: "COO",                       email: "lukas.horvath@pipedrive.com",   phone: "+372 5000 1102", linkedin: null },
    { id: "p2",  companyId: "c2",  firstName: "Elena",      lastName: "Popescu",   title: "Head of Operations",        email: "elena.popescu@skyeng.com",      phone: "+7 495 000-12-04", linkedin: null },
    { id: "p3",  companyId: "c8",  firstName: "Marek",      lastName: "Nowak",     title: "Head of Support",           email: "marek.nowak@gocardless.com",    phone: "+44 20 7946 0112", linkedin: null },
    { id: "p4",  companyId: "c7",  firstName: "Anna",       lastName: "Kovalenko", title: "Head of AI",                email: "anna.kovalenko@monzo.com",      phone: "+44 20 7946 0143", linkedin: null },
    { id: "p5",  companyId: "c7",  firstName: "Tomas",      lastName: "Varga",     title: "Customer Ops Lead",         email: "tomas.varga@monzo.com",         phone: "+44 20 7946 0144", linkedin: null },
    { id: "p6",  companyId: "c10", firstName: "Sofia",      lastName: "Marin",     title: "Product Lead",              email: "sofia.marin@hotjar.com",        phone: "+356 2010 0150", linkedin: null },
    { id: "p7",  companyId: "c3",  firstName: "Pavel",      lastName: "Novak",     title: "COO",                       email: "pavel.novak@dodobrands.io",     phone: "+7 495 000-17-07", linkedin: null },
    { id: "p8",  companyId: "c3",  firstName: "Milan",      lastName: "Kovac",     title: "Data Lead",                 email: "milan.kovac@dodobrands.io",     phone: "+7 495 000-17-08", linkedin: null },
    { id: "p9",  companyId: "c11", firstName: "Katarzyna",  lastName: "Wójcik",    title: "Growth Lead",               email: "katarzyna.wojcik@typeform.com", phone: "+34 931 220 190", linkedin: null },
    { id: "p10", companyId: "c4",  firstName: "Andrei",     lastName: "Lupu",      title: "Head of Document Products", email: "andrei.lupu@kontur.ru",         phone: "+7 495 000-11-10", linkedin: null },
    { id: "p11", companyId: "c4",  firstName: "Ivana",      lastName: "Horak",     title: "IT Director",               email: "ivana.horak@kontur.ru",         phone: "+7 495 000-11-11", linkedin: null },
    { id: "p12", companyId: "c9",  firstName: "Dragan",     lastName: "Petrovic",  title: "Finance Ops Manager",       email: "dragan.petrovic@pleo.io",       phone: "+45 32 12 01 12", linkedin: null },
    { id: "p13", companyId: "c5",  firstName: "Bohdan",     lastName: "Tkachenko", title: "CTO",                       email: "bohdan.tkachenko@delimobil.ru", phone: "+7 495 000-15-13", linkedin: null },
    { id: "p14", companyId: "c15", firstName: "Nikola",     lastName: "Jovanovic", title: "Operations Director",       email: "nikola.jovanovic@samokat.ru",   phone: "+7 495 000-15-14", linkedin: null },
    { id: "p15", companyId: "c16", firstName: "Aleksandra", lastName: "Kozlova",   title: "People Ops Lead",           email: "aleksandra.kozlova@deel.com",   phone: "+1 555 0116", linkedin: null },

    // --- контакты входящих лидов L6 (только имя+корп.емейл из формы; должность/телефон находим обогащением) ---
    { id: "p17", companyId: "c17", firstName: "Daniel",     lastName: "Roth",      title: null,                        email: "daniel.roth@getwhizz.com",      phone: null, linkedin: null },
    { id: "p18", companyId: "c18", firstName: "Egor",       lastName: "Smirnov",   title: null,                        email: "egor.smirnov@hr-link.ru",       phone: null, linkedin: null },

    // --- контакты по закрытым сделкам ---
    { id: "p20", companyId: "c20", firstName: "Igor",    lastName: "Volkov",      title: "Head of Operations", email: "igor.volkov@lamoda.ru",         phone: "+7 495 000-20-20", linkedin: null },
    { id: "p21", companyId: "c21", firstName: "Daria",   lastName: "Sokolova",    title: "COO",                email: "daria.sokolova@indrive.com",    phone: "+7 495 000-21-21", linkedin: null },
    { id: "p22", companyId: "c22", firstName: "Roman",   lastName: "Orlov",       title: "Product Director",   email: "roman.orlov@hh.ru",             phone: "+7 495 000-22-22", linkedin: null },
    { id: "p23", companyId: "c23", firstName: "Yulia",   lastName: "Morozova",    title: "Head of Automation", email: "yulia.morozova@ozon.ru",        phone: "+7 495 000-23-23", linkedin: null },
    { id: "p24", companyId: "c24", firstName: "Artem",   lastName: "Belov",       title: "CTO",                email: "artem.belov@aviasales.ru",      phone: "+7 495 000-24-24", linkedin: null },
    { id: "p25", companyId: "c25", firstName: "Tomasz",  lastName: "Wisniewski",  title: "Head of People Ops", email: "tomasz.wisniewski@personio.com",phone: "+49 89 1200 2525", linkedin: null },
    { id: "p26", companyId: "c26", firstName: "Elena",   lastName: "Marin",       title: "Operations Lead",    email: "elena.marin@qonto.com",         phone: "+33 1 7000 2626", linkedin: null },
    { id: "p27", companyId: "c27", firstName: "Pavel",   lastName: "Horvat",      title: "Finance Lead",       email: "pavel.horvat@spendesk.com",     phone: "+33 1 7000 2727", linkedin: null },
    { id: "p28", companyId: "c28", firstName: "Milos",   lastName: "Petrovic",    title: "Head of Growth",     email: "milos.petrovic@gostudent.org",  phone: "+43 1 200 2828", linkedin: null },
    { id: "p29", companyId: "c29", firstName: "Ivan",    lastName: "Novak",       title: "Head of CX",         email: "ivan.novak@traderepublic.com",  phone: "+49 30 1200 2929", linkedin: null },
    { id: "p30", companyId: "c30", firstName: "Sofia",   lastName: "Ilic",        title: "Operations Manager", email: "sofia.ilic@glovoapp.com",       phone: "+34 931 220 3030", linkedin: null },
    { id: "p31", companyId: "c31", firstName: "Andrei",  lastName: "Popa",        title: "Head of Support",    email: "andrei.popa@bolt.eu",           phone: "+372 5000 3131", linkedin: null },
    { id: "p32", companyId: "c32", firstName: "Pavel",   lastName: "Gusev",       title: "Коммерческий директор", email: "p.gusev@logistpro-spb.ru",      phone: "+7 812 700-12-09", linkedin: null },

    // контакт-форм-филлер заявки d3 (Wazzup24) — только имя+почта
    { id: "p16", companyId: "c19", firstName: "Sergey",      lastName: "Lebedev",   title: null,                        email: "sergey.lebedev@wazzup24.ru",    phone: null, linkedin: null }
  ],

  /* ============================= СДЕЛКИ ============================= */
  deals: [
    /* ---------- NEW ---------- */
    {
      id: "d1", name: "Заявка с сайта — Whizz", companyId: "c17", contactIds: ["p17"], stage: "New",
      amountUSD: 0, owner: "You", createdHoursAgo: 1, lastActivityHoursAgo: 1,
      nextStep: "Квалифицировать: что за компания, наш ли ICP, найти ЛПР",
      notes: [{ daysAgo: 0, author: "You", text: "Заявка с сайта. Всё, что есть: Daniel Roth, daniel.roth@getwhizz.com. Нужно обогатить (домен → сайт → ЛПР) и квалифицировать." }],
      correspondence: []
    },
    {
      id: "d2", name: "Заявка с сайта — HR-Link", companyId: "c18", contactIds: ["p18"], stage: "New",
      amountUSD: 0, owner: "You", createdHoursAgo: 4, lastActivityHoursAgo: 4,
      nextStep: "Квалифицировать: что за компания, наш ли ICP, найти ЛПР и ИНН",
      notes: [{ daysAgo: 0, author: "You", text: "Заявка с сайта. Всё, что есть: Egor Smirnov, egor.smirnov@hr-link.ru. Российская компания — обогатить через сайт (ИНН/выручка) и квалифицировать." }],
      correspondence: []
    },
    {
      id: "d3", name: "Заявка с сайта — Wazzup24", companyId: "c19", contactIds: ["p16"], stage: "New",
      amountUSD: 0, owner: "You", createdDaysAgo: 1, lastActivityDaysAgo: 1,
      nextStep: "Квалифицировать: что за компания, наш ли ICP",
      notes: [{ daysAgo: 1, author: "You", text: "Заявка с сайта. Всё, что есть: Sergey Lebedev, sergey.lebedev@wazzup24.ru. Обогатить и квалифицировать." }],
      correspondence: []
    },

    /* ---------- QUALIFIED ---------- */
    {
      id: "d4", name: "Pipedrive — AI-ассистент для саппорта", companyId: "c6", contactIds: ["p1"], stage: "Qualified",
      amountUSD: 24000, owner: "You", createdDaysAgo: 12, lastActivityDaysAgo: 4,
      nextStep: "Назначить демо",
      notes: [
        { daysAgo: 11, author: "You", text: "Квалификация ОК: ~40% тикетов типовые, хотят бота 1-й линии. Бюджет подтверждён." },
        { daysAgo: 4,  author: "You", text: "Lukas просил прислать пару кейсов перед демо." }
      ],
      correspondence: []
    },
    {
      id: "d5", name: "Skyeng — AI-проверка домашних заданий", companyId: "c2", contactIds: ["p2"], stage: "Qualified",
      amountUSD: 28000, owner: "You", createdDaysAgo: 18, lastActivityDaysAgo: 11,
      nextStep: "Согласовать дату демо — подвисло, давно не писали",
      notes: [{ daysAgo: 11, author: "You", text: "Боль: преподаватели тонут в проверке ДЗ. Хотят AI-первичную проверку. ЛПР — Elena (Head of Ops). Договаривались про дату демо — пока тишина." }],
      correspondence: []
    },
    {
      id: "d6", name: "GoCardless — AI-автоматизация поддержки", companyId: "c8", contactIds: ["p3"], stage: "Qualified",
      amountUSD: 35000, owner: "Serj Ivanov", createdDaysAgo: 20, lastActivityDaysAgo: 0,
      nextStep: "ДЕМО СЕГОДНЯ 16:00 — их CEO завтра в отпуск, хочет лично глянуть до решения. Срочно подготовиться.",
      notes: [
        { daysAgo: 9, author: "Serj Ivanov", text: "Квалифицировал, интерес есть. Боль: саппорт захлёбывается, ~50% тикетов типовые (статусы платежей, смена реквизитов), сидят на Zendesk + ручная разборка. Ушёл в отпуск — подхватите демо." },
        { daysAgo: 0, author: "You", text: "Marek просит демо сегодня в 16:00: их CEO завтра уходит в отпуск на 2 недели и хочет лично оценить решение до того, как примут финальное решение. Готовлюсь срочно." }
      ],
      correspondence: [
        { daysAgo: 0, direction: "in", from: "marek.nowak@gocardless.com", subject: "Демо сегодня?", body: "Привет! Наш CEO завтра уходит в отпуск на две недели, но хочет лично посмотреть ваше решение, прежде чем примем решение. Сможете показать демо сегодня в 16:00? Извините за срочность." }
      ]
    },

    /* ---------- DEMO ---------- */
    {
      id: "d7", name: "Monzo — AI customer insights", companyId: "c7", contactIds: ["p4", "p5"], stage: "Demo",
      amountUSD: 40000, owner: "You", createdDaysAgo: 25, lastActivityDaysAgo: 2,
      nextStep: "Подготовить и отправить КП",
      notes: [{ daysAgo: 2, author: "You", text: "Демо прошло отлично. Anna (Head of AI) хочет КП с ROI-расчётом. Tomas — будущий пользователь." }],
      correspondence: [
        { daysAgo: 8, direction: "in",  from: "anna.kovalenko@monzo.com", subject: "Re: AI customer insights",  body: "Интересно, давайте демо на след. неделе. Подключу Tomas из Customer Ops." },
        { daysAgo: 2, direction: "in",  from: "anna.kovalenko@monzo.com", subject: "После демо",                 body: "Спасибо, выглядит сильно. Пришлите КП с расчётом окупаемости, покажу команде." }
      ]
    },
    {
      id: "d8", name: "Hotjar — AI feedback analyzer", companyId: "c10", contactIds: ["p6"], stage: "Demo",
      amountUSD: 20000, owner: "You", createdDaysAgo: 15, lastActivityDaysAgo: 5,
      nextStep: "Дожать до КП (пилот уже выигран — см. d15)",
      notes: [{ daysAgo: 5, author: "You", text: "Пилот (d15) прошёл успешно, обсуждаем полноценный проект." }],
      correspondence: []
    },

    /* ---------- PROPOSAL ---------- */
    {
      id: "d9", name: "Dodo Brands — AI прогноз спроса", companyId: "c3", contactIds: ["p7", "p8"], stage: "Proposal",
      amountUSD: 45000, owner: "You", createdDaysAgo: 35, lastActivityDaysAgo: 7,
      nextStep: "Фолоап по отправленному КП",
      notes: [{ daysAgo: 7, author: "You", text: "КП отправлено. Pavel (COO) на финальном слове, Milan (Data Lead) — технический чемпион." }],
      correspondence: [
        { daysAgo: 7, direction: "out", from: "hi@aximo.io", subject: "КП: AI-прогноз спроса",  body: "Pavel, направляю КП с тремя пакетами и сроками. Готов обсудить в удобное время." }
      ]
    },
    {
      id: "d10", name: "Typeform — AI form optimization", companyId: "c11", contactIds: ["p9"], stage: "Proposal",
      amountUSD: 26000, owner: "Serj Ivanov", createdDaysAgo: 30, lastActivityDaysAgo: 14,
      nextStep: "Реанимировать — тишина 2 недели",
      notes: [{ daysAgo: 14, author: "Serj Ivanov", text: "Отправил КП перед отпуском. Тишина 2 недели — нужен фолоап." }],
      correspondence: [
        { daysAgo: 14, direction: "out", from: "serj.ivanov@aximo.io", subject: "КП для Typeform", body: "Katarzyna, направляю предложение. Дайте знать, что думаете." }
      ]
    },

    /* ---------- NEGOTIATION ---------- */
    {
      id: "d11", name: "Kontur — AI обработка документов", companyId: "c4", contactIds: ["p10", "p11"], stage: "Negotiation",
      amountUSD: 38000, owner: "Serj Ivanov", createdDaysAgo: 50, lastActivityDaysAgo: 16,
      nextStep: "Заглохло ~2 недели: после звонка ждут от нас финальные условия (SLA + сроки) и проект договора, мяч на нашей стороне, Serj в отпуске. Написать сильное письмо → сдвинуть к договору.",
      _transcriptFile: "aximo-templates/transcripts/kontur-call-1.txt",
      notes: [
        { daysAgo: 18, author: "Serj Ivanov", text: "Звонок с Andrei (Head of Document Products) и Ivana (IT Director). Почти договорились: внедряем AI-обработку входящих документов (счета, договоры, акты). Бюджет ок. Открытые вопросы — SLA (гарантии по времени реакции/аптайму, на этом фокус Ivana) и сроки запуска (Andrei хочет до пика отчётности). Детали в транскрипте." },
        { daysAgo: 16, author: "Serj Ivanov", text: "Ivana просит прислать финальные условия по SLA и срокам + проект договора, вынесут на согласование. Ушёл в отпуск — подхватите, мяч на нашей стороне." }
      ],
      correspondence: [
        { daysAgo: 18, direction: "in",  from: "andrei.lupu@kontur.ru", subject: "Re: внедрение",  body: "В целом за. Остались вопросы по SLA и срокам реакции — обсудим на звонке." },
        { daysAgo: 16, direction: "in",  from: "ivana.horak@kontur.ru", subject: "Договор",        body: "Спасибо за звонок. Пришлите финальные условия по SLA и срокам запуска и проект договора — вынесем на согласование руководству." }
      ]
    },
    {
      id: "d12", name: "Pleo — AI категоризация расходов", companyId: "c9", contactIds: ["p12"], stage: "Negotiation",
      amountUSD: 22000, owner: "You", createdDaysAgo: 40, lastActivityDaysAgo: 8,
      nextStep: "Согласовать смету и условия",
      notes: [{ daysAgo: 8, author: "You", text: "Dragan торгуется по цене, просит поэтапную оплату. Близко к закрытию." }],
      correspondence: []
    },

    /* ---------- CLOSED WON ---------- */
    {
      id: "d13", name: "Delimobil — AI оптимизация маршрутов", companyId: "c5", contactIds: ["p13"], stage: "Closed Won",
      amountUSD: 33000, owner: "You", createdDaysAgo: 110, closedDaysAgo: 40, lastActivityDaysAgo: 40,
      notes: [{ daysAgo: 40, author: "You", text: "Внедрено, клиент доволен. Кандидат на ретейнер/допродажу." }], correspondence: []
    },
    {
      id: "d14", name: "Samokat — AI управление складом", companyId: "c15", contactIds: ["p14"], stage: "Closed Won",
      amountUSD: 41000, owner: "Serj Ivanov", createdDaysAgo: 150, closedDaysAgo: 95, lastActivityDaysAgo: 95,
      notes: [{ daysAgo: 95, author: "Serj Ivanov", text: "Крупнейшее внедрение квартала. Референс-кейс." }], correspondence: []
    },
    {
      id: "d15", name: "Hotjar — пилот аналитики отзывов", companyId: "c10", contactIds: ["p6"], stage: "Closed Won",
      amountUSD: 7000, owner: "You", createdDaysAgo: 90, closedDaysAgo: 60, lastActivityDaysAgo: 60,
      notes: [{ daysAgo: 60, author: "You", text: "Пилот успешен → перешли к полному проекту (d8)." }], correspondence: []
    },

    /* ---------- CLOSED LOST ---------- */
    {
      id: "d16", name: "Deel — AI онбординг-бот", companyId: "c16", contactIds: ["p15"], stage: "Closed Lost",
      amountUSD: 30000, owner: "You", createdDaysAgo: 130, closedDaysAgo: 60, lastActivityDaysAgo: 60,
      closeReason: "Выбрали конкурента (дешевле)",
      notes: [{ daysAgo: 60, author: "You", text: "Проиграли по цене. Кандидат на реанимацию — спросить, как зашло у конкурента." }], correspondence: []
    },
    {
      id: "d17", name: "Monzo — AI knowledge base", companyId: "c7", contactIds: ["p4"], stage: "Closed Lost",
      amountUSD: 25000, owner: "Serj Ivanov", createdDaysAgo: 220, closedDaysAgo: 120, lastActivityDaysAgo: 120,
      closeReason: "Заморозили бюджет",
      notes: [{ daysAgo: 120, author: "Serj Ivanov", text: "Бюджет заморозили. Сейчас снова активны (см. d7) — связь сохранилась." }], correspondence: []
    },
    {
      id: "d18", name: "Skyeng — AI подбор репетиторов", companyId: "c2", contactIds: ["p2"], stage: "Closed Lost",
      amountUSD: 32000, owner: "You", createdDaysAgo: 200, closedDaysAgo: 85, lastActivityDaysAgo: 85,
      closeReason: "Не было ресурсов на их стороне",
      notes: [{ daysAgo: 85, author: "You", text: "Заглохло из-за нехватки людей у них. Сейчас обсуждаем другой проект (d5)." }], correspondence: []
    },

    /* ---------- INVOICE / СЧЁТ ВЫСТАВЛЕН (выиграно, ждём оплату — для урока дебиторки) ---------- */
    {
      id: "d19", name: "Pipedrive — AI-ассистент (этап 1)", companyId: "c6", contactIds: ["p1"], stage: "Invoice",
      amountUSD: 12000, owner: "You", createdDaysAgo: 70, lastActivityDaysAgo: 18,
      invoiceNumber: "AX-2041", invoiceIssuedDaysAgo: 18, paymentTermsDays: 10,
      nextStep: "Просрочка ~8 дней — напомнить об оплате",
      notes: [{ daysAgo: 18, author: "You", text: "Счёт AX-2041 на $12 000 выставлен, условия net-10. Оплата не поступила — просрочка." }],
      correspondence: [{ daysAgo: 18, direction: "out", from: "hi@aximo.io", subject: "Счёт AX-2041", body: "Lukas, направляю счёт по этапу 1. Оплата в течение 10 дней." }]
    },
    {
      id: "d20", name: "Kontur — пилот обработки документов", companyId: "c4", contactIds: ["p10"], stage: "Invoice",
      amountUSD: 9000, owner: "Serj Ivanov", createdDaysAgo: 80, lastActivityDaysAgo: 25,
      invoiceNumber: "AX-2038", invoiceIssuedDaysAgo: 25, paymentTermsDays: 14,
      nextStep: "Просрочка ~11 дней — напомнить (Serj в отпуске)",
      notes: [{ daysAgo: 25, author: "Serj Ivanov", text: "Счёт AX-2038 на $9 000, net-14. Перед отпуском не дожал оплату." }],
      correspondence: []
    },
    {
      id: "d21", name: "Delimobil — доработка маршрутов", companyId: "c5", contactIds: ["p13"], stage: "Invoice",
      amountUSD: 6000, owner: "You", createdDaysAgo: 60, lastActivityDaysAgo: 12,
      invoiceNumber: "AX-2049", invoiceIssuedDaysAgo: 12, paymentTermsDays: 10,
      nextStep: "Просрочка ~2 дня — мягкое напоминание",
      notes: [{ daysAgo: 12, author: "You", text: "Счёт AX-2049 на $6 000, net-10. Клиент лояльный, чуть задержали." }],
      correspondence: []
    },

    /* ---------- CLOSED WON (история) ---------- */
    {
      id: "d22", name: "Lamoda — AI-рекомендации товаров", companyId: "c20", contactIds: ["p20"], stage: "Closed Won",
      amountUSD: 38000, owner: "You", createdDaysAgo: 180, closedDaysAgo: 130, lastActivityDaysAgo: 130,
      notes: [{ daysAgo: 130, author: "You", text: "Внедрено. Хороший референс по ритейлу." }], correspondence: []
    },
    {
      id: "d23", name: "HeadHunter — AI-скрининг резюме", companyId: "c22", contactIds: ["p22"], stage: "Closed Won",
      amountUSD: 44000, owner: "Serj Ivanov", createdDaysAgo: 220, closedDaysAgo: 160, lastActivityDaysAgo: 160,
      notes: [{ daysAgo: 160, author: "Serj Ivanov", text: "Крупный проект, прошёл гладко." }], correspondence: []
    },
    {
      id: "d24", name: "Qonto — AI-категоризация транзакций", companyId: "c26", contactIds: ["p26"], stage: "Closed Won",
      amountUSD: 24000, owner: "You", createdDaysAgo: 150, closedDaysAgo: 100, lastActivityDaysAgo: 100,
      notes: [{ daysAgo: 100, author: "You", text: "Довольны, обсуждали продолжение." }], correspondence: []
    },
    {
      id: "d25", name: "GoStudent — AI-подбор репетиторов", companyId: "c28", contactIds: ["p28"], stage: "Closed Won",
      amountUSD: 29000, owner: "You", createdDaysAgo: 140, closedDaysAgo: 90, lastActivityDaysAgo: 90,
      notes: [], correspondence: []
    },
    {
      id: "d26", name: "Bolt — AI-поддержка водителей", companyId: "c31", contactIds: ["p31"], stage: "Closed Won",
      amountUSD: 35000, owner: "Serj Ivanov", createdDaysAgo: 200, closedDaysAgo: 150, lastActivityDaysAgo: 150,
      notes: [{ daysAgo: 150, author: "Serj Ivanov", text: "Масштабное внедрение, кандидат на ретейнер." }], correspondence: []
    },
    {
      id: "d27", name: "Aviasales — AI-чат поддержки", companyId: "c24", contactIds: ["p24"], stage: "Closed Won",
      amountUSD: 27000, owner: "You", createdDaysAgo: 120, closedDaysAgo: 75, lastActivityDaysAgo: 75,
      notes: [], correspondence: []
    },
    {
      id: "d28", name: "Spendesk — AI-обработка чеков", companyId: "c27", contactIds: ["p27"], stage: "Closed Won",
      amountUSD: 21000, owner: "You", createdDaysAgo: 160, closedDaysAgo: 110, lastActivityDaysAgo: 110,
      notes: [], correspondence: []
    },

    /* ---------- CLOSED LOST (история) ---------- */
    {
      id: "d29", name: "Ozon — AI-прогноз спроса", companyId: "c23", contactIds: ["p23"], stage: "Closed Lost",
      amountUSD: 50000, owner: "Serj Ivanov", createdDaysAgo: 240, closedDaysAgo: 170, lastActivityDaysAgo: 170,
      closeReason: "Решили делать инхаус",
      notes: [{ daysAgo: 170, author: "Serj Ivanov", text: "Ушли в инхаус-разработку. Стоит вернуться — инхаус часто буксует." }], correspondence: []
    },
    {
      id: "d30", name: "inDrive — AI-роутинг заказов", companyId: "c21", contactIds: ["p21"], stage: "Closed Lost",
      amountUSD: 40000, owner: "You", createdDaysAgo: 210, closedDaysAgo: 140, lastActivityDaysAgo: 140,
      closeReason: "Заморозили бюджет",
      notes: [{ daysAgo: 140, author: "You", text: "Бюджет заморозили на квартал. Кандидат на реанимацию." }], correspondence: []
    },
    {
      id: "d31", name: "Personio — AI-онбординг сотрудников", companyId: "c25", contactIds: ["p25"], stage: "Closed Lost",
      amountUSD: 26000, owner: "You", createdDaysAgo: 190, closedDaysAgo: 120, lastActivityDaysAgo: 120,
      closeReason: "Выбрали конкурента",
      notes: [], correspondence: []
    },
    {
      id: "d32", name: "Trade Republic — AI-поддержка клиентов", companyId: "c29", contactIds: ["p29"], stage: "Closed Lost",
      amountUSD: 33000, owner: "Serj Ivanov", createdDaysAgo: 230, closedDaysAgo: 160, lastActivityDaysAgo: 160,
      closeReason: "Не приоритет в этом году",
      notes: [], correspondence: []
    },
    {
      id: "d33", name: "Glovo — AI-диспетчеризация", companyId: "c30", contactIds: ["p30"], stage: "Closed Lost",
      amountUSD: 36000, owner: "You", createdDaysAgo: 175, closedDaysAgo: 105, lastActivityDaysAgo: 105,
      closeReason: "Долго согласовывали, ушли к конкуренту",
      notes: [{ daysAgo: 105, author: "You", text: "Потеряли на скорости согласования. Урок на будущее." }], correspondence: []
    },
    {
      id: "d34", name: "Lamoda — AI-поддержка (этап 2)", companyId: "c20", contactIds: ["p20"], stage: "Closed Lost",
      amountUSD: 30000, owner: "You", createdDaysAgo: 110, closedDaysAgo: 55, lastActivityDaysAgo: 55,
      closeReason: "Урезали бюджет на инновации",
      notes: [{ daysAgo: 55, author: "You", text: "Этап 1 выиграли (d22), этап 2 не пошёл из-за бюджета. Тёплый контакт остался." }], correspondence: []
    },
    {
      id: "d35", name: "HeadHunter — AI-аналитика вакансий", companyId: "c22", contactIds: ["p22"], stage: "Closed Lost",
      amountUSD: 28000, owner: "You", createdDaysAgo: 130, closedDaysAgo: 70, lastActivityDaysAgo: 70,
      closeReason: "Сменился ЛПР, проект заглох",
      notes: [{ daysAgo: 70, author: "You", text: "Чемпион ушёл. Новый ЛПР — повод вернуться." }], correspondence: []
    },
    {
      id: "d36", name: "Pipedrive — AI-аналитика (расширение)", companyId: "c6", contactIds: ["p1"], stage: "Closed Lost",
      amountUSD: 18000, owner: "Serj Ivanov", createdDaysAgo: 95, closedDaysAgo: 45, lastActivityDaysAgo: 45,
      closeReason: "Решили отложить",
      notes: [], correspondence: []
    },
    {
      id: "d37", name: "ЛогистПро — AI-обработка заявок перевозок", companyId: "c32", contactIds: ["p32"], stage: "Closed Lost",
      amountUSD: 9000, owner: "You", createdDaysAgo: 230, closedDaysAgo: 195, lastActivityDaysAgo: 195,
      closeReason: "Не было бюджета, просили вернуться через полгода",
      notes: [{ daysAgo: 195, author: "You", text: "Проиграли по бюджету. Небольшой региональный перевозчик из СПб, обещали вернуться через полгода — с тех пор тишина." }], correspondence: []
    }
  ]
};
