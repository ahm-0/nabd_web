#!/usr/bin/env python3
"""Move inline bundled blocks that are byte-identical across many pages into shared,
content-hashed files under assets/bundle/. Pages shrink from ~1.1MB to ~0.3MB, the browser
caches/compiles the shared code once, and navigation gets much faster.
Run from the repo root:  python3 tools/externalize-shared-bundles.py"""
import re, glob, hashlib, os, collections, json

MIN_PAGES = 10
OUT = 'assets/bundle'
pat = re.compile(r'<(script|style) data-bundled-from="([^"]+)">(.*?)</\1>', re.S)
files = sorted(glob.glob('*.html'))
count = collections.defaultdict(lambda: collections.Counter())
for f in files:
    for m in pat.finditer(open(f, encoding='utf-8').read()):
        count[m.group(2)][hashlib.md5(m.group(3).encode()).hexdigest()] += 1

plan = {}
for src, c in count.items():
    h, n = c.most_common(1)[0]
    if n >= MIN_PAGES: plan[(src, h)] = n
os.makedirs(OUT, exist_ok=True)
written = {}
manifest = []
for f in files:
    s = open(f, encoding='utf-8').read()
    def rep(m):
        kind, src, body = m.group(1), m.group(2), m.group(3)
        h = hashlib.md5(body.encode()).hexdigest()
        if (src, h) not in plan: return m.group(0)
        short = h[:8]; base = os.path.basename(src)
        name = re.sub(r'(\.[a-z]+)$', r'.' + short + r'\1', base)
        path = f'{OUT}/{name}'
        if path not in written:
            data = body
            if kind == 'style':  # url() كانت نسبية للصفحة؛ الملف الآن في assets/bundle
                data = re.sub(r'url\((["\']?)(?!data:|https?:|/|#)([^)"\']+)\1\)', lambda u: f'url({u.group(1)}../../{u.group(2)}{u.group(1)})', data)
            open(path, 'w', encoding='utf-8').write(data)
            written[path] = src; manifest.append(path)
        return f'<link rel="stylesheet" href="{path}">' if kind == 'style' else f'<script src="{path}"></script>'
    new = pat.sub(rep, s)
    if new != s: open(f, 'w', encoding='utf-8').write(new)
print(json.dumps(sorted(manifest), ensure_ascii=False, indent=1))
