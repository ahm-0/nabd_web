#!/usr/bin/env python3
"""Bundle each root HTML page into one self-contained HTML document.

Local stylesheets and scripts are embedded in place; remote CDN resources stay
external. The generated pages keep their original filenames and runtime order.
"""
from __future__ import annotations

import posixpath
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML_FILES = sorted(ROOT.glob("*.html"))

LOCAL_PREFIXES = ("./", "vendor/", "assets/", "sections/")

def clean_ref(value: str) -> str:
    return value.split("?", 1)[0].split("#", 1)[0]

def local_path(value: str) -> Path | None:
    base = clean_ref(value)
    if not base or base.startswith(("http://", "https://", "//", "data:", "blob:", "mailto:")):
        return None
    if base.startswith("/"):
        return None
    path = (ROOT / base).resolve()
    try:
        path.relative_to(ROOT.resolve())
    except ValueError:
        return None
    return path if path.is_file() else None

def rebase_css_urls(css: str, source: Path) -> str:
    """Make URLs resolve from the HTML document rather than the CSS file."""
    source_dir = source.parent.relative_to(ROOT).as_posix()
    def repl(match: re.Match[str]) -> str:
        quote, raw = match.group(1), match.group(2).strip()
        if not raw or raw.startswith(("data:", "http://", "https://", "//", "#")):
            return f"url({quote}{raw}{quote})"
        clean = raw.split("?", 1)[0].split("#", 1)[0]
        root_relative = posixpath.normpath(posixpath.join(source_dir, clean))
        suffix = raw[len(clean):]
        return f"url({quote}{root_relative}{suffix}{quote})"
    return re.sub(r"url\(\s*(['\"]?)(.*?)\1\s*\)", repl, css, flags=re.I)

def inline_styles(html: str) -> str:
    pattern = re.compile(r"<link(?P<tag>[^>]*?rel=[\"']stylesheet[\"'][^>]*)>", re.I)
    def repl(match: re.Match[str]) -> str:
        tag = match.group("tag")
        href_match = re.search(r"href=[\"']([^\"']+)[\"']", tag, re.I)
        if not href_match:
            return match.group(0)
        href = href_match.group(1)
        source = local_path(href)
        if source is None:
            return match.group(0)
        css = rebase_css_urls(source.read_text(encoding="utf-8", errors="ignore"), source)
        return f'<style data-bundled-from="{clean_ref(href)}">\n{css}\n</style>'
    return pattern.sub(repl, html)

def inline_scripts(html: str) -> str:
    pattern = re.compile(r"<script(?P<attrs>[^>]*)>\s*</script>|<script(?P<attrs2>[^>]*)></script>", re.I)
    # Handle external script tags separately; inline scripts are intentionally untouched.
    src_pattern = re.compile(r"<script(?P<attrs>[^>]*)\bsrc=[\"']([^\"']+)[\"'][^>]*>\s*</script>", re.I)
    def repl(match: re.Match[str]) -> str:
        full_tag = match.group(0)
        attrs = match.group("attrs") or ""
        src_match = re.search(r"\bsrc=[\"']([^\"']+)[\"']", full_tag, re.I)
        if not src_match:
            return match.group(0)
        src = src_match.group(1)
        source = local_path(src)
        if source is None:
            return match.group(0)
        js = source.read_text(encoding="utf-8", errors="ignore").replace("</script>", "<\\/script>")
        return f'<script data-bundled-from="{clean_ref(src)}">\n{js}\n</script>'
    return src_pattern.sub(repl, html)

def bundle(path: Path) -> None:
    html = path.read_text(encoding="utf-8", errors="ignore")
    html = inline_styles(html)
    html = inline_scripts(html)
    html = re.sub(r'\s*<meta\s+name=["\']nabd-single-file["\'][^>]*>', '', html, flags=re.I)
    html = html.replace("</head>", '<meta name="nabd-single-file" content="true">\n</head>', 1)
    path.write_text(html, encoding="utf-8")

if __name__ == "__main__":
    for page in HTML_FILES:
        bundle(page)
    print(f"Bundled {len(HTML_FILES)} HTML pages into self-contained documents.")
