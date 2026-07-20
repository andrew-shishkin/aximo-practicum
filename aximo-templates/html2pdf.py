#!/usr/bin/env python3
"""
html2pdf.py — красиво конвертирует HTML в PDF, СОХРАНЯЯ дизайн.

Использование:
    python3 html2pdf.py вход.html выход.pdf

Как работает (по очереди, до первого успеха):
  1) headless Chrome / Chromium / Edge / Brave — лучший результат, дизайн один в один
     (macOS / Windows / Linux, ищет уже установленный браузер);
  2) wkhtmltopdf — если он есть в системе;
  3) weasyprint — чистый Python-рендерер; если не установлен, скрипт пробует
     поставить его сам через pip (нужна сеть).

Если ни один способ не сработал (например, в облачной песочнице без браузера
и без сети) — скрипт честно об этом скажет и напомнит, что HTML-файл на месте
и его можно открыть/скачать как есть. Молча ничего не ломается.
"""
import os
import sys
import shutil
import platform
import subprocess


def find_browser():
    system = platform.system()
    paths = []
    if system == "Darwin":
        paths = [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
            "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
        ]
    elif system == "Windows":
        paths = [
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
            os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
            r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        ]
    else:
        paths = []
    for p in paths:
        if p and os.path.exists(p):
            return p
    for name in ("google-chrome", "google-chrome-stable", "chromium",
                 "chromium-browser", "microsoft-edge", "brave-browser", "chrome"):
        found = shutil.which(name)
        if found:
            return found
    return None


def render_with_browser(browser, src, dst):
    """Печать через headless-браузер. True — PDF получился."""
    url = "file://" + src
    variants = [
        [browser, "--headless", "--disable-gpu", "--no-sandbox",
         "--no-pdf-header-footer", "--print-to-pdf-no-header",
         "--print-to-pdf=" + dst, url],
        # старые сборки Chrome не знают --no-pdf-header-footer
        [browser, "--headless", "--disable-gpu", "--no-sandbox",
         "--print-to-pdf=" + dst, url],
    ]
    for cmd in variants:
        try:
            subprocess.run(cmd, check=True, timeout=180,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError):
            continue
        if os.path.exists(dst) and os.path.getsize(dst) > 0:
            return True
    return False


def render_with_wkhtmltopdf(src, dst):
    """Запасной рендерер, если он вдруг стоит в системе."""
    exe = shutil.which("wkhtmltopdf")
    if not exe:
        return False
    try:
        subprocess.run([exe, "--quiet", "--enable-local-file-access", src, dst],
                       check=True, timeout=180,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError):
        return False
    return os.path.exists(dst) and os.path.getsize(dst) > 0


def _weasyprint_available():
    try:
        import weasyprint  # noqa: F401
        return True
    except Exception:
        # ImportError — не установлен; OSError — нет системных библиотек рендеринга
        return False


def _try_install_weasyprint():
    """Ставим weasyprint pip-ом. Пробуем несколько вариантов вызова."""
    attempts = [
        [sys.executable, "-m", "pip", "install", "--quiet", "weasyprint"],
        [sys.executable, "-m", "pip", "install", "--quiet", "--user", "weasyprint"],
        [sys.executable, "-m", "pip", "install", "--quiet",
         "--break-system-packages", "weasyprint"],
    ]
    for cmd in attempts:
        try:
            subprocess.run(cmd, check=True, timeout=300,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError):
            continue
        if _weasyprint_available():
            return True
    return False


def render_with_weasyprint(src, dst):
    """Рендер без браузера. При отсутствии weasyprint — пробуем поставить."""
    if not _weasyprint_available():
        print("Браузера нет — пробую поставить weasyprint (одноразово)…")
        if not _try_install_weasyprint():
            return False
    try:
        from weasyprint import HTML
        HTML(filename=src).write_pdf(dst)
    except Exception as e:
        print("weasyprint не смог собрать PDF:", e)
        return False
    return os.path.exists(dst) and os.path.getsize(dst) > 0


def main():
    if len(sys.argv) < 3:
        print("Использование: python3 html2pdf.py вход.html выход.pdf")
        sys.exit(2)
    src = os.path.abspath(sys.argv[1])
    dst = os.path.abspath(sys.argv[2])
    if not os.path.exists(src):
        print("Не найден входной файл:", src)
        sys.exit(1)
    os.makedirs(os.path.dirname(dst) or ".", exist_ok=True)

    # 1) Браузер — если он есть, результат самый красивый.
    browser = find_browser()
    if browser and render_with_browser(browser, src, dst):
        print("Готов PDF:", dst)
        return

    # 2) wkhtmltopdf, если установлен.
    if render_with_wkhtmltopdf(src, dst):
        print("Готов PDF (wkhtmltopdf):", dst)
        return

    # 3) weasyprint — рендер без браузера.
    if render_with_weasyprint(src, dst):
        print("Готов PDF (weasyprint, без браузера):", dst)
        return

    # Не вышло ничем — объясняем честно и по-человечески.
    print()
    print("PDF собрать не удалось: в этой среде нет ни браузера (Chrome/Chromium/Edge),")
    print("ни рабочего weasyprint — и установить его не получилось (нет сети или прав).")
    print()
    print("Это не потеря работы: HTML-файл готов и полностью пригоден —")
    print("   " + src)
    print("Его можно открыть в браузере, скачать, отправить или напечатать в PDF")
    print("из браузера. Файл лежит в проекте, никуда не денется.")
    sys.exit(1)


if __name__ == "__main__":
    main()
