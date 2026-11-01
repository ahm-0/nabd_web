#!/usr/bin/env bash
# تحديث الهوية البصرية والأداء لتطبيق نبض التفوق مع الحفاظ على البيانات والربط.
set -e

REPO_URL="https://github.com/ahm-0/nabd_web.git"
if [ ! -d ".git" ]; then
  git clone "$REPO_URL" nabd_web_updated
  cd nabd_web_updated
else
  git pull origin main || git pull
fi

python3 - <<'PYEOF'
import glob
import os
import re

FONT_IMPORT = "@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=Readex+Pro:wght@400;500;600;700&display=swap');\n"
FONT_HEAD_LINKS = """  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=Readex+Pro:wght@400;500;600;700&display=swap" rel="stylesheet">"""

for css_path in glob.glob("*.css"):
    with open(css_path, encoding="utf-8", errors="ignore") as f:
        content = f.read()
    if "fonts.googleapis.com/css2?family=Cairo" not in content:
        content = FONT_IMPORT + content
    content = re.sub(r"--app-font\s*:\s*system-ui[^;]*;", "--app-font: 'Cairo', 'Readex Pro', system-ui, -apple-system, sans-serif;", content)
    content = re.sub(r"--font-sans\s*:\s*[^;]*;", "--font-sans: 'Cairo', 'Readex Pro', system-ui, -apple-system, sans-serif;", content)
    with open(css_path, "w", encoding="utf-8") as f:
        f.write(content)

for html_path in glob.glob("*.html"):
    with open(html_path, encoding="utf-8", errors="ignore") as f:
        html = f.read()
    html = re.sub(r'<meta\s+name=["\']theme-color["\']\s+content=["\'][^"\']*["\']\s*/?>', '<meta name="theme-color" content="#071324">', html, flags=re.I)
    if "fonts.googleapis.com/css2?family=Cairo" not in html and "</head>" in html:
        html = html.replace("</head>", FONT_HEAD_LINKS + "\n</head>", 1)
    if "nabd-theme.css" not in html and "</head>" in html:
        html = html.replace("</head>", '  <link rel="stylesheet" href="nabd-theme.css?v=20261101-unified">\n</head>', 1)
    if not re.search(r'<link[^>]+href=["\'][^"\']*vendor/fontawesome/css/all\.min\.css', html, flags=re.I) and "</head>" in html:
        html = html.replace("</head>", '  <link rel="stylesheet" href="vendor/fontawesome/css/all.min.css?v=20261101-icons">\n</head>', 1)
    html = html.replace("url(../webfonts/", "url(vendor/fontawesome/webfonts/")
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html)

if os.path.exists("sw.js"):
    with open("sw.js", encoding="utf-8", errors="ignore") as f:
        sw = f.read()
    sw = re.sub(r"const\s+CACHE_VERSION\s*=\s*['\"][^'\"]*['\"];", "const CACHE_VERSION = '2026-11-01-unified-theme-v1';", sw)
    if "'./nabd-theme.css'" not in sw and "'./styles.css'" in sw:
        sw = sw.replace("'./styles.css',", "'./styles.css',\n  './nabd-theme.css',")
    with open("sw.js", "w", encoding="utf-8") as f:
        f.write(sw)
PYEOF

git add -A
git commit -m "Unify Nabd theme and repair responsive CSS" || echo "لا توجد تغييرات جديدة للحفظ"
git push origin HEAD
echo "تم تحديث ورفع تطبيق نبض التفوق بنجاح."
