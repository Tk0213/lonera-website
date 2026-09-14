#!/usr/bin/env python3
"""
Wrap the single-file prototype so a plain static server can open it.

apps/prototype/app-preview.html is written as an artifact *body*: no doctype,
no <head>, because the artifact host supplies them. Opened directly it has no
charset, so Korean turns to mojibake, and no viewport meta, so the mobile media
queries never fire. This writes apps/prototype/app-harness.html with both,
which is gitignored.

    python3 scripts/wrap-prototype.py
    python3 -m http.server 8934 --bind 127.0.0.1 --directory apps/prototype
    open http://127.0.0.1:8934/app-harness.html
"""
import io
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "apps", "prototype", "app-preview.html")
OUT = os.path.join(ROOT, "apps", "prototype", "app-harness.html")

HEAD = (
    "<!doctype html>\n<html lang=\"en\">\n<head>\n"
    "<meta charset=\"utf-8\">\n"
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">\n"
    "<style>:root{color-scheme:light}html,body{margin:0;padding:0}</style>\n"
    "</head>\n<body>\n"
)

def main():
    body = io.open(SRC, encoding="utf-8").read()
    io.open(OUT, "w", encoding="utf-8").write(HEAD + body + "\n</body>\n</html>\n")
    print("wrote %s (%d KB)" % (os.path.relpath(OUT, ROOT), os.path.getsize(OUT) // 1024))

if __name__ == "__main__":
    main()
