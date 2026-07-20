#!/usr/bin/env python3
"""Забирает страницы портала участников конференции по Basic Auth.

Использование: python3 fetch_portal.py <url> <login> <password> [page]
Ничего не печатает в чат/лог, кроме HTML на stdout — креды нигде не логируются.
"""
import sys
import base64
import urllib.request
import ssl

import certifi


def main():
    if len(sys.argv) < 4:
        print("Использование: python3 fetch_portal.py <url> <login> <password> [page]", file=sys.stderr)
        sys.exit(1)

    url, login, password = sys.argv[1], sys.argv[2], sys.argv[3]
    if len(sys.argv) > 4:
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}page={sys.argv[4]}"

    token = base64.b64encode(f"{login}:{password}".encode()).decode()
    req = urllib.request.Request(url, headers={"Authorization": f"Basic {token}"})
    ctx = ssl.create_default_context(cafile=certifi.where())
    with urllib.request.urlopen(req, context=ctx, timeout=20) as resp:
        print(resp.read().decode("utf-8", errors="replace"))


if __name__ == "__main__":
    main()
