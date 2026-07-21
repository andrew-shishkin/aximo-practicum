#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
get_lesson.py N — забрать урок N с курс-сервера, проверить подпись и отдать
ТОЛЬКО подлинный урок. Доверенный локальный код (в дистрибутиве).

Лицензионный ключ читается из .env самим скриптом — он НЕ попадает ни в чат,
ни в контекст ассистента. Подпись — Ed25519 по вшитому публичному ключу:
если она не сходится (подмена / MITM / фейковый сервер) — урок НЕ сохраняется.

Запуск:  python3 aximo-licensing/get_lesson.py 2     (Windows: python ...)
Успех:   пишет lesson.json (поле lesson — тело урока) и печатает OK, код 0.
Ошибка:  ничего не пишет, печатает причину в stderr, код != 0 → урок не проводить.
"""
import sys, os, json, base64, ssl, uuid, socket, subprocess, urllib.request, urllib.parse, urllib.error

SERVER = "https://aximo-function-150843257576.europe-west1.run.app"

# Вшитый ПУБЛИЧНЫЙ ключ (приватный — только при офлайн-сборке контента). PoC-ключ.
PUBLIC_KEY_PEM = b"""-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAioiZLcj4VVyhTSUZjWfPfAC2Z1NcPZcNbavLfBjv2N0=
-----END PUBLIC KEY-----"""


def fail(msg, code=1):
    print(msg, file=sys.stderr)
    sys.exit(code)


# --ping — мягкая проверка ключа (валидация/активация, без урока), зовётся из бутстрапа L1;
# --done — мягкая отметка «L1 пройден» (вторая точка воронки), зовётся в итогах L1;
# иначе — позиционный номер урока.
PING = "--ping" in sys.argv[1:]
DONE = "--done" in sys.argv[1:]
# --status N — какой это ключ (trial/full) и упрётся ли урок после N-го в пейволл.
# Зовётся в конце последнего бесплатного урока, чтобы показать оффер сразу, а не ждать /L5.
STATUS = "--status" in sys.argv[1:]
_pos = [a for a in sys.argv[1:] if not a.startswith("-")]
n = _pos[0] if _pos else "1"

# --- ключ из .env (НЕ печатаем, в чат не отдаём) ---
key = None
if os.path.exists(".env"):
    for line in open(".env", encoding="utf-8"):
        line = line.strip()
        if line.startswith("COURSE_KEY="):
            key = line.split("=", 1)[1].strip().strip('"').strip("'")  # последнее вхождение побеждает (если ключ переписали)
# Фолбэк для облачных сессий (Claude в браузере/на телефоне): файловая система песочницы не
# переживает новую сессию, поэтому .env там теряется. Ключ можно один раз положить в переменные
# окружения самого Environment — тогда он подхватывается здесь и переживает сессии.
if not key:
    key = (os.environ.get("COURSE_KEY") or "").strip().strip('"').strip("'") or None
if not key:
    env_path = os.path.abspath(".env")
    fail("Нет COURSE_KEY ни в .env, ни в переменных окружения. Ключ приходил в Телеграм-боте в момент оплаты (покупал давно — поищи там).\n"
         "В облачной сессии (Claude в браузере или на телефоне) надёжнее всего добавить его в настройках Environment,\n"
         "в разделе Environment variables, строкой COURSE_KEY=<ключ> — тогда он не потеряется при новой сессии.\n"
         "Добавь его в терминале (не в чат) — путь абсолютный, сработает из любой папки:\n"
         f"  macOS/Linux:  touch \"{env_path}\" && echo 'COURSE_KEY=<ключ>' >> \"{env_path}\"\n"
         f"  Windows (PS): Add-Content \"{env_path}\" 'COURSE_KEY=<ключ>'")

# --- device_id из ~/.aximo/ (вне папки курса → копирование папки НЕ копирует устройство) ---
dev_dir = os.path.join(os.path.expanduser("~"), ".aximo")
dev_file = os.path.join(dev_dir, "device")
# AXIMO_DEVICE — для облачных сессий: домашняя папка песочницы не переживает новую сессию, и без
# этого каждая сессия выглядела бы для сервера новым устройством и жгла лимит.
device_id = (os.environ.get("AXIMO_DEVICE") or "").strip()
if not device_id:
    try:
        device_id = open(dev_file, encoding="utf-8").read().strip()
    except Exception:
        pass
if not device_id:
    os.makedirs(dev_dir, exist_ok=True)
    device_id = uuid.uuid4().hex
    with open(dev_file, "w", encoding="utf-8") as f:
        f.write(device_id)

# --- надёжная проверка SSL через certifi (не зависит от настройки Python на машине ученика) ---
try:
    import certifi
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "--quiet", "certifi"])
    import certifi
ssl_ctx = ssl.create_default_context(cafile=certifi.where())

# --- надёжная стратегия резолвинга: системный DNS (IPv4) → при отказе DoH ---
# Две частые беды у учеников:
#  1) IPv6 «настроен, но не работает» → на dual-stack домене Python виснет на IPv6.
#     Лечим предпочтением IPv4.
#  2) Провайдер/роутер/антивирус фильтрует DNS и режет внешние резолверы (порт 53) →
#     имя не резолвится вообще (getaddrinfo failed). Лечим DNS-over-HTTPS: спрашиваем IP
#     у Cloudflare/Google по их IP-адресу через HTTPS (порт 443, его не режут) — в обход
#     сломанного DNS сети. TLS проверяется как обычно (у 1.1.1.1/8.8.8.8 IP в сертификате).
def _looks_like_ip(h):
    parts = str(h).split(".")
    return len(parts) == 4 and all(p.isdigit() and 0 <= int(p) <= 255 for p in parts)

def _doh_resolve_a(host):
    for base in ("https://1.1.1.1/dns-query", "https://8.8.8.8/resolve"):
        try:
            q = f"{base}?name={urllib.parse.quote(host)}&type=A"
            req = urllib.request.Request(q, headers={"accept": "application/dns-json"})
            with urllib.request.urlopen(req, timeout=6, context=ssl_ctx) as r:
                j = json.loads(r.read().decode("utf-8"))
            ips = [a["data"] for a in j.get("Answer", []) if a.get("type") == 1]
            if ips:
                return ips
        except Exception:
            continue
    return []

_orig_getaddrinfo = socket.getaddrinfo
def _resolver(host, port, family=0, type=0, proto=0, flags=0):
    try:
        res = _orig_getaddrinfo(host, port, family, type, proto, flags)
        v4 = [r for r in res if r[0] == socket.AF_INET]
        return v4 or res  # предпочитаем IPv4; если его нет (IPv6-only+NAT64) — как есть
    except socket.gaierror:
        # системный DNS не смог (фильтр/блокировка сети) → идём через DoH по IPv4
        if isinstance(host, str) and not _looks_like_ip(host):
            ips = _doh_resolve_a(host)
            if ips:
                p = port if isinstance(port, int) else 0
                return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (ip, p)) for ip in ips]
        raise
socket.getaddrinfo = _resolver

# --- ПИНГ-проверка ключа из L1 (мягко: печатает статус и всегда выходит 0, не роняет L1) ---
if PING:
    ping_url = f"{SERVER}/?key={urllib.parse.quote(key)}&device={urllib.parse.quote(device_id)}&n=1&stage=ping"
    try:
        with urllib.request.urlopen(ping_url, timeout=15, context=ssl_ctx) as r:
            pdata = json.loads(r.read().decode("utf-8"))
        if isinstance(pdata, dict) and pdata.get("ok"):
            print("OK: ключ подтверждён сервером — доступ активен.")
        else:
            print("KEY_INVALID: сервер не подтвердил ключ. Проверь ключ из Телеграм-бота практикума.")
    except urllib.error.HTTPError as e:
        if e.code == 401:
            print("KEY_INVALID: лицензионный ключ не принят (401). Проверь ключ из Телеграм-бота практикума.")
        elif e.code == 403:
            print("KEY_DEVICE_LIMIT: ключ уже активирован на максимуме устройств для этой версии.")
        else:
            print(f"KEY_UNCHECKED: сервер вернул {e.code} — не страшно, проверю ключ при запуске первого урока.")
    except Exception as e:
        print(f"KEY_UNCHECKED: не удалось проверить ключ сейчас ({e}). Это не критично — проверим при запуске первого урока.")
    sys.exit(0)

# --- СТАТУС КЛЮЧА (мягко: не смогли узнать — печатаем UNKNOWN и выходим 0) ---
if STATUS:
    st_url = (f"{SERVER}/?key={urllib.parse.quote(key)}&device={urllib.parse.quote(device_id)}"
              f"&n={urllib.parse.quote(n)}&stage=status")
    try:
        with urllib.request.urlopen(st_url, timeout=15, context=ssl_ctx) as r:
            sdata = json.loads(r.read().decode("utf-8"))
        plan = sdata.get("plan", "full")
        if sdata.get("next_is_paywall"):
            print(f"PLAN={plan} NEXT=paywall")
        else:
            print(f"PLAN={plan} NEXT=open")
    except Exception as e:
        print(f"PLAN=unknown NEXT=unknown ({e})")
    sys.exit(0)

# --- ОТМЕТКА «L1 пройден» (мягко: что бы ни случилось — выходим 0, урок ученику не ломаем) ---
if DONE:
    done_url = f"{SERVER}/?key={urllib.parse.quote(key)}&device={urllib.parse.quote(device_id)}&n=1&stage=done"
    try:
        with urllib.request.urlopen(done_url, timeout=15, context=ssl_ctx) as r:
            r.read()
        print("OK: отметка о завершении урока 1 записана.")
    except Exception as e:
        print(f"UNCHECKED: не удалось записать отметку ({e}). На доступ ученика это не влияет.")
    sys.exit(0)

# --- запрос на сервер ---
url = f"{SERVER}/?key={urllib.parse.quote(key)}&device={urllib.parse.quote(device_id)}&n={urllib.parse.quote(n)}"
try:
    with urllib.request.urlopen(url, timeout=20, context=ssl_ctx) as r:
        raw = r.read().decode("utf-8")
except urllib.error.HTTPError as e:
    if e.code == 401:
        fail("HTTP 401 — лицензионный ключ не принят сервером. Проверь ключ из письма после оплаты.")
    if e.code == 403:
        fail("HTTP 403 — ключ уже активирован на максимуме устройств (лимит 3). Если сменил компьютер — напиши в поддержку.")
    if e.code == 404:
        fail(f"HTTP 404 — урок {n} не найден на сервере.")
    if e.code >= 500:
        fail(f"HTTP {e.code} — временная проблема на сервере курса. Попробуй ещё раз через минуту (скажи «повтори»).")
    fail(f"HTTP {e.code} — сервер вернул ошибку.")
except Exception as e:
    fail("Не достучался до курс-сервера.\n"
         f"  Причина: {e}\n"
         "  Что попробовать по порядку:\n"
         "  1) Самый надёжный обход — раздай интернет с телефона (мобильный) и запусти ещё раз.\n"
         "  2) Если стоит антивирус с «веб-защитой» или файрвол — временно выключи его или добавь домен в исключения.\n"
         "  3) Проверь, что интернет вообще есть (открой любой сайт в браузере); если есть VPN — попробуй и с ним, и без него.")

# --- разбор ---
try:
    data = json.loads(raw)
except Exception:
    fail("Ответ сервера не разобран как JSON.")
if not data.get("ok") or "lesson" not in data or "sig" not in data:
    fail("В ответе нет подписанного урока.")

# --- проверка подписи Ed25519 на ЧИСТОМ Python (без внешних библиотек) ---
# Раньше здесь бралась библиотека cryptography (тянет cffi). В облачных сессиях cffi/cryptography
# часто установлены битыми → ассистент тратил старт первого урока на их «диагностику и починку».
# Ниже — эталонный алгоритм из RFC 8032 (только verify): ничего ставить не нужно, cffi не участвует.
_P = 2 ** 255 - 19
_Q = 2 ** 252 + 27742317777372353535851937790883648493
_D = (-121665 * pow(121666, _P - 2, _P)) % _P
_SQRT_M1 = pow(2, (_P - 1) // 4, _P)

def _recover_x(y, sign):
    if y >= _P:
        return None
    x2 = (y * y - 1) * pow(_D * y * y + 1, _P - 2, _P) % _P
    if x2 == 0:
        return None if sign else 0
    x = pow(x2, (_P + 3) // 8, _P)
    if (x * x - x2) % _P != 0:
        x = x * _SQRT_M1 % _P
    if (x * x - x2) % _P != 0:
        return None
    if (x & 1) != sign:
        x = _P - x
    return x

def _pt_add(Pt, Qt):
    A = (Pt[1] - Pt[0]) * (Qt[1] - Qt[0]) % _P
    B = (Pt[1] + Pt[0]) * (Qt[1] + Qt[0]) % _P
    C = 2 * Pt[3] * Qt[3] * _D % _P
    Dd = 2 * Pt[2] * Qt[2] % _P
    E, F, G, H = B - A, Dd - C, Dd + C, B + A
    return (E * F % _P, G * H % _P, F * G % _P, E * H % _P)

def _pt_mul(s, Pt):
    Qt = (0, 1, 1, 0)
    while s > 0:
        if s & 1:
            Qt = _pt_add(Qt, Pt)
        Pt = _pt_add(Pt, Pt)
        s >>= 1
    return Qt

def _pt_equal(Pt, Qt):
    if (Pt[0] * Qt[2] - Qt[0] * Pt[2]) % _P != 0:
        return False
    if (Pt[1] * Qt[2] - Qt[1] * Pt[2]) % _P != 0:
        return False
    return True

def _pt_decompress(s):
    if len(s) != 32:
        return None
    y = int.from_bytes(s, "little")
    sign = y >> 255
    y &= (1 << 255) - 1
    x = _recover_x(y, sign)
    return None if x is None else (x, y, 1, x * y % _P)

_g_y = 4 * pow(5, _P - 2, _P) % _P
_g_x = _recover_x(_g_y, 0)
_G = (_g_x, _g_y, 1, _g_x * _g_y % _P)

def _ed25519_verify(public, message, signature):
    if len(public) != 32 or len(signature) != 64:
        return False
    A = _pt_decompress(public)
    if A is None:
        return False
    Rs = signature[:32]
    R = _pt_decompress(Rs)
    if R is None:
        return False
    s = int.from_bytes(signature[32:], "little")
    if s >= _Q:
        return False
    import hashlib
    h = int.from_bytes(hashlib.sha512(Rs + public + message).digest(), "little") % _Q
    return _pt_equal(_pt_mul(s, _G), _pt_add(R, _pt_mul(h, A)))

# сырой 32-байтный публичный ключ из PEM: SubjectPublicKeyInfo → последние 32 байта DER
_pem_body = b"".join(l for l in PUBLIC_KEY_PEM.splitlines() if b"-----" not in l)
_RAW_PUB = base64.b64decode(_pem_body)[-32:]

msg = f"aximo-lesson:v1:{data['n']}\n{data['lesson']}".encode("utf-8")
if not _ed25519_verify(_RAW_PUB, msg, base64.b64decode(data["sig"])):
    fail("Подпись урока не сходится — урок не подлинный, исполнять нельзя.")

# --- только теперь сохраняем подлинный урок ---
with open("lesson.json", "w", encoding="utf-8") as f:
    json.dump({"n": data["n"], "lesson": data["lesson"]}, f, ensure_ascii=False)
print(f"OK: урок {data['n']} получен, подпись подтверждена. Тело — в lesson.json.")
