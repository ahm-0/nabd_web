#!/usr/bin/env bash
# ==============================================================================
# سكربت التحديث الشامل لتطبيق نبض (nabd_web) ورفعه إلى GitHub
# يقوم هذا السكربت بـ:
# 1. جلب أحدث نسخة من المستودع https://github.com/ahm-0/nabd_web.git
# 2. تحديث الهوية البصرية بالكامل إلى الألوان الكحلية والسماوية والخط العربي المميز (Cairo & Readex Pro)
# 3. الحفاظ التام (100%) على كافة البيانات وربط Supabase وجميع الصفحات والكلاسات
# 4. تحسين أداء التحميل والتخزين المؤقت (Service Worker & Font Preconnect)
# 5. عمل Commit و Push مباشر إلى GitHub
# ==============================================================================

set -e

REPO_URL="https://github.com/ahm-0/nabd_web.git"

if [ ! -d ".git" ]; then
  echo "📥 جاري جلب أحدث نسخة من المستودع $REPO_URL ..."
  git clone "$REPO_URL" nabd_web_updated
  cd nabd_web_updated
else
  echo "🔄 جاري سحب أحدث التعديلات من GitHub ..."
  git pull origin main || git pull
fi

echo "🎨 جاري تطبيق الهوية البصرية الكحلية والسماوية والخط العربي المميز وتحسين الأداء..."

python3 - << 'PYEOF'
import glob
import os
import re

FONT_IMPORT = "@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=Readex+Pro:wght@400;500;600;700&display=swap');\n"

NAVY_SKY_THEME_OVERRIDE = """
/* === Nabd Navy & Sky Blue Unified Theme & Performance Layer === */
:root {
  --bg: #071324 !important;
  --surface: #0b1d36 !important;
  --surface-2: #112a4a !important;
  --surface-3: #17375e !important;
  --text: #f0f7ff !important;
  --muted: #93b4d8 !important;
  --line: rgba(56, 189, 248, 0.16) !important;
  --brand: #38bdf8 !important;
  --brand-2: #0ea5e9 !important;
  --accent: #0ea5e9 !important;
  --accent-bg: rgba(14, 165, 233, 0.14) !important;
  --font-sans: 'Cairo', 'Readex Pro', system-ui, -apple-system, sans-serif !important;
  --app-font: 'Cairo', 'Readex Pro', system-ui, -apple-system, sans-serif !important;
  --md-primary: #38bdf8 !important;
  --md-on-primary: #041e36 !important;
  --md-primary-container: #0c3b5e !important;
  --md-on-primary-container: #d8f2ff !important;
}

html[data-theme="light"] {
  --bg: #f0f7ff !important;
  --surface: #ffffff !important;
  --surface-2: #e6f2ff !important;
  --surface-3: #d4e9ff !important;
  --text: #07192e !important;
  --muted: #3b5a7c !important;
  --line: rgba(14, 165, 233, 0.2) !important;
  --brand: #0284c7 !important;
  --brand-2: #0ea5e9 !important;
  --accent: #0284c7 !important;
  --md-primary: #0284c7 !important;
  --md-on-primary: #ffffff !important;
  --md-primary-container: #cfefff !important;
}

html, body, button, input, select, textarea, h1, h2, h3, h4, h5, h6 {
  font-family: var(--app-font) !important;
  -webkit-font-smoothing: antialiased;
}
"""

for css_path in glob.glob("*.css"):
    with open(css_path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()
    content = re.sub(
        r"--app-font\s*:\s*system-ui[^;]*;",
        "--app-font: 'Cairo', 'Readex Pro', system-ui, -apple-system, sans-serif;",
        content
    )
    content = re.sub(
        r"--font-sans\s*:\s*[^;]*;",
        "--font-sans: 'Cairo', 'Readex Pro', system-ui, -apple-system, sans-serif;",
        content
    )
    if "fonts.googleapis.com/css2?family=Cairo" not in content:
        content = FONT_IMPORT + content
    if css_path in ("styles.css", "nabd-ui.css", "material-ui.css") and "Nabd Navy & Sky Blue Unified Theme" not in content:
        content = content + "\n" + NAVY_SKY_THEME_OVERRIDE
    with open(css_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  ✔ تم تحديث ملف التنسيق: {css_path}")

FONT_HEAD_LINKS = """  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=Readex+Pro:wght@400;500;600;700&display=swap" rel="stylesheet">"""

for html_path in glob.glob("*.html"):
    with open(html_path, "r", encoding="utf-8", errors="ignore") as f:
        html = f.read()
    html = re.sub(
        r'<meta\s+name=["\']theme-color["\']\s+content=["\'][^"\']*["\']\s*/?>',
        '<meta name="theme-color" content="#071324">',
        html,
        flags=re.IGNORECASE
    )
    if "fonts.googleapis.com/css2?family=Cairo" not in html and "</head>" in html:
        html = html.replace("</head>", f"{FONT_HEAD_LINKS}\n</head>", 1)
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"  ✔ تم تحسين وتحديث صفحة: {html_path}")

if os.path.exists("sw.js"):
    with open("sw.js", "r", encoding="utf-8", errors="ignore") as f:
        sw = f.read()
    sw = re.sub(
        r"const\s+CACHE_VERSION\s*=\s*['\"][^'\"]*['\"];",
        "const CACHE_VERSION = '2026-10-29-navy-sky-v2';",
        sw
    )
    if "'./nabd-ui.css'" not in sw and "'./styles.css'" in sw:
        sw = sw.replace("'./styles.css',", "'./styles.css',\n  './nabd-ui.css',\n  './material-ui.css',")
    with open("sw.js", "w", encoding="utf-8") as f:
        f.write(sw)
    print("  ✔ تم تحديث Service Worker (sw.js) لرفع سرعة الأداء والتخزين المؤقت")
PYEOF

echo "🚀 جاري حفظ التعديلات ورفعها إلى GitHub..."
git add -A
git commit -m "Redesign UI with Navy & Sky Blue theme, Cairo/Readex Pro font, and performance optimizations" || echo "لا توجد تغييرات جديدة للحفظ"
git push origin HEAD

echo "✅ تم تحديث الموقع ورفع جميع التعديلات إلى GitHub بنجاح!"
