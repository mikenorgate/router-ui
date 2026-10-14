#!/usr/bin/env python3
"""Assemble artifacts/router-console-phase3.html from preview sources.

Standalone deliverable: tokens.css is inlined verbatim from design/ (canonical
source), IBM Plex fonts are embedded as base64 data URIs from design/fonts
(SIL OFL, licences in the HTML comment), and app.js is escaped so the HTML
parser never sees a literal closing script tag. No external references.
"""
import base64
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[3]  # repository root
HERE = pathlib.Path(__file__).resolve().parent
OUT = ROOT / "artifacts" / "router-console-phase3.html"

FONTS = [
    ("ibm-plex-sans-latin-400-normal.woff2", "IBM Plex Sans", 400),
    ("ibm-plex-sans-latin-500-normal.woff2", "IBM Plex Sans", 500),
    ("ibm-plex-sans-latin-600-normal.woff2", "IBM Plex Sans", 600),
    ("ibm-plex-mono-latin-400-normal.woff2", "IBM Plex Mono", 400),
    ("ibm-plex-mono-latin-500-normal.woff2", "IBM Plex Mono", 500),
]


def font_faces() -> str:
    faces = []
    for filename, family, weight in FONTS:
        data = base64.b64encode((ROOT / "design" / "fonts" / filename).read_bytes()).decode()
        faces.append(
            f"@font-face {{ font-family: '{family}'; font-style: normal; font-weight: {weight}; "
            f"font-display: swap; src: url(data:font/woff2;base64,{data}) format('woff2'); }}"
        )
    return "\n".join(faces)


def main() -> int:
    tokens = (ROOT / "design" / "tokens.css").read_text()
    css = (HERE / "styles.css").read_text()
    css = css.replace("/*__TOKENS__*/", tokens).replace("/*__FONTS__*/", font_faces())
    body = (HERE / "body.html").read_text()
    js = (HERE / "app.js").read_text()
    js = re.sub(r"</script", "<\\/script", js, flags=re.IGNORECASE)
    licence = (ROOT / "design" / "fonts" / "OFL-sans.txt").read_text().splitlines()[0]
    html = f"""<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Router Console · Phase 3 investigation preview (explicit demo)</title>
<!-- Router Console Phase 3 preview. Fonts: IBM Plex Sans and IBM Plex Mono, {licence}
     Full licences: design/fonts/OFL-sans.txt and design/fonts/OFL-mono.txt.
     All records are fictional: documentation addresses (RFC 5737 / RFC 3849) and example names. -->
<style>{css}</style>
</head>
<body>
{body}
<script>{js}</script>
</body>
</html>
"""
    OUT.write_text(html)
    print(f"Wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes) from preview sources; tokens and fonts embedded.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
