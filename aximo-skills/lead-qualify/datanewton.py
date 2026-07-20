#!/usr/bin/env python3
"""Обогащение российской компании по ИНН через DataNewton API.

Использование: python3 datanewton.py <ИНН>
Ключ читается из .env (DATANEWTON_KEY), нигде не печатается.
"""
import sys
import json
import urllib.request
import urllib.parse
import urllib.error
import os

import certifi

BASE_URL = "https://api.datanewton.ru"


def load_env_key(name, env_path=".env"):
    if os.environ.get(name):
        return os.environ[name]
    if os.path.exists(env_path):
        with open(env_path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith(f"{name}="):
                    return line.split("=", 1)[1]
    return None


def fetch(path, key, inn):
    params = urllib.parse.urlencode({"key": key, "inn": inn})
    url = f"{BASE_URL}{path}?{params}"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    ctx = None
    import ssl
    ctx = ssl.create_default_context(cafile=certifi.where())
    with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main():
    if len(sys.argv) < 2:
        print("Использование: python3 datanewton.py <ИНН>")
        sys.exit(1)

    inn = sys.argv[1]
    key = load_env_key("DATANEWTON_KEY")
    if not key:
        print("Нет DATANEWTON_KEY в .env / переменных окружения")
        sys.exit(1)

    try:
        counterparty = fetch("/v1/counterparty", key, inn)
    except urllib.error.HTTPError as e:
        print(f"Ошибка запроса /v1/counterparty: HTTP {e.code}")
        sys.exit(1)

    try:
        finance = fetch("/v1/finance", key, inn)
    except urllib.error.HTTPError as e:
        finance = None
        print(f"Предупреждение: /v1/finance вернул HTTP {e.code}")

    result = {
        "inn": inn,
        "company": counterparty.get("company", counterparty),
        "finance": finance,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
