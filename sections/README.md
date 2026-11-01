# ملفات أقسام منصة نبض التفوق

كل صفحة HTML تمثل قسماً مستقلاً وتحمل ملف CSS الخاص بها عند الحاجة، بينما تُحمّل ملفات CSS وJavaScript المشتركة مرة واحدة وتُخزّن في الكاش. هذا يمنع تكرار الموارد الضخمة داخل كل صفحة ويحافظ على ربط Supabase والوظائف المشتركة.

- `exam-countdown.html` — عداد الامتحان، مع `exam-countdown-share.css`.
- `chat.html` و`private-chat.html` — الدردشة، مع `chat.css`.
- `profile.html` و`settings.html` — الملف الشخصي والإعدادات.
- `news.html` — مجتمع الأخبار، مع `news-ui.css`.
- `universities.html` والصفحات الجامعية — قسم الجامعات.
- `nabd-ui.css` و`material-ui.css` و`nabd-theme.css` — الأساس المشترك.
- `nabd-app.js` و`nabd-navigation.js` — منطق التطبيق وتسريع التنقل.
