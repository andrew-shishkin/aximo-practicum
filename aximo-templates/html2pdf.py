#!/usr/bin/env python3
"""
html2pdf.py — красиво конвертирует HTML в PDF, СОХРАНЯЯ дизайн (через headless Chrome).
Использование:
    python3 html2pdf.py вход.html выход.pdf

Работает на macOS / Windows / Linux: находит установленный Chrome / Chromium / Edge
и рендерит страницу как при печати из браузера, но без «мусорных» колонтитулов.
Никаких pip-зависимостей не нужно — только установленный браузер на движке Chromium.
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


def main():
    if len(sys.argv) < 3:
        print("Использование: python3 html2pdf.py вход.html выход.pdf")
        sys.exit(2)
    src = os.path.abspath(sys.argv[1])
    dst = os.path.abspath(sys.argv[2])
    if not os.path.exists(src):
        print("Не найден входной файл:", src)
        sys.exit(1)
    browser = find_browser()
    if not browser:
        print("Не нашёл Chrome/Chromium/Edge. Установи Google Chrome — он нужен для красивого PDF.")
        sys.exit(1)
    os.makedirs(os.path.dirname(dst) or ".", exist_ok=True)
    url = "file://" + src
    cmd = [
        browser, "--headless", "--disable-gpu",
        "--no-pdf-header-footer", "--print-to-pdf-no-header",
        "--print-to-pdf=" + dst, url,
    ]
    try:
        subprocess.run(cmd, check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except subprocess.CalledProcessError:
        # старые сборки Chrome не знают --no-pdf-header-footer — пробуем без него
        cmd = [browser, "--headless", "--disable-gpu",
               "--print-to-pdf=" + dst, url]
        subprocess.run(cmd, check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if os.path.exists(dst):
        print("Готов PDF:", dst)
    else:
        print("Не удалось создать PDF.")
        sys.exit(1)


if __name__ == "__main__":
    main()
