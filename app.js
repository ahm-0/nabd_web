/* نبض التفوق — منطق الواجهة المشترك للصفحات الثابتة */
(() => {
  'use strict';

  const STORE = 'nabd_v3_';
  const LEGACY_STORE = 'nabd_v2_';
  const PAGE = document.body.dataset.page || 'home';
  const ADMIN_EMAIL = 'aaaaaaaa@gmail.com';
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  const defaultStudent = {
    first: '', last: '', phone: '', birth: '', city: 'دمشق', stage: 'بكالوريا علمي',
    bio: 'طالب في منصة نبض التفوق، أعمل على تنظيم رحلتي الدراسية والوصول إلى أهدافي.',
    avatar: '', notifications: true, theme: 'dark', studentId: '', gender: '', verificationRequested: false, verificationStatus: ''
  };

  function readStorage(key, fallback) {
    const raw = localStorage.getItem(STORE + key) ?? localStorage.getItem(LEGACY_STORE + key);
    if (!raw) return fallback;
    try { return JSON.parse(raw) ?? fallback; }
    catch { return fallback; }
  }

  const storedPosts = readStorage('posts', []);
  const storedChats = readStorage('chats', []);
  const storedInteractions = readStorage('post_interactions', {});
  const storedGallery = readStorage('study_gallery', []);
  const storedGrade = readStorage('grade_calculator', {});
  let student = { ...defaultStudent, ...readStorage('student', {}) };
  let posts = Array.isArray(storedPosts) ? storedPosts : [];
  let chats = Array.isArray(storedChats) ? storedChats : [];
  let postInteractions = storedInteractions && typeof storedInteractions === 'object' && !Array.isArray(storedInteractions) ? storedInteractions : {};
  let studyGallery = Array.isArray(storedGallery) ? storedGallery.slice(0, 12) : [];
  let gradeCalculator = storedGrade && typeof storedGrade === 'object' && !Array.isArray(storedGrade) ? storedGrade : {};
  let adminStudents = readStorage('admin_students', []);
  let verificationRequests = readStorage('verification_requests', []);
  let supportTickets = readStorage('support_tickets', []);
  let adminActivity = readStorage('admin_activity', []);
  adminStudents = Array.isArray(adminStudents) ? adminStudents : [];
  verificationRequests = Array.isArray(verificationRequests) ? verificationRequests : [];
  supportTickets = Array.isArray(supportTickets) ? supportTickets : [];
  adminActivity = Array.isArray(adminActivity) ? adminActivity : [];
  let adminCredential = readStorage('admin_credential', null);
  let adminSession = readStorage('admin_session', null);
  let adminControlsBound = false;
  let customCountdown = readStorage('custom_countdown', {
    title: 'هدفي الخاص', target: new Date('2027-04-15T08:00:00').getTime()
  });
  let uploadImages = [];
  let activeChatId = null;
  let activeExam = 'bac';
  let activeFeedFilter = 'all';
  const openComments = new Set();

  const escapeHTML = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));

  const fullName = () => `${student.first || 'طالب'} ${student.last || ''}`.trim();
  const initials = () => fullName().split(/\s+/).map(word => word[0]).join('').slice(0, 2);
  const profileIncomplete = () => !(student.first && student.last && student.phone && student.birth);

  function saveState() {
    try {
      localStorage.setItem(STORE + 'student', JSON.stringify(student));
      localStorage.setItem(STORE + 'posts', JSON.stringify(posts));
      localStorage.setItem(STORE + 'chats', JSON.stringify(chats.slice(0, 12)));
      localStorage.setItem(STORE + 'post_interactions', JSON.stringify(postInteractions));
      localStorage.setItem(STORE + 'custom_countdown', JSON.stringify(customCountdown));
      return true;
    } catch (error) {
      console.warn('تعذر حفظ بعض البيانات محليًا', error);
      toast('تعذر حفظ البيانات؛ جرّب تقليل عدد أو حجم الصور المرفقة.');
      return false;
    }
  }

  function saveGallery() {
    try {
      localStorage.setItem(STORE + 'study_gallery', JSON.stringify(studyGallery.slice(0, 12)));
      return true;
    } catch (error) {
      toast('تعذر حفظ الصور محليًا؛ احذف بعض الصور ثم حاول مرة أخرى.');
      return false;
    }
  }

  function saveGradeCalculator() {
    try { localStorage.setItem(STORE + 'grade_calculator', JSON.stringify(gradeCalculator)); }
    catch { toast('تعذر حفظ العلامات محليًا.'); }
  }

  function ensureStudentId() {
    if (!student.studentId) {
      student.studentId = String(Math.floor(1000000000 + Math.random() * 9000000000));
      saveState();
    }
  }

  function saveAdminState() {
    try {
      localStorage.setItem(STORE + 'admin_students', JSON.stringify(adminStudents.slice(0, 100)));
      localStorage.setItem(STORE + 'verification_requests', JSON.stringify(verificationRequests.slice(0, 100)));
      localStorage.setItem(STORE + 'support_tickets', JSON.stringify(supportTickets.slice(0, 100)));
      localStorage.setItem(STORE + 'admin_activity', JSON.stringify(adminActivity.slice(0, 80)));
      return true;
    } catch (error) {
      console.warn('تعذر حفظ بيانات الإشراف محليًا', error);
      toast('تعذر حفظ بيانات الإشراف محليًا.');
      return false;
    }
  }

  function adminLog(type, title, detail = '') {
    adminActivity.unshift({ id: `activity-${Date.now()}-${Math.random().toString(16).slice(2)}`, type, title, detail, createdAt: Date.now() });
    adminActivity = adminActivity.slice(0, 80);
    saveAdminState();
  }

  function studentSnapshot() {
    ensureStudentId();
    return {
      id: student.studentId,
      name: fullName(),
      phone: student.phone || '—',
      city: student.city || '—',
      gender: student.gender || '',
      stage: student.stage || '—',
      birth: student.birth || '',
      avatar: student.avatar || '',
      verificationStatus: student.verificationStatus || '',
      updatedAt: Date.now()
    };
  }

  function syncAdminStudent(logUpdate = false) {
    if (!(student.first || student.last || student.phone || student.birth)) return;
    const snapshot = studentSnapshot();
    const index = adminStudents.findIndex(item => item.id === snapshot.id);
    if (index >= 0) adminStudents[index] = { ...adminStudents[index], ...snapshot };
    else adminStudents.unshift(snapshot);
    if (logUpdate) adminLog('student', `تحديث ملف الطالب: ${snapshot.name}`, `${snapshot.city} · ${snapshot.stage}`);
    else saveAdminState();
  }

  function displayAdminDate(timestamp) {
    if (!timestamp) return '—';
    try { return new Intl.DateTimeFormat('ar-SY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp)); }
    catch { return '—'; }
  }

  async function hashAdminPassword(value) {
    const source = new TextEncoder().encode(String(value));
    if (window.crypto?.subtle) {
      const digest = await window.crypto.subtle.digest('SHA-256', source);
      return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    }
    return btoa(unescape(encodeURIComponent(String(value))));
  }

  function saveAdminAccess() {
    localStorage.setItem(STORE + 'admin_credential', JSON.stringify(adminCredential));
    localStorage.setItem(STORE + 'admin_session', JSON.stringify(adminSession));
  }

  function isAdminAuthenticated() {
    return Boolean(adminSession && adminSession.email === ADMIN_EMAIL && adminSession.active === true);
  }

  function showAdminWorkspace(allowed) {
    const screen = $('#adminLoginScreen');
    const workspace = $('#adminWorkspace');
    if (screen) screen.classList.toggle('hidden', allowed);
    if (workspace) workspace.classList.toggle('hidden', !allowed);
    document.body.classList.toggle('admin-authenticated', allowed);
  }

  async function submitAdminLogin(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    const email = String(data.email || '').trim().toLowerCase();
    const password = String(data.password || '');
    if (email !== ADMIN_EMAIL) return toast('هذا البريد غير مخوّل بفتح بوابة المشرفين.');
    if (password.length < 6) return toast('اختر كلمة مرور محلية من 6 أحرف على الأقل.');
    const passwordHash = await hashAdminPassword(password);
    if (!adminCredential?.passwordHash) {
      adminCredential = { email: ADMIN_EMAIL, passwordHash, configuredAt: Date.now() };
      toast('تم إعداد كلمة مرور بوابة المشرفين على هذا المتصفح.');
    } else if (adminCredential.email !== ADMIN_EMAIL || adminCredential.passwordHash !== passwordHash) {
      return toast('كلمة المرور غير صحيحة.');
    }
    adminSession = { email: ADMIN_EMAIL, active: true, openedAt: Date.now() };
    saveAdminAccess();
    showAdminWorkspace(true);
    initAdminDashboard();
  }

  function logoutAdmin() {
    adminSession = null;
    saveAdminAccess();
    showAdminWorkspace(false);
    const password = $('#adminPassword');
    if (password) password.value = '';
    toast('تم قفل بوابة المشرفين على هذا المتصفح.');
  }

  function toast(message) {
    const element = $('#toast');
    if (!element) return;
    element.textContent = message;
    element.classList.add('show');
    clearTimeout(window.nabdToastTimer);
    window.nabdToastTimer = setTimeout(() => element.classList.remove('show'), 2800);
  }

  function avatarMarkup(className = 'avatar') {
    if (student.avatar) return `<img class="${className}" src="${student.avatar}" alt="صورة ${escapeHTML(fullName())}">`;
    return `<span class="${className}">${escapeHTML(initials())}</span>`;
  }

  function setAvatar(elementId, className = 'avatar') {
    const element = $('#' + elementId);
    if (!element) return;
    if (student.avatar) {
      const image = document.createElement('img');
      image.id = elementId;
      image.className = className;
      image.src = student.avatar;
      image.alt = `صورة ${fullName()}`;
      element.replaceWith(image);
    } else {
      element.className = className;
      element.textContent = initials();
    }
  }

  function applyTheme(theme = student.theme, persist = true) {
    student.theme = theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = student.theme;
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.content = student.theme === 'dark' ? '#080d19' : '#f2f7ff';
    const switcher = $('#themeSwitch');
    if (switcher) switcher.checked = student.theme === 'dark';
    const buttonIcon = $('#profileThemeButton i');
    if (buttonIcon) buttonIcon.className = student.theme === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
    if (persist) saveState();
  }

  function renderBrand() {
    $$('.brand-mark').forEach(mark => {
      mark.innerHTML = '<img src="assets/nabd-logo.jpg" alt="شعار نبض التفوق" decoding="async">';
    });
  }

  function renderTopActions() {
    const actions = $('.top-actions');
    if (!actions || $('#sharePlatform')) return;
    actions.insertAdjacentHTML('afterbegin', '<button class="icon-button sidebar-toggle" id="sidebarToggle" type="button" title="القائمة الرئيسية" aria-label="فتح القائمة الرئيسية" aria-expanded="false"><i class="fa-solid fa-bars-staggered"></i></button><button class="icon-button share-platform" id="sharePlatform" type="button" title="مشاركة المنصة" aria-label="مشاركة المنصة"><i class="fa-solid fa-arrow-up-from-bracket"></i></button>');
  }

  function toggleSidebar(force) {
    const toggle = $('#sidebarToggle');
    const mobile = window.matchMedia('(max-width: 980px)').matches;
    if (mobile) {
      const shouldOpen = typeof force === 'boolean' ? force : !document.body.classList.contains('sidebar-open');
      document.body.classList.toggle('sidebar-open', shouldOpen);
      if (toggle) { toggle.setAttribute('aria-expanded', String(shouldOpen)); toggle.setAttribute('aria-label', shouldOpen ? 'إغلاق القائمة الرئيسية' : 'فتح القائمة الرئيسية'); }
      return;
    }
    const shouldCollapse = typeof force === 'boolean' ? !force : !document.body.classList.contains('sidebar-collapsed');
    document.body.classList.toggle('sidebar-collapsed', shouldCollapse);
    if (toggle) { toggle.setAttribute('aria-expanded', String(!shouldCollapse)); toggle.setAttribute('aria-label', shouldCollapse ? 'إظهار القائمة الجانبية' : 'إخفاء القائمة الجانبية'); }
  }

  async function sharePlatform() {
    const url = location.href;
    try {
      if (navigator.share) await navigator.share({ title: 'نبض التفوق', text: 'منصة نبض التفوق التعليمية', url });
      else if (navigator.clipboard) { await navigator.clipboard.writeText(url); toast('تم نسخ رابط المنصة.'); }
      else toast('ميزة المشاركة متاحة عند نشر التطبيق على الهاتف.');
    } catch (error) {
      if (error.name !== 'AbortError') toast('تعذر تنفيذ المشاركة حاليًا.');
    }
  }

  function verifiedBadgeMarkup(verified = false) {
    return verified ? '<span class="verified-badge" role="img" aria-label="حساب موثّق" title="حساب موثّق"><i class="fa-solid fa-check"></i></span>' : '';
  }

  function renderShell() {
    const sidebar = $('#desktopSidebar');
    if (sidebar) {
      const studentSubtitle = profileIncomplete()
        ? 'أكمل بياناتك لتخصيص تجربتك'
        : `${escapeHTML(student.stage)} · ${escapeHTML(student.city)}`;
      sidebar.innerHTML = `
        <div class="sidebar-brand"><img src="assets/nabd-logo.jpg" alt="شعار نبض التفوق" decoding="async"><div><b>نبض التفوق</b><span>منصتك نحو التميز</span></div><i class="fa-solid fa-sparkles"></i></div>
        <div class="sidebar-student"><div class="sidebar-avatar-wrap">${avatarMarkup('sidebar-avatar')}<span class="online-ring"></span></div><div><strong>${escapeHTML(fullName())}${verifiedBadgeMarkup(student.verificationStatus === 'approved')}</strong><span>${studentSubtitle}</span></div><a class="quick-edit" href="profile.html" title="تعديل الملف"><i class="fa-solid fa-pen"></i></a></div>
        <div class="sidebar-overview"><div><span>مسار التفوق</span><b>${profileIncomplete() ? 'أكمل ملفك أولًا' : 'ملفك جاهز للانطلاق'}</b></div><div class="sidebar-meter"><i style="width:${profileIncomplete() ? '38' : '82'}%"></i></div><small>${profileIncomplete() ? '38' : '82'}% من إعداد الحساب</small></div>
        <div class="sidebar-label">التنقل الرئيسي</div>
        <nav class="side-nav">
          <a class="side-link ${PAGE === 'home' ? 'active' : ''}" href="index.html"><span class="nav-icon home-nav"><i class="fa-solid fa-house"></i></span><span>الرئيسية</span></a>
          <a class="side-link ${PAGE === 'profile' ? 'active' : ''}" href="profile.html"><span class="nav-icon profile-nav"><i class="fa-regular fa-user"></i></span><span>ملفي الشخصي</span></a>
          <a class="side-link ${PAGE === 'news' ? 'active' : ''}" href="news.html"><span class="nav-icon news-nav"><i class="fa-regular fa-newspaper"></i></span><span>مجتمع الأخبار</span><em>جديد</em></a>
          <a class="side-link ${PAGE === 'ai' ? 'active' : ''}" href="assistant.html"><span class="nav-icon ai-nav"><i class="fa-solid fa-wand-magic-sparkles"></i></span><span>مساعد نبض</span></a>
        </nav>
        <div class="sidebar-label">المركز الشخصي</div>
        <nav class="side-nav compact">
          <a class="side-link ${PAGE === 'notifications' ? 'active' : ''}" href="notifications.html"><span class="nav-icon notify-nav"><i class="fa-regular fa-bell"></i></span><span>الإشعارات</span></a>
          <a class="side-link ${PAGE === 'about' ? 'active' : ''}" href="about.html"><span class="nav-icon about-nav"><i class="fa-solid fa-circle-info"></i></span><span>عن المنصة</span></a>
          <a class="side-link ${PAGE === 'supervision' ? 'active' : ''}" href="admin-dashboard.html"><span class="nav-icon shield-nav"><i class="fa-solid fa-shield-halved"></i></span><span>بوابة الإشراف</span></a>
          <a class="side-link ${PAGE === 'privacy' ? 'active' : ''}" href="privacy.html"><span class="nav-icon lock-nav"><i class="fa-solid fa-lock"></i></span><span>الخصوصية والأمان</span></a>
        </nav>
        <a class="sidebar-edit-cta" href="profile.html"><i class="fa-solid fa-sliders"></i><span>${profileIncomplete() ? 'أكمل بياناتي' : 'تعديل بياناتي'}</span><i class="fa-solid fa-arrow-left"></i></a>`;
    }

    const bottomNav = $('#bottomNav');
    if (bottomNav) {
      bottomNav.innerHTML = `
        <a class="bottom-link" href="assistant.html"><i class="fa-solid fa-circle-play"></i><span>الدروس</span></a>
        <a class="bottom-link" href="index.html#tools"><i class="fa-solid fa-clipboard-check"></i><span>الاختبارات</span></a>
        <a class="bottom-link ${PAGE === 'home' ? 'active' : ''}" href="index.html"><i class="fa-solid fa-house"></i><span>الرئيسية</span></a>
        <a class="bottom-link ${PAGE === 'news' ? 'active' : ''}" href="news.html"><i class="fa-regular fa-newspaper"></i><span>الأخبار</span></a>
        <a class="bottom-link ${PAGE === 'profile' ? 'active' : ''}" href="profile.html"><i class="fa-regular fa-user"></i><span>حسابي</span></a>`;
    }
  }

  function formatDate(timestamp) {
    const date = new Date(timestamp);
    const pad = number => String(number).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function openModal(content) {
    const modal = $('#modalContent');
    const backdrop = $('#modalBackdrop');
    if (!modal || !backdrop) return;
    modal.innerHTML = content;
    backdrop.classList.add('show');
  }

  function closeModal() {
    $('#modalBackdrop')?.classList.remove('show');
  }

  function openNamedModal(name) {
    const modals = {
      edit: `<div class="modal-head"><h3>تعديل الملف الشخصي</h3><button class="close-modal" aria-label="إغلاق">×</button></div>
        <form id="editForm"><div class="form-grid">
          <div class="form-group"><label>الاسم الأول</label><input name="first" required maxlength="32" value="${escapeHTML(student.first)}"></div>
          <div class="form-group"><label>اسم العائلة</label><input name="last" required maxlength="32" value="${escapeHTML(student.last)}"></div>
          <div class="form-group"><label>رقم الهاتف</label><input name="phone" type="tel" inputmode="tel" maxlength="20" value="${escapeHTML(student.phone)}"></div>
          <div class="form-group"><label>تاريخ الميلاد</label><input name="birth" type="date" value="${escapeHTML(student.birth)}"></div>
          <div class="form-group"><label>المنطقة</label><input name="city" maxlength="40" value="${escapeHTML(student.city)}"></div>
          <div class="form-group"><label>الجنس</label><select name="gender"><option value="" ${!student.gender ? 'selected' : ''}>أفضل عدم التحديد</option><option value="ذكر" ${student.gender === 'ذكر' ? 'selected' : ''}>ذكر</option><option value="أنثى" ${student.gender === 'أنثى' ? 'selected' : ''}>أنثى</option></select></div>
          <div class="form-group"><label>المرحلة</label><select name="stage"><option ${student.stage === 'بكالوريا علمي' ? 'selected' : ''}>بكالوريا علمي</option><option ${student.stage === 'بكالوريا أدبي' ? 'selected' : ''}>بكالوريا أدبي</option><option ${student.stage === 'التاسع الأساسي' ? 'selected' : ''}>التاسع الأساسي</option></select></div>
          <div class="form-group full"><label>السيرة الذاتية</label><textarea name="bio" maxlength="240">${escapeHTML(student.bio)}</textarea></div>
        </div><div class="form-actions"><button type="button" class="outline-button close-modal">إلغاء</button><button class="primary-button" type="submit">حفظ التغييرات</button></div></form>`,
      customCountdown: `<div class="modal-head"><h3>ضبط العداد المخصص</h3><button class="close-modal" aria-label="إغلاق">×</button></div>
        <form id="customCountdownForm"><div class="form-group"><label>اسم الهدف</label><input name="title" required maxlength="34" value="${escapeHTML(customCountdown.title)}"></div><div class="form-group" style="margin-top:12px"><label>موعد الهدف</label><input name="target" type="datetime-local" required value="${formatDate(customCountdown.target)}"></div><p class="onboarding-note">يحفظ العداد على جهازك داخل المتصفح.</p><div class="form-actions"><button type="button" class="outline-button close-modal">إلغاء</button><button class="primary-button" type="submit">حفظ العداد</button></div></form>`,
      appGuide: `<div class="modal-head"><h3>شرح استخدام التطبيق</h3><button class="close-modal" aria-label="إغلاق">×</button></div><div class="info-page"><div class="info-icon"><i class="fa-regular fa-circle-play"></i></div><h2>ابدأ بخطوات بسيطة</h2><p>من الرئيسية تابع عدادات الامتحان واستخدم الأدوات الدراسية. اختر «مخصص» لضبط هدفك وموعده.</p><p>في الملف الشخصي عدّل بياناتك وصورتك وإعداداتك، ثم استخدم مجتمع الأخبار لمشاركة الأخبار والصور والتفاعل باحترام.</p></div>`,
      contribute: `<div class="modal-head"><h3>ساهم في التطبيق</h3><button class="close-modal" aria-label="إغلاق">×</button></div><div class="info-page"><div class="info-icon"><i class="fa-solid fa-hand-holding-heart"></i></div><h2>رأيك يصنع فرقًا</h2><p>شارك اقتراحاتك للأقسام والأدوات الدراسية التي ترغب برؤيتها في الإصدارات القادمة.</p></div>`,
      contact: `<div class="modal-head"><h3>تواصل مع الدعم</h3><button class="close-modal" aria-label="إغلاق">×</button></div><form id="supportForm"><div class="info-page"><div class="info-icon"><i class="fa-regular fa-comment-dots"></i></div><h2>كيف يمكننا مساعدتك؟</h2><p>اكتب رسالتك، وستظهر في صندوق الدعم داخل بوابة المشرفين على هذا المتصفح.</p><div class="form-group" style="text-align:right"><label>نوع الرسالة</label><select name="category"><option>مساعدة دراسية</option><option>مشكلة تقنية</option><option>اقتراح تطوير</option><option>استفسار عام</option></select></div><div class="form-group" style="text-align:right;margin-top:11px"><label>رسالتك</label><textarea name="message" required maxlength="700" placeholder="اكتب تفاصيل المساعدة التي تحتاجها..."></textarea></div><div class="form-actions"><button type="button" class="outline-button close-modal">إلغاء</button><button class="primary-button" type="submit">إرسال للدعم</button></div></div></form>`,
      verification: student.verificationRequested
        ? `<div class="modal-head"><h3>طلب شارة التوثيق</h3><button class="close-modal" aria-label="إغلاق">×</button></div><div class="info-page"><div class="info-icon"><i class="fa-solid fa-circle-check"></i></div><h2>طلبك قيد المراجعة</h2><p>تم تسجيل طلب شارة التوثيق محليًا. ستظهر حالة الطلب في ملفك الشخصي داخل هذه النسخة التجريبية.</p></div>`
        : `<div class="modal-head"><h3>طلب شارة التوثيق</h3><button class="close-modal" aria-label="إغلاق">×</button></div><form id="verificationForm"><div class="info-page"><div class="info-icon"><i class="fa-solid fa-certificate"></i></div><h2>عرّف مجتمع نبض بحسابك</h2><p>سنراجع اكتمال بيانات ملفك الشخصي قبل اعتماد الطلب. هذه الواجهة تحفظ حالة الطلب محليًا في النسخة الثابتة.</p><div class="form-actions"><button type="button" class="outline-button close-modal">ليس الآن</button><button class="primary-button" type="submit">إرسال طلب التوثيق</button></div></div></form>`
    };
    openModal(modals[name] || modals.appGuide);
  }

  function updateProfileUI() {
    ensureStudentId();
    const values = {
      profileName: fullName(),
      profileHandle: '@' + fullName().replaceAll(' ', '_'),
      profileBio: student.bio || 'أضف نبذة بسيطة لتظهر في مجتمع الأخبار.',
      profilePhone: student.phone || '—',
      profileCity: student.city || '—',
      profileStudentId: student.studentId,
      profilePosts: posts.filter(post => post.mine).length,
      homeGreeting: `أهلاً ${student.first || 'بك'}، لنصنع يومًا دراسيًا رائعًا`
    };
    Object.entries(values).forEach(([id, text]) => { const element = $('#' + id); if (element) element.textContent = text; });
    const profileName = $('#profileName');
    if (profileName) profileName.innerHTML = `${escapeHTML(fullName())}${verifiedBadgeMarkup(student.verificationStatus === 'approved')}`;
    const stage = $('#profileStage');
    if (stage) stage.innerHTML = `<i class="fa-solid fa-graduation-cap"></i> ${escapeHTML(student.stage)}`;
    const birth = $('#profileBirth');
    if (birth) birth.textContent = student.birth ? new Intl.DateTimeFormat('ar-SY', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(student.birth)) : '—';
    const completion = $('#completeProfile');
    if (completion) completion.classList.toggle('hidden', !profileIncomplete());
    const verificationState = student.verificationStatus || (student.verificationRequested ? 'pending' : '');
    const verificationStatus = $('#verificationStatus');
    if (verificationStatus) { verificationStatus.classList.toggle('hidden', !verificationState); verificationStatus.className = `verification-status ${verificationState || 'hidden'}`; verificationStatus.innerHTML = verificationState === 'approved' ? '<i class="fa-solid fa-circle-check"></i> الحساب موثّق' : verificationState === 'revoked' ? '<i class="fa-solid fa-circle-xmark"></i> تم إلغاء التوثيق' : verificationState === 'rejected' ? '<i class="fa-solid fa-circle-xmark"></i> راجع بيانات التوثيق' : '<i class="fa-solid fa-circle-check"></i> طلب التوثيق قيد المراجعة'; }
    const verificationButton = $('#verificationRequest');
    if (verificationButton) { const title = $('.setting-copy strong', verificationButton); const detail = $('.setting-copy small', verificationButton); verificationButton.disabled = verificationState === 'pending' || verificationState === 'approved'; if (title) title.textContent = verificationState === 'approved' ? 'الحساب موثّق' : verificationState === 'pending' ? 'طلب التوثيق قيد المراجعة' : verificationState === 'revoked' ? 'إعادة طلب شارة التوثيق' : verificationState === 'rejected' ? 'إعادة طلب شارة التوثيق' : 'طلب شارة التوثيق'; if (detail) detail.textContent = verificationState === 'approved' ? 'تم اعتماد الشارة على هذا المتصفح' : verificationState === 'pending' ? 'تم إرسال طلبك وسيبقى ظاهرًا في ملفك' : verificationState === 'revoked' ? 'يمكنك مراجعة البيانات وإرسال طلب جديد' : verificationState === 'rejected' ? 'يمكنك مراجعة البيانات وإرسال طلب جديد' : 'راجع ملفك وأرسل الطلب للمراجعة'; }
    const notificationSwitch = $('#notificationsSwitch');
    if (notificationSwitch) notificationSwitch.checked = Boolean(student.notifications);
    setAvatar('profileAvatar', 'profile-avatar');
    setAvatar('composerAvatar', 'avatar');
    renderShell();
  }

  const homeExams = {
    bac: { title: 'امتحانات البكالوريا', badge: 'الثانوية العامة', note: 'رتّب خطتك اليومية لتصل إلى موعد الامتحان بثقة.', target: new Date('2027-06-24T07:00:00').getTime() },
    nine: { title: 'امتحانات التاسع', badge: 'التعليم الأساسي', note: 'اجعل المراجعة اليومية عادة ثابتة قبل موعد الامتحان.', target: new Date('2027-05-28T07:00:00').getTime() },
    custom: { title: customCountdown.title, badge: 'عداد مخصص', note: 'اضبط اسم هدفك وموعده ليظهر عدادك الخاص هنا.', target: customCountdown.target }
  };

  function updateCountdown() {
    const exam = homeExams[activeExam];
    if (!exam) return;
    const difference = Math.max(0, exam.target - Date.now());
    const parts = [
      ['countDays', Math.floor(difference / 86400000), 3],
      ['countHours', Math.floor((difference % 86400000) / 3600000), 2],
      ['countMinutes', Math.floor((difference % 3600000) / 60000), 2],
      ['countSeconds', Math.floor((difference % 60000) / 1000), 2]
    ];
    parts.forEach(([id, value, length]) => { const element = $('#' + id); if (element) element.textContent = String(value).padStart(length, '0'); });
  }

  function setExam(key) {
    const exam = homeExams[key];
    if (!exam) return;
    activeExam = key;
    const title = $('#homeExamTitle');
    const badge = $('#homeExamBadge');
    const note = $('#homeExamNote');
    if (title) title.innerHTML = `<i class="fa-solid fa-graduation-cap"></i> ${escapeHTML(exam.title)}`;
    if (badge) badge.textContent = exam.badge;
    if (note) note.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${escapeHTML(exam.note)}`;
    $('#customCountdownButton')?.classList.toggle('hidden', key !== 'custom');
    $$('.exam-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.exam === key));
    updateCountdown();
  }

  function initWelcomeScreen() {
    const screen = $('#welcomeScreen');
    if (!screen) return;
    const sessionKey = `${STORE}welcome_seen`;
    let seen = false;
    try { seen = sessionStorage.getItem(sessionKey) === '1'; } catch { /* يستمر العرض عند تعذر التخزين */ }
    if (seen) { screen.remove(); return; }
    const progressBar = $('#welcomeProgressBar');
    const progressValue = $('#welcomeProgressValue');
    const loadingText = $('#welcomeLoadingText');
    const duration = 4200;
    const startedAt = performance.now();
    let animationFrame = 0;
    let closed = false;
    const closeWelcome = () => {
      if (closed) return;
      closed = true;
      window.cancelAnimationFrame(animationFrame);
      try { sessionStorage.setItem(sessionKey, '1'); } catch { /* لا حاجة لإيقاف الواجهة */ }
      screen.classList.add('is-leaving');
      screen.setAttribute('aria-hidden', 'true');
      window.setTimeout(() => screen.remove(), 560);
    };
    const updateProgress = now => {
      if (closed) return;
      const progress = Math.min(100, Math.round(((now - startedAt) / duration) * 100));
      if (progressBar) progressBar.style.width = `${progress}%`;
      if (progressValue) progressValue.textContent = `${progress}%`;
      if (loadingText && progress >= 100) loadingText.innerHTML = '<i class="fa-solid fa-circle-check"></i> اكتمل التجهيز، أهلًا بك في نبض التفوق';
      if (progress >= 100) { window.setTimeout(closeWelcome, 280); return; }
      animationFrame = window.requestAnimationFrame(updateProgress);
    };
    screen.classList.add('is-visible');
    screen.setAttribute('aria-hidden', 'false');
    $('#welcomeStart')?.addEventListener('click', closeWelcome);
    $('#welcomeSkip')?.addEventListener('click', closeWelcome);
    animationFrame = window.requestAnimationFrame(updateProgress);
    window.setTimeout(() => $('#welcomeStart')?.focus(), 160);
  }

  function initHome() {
    if (!$('#homeExamTitle')) return;
    $$('.exam-tab').forEach(tab => tab.addEventListener('click', () => setExam(tab.dataset.exam)));
    $('#customCountdownButton')?.addEventListener('click', () => openNamedModal('customCountdown'));
    setExam('bac');
    let timer = window.setInterval(() => { if (!document.hidden) updateCountdown(); }, 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) updateCountdown(); });
    window.addEventListener('pagehide', () => window.clearInterval(timer), { once: true });
  }

  function initIntensives() {
    const carousel = $('#intensiveCarousel');
    const post = $('#intensivePost');
    const link = $('#intensivePostLink');
    const current = $('#intensiveCurrent');
    if (!carousel || !post || !link) return;
    const covers = [
      { theme: 'theme-math', href: 'intensive-math.html' },
      { theme: 'theme-science', href: 'intensive-science.html' },
      { theme: 'theme-arabic', href: 'intensive-arabic.html' },
      { theme: 'theme-advert', href: 'advertising.html' }
    ];
    const dots = $$('.intensive-dot', carousel);
    let activeIndex = 0;
    let startX = 0;
    let dragging = false;
    const showCover = index => {
      activeIndex = (index + covers.length) % covers.length;
      post.className = `intensive-post ${covers[activeIndex].theme}`;
      link.href = covers[activeIndex].href;
      if (current) current.textContent = String(activeIndex + 1);
      dots.forEach((dot, position) => dot.classList.toggle('active', position === activeIndex));
      post.classList.remove('cover-changing');
      void post.offsetWidth;
      post.classList.add('cover-changing');
    };
    post.addEventListener('pointerdown', event => { startX = event.clientX; dragging = true; post.setPointerCapture?.(event.pointerId); });
    post.addEventListener('pointerup', event => {
      if (!dragging) return;
      const distance = event.clientX - startX;
      dragging = false;
      if (Math.abs(distance) > 42) showCover(activeIndex + (distance < 0 ? 1 : -1));
    });
    post.addEventListener('pointercancel', () => { dragging = false; });
    dots.forEach(dot => dot.addEventListener('click', () => showCover(Number(dot.dataset.intensiveSlide))));
    $$('[data-intensive-nav]', carousel).forEach(button => button.addEventListener('click', () => showCover(activeIndex + (button.dataset.intensiveNav === 'next' ? 1 : -1))));
  }

  const seedPosts = [
    { id: 'sample-1', name: 'سارة الحلبي', meta: 'بكالوريا علمي · حلب', text: 'تم نشر برنامج المراجعة المكثفة لمادة الفيزياء في المدرسة، بالتوفيق للجميع في التحضير للامتحانات.', likes: 24, comments: [{ name: 'محمد', text: 'شكرًا على المشاركة، خبر مفيد جدًا.' }], images: [] },
    { id: 'sample-2', name: 'ياسر الدمشقي', meta: 'التاسع الأساسي · دمشق', text: 'شاركتكم صورًا من معرض المشاريع العلمية اليوم. كانت تجربة ملهمة ومليئة بالأفكار الجديدة.', likes: 38, comments: [], images: ['https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1000&q=80', 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1000&q=80'] }
  ];

  function feedPost(id) {
    return posts.find(post => post.id === id) || seedPosts.find(post => post.id === id) || null;
  }

  function enrichedPost(post) {
    const interaction = postInteractions[post.id] || {};
    return {
      ...post,
      liked: Boolean(interaction.liked ?? post.liked),
      likes: Number.isFinite(interaction.likes) ? interaction.likes : (post.likes || 0),
      comments: [...(post.comments || []), ...(interaction.comments || [])]
    };
  }

  function postTemplate(rawPost) {
    const post = enrichedPost(rawPost);
    const avatar = rawPost.mine ? avatarMarkup() : `<span class="avatar">${escapeHTML((post.name || 'ط')[0])}</span>`;
    const verified = rawPost.mine ? student.verificationStatus === 'approved' : Boolean(post.verified);
    const images = (post.images || []).length
      ? `<div class="post-images ${(post.images || []).length > 1 ? 'multiple' : ''}">${post.images.map(src => `<img loading="lazy" src="${src}" alt="صورة مرفقة بالمنشور">`).join('')}</div><div class="post-media-indicator">${post.images.length > 1 ? `<i class="fa-solid fa-images"></i> اسحب لمشاهدة الصور ${post.images.length}` : ''}</div>`
      : '';
    const comments = post.comments.map(comment => { const commentVerified = comment.mine ? student.verificationStatus === 'approved' : Boolean(comment.verified); return `<div class="comment"><b>${escapeHTML(comment.name)}${verifiedBadgeMarkup(commentVerified)}</b><br>${escapeHTML(comment.text)}</div>`; }).join('');
    return `<article class="post" data-post="${escapeHTML(post.id)}"><div class="post-head">${avatar}<div class="post-author"><strong>${escapeHTML(post.name)}${verifiedBadgeMarkup(verified)}</strong><span>${escapeHTML(post.meta || `${student.stage} · ${student.city}`)} · الآن</span></div><button class="post-menu" type="button" aria-label="المزيد"><i class="fa-solid fa-ellipsis"></i></button></div><p class="post-content">${escapeHTML(post.text)}</p>${images}<div class="post-insights"><span>${post.likes} إعجاب</span><span>${post.comments.length} تعليق</span></div><div class="post-tools"><button class="tool-button ${post.liked ? 'liked' : ''}" type="button" data-action="like"><i class="${post.liked ? 'fa-solid' : 'fa-regular'} fa-heart"></i> إعجاب</button><button class="tool-button" type="button" data-action="comments"><i class="fa-regular fa-comment"></i> تعليق</button><button class="tool-button" type="button" data-action="share"><i class="fa-solid fa-arrow-up-from-bracket"></i> مشاركة</button></div><div class="comments ${openComments.has(post.id) ? '' : 'hidden'}">${comments}<form class="comment-form"><input required maxlength="280" placeholder="أضف تعليقًا محترمًا..."><button title="إرسال" aria-label="إرسال التعليق"><i class="fa-solid fa-paper-plane"></i></button></form></div></article>`;
  }

  function renderFeed() {
    const feed = $('#feed');
    if (!feed) return;
    const entries = [...posts, ...seedPosts];
    let visible = [...entries];
    if (activeFeedFilter === 'mine') visible = entries.filter(post => post.mine);
    if (activeFeedFilter === 'study') visible = entries.filter(post => /دراس|مراجعة|امتحان|فيزياء|رياض|منهاج|تعليم/.test(`${post.text} ${post.meta}`));
    if (activeFeedFilter === 'popular') visible.sort((first, second) => enrichedPost(second).likes - enrichedPost(first).likes);
    const headings = { all: ['الخلاصة التعليمية', 'أحدث المنشورات'], popular: ['اختيارات المجتمع', 'الأكثر تفاعلًا'], study: ['مساحة المذاكرة', 'أخبار الدراسة'], mine: ['مساحتك الشخصية', 'منشوراتي'] };
    const [eyebrow, title] = headings[activeFeedFilter] || headings.all;
    const feedTitle = $('#feedTitle');
    const feedEyebrow = $('#feedEyebrow');
    const communityPostCount = $('#communityPostCount');
    if (feedTitle) feedTitle.textContent = title;
    if (feedEyebrow) feedEyebrow.textContent = eyebrow;
    if (communityPostCount) communityPostCount.textContent = entries.length;
    feed.innerHTML = visible.length ? visible.map(postTemplate).join('') : '<div class="empty-feed"><i class="fa-regular fa-newspaper"></i><b>لا توجد منشورات في هذا القسم بعد.</b><span>جرّب فئة أخرى أو كن أول من يشارك خبرًا مفيدًا.</span></div>';
    const postCount = $('#profilePosts');
    if (postCount) postCount.textContent = posts.filter(post => post.mine).length;
  }

  function renderPreview() {
    const preview = $('#composePreview');
    if (preview) preview.innerHTML = uploadImages.map(source => `<img loading="lazy" src="${source}" alt="معاينة الصورة">`).join('');
  }

  function publishPost() {
    const text = $('#postText')?.value.trim() || '';
    if (!text && !uploadImages.length) return toast('اكتب الخبر أو أرفق صورة قبل النشر.');
    if (text.length > 1200) return toast('يرجى اختصار الخبر إلى 1200 حرف أو أقل.');
    const draft = { id: `post-${Date.now()}`, name: fullName(), meta: `${student.stage} · ${student.city}`, text, images: [...uploadImages], likes: 0, comments: [], mine: true, verified: student.verificationStatus === 'approved' };
    posts.unshift(draft);
    if (!saveState()) { posts.shift(); return; }
    uploadImages = [];
    const input = $('#postText');
    if (input) input.value = '';
    renderPreview();
    renderFeed();
    updateProfileUI();
    toast('تم نشر خبرك في مجتمع نبض.');
  }

  function toggleLike(postId) {
    const post = feedPost(postId);
    if (!post) return;
    const current = enrichedPost(post);
    const next = { liked: !current.liked, likes: Math.max(0, current.likes + (current.liked ? -1 : 1)), comments: postInteractions[postId]?.comments || [] };
    if (posts.some(item => item.id === postId)) {
      post.liked = next.liked;
      post.likes = next.likes;
    } else {
      postInteractions[postId] = next;
    }
    saveState();
    renderFeed();
  }

  async function sharePost(postId) {
    const url = `${location.origin}${location.pathname}#${postId}`;
    try {
      if (navigator.share) await navigator.share({ title: 'مجتمع نبض التفوق', text: 'منشور جديد في مجتمع نبض التفوق', url });
      else if (navigator.clipboard) { await navigator.clipboard.writeText(url); toast('تم نسخ رابط المنشور.'); }
      else toast('ميزة المشاركة متاحة عند نشر التطبيق على الهاتف.');
    } catch (error) {
      if (error.name !== 'AbortError') toast('تعذر تنفيذ المشاركة حاليًا.');
    }
  }

  function addComment(form) {
    const postId = form.closest('[data-post]')?.dataset.post;
    const post = feedPost(postId);
    const input = $('input', form);
    const text = input?.value.trim();
    if (!post || !text) return;
    const comment = { name: fullName(), text, mine: true, verified: student.verificationStatus === 'approved' };
    if (posts.some(item => item.id === postId)) {
      post.comments = [...(post.comments || []), comment];
    } else {
      const current = postInteractions[postId] || {};
      postInteractions[postId] = { ...current, comments: [...(current.comments || []), comment] };
    }
    openComments.add(postId);
    saveState();
    renderFeed();
  }

  function initNews() {
    if (!$('#feed')) return;
    renderFeed();
    $('#publishPost')?.addEventListener('click', publishPost);
    $('#clearImages')?.addEventListener('click', () => { uploadImages = []; renderPreview(); });
    $('#postImages')?.addEventListener('change', event => {
      const files = [...event.target.files].slice(0, 2);
      const invalid = files.some(file => file.size > 700 * 1024);
      if (invalid) { event.target.value = ''; return toast('اختر حتى صورتين، وحجم كل صورة لا يتجاوز 700 كيلوبايت.'); }
      Promise.all(files.map(file => new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(file); }))).then(images => { uploadImages = images; renderPreview(); });
    });
    $$('.community-tab').forEach(tab => tab.addEventListener('click', () => { activeFeedFilter = tab.dataset.filter || 'all'; $$('.community-tab').forEach(item => item.classList.toggle('active', item === tab)); renderFeed(); }));
  }

  function dateInputValue(date = new Date()) {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
  }

  function galleryDateLabel(value) {
    try { return new Intl.DateTimeFormat('ar-SY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(`${value}T12:00:00`)); }
    catch { return value; }
  }

  function orderedGallery() {
    const mode = $('#gallerySort')?.value || 'newest';
    const items = [...studyGallery];
    if (mode === 'manual') return items;
    return items.sort((first, second) => mode === 'oldest' ? first.date.localeCompare(second.date) : second.date.localeCompare(first.date));
  }

  function renderGallery() {
    const gallery = $('#studyGallery');
    const count = $('#galleryCount');
    if (!gallery) return;
    if (count) count.textContent = `${studyGallery.length} ${studyGallery.length === 1 ? 'صورة' : 'صورة'}`;
    if (!studyGallery.length) {
      gallery.innerHTML = '<div class="gallery-empty"><i class="fa-regular fa-images"></i><b>ألبومك الدراسي جاهز</b><span>ارفع صور ملخصاتك أو لوحاتك، وستظهر مرتبة حسب اليوم هنا.</span></div>';
      return;
    }
    const grouped = orderedGallery().reduce((groups, photo) => { (groups[photo.date] ||= []).push(photo); return groups; }, {});
    gallery.innerHTML = Object.entries(grouped).map(([date, photos]) => `<section class="gallery-day"><header><div><i class="fa-regular fa-calendar"></i><b>${galleryDateLabel(date)}</b></div><span>${photos.length} صور</span></header><div class="gallery-grid">${photos.map(photo => `<article class="study-photo"><button type="button" class="gallery-image-open" data-gallery-image="${photo.id}" title="عرض الصورة بالحجم الكامل"><img loading="lazy" src="${photo.src}" alt="صورة دراسية بتاريخ ${escapeHTML(date)}"></button><div class="gallery-image-actions"><button type="button" data-gallery-move="${photo.id}" data-direction="up" title="تقديم الصورة"><i class="fa-solid fa-arrow-up"></i></button><button type="button" data-gallery-move="${photo.id}" data-direction="down" title="تأخير الصورة"><i class="fa-solid fa-arrow-down"></i></button><button type="button" class="gallery-image-remove" data-gallery-remove="${photo.id}" title="حذف الصورة"><i class="fa-solid fa-xmark"></i></button></div></article>`).join('')}</div></section>`).join('');
  }

  function openGalleryImage(id) {
    const photo = studyGallery.find(item => item.id === id);
    if (!photo) return;
    openModal(`<div class="modal-head"><h3>صورة دراسية</h3><button class="close-modal" aria-label="إغلاق">×</button></div><div class="image-viewer"><img src="${photo.src}" alt="صورة دراسية"><span><i class="fa-regular fa-calendar"></i> ${galleryDateLabel(photo.date)}</span></div>`);
  }

  function removeGalleryImage(id) {
    studyGallery = studyGallery.filter(photo => photo.id !== id);
    saveGallery();
    renderGallery();
    toast('تم حذف الصورة من الأرشيف.');
  }

  function moveGalleryImage(id, direction) {
    const index = studyGallery.findIndex(photo => photo.id === id);
    if (index < 0) return;
    const date = studyGallery[index].date;
    const target = direction === 'up'
      ? [...studyGallery.keys()].slice(0, index).reverse().find(position => studyGallery[position].date === date)
      : [...studyGallery.keys()].slice(index + 1).find(position => studyGallery[position].date === date);
    if (target === undefined) return toast(direction === 'up' ? 'هذه الصورة في أول ترتيب يومها.' : 'هذه الصورة في آخر ترتيب يومها.');
    [studyGallery[index], studyGallery[target]] = [studyGallery[target], studyGallery[index]];
    const sorter = $('#gallerySort');
    if (sorter) sorter.value = 'manual';
    saveGallery();
    renderGallery();
  }

  function initGallery() {
    const upload = $('#galleryUpload');
    if (!upload) return;
    const date = $('#galleryDate');
    if (date && !date.value) date.value = dateInputValue();
    renderGallery();
    $('#gallerySort')?.addEventListener('change', renderGallery);
    upload.addEventListener('change', event => {
      const files = [...event.target.files].slice(0, 4);
      if (!files.length) return;
      if (studyGallery.length + files.length > 12) { event.target.value = ''; return toast('يمكن حفظ 12 صورة دراسية كحد أقصى. احذف صورة ثم حاول مجددًا.'); }
      if (files.some(file => !file.type.startsWith('image/') || file.size > 650 * 1024)) { event.target.value = ''; return toast('اختر صورًا صالحة بحجم لا يتجاوز 650 كيلوبايت للصورة.'); }
      const before = [...studyGallery];
      Promise.all(files.map(file => new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(file); }))).then(images => {
        const selectedDate = date?.value || dateInputValue();
        studyGallery = images.map((src, index) => ({ id: `study-${Date.now()}-${index}`, src, date: selectedDate })).concat(studyGallery);
        if (!saveGallery()) { studyGallery = before; return; }
        event.target.value = '';
        renderGallery();
        toast(`تمت إضافة ${images.length} صور إلى الأرشيف الدراسي.`);
      });
    });
    $('#galleryClear')?.addEventListener('click', () => {
      if (!studyGallery.length) return toast('لا توجد صور لحذفها.');
      if (!confirm('هل تريد حذف جميع الصور الدراسية المحفوظة؟')) return;
      studyGallery = [];
      saveGallery();
      renderGallery();
      toast('تم إفراغ الألبوم الدراسي.');
    });
  }

  const gradeCurricula = {
    nine: { title: 'مواد التاسع الأساسي', label: 'التاسع الأساسي', subjects: [
      { name: 'اللغة العربية', max: 600, pass: 300 }, { name: 'الاجتماعيات', max: 600, pass: 240 }, { name: 'العلوم العامة', max: 400, pass: 120 }, { name: 'الرياضيات', max: 600, pass: 240 }, { name: 'التربية الإسلامية', max: 200, pass: 80 }, { name: 'اللغة الإنكليزية', max: 400, pass: 160 }, { name: 'اللغة الفرنسية', max: 400, pass: 160 }
    ] },
    science: { title: 'مواد البكالوريا العلمي', label: 'بكالوريا علمي', subjects: [
      { name: 'اللغة العربية', max: 400, pass: 160 }, { name: 'الرياضيات', max: 600, pass: 240 }, { name: 'العلوم', max: 300, pass: 120 }, { name: 'التربية الإسلامية', max: 200, pass: 80 }, { name: 'الكيمياء', max: 200, pass: 80 }, { name: 'الفيزياء', max: 400, pass: 160 }, { name: 'اللغة الإنكليزية', max: 300, pass: 120 }, { name: 'اللغة الفرنسية', max: 300, pass: 120 }
    ] },
    literary: { title: 'مواد البكالوريا الأدبي', label: 'بكالوريا أدبي', subjects: [
      { name: 'اللغة العربية', max: 600, pass: 300 }, { name: 'التربية الإسلامية', max: 200, pass: 80 }, { name: 'اللغة الإنكليزية', max: 400, pass: 160 }, { name: 'التاريخ', max: 200, pass: 80 }, { name: 'الجغرافيا', max: 200, pass: 80 }, { name: 'الفلسفة', max: 200, pass: 80 }, { name: 'اللغة الفرنسية', max: 400, pass: 160 }
    ] }
  };

  function defaultGradeStage() {
    if (gradeCalculator.stage) return gradeCalculator.stage;
    if (/تاسع/.test(student.stage)) return 'nine';
    if (/أدبي/.test(student.stage)) return 'literary';
    return 'science';
  }

  function renderGradeSubjects() {
    const select = $('#gradeStage');
    const container = $('#gradeSubjects');
    if (!select || !container) return;
    const stage = select.value || defaultGradeStage();
    const curriculum = gradeCurricula[stage];
    gradeCalculator.stage = stage;
    gradeCalculator.marks ||= {};
    const title = $('#gradeTitle');
    const count = $('#gradeSubjectCount');
    if (title) title.textContent = curriculum.title;
    if (count) count.textContent = `${curriculum.subjects.length} مواد`;
    container.innerHTML = curriculum.subjects.map((subject, index) => `<label class="grade-subject"><span><b>${escapeHTML(subject.name)}</b><small>التامة ${subject.max} · حد الكسر ${subject.pass}</small></span><input class="grade-input" data-subject="${escapeHTML(subject.name)}" data-max="${subject.max}" data-pass="${subject.pass}" type="number" inputmode="decimal" min="0" max="${subject.max}" step="0.01" placeholder="/ ${subject.max}" value="${gradeCalculator.marks[subject.name] ?? ''}"><i>${String(index + 1).padStart(2, '0')}</i></label>`).join('');
  }

  function calculateGrade() {
    const inputs = $$('.grade-input');
    const values = inputs.map(input => ({ subject: input.dataset.subject, raw: input.value.trim(), value: Number(input.value), max: Number(input.dataset.max), pass: Number(input.dataset.pass) })).filter(item => item.raw !== '' && Number.isFinite(item.value) && item.value >= 0 && item.value <= item.max);
    if (!values.length) return toast('أدخل علامة مادة واحدة على الأقل لعرض المعدل.');
    const totalScore = values.reduce((sum, item) => sum + item.value, 0);
    const totalMax = values.reduce((sum, item) => sum + item.max, 0);
    const average = (totalScore / totalMax) * 100;
    const passedSubjects = values.filter(item => item.value >= item.pass).length;
    const result = $('#gradeResult');
    if (!result) return;
    const resultClass = average >= 85 ? 'excellent' : average >= 65 ? 'good' : average >= 50 ? 'pass' : 'needs-work';
    result.className = `grade-result panel ${resultClass}`;
    result.innerHTML = `<div class="grade-result-icon"><i class="fa-solid fa-chart-line"></i></div><div><span>نسبتك المئوية التقريبية</span><b>${average.toFixed(2)}<small> / 100</small></b><p>مجموعك الحالي ${totalScore.toFixed(0)} من ${totalMax.toFixed(0)} عبر ${values.length} مواد، وقد تجاوزت حد الكسر في ${passedSubjects} مواد.</p></div><div class="grade-result-tag">${average >= 85 ? 'ممتاز' : average >= 65 ? 'جيد' : average >= 50 ? 'مقبول' : 'بحاجة إلى تحسين'}</div>`;
    gradeCalculator.marks = Object.fromEntries(inputs.map(input => [input.dataset.subject, input.value]));
    gradeCalculator.lastAverage = average;
    saveGradeCalculator();
    result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function initCalculator() {
    const select = $('#gradeStage');
    if (!select) return;
    select.value = defaultGradeStage();
    renderGradeSubjects();
    select.addEventListener('change', () => { gradeCalculator.marks = {}; renderGradeSubjects(); saveGradeCalculator(); $('#gradeResult')?.classList.add('hidden'); });
    $('#gradeForm')?.addEventListener('submit', event => { event.preventDefault(); calculateGrade(); });
    $('#gradeReset')?.addEventListener('click', () => { gradeCalculator.marks = {}; saveGradeCalculator(); renderGradeSubjects(); $('#gradeResult')?.classList.add('hidden'); toast('تم مسح العلامات المدخلة.'); });
  }

  const assistantServices = {
    profile: { label: 'فتح ملفي الشخصي', href: 'profile.html', icon: 'fa-regular fa-user' },
    news: { label: 'فتح مجتمع الأخبار', href: 'news.html', icon: 'fa-regular fa-newspaper' },
    tools: { label: 'فتح أدوات الدراسة', href: 'index.html#tools', icon: 'fa-solid fa-toolbox' },
    gallery: { label: 'فتح تنظيم الصور', href: 'gallery.html', icon: 'fa-regular fa-images' },
    calculator: { label: 'فتح حاسبة المعدل', href: 'grade-calculator.html', icon: 'fa-solid fa-calculator' },
    home: { label: 'الذهاب إلى الرئيسية', href: 'index.html', icon: 'fa-solid fa-house' },
    notifications: { label: 'فتح الإشعارات', href: 'notifications.html', icon: 'fa-regular fa-bell' },
    privacy: { label: 'سياسة الخصوصية', href: 'privacy.html', icon: 'fa-solid fa-shield-halved' },
    supervision: { label: 'بوابة الإشراف', href: 'admin-dashboard.html', icon: 'fa-solid fa-shield-halved' },
    about: { label: 'عن المنصة', href: 'about.html', icon: 'fa-solid fa-circle-info' }
  };

  function getChat() {
    let chat = chats.find(item => item.id === activeChatId);
    if (!chat) {
      const now = Date.now();
      chat = { id: `chat-${now}`, title: 'محادثة جديدة', updatedAt: now, messages: [{ role: 'assistant', text: `أهلاً ${student.first || 'بك'}، أنا دليل نبض التفوق. أخبرني بالخدمة التي تريدها وسأشرحها وأرشدك إليها مباشرة.`, links: [assistantServices.profile, assistantServices.news, assistantServices.tools] }] };
      chats.unshift(chat);
      activeChatId = chat.id;
      saveState();
    }
    if (!Array.isArray(chat.messages)) chat.messages = [];
    return chat;
  }

  function expertReply(question) {
    const query = question.toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه');
    const answer = (text, links = []) => ({ text, links });
    if (/ملف|حساب|صوره|بيان|اسم|منطقه|مواليد|توثيق/.test(query)) {
      return answer(`ملفك الشخصي هو مركز تخصيص المنصة يا ${student.first || 'صديقي'}. منه تعدّل الاسم والرقم والمنطقة والمواليد والصورة والنبذة، وتدير الإشعارات والوضع الليلي. بعد اكتمال البيانات يمكنك إرسال طلب شارة التوثيق.`, [assistantServices.profile]);
    }
    if (/تنظيم الصور|صور دراسي|البوم|ارشيف الصور|لوحات|ملاحظات مصور/.test(query)) {
      return answer('تنظيم الصور الدراسية يحفظ صور الملاحظات واللوحات على جهازك، ويرتبها حسب اليوم. تستطيع رفع عدة صور، ثم الضغط على أي صورة لعرضها بالحجم الكامل أو حذفها عند الحاجة.', [assistantServices.gallery]);
    }
    if (/حاسبه المعدل|حساب المعدل|معدلي|علامات المواد|المعدل/.test(query)) {
      return answer('حاسبة المعدل تبدأ باختيار المرحلة: تاسع، بكالوريا علمي أو بكالوريا أدبي. بعدها تظهر مواد المرحلة؛ أدخل العلامات المتاحة واضغط «عرض المعدل» للحصول على متوسط تقريبي من المواد المدخلة.', [assistantServices.calculator]);
    }
    if (/خبر|مجتمع|منشور|تعليق|اعجاب|صور/.test(query)) {
      return answer('مجتمع الأخبار مخصص لمشاركة الأخبار التعليمية والإنجازات. اكتب الخبر، وأرفق حتى صورتين، ثم انشره. تستطيع التفاعل بالإعجاب والتعليقات، واستخدام الفلاتر لمشاهدة الأحدث أو الأكثر تفاعلًا أو منشوراتك.', [assistantServices.news]);
    }
    if (/عداد|هدف|موعد|بكالوريا|تاسع/.test(query)) {
      return answer('من الرئيسية ستجد عدادات البكالوريا والتاسع والعداد المخصص. لاستخدام العداد الشخصي اختر «مخصص»، ثم اضغط «ضبط» واكتب اسم هدفك وموعده. سيبقى محفوظًا في متصفحك.', [assistantServices.home]);
    }
    if (/اختبار|حاسب|معدل|بومودورو|دروس|مكتبه|جامع|توقع|تنظيم/.test(query)) {
      return answer('تضم الرئيسية أدوات الدراسة مثل حاسبة المعدل والاختبارات وبومودورو وتنظيم الوقت والمكتبة والدروس والتوقعات. اختر الأداة المناسبة من بطاقات الخدمات، وسأرشدك إلى المكان الصحيح.', [assistantServices.tools, assistantServices.calculator, assistantServices.gallery]);
    }
    if (/اشعار|تنبيه/.test(query)) return answer('يمكنك إدارة تنبيهات الأخبار والأنشطة من صفحة الإشعارات أو من إعدادات الملف الشخصي.', [assistantServices.notifications, assistantServices.profile]);
    if (/خصوص|امان|حفظ|بيانات/.test(query)) return answer('هذه النسخة الثابتة تحفظ ملفك والمنشورات والمحادثات على جهازك داخل المتصفح. يمكنك مراجعة سياسة الخصوصية لمعرفة التفاصيل.', [assistantServices.privacy]);
    if (/اشراف|بلاغ|اداره/.test(query)) return answer('بوابة الإشراف هي المكان المخصص لمسارات المراجعة والتنظيم داخل المنصة.', [assistantServices.supervision]);
    if (/من انت|كيف ابد|خدم|قسم|تطبيق|ساعد/.test(query)) {
      return answer('أنا دليل نبض التفوق. أساعدك في الوصول إلى ملفك الشخصي، عدادات الامتحانات، أدوات الدراسة، مجتمع الأخبار، الإشعارات والخصوصية. اختر القسم الذي تريد معرفته أو اكتب سؤالك بشكل مباشر.', [assistantServices.profile, assistantServices.home, assistantServices.tools, assistantServices.news]);
    }
    return answer(`فهمت سؤالك يا ${student.first || 'صديقي'}. يمكنني شرح أي قسم من نبض التفوق أو نقلك إليه مباشرة. جرّب أن تسأل مثلًا: «كيف أنشر خبرًا؟»، «كيف أضبط العداد؟»، أو «أين الاختبارات؟».`, [assistantServices.home, assistantServices.profile, assistantServices.news]);
  }

  function chatLinkMarkup(links = []) {
    return links.map(link => `<a class="assistant-link" href="${link.href}"><i class="${link.icon}"></i><span>${escapeHTML(link.label)}</span><i class="fa-solid fa-arrow-left"></i></a>`).join('');
  }

  function chatTime(timestamp) {
    if (!timestamp) return 'محفوظة محليًا';
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'الآن';
    if (diff < 3600000) return `منذ ${Math.floor(diff / 60000)} د`;
    return 'محادثة محفوظة';
  }

  function renderChat() {
    const area = $('#chatArea');
    if (!area) return;
    const chat = getChat();
    area.innerHTML = chat.messages.map(message => `<div class="message-wrap ${message.role === 'assistant' ? 'assistant' : 'student'}"><div class="bubble">${escapeHTML(message.text)}</div>${message.role === 'assistant' && message.links?.length ? `<div class="assistant-links">${chatLinkMarkup(message.links)}</div>` : ''}</div>`).join('') + `<div class="guide-block"><b>دليل ذكي لخدمات نبض:</b> اذكر اسم الخدمة أو الهدف، وسأشرحها وأضع لك زر انتقال مباشر.</div><div class="suggestions"><button class="suggestion" type="button">كيف أعدل ملفي؟</button><button class="suggestion" type="button">كيف أنشر خبرًا؟</button><button class="suggestion" type="button">أين الاختبارات؟</button><button class="suggestion" type="button">كيف أضبط العداد؟</button></div>`;
    area.scrollTop = area.scrollHeight;
    const history = $('#chatHistoryList');
    if (history) history.innerHTML = chats.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).map(item => `<button class="history-item ${item.id === activeChatId ? 'active' : ''}" type="button" data-chat="${item.id}"><i class="fa-regular fa-message"></i><span>${escapeHTML(item.title || 'محادثة جديدة')}<small>${chatTime(item.updatedAt)}</small></span></button>`).join('');
  }

  function sendChat() {
    const input = $('#chatInput');
    const question = input?.value.trim();
    if (!question) return;
    const chat = getChat();
    const reply = expertReply(question);
    chat.messages.push({ role: 'student', text: question }, { role: 'assistant', ...reply });
    chat.messages = chat.messages.slice(-80);
    chat.title = question.slice(0, 30);
    chat.updatedAt = Date.now();
    chats.sort((first, second) => (second.updatedAt || 0) - (first.updatedAt || 0));
    input.value = '';
    saveState();
    renderChat();
  }

  function initChat() {
    if (!$('#chatArea')) return;
    renderChat();
    $('#sendChat')?.addEventListener('click', sendChat);
    $('#chatInput')?.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendChat(); } });
    $('#newChat')?.addEventListener('click', () => { activeChatId = null; renderChat(); });
  }

  function handleProfileSave(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    student = { ...student, ...data, first: String(data.first || '').trim(), last: String(data.last || '').trim(), phone: String(data.phone || '').trim(), city: String(data.city || '').trim(), bio: String(data.bio || '').trim() || defaultStudent.bio };
    saveState();
    syncAdminStudent(true);
    closeModal();
    updateProfileUI();
    renderAdminDashboard();
    toast(profileIncomplete() ? 'تم حفظ البيانات. أكمل الحقول المتبقية متى شئت.' : 'تم حفظ بيانات الملف الشخصي.');
  }

  function handleCountdownSave(form) {
    const data = new FormData(form);
    const target = new Date(data.get('target')).getTime();
    if (!Number.isFinite(target)) return toast('اختر موعدًا صحيحًا.');
    customCountdown = { title: String(data.get('title')).trim(), target };
    homeExams.custom = { title: customCountdown.title, badge: 'عداد مخصص', note: 'اضبط اسم هدفك وموعده ليظهر عدادك الخاص هنا.', target };
    saveState();
    closeModal();
    setExam('custom');
    toast('تم حفظ العداد المخصص.');
  }

  function submitVerificationRequest() {
    syncAdminStudent(false);
    const snapshot = studentSnapshot();
    const existing = verificationRequests.find(request => request.studentId === snapshot.id && request.status === 'pending');
    if (!existing) {
      verificationRequests.unshift({ id: `verification-${Date.now()}`, studentId: snapshot.id, name: snapshot.name, phone: snapshot.phone, city: snapshot.city, gender: snapshot.gender, stage: snapshot.stage, status: 'pending', createdAt: Date.now() });
      adminLog('verification', `طلب توثيق جديد: ${snapshot.name}`, `${snapshot.city} · ${snapshot.stage}`);
    }
    student.verificationRequested = true;
    student.verificationStatus = 'pending';
    saveState();
    saveAdminState();
    closeModal();
    updateProfileUI();
    renderAdminDashboard();
    toast('تم إرسال طلب شارة التوثيق للمراجعة.');
  }

  function submitSupportRequest(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    const message = String(data.message || '').trim();
    if (!message) return toast('اكتب رسالتك قبل الإرسال.');
    syncAdminStudent(false);
    const snapshot = studentSnapshot();
    supportTickets.unshift({ id: `support-${Date.now()}`, studentId: snapshot.id, name: snapshot.name, phone: snapshot.phone, city: snapshot.city, gender: snapshot.gender, category: String(data.category || 'استفسار عام'), message, status: 'open', createdAt: Date.now() });
    adminLog('support', `رسالة دعم من ${snapshot.name}`, String(data.category || 'استفسار عام'));
    saveAdminState();
    closeModal();
    renderAdminDashboard();
    toast('تم إرسال رسالتك إلى صندوق الدعم.');
  }

  function adminAvatarMarkup(entry) {
    if (entry.avatar) return `<img class="avatar" src="${escapeHTML(entry.avatar)}" alt="صورة ${escapeHTML(entry.name)}">`;
    return `<span class="avatar">${escapeHTML(String(entry.name || 'ط').split(/\s+/).map(word => word[0]).join('').slice(0, 2))}</span>`;
  }

  function adminGenderMarkup(gender) {
    if (gender === 'ذكر') return '<span class="admin-gender male"><i class="fa-solid fa-mars"></i> ذكر</span>';
    if (gender === 'أنثى') return '<span class="admin-gender female"><i class="fa-solid fa-venus"></i> أنثى</span>';
    return '<span class="admin-gender unspecified">غير محدد</span>';
  }

  function adminStatusMarkup(status) {
    const labels = { pending: 'قيد المراجعة', approved: 'تم القبول', rejected: 'مرفوض', revoked: 'أُلغي التوثيق', open: 'مفتوحة', resolved: 'تمت المعالجة' };
    return `<span class="admin-status ${escapeHTML(status)}">${labels[status] || 'غير محدد'}</span>`;
  }

  function renderAdminDashboard() {
    if (!$('#adminStudentCount')) return;
    const pending = verificationRequests.filter(request => request.status === 'pending');
    const open = supportTickets.filter(ticket => ticket.status === 'open');
    $('#adminStudentCount').textContent = String(adminStudents.length);
    $('#adminVerificationCount').textContent = String(pending.length);
    $('#adminSupportCount').textContent = String(open.length);
    $('#adminPostCount').textContent = String(posts.length);
    const activities = $('#adminActivityList');
    if (activities) activities.innerHTML = adminActivity.length ? adminActivity.slice(0, 7).map(item => `<div class="admin-activity"><i class="${item.type === 'verification' ? 'fa-solid fa-certificate' : item.type === 'support' ? 'fa-solid fa-headset' : item.type === 'content' ? 'fa-regular fa-newspaper' : 'fa-solid fa-user-pen'}"></i><div><b>${escapeHTML(item.title)}</b><span>${escapeHTML(item.detail || 'تحديث داخل المنصة')} · ${displayAdminDate(item.createdAt)}</span></div></div>`).join('') : '<div class="admin-empty">لا توجد أحداث إشرافية بعد. ستظهر هنا تحديثات ملفات الطلاب والطلبات والرسائل.</div>';
    renderAdminStudents();
    const verificationRows = $('#adminVerificationRows');
    if (verificationRows) verificationRows.innerHTML = verificationRequests.length ? verificationRequests.map(request => `<article class="admin-request"><div class="admin-request-head"><div class="admin-request-person">${adminAvatarMarkup(request)}<div><b>${escapeHTML(request.name)}</b><small>${displayAdminDate(request.createdAt)}</small></div></div>${adminStatusMarkup(request.status)}</div><div class="admin-request-body"><span class="admin-detail-chip"><i class="fa-solid fa-phone"></i> ${escapeHTML(request.phone)}</span><span class="admin-detail-chip"><i class="fa-solid fa-location-dot"></i> ${escapeHTML(request.city)}</span><span class="admin-detail-chip">${escapeHTML(request.gender || 'الجنس غير محدد')}</span><span class="admin-detail-chip">${escapeHTML(request.stage)}</span></div>${request.status === 'pending' ? `<div class="admin-request-actions"><button class="admin-approve" type="button" data-admin-action="verification-approve" data-admin-id="${escapeHTML(request.id)}"><i class="fa-solid fa-check"></i> قبول</button><button class="admin-reject" type="button" data-admin-action="verification-reject" data-admin-id="${escapeHTML(request.id)}"><i class="fa-solid fa-xmark"></i> رفض</button></div>` : ''}</article>`).join('') : '<div class="admin-empty">لا توجد طلبات توثيق حتى الآن.</div>';
    const supportRows = $('#adminSupportRows');
    if (supportRows) supportRows.innerHTML = supportTickets.length ? supportTickets.map(ticket => `<article class="admin-request"><div class="admin-request-head"><div class="admin-request-person">${adminAvatarMarkup(ticket)}<div><b>${escapeHTML(ticket.name)}</b><small>${escapeHTML(ticket.category)} · ${displayAdminDate(ticket.createdAt)}</small></div></div>${adminStatusMarkup(ticket.status)}</div><div class="admin-request-body"><span class="admin-detail-chip"><i class="fa-solid fa-phone"></i> ${escapeHTML(ticket.phone)}</span><span class="admin-detail-chip"><i class="fa-solid fa-location-dot"></i> ${escapeHTML(ticket.city)}</span></div><p class="admin-request-message">${escapeHTML(ticket.message)}</p>${ticket.status === 'open' ? `<div class="admin-request-actions"><button class="admin-resolve" type="button" data-admin-action="support-resolve" data-admin-id="${escapeHTML(ticket.id)}"><i class="fa-solid fa-check"></i> تم الرد والمعالجة</button></div>` : ''}</article>`).join('') : '<div class="admin-empty">صندوق الدعم هادئ حاليًا، وستظهر الرسائل الجديدة هنا.</div>';
    const postRows = $('#adminPostRows');
    if (postRows) postRows.innerHTML = posts.length ? posts.map(post => `<article class="admin-post"><header><div><b>${escapeHTML(post.name || 'طالب')}</b><small>${escapeHTML(post.meta || 'منشور دراسي')} · ${displayAdminDate(post.createdAt || Date.now())}</small></div>${post.mine ? '<span class="admin-status open">منشور الطالب</span>' : ''}</header><p>${escapeHTML(post.text || 'منشور مرفق بصور دراسية')}</p><button type="button" data-admin-action="post-remove" data-admin-id="${escapeHTML(post.id)}"><i class="fa-solid fa-trash"></i> إزالة من العرض المحلي</button></article>`).join('') : '<div class="admin-empty">لا توجد منشورات محلية يحتاج المشرف إلى مراجعتها.</div>';
  }

  function renderAdminStudents(query = '') {
    const rows = $('#adminStudentsRows');
    if (!rows) return;
    const normalized = String(query).trim();
    const visible = adminStudents.filter(entry => `${entry.name} ${entry.phone} ${entry.city} ${entry.studentId || entry.id}`.includes(normalized));
    rows.innerHTML = visible.length ? visible.map(entry => { const verified = entry.verificationStatus === 'approved' || verificationRequests.some(request => request.studentId === entry.id && request.status === 'approved'); return `<article class="admin-student-card"><header class="admin-student-card-head"><div class="admin-student-cell">${adminAvatarMarkup(entry)}<span><b>${escapeHTML(entry.name)}</b><small>معرّف الطالب: ${escapeHTML(entry.id)}</small></span></div><div class="admin-row-actions"><button class="${verified ? 'admin-unverify' : 'admin-verify'}" type="button" title="${verified ? 'إلغاء توثيق الحساب' : 'توثيق الحساب'}" aria-label="${verified ? 'إلغاء توثيق' : 'توثيق'} ${escapeHTML(entry.name)}" data-admin-action="${verified ? 'student-unverify' : 'student-verify'}" data-admin-id="${escapeHTML(entry.id)}"><i class="fa-solid ${verified ? 'fa-user-xmark' : 'fa-circle-check'}"></i></button><button type="button" title="حذف من السجل المحلي" aria-label="حذف سجل ${escapeHTML(entry.name)}" data-admin-action="student-remove" data-admin-id="${escapeHTML(entry.id)}"><i class="fa-solid fa-trash"></i></button></div></header><div class="admin-student-fields"><div><span><i class="fa-solid fa-phone"></i> الرقم</span><b dir="ltr">${escapeHTML(entry.phone)}</b></div><div><span><i class="fa-solid fa-location-dot"></i> المنطقة</span><b>${escapeHTML(entry.city)}</b></div><div><span><i class="fa-solid fa-user"></i> الجنس</span>${adminGenderMarkup(entry.gender)}</div><div><span><i class="fa-solid fa-graduation-cap"></i> المرحلة</span><b>${escapeHTML(entry.stage)}</b></div></div><footer><span><i class="fa-solid ${verified ? 'fa-circle-check' : 'fa-clock'}"></i> ${verified ? 'حساب موثّق' : 'بانتظار التوثيق'}</span><b>${displayAdminDate(entry.updatedAt)}</b></footer></article>`; }).join('') : '<div class="admin-empty">لا توجد بيانات مطابقة للبحث.</div>';
  }

  function setStudentVerificationStatus(studentId, status, source = 'admin') {
    const entry = adminStudents.find(item => item.id === studentId);
    if (!entry) return null;
    entry.verificationStatus = status;
    entry.updatedAt = Date.now();
    let request = verificationRequests.filter(item => item.studentId === studentId).sort((a, b) => b.createdAt - a.createdAt)[0];
    if (!request) {
      request = { id: `verification-${Date.now()}`, studentId, name: entry.name, phone: entry.phone, city: entry.city, gender: entry.gender, stage: entry.stage, status, source, createdAt: Date.now() };
      verificationRequests.unshift(request);
    } else request.status = status;
    if (student.studentId === studentId) {
      student.verificationStatus = status;
      student.verificationRequested = status === 'pending';
      saveState();
      updateProfileUI();
    }
    return entry;
  }

  function handleAdminAction(button) {
    const action = button.dataset.adminAction;
    const id = button.dataset.adminId;
    if (action === 'logout') return logoutAdmin();
    if (!isAdminAuthenticated()) return toast('افتح بوابة المشرفين أولًا لتنفيذ هذا الإجراء.');
    if (action === 'verification-approve' || action === 'verification-reject') {
      const request = verificationRequests.find(item => item.id === id);
      if (!request) return;
      request.status = action === 'verification-approve' ? 'approved' : 'rejected';
      if (request.studentId === student.studentId) {
        student.verificationStatus = request.status;
        student.verificationRequested = request.status === 'pending';
        saveState();
        updateProfileUI();
      }
      adminLog('verification', `${request.status === 'approved' ? 'قبول' : 'رفض'} طلب توثيق: ${request.name}`, request.city);
      toast(request.status === 'approved' ? 'تم قبول طلب التوثيق محليًا.' : 'تم رفض طلب التوثيق محليًا.');
    }
    if (action === 'student-verify' || action === 'student-unverify') {
      const status = action === 'student-verify' ? 'approved' : 'revoked';
      const entry = setStudentVerificationStatus(id, status, 'manual');
      if (!entry) return;
      adminLog('verification', `${status === 'approved' ? 'توثيق يدوي' : 'إلغاء توثيق'}: ${entry.name}`, entry.city);
      toast(status === 'approved' ? 'تم توثيق الحساب يدويًا.' : 'تم إلغاء توثيق الحساب.');
    }
    if (action === 'support-resolve') {
      const ticket = supportTickets.find(item => item.id === id);
      if (!ticket) return;
      ticket.status = 'resolved';
      adminLog('support', `إغلاق رسالة دعم: ${ticket.name}`, ticket.category);
      toast('تم وضع رسالة الدعم كمعالجة.');
    }
    if (action === 'post-remove') {
      const index = posts.findIndex(post => post.id === id);
      if (index < 0) return;
      const [removed] = posts.splice(index, 1);
      saveState();
      adminLog('content', `إزالة منشور: ${removed.name || 'طالب'}`, 'إزالة محلية من لوحة الإشراف');
      toast('تمت إزالة المنشور من العرض المحلي.');
    }
    if (action === 'student-remove') {
      adminStudents = adminStudents.filter(entry => entry.id !== id);
      verificationRequests = verificationRequests.filter(request => request.studentId !== id);
      supportTickets = supportTickets.filter(ticket => ticket.studentId !== id);
      adminLog('student', 'إزالة سجل طالب', 'تم حذف السجل من بوابة هذا المتصفح فقط.');
      toast('تمت إزالة سجل الطالب المحلي.');
    }
    if (action === 'clear-activity') { adminActivity = []; saveAdminState(); toast('تم تنظيف سجل النشاط.'); }
    if (action === 'export') {
      const report = { generatedAt: new Date().toISOString(), students: adminStudents, verificationRequests, supportTickets, posts };
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'nabd-supervision-export.json'; anchor.click(); URL.revokeObjectURL(url);
      toast('تم تصدير ملخص الإشراف بصيغة JSON.');
    }
    saveAdminState();
    renderAdminDashboard();
  }

  function initAdminDashboard() {
    if (!$('#adminLoginScreen')) return;
    const allowed = isAdminAuthenticated();
    showAdminWorkspace(allowed);
    if (!allowed || !$('#adminStudentCount')) return;
    syncAdminStudent(false);
    renderAdminDashboard();
    if (adminControlsBound) return;
    adminControlsBound = true;
    $$('.admin-tab').forEach(tab => tab.addEventListener('click', () => { $$('.admin-tab').forEach(item => item.classList.toggle('active', item === tab)); $$('.admin-pane').forEach(pane => pane.classList.toggle('active', pane.dataset.adminPane === tab.dataset.adminTab)); }));
    $('#adminStudentSearch')?.addEventListener('input', event => renderAdminStudents(event.target.value));
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      if (event.target.closest('.close-modal') || event.target.id === 'modalBackdrop') closeModal();
      const modalButton = event.target.closest('[data-modal]');
      if (modalButton) openNamedModal(modalButton.dataset.modal);
      const adminButton = event.target.closest('[data-admin-action]');
      if (adminButton) handleAdminAction(adminButton);
      if (event.target.closest('#openEditProfile, #editProfileSmall, #completeProfile, #profileDataUpdate')) openNamedModal('edit');
      if (event.target.closest('#verificationRequest')) { if (profileIncomplete()) { toast('أكمل بيانات الملف الشخصي قبل طلب التوثيق.'); openNamedModal('edit'); } else openNamedModal('verification'); }
      if (event.target.closest('#sharePlatform')) sharePlatform();
      if (event.target.closest('#sidebarToggle')) toggleSidebar();
      if (document.body.classList.contains('sidebar-open') && event.target.closest('.side-link, .sidebar-edit-cta')) toggleSidebar(false);
      if (document.body.classList.contains('sidebar-open') && !event.target.closest('#desktopSidebar, #sidebarToggle')) toggleSidebar(false);
      if (event.target.closest('#profileThemeButton')) applyTheme(student.theme === 'dark' ? 'light' : 'dark');
      const galleryOpen = event.target.closest('[data-gallery-image]');
      if (galleryOpen) openGalleryImage(galleryOpen.dataset.galleryImage);
      const galleryRemove = event.target.closest('[data-gallery-remove]');
      if (galleryRemove) removeGalleryImage(galleryRemove.dataset.galleryRemove);
      const galleryMove = event.target.closest('[data-gallery-move]');
      if (galleryMove) moveGalleryImage(galleryMove.dataset.galleryMove, galleryMove.dataset.direction);
      const demo = event.target.closest('[data-demo]');
      if (demo) toast(demo.dataset.demo);

      const tool = event.target.closest('[data-action]');
      if (tool) {
        const postId = tool.closest('[data-post]')?.dataset.post;
        if (tool.dataset.action === 'like') toggleLike(postId);
        if (tool.dataset.action === 'comments') { openComments.has(postId) ? openComments.delete(postId) : openComments.add(postId); renderFeed(); }
        if (tool.dataset.action === 'share') sharePost(postId);
      }

      const suggestion = event.target.closest('.suggestion, .assistant-chip');
      if (suggestion) { const input = $('#chatInput'); if (input) { input.value = suggestion.dataset.prompt || suggestion.textContent; sendChat(); } }
      const history = event.target.closest('[data-chat]');
      if (history) { activeChatId = history.dataset.chat; renderChat(); }
    });

    document.addEventListener('submit', event => {
      if (event.target.id === 'editForm') { event.preventDefault(); handleProfileSave(event.target); }
      if (event.target.id === 'customCountdownForm') { event.preventDefault(); handleCountdownSave(event.target); }
      if (event.target.id === 'verificationForm') { event.preventDefault(); submitVerificationRequest(); }
      if (event.target.id === 'supportForm') { event.preventDefault(); submitSupportRequest(event.target); }
      if (event.target.id === 'adminLoginForm') { event.preventDefault(); submitAdminLogin(event.target); }
      if (event.target.matches('.comment-form')) { event.preventDefault(); addComment(event.target); }
    });

    $('#avatarInput')?.addEventListener('change', event => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) return toast('اختر ملف صورة صالحًا.');
      if (file.size > 700 * 1024) return toast('اختر صورة أصغر من 700 كيلوبايت للحفظ المحلي.');
      const reader = new FileReader();
      reader.onload = () => { student.avatar = reader.result; saveState(); syncAdminStudent(true); updateProfileUI(); renderAdminDashboard(); toast('تم تحديث صورة الملف الشخصي.'); };
      reader.readAsDataURL(file);
    });
    $('#themeSwitch')?.addEventListener('change', event => applyTheme(event.target.checked ? 'dark' : 'light'));
    $('#notificationsSwitch')?.addEventListener('change', event => { student.notifications = event.target.checked; saveState(); toast(event.target.checked ? 'تم تفعيل الإشعارات.' : 'تم إيقاف الإشعارات.'); });
  }

  function init() {
    if (typeof android !== 'undefined' && android.webReady) android.webReady();
    renderBrand();
    renderTopActions();
    applyTheme(student.theme, false);
    updateProfileUI();
    syncAdminStudent(false);
    bindEvents();
    initAdminDashboard();
    initWelcomeScreen();
    initHome();
    initIntensives();
    initNews();
    initGallery();
    initCalculator();
    initChat();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
