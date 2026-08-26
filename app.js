/* نبض التفوق — منطق الواجهة المشترك للصفحات الثابتة */
(() => {
  'use strict';

  const STORE = 'nabd_v3_';
  const LEGACY_STORE = 'nabd_v2_';
  const PAGE = document.body.dataset.page || 'home';
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const supabaseClient = window.nabdSupabase;
  let currentAuthUser = null;

  async function requireStudentSession() {
    if (!supabaseClient) { window.location.replace('auth.html'); return false; }
    let session = null;
    let lastError = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const { data, error } = await supabaseClient.auth.getSession();
      lastError = error || null;
      session = data?.session || null;
      if (session) break;
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 250));
    }
    if (lastError || !session) { window.location.replace('auth.html'); return false; }
    currentAuthUser = session.user;
    const { data: profile, error: profileError } = await supabaseClient.from('student_profiles').select('user_id,first_name,father_name,family_name,study_stage,email,avatar_url,bio').eq('user_id', currentAuthUser.id).maybeSingle();
    if (!profileError && profile) {
      student = { ...student, first: profile.first_name || student.first, father: profile.father_name || student.father, last: profile.family_name || student.last, stage: profile.study_stage || student.stage, bio: profile.bio || student.bio, avatar: profile.avatar_url || student.avatar };
      saveState();
    }
    return true;
  }

  async function persistStudentProfile() {
    if (!supabaseClient || !currentAuthUser) return;
    const { error } = await supabaseClient.from('student_profiles').upsert({ user_id: currentAuthUser.id, first_name: student.first, father_name: student.father || '', family_name: student.last, study_stage: student.stage, email: currentAuthUser.email, avatar_url: student.avatar || null, bio: student.bio || '' }, { onConflict: 'user_id' });
    if (error) console.warn('تعذر مزامنة ملف الطالب مع الخادم', error);
  }

  async function signOutStudent() {
    await supabaseClient?.auth.signOut();
    window.location.replace('auth.html');
  }


  const defaultStudent = {
    first: '', father: '', last: '', phone: '', birth: '', city: 'دمشق', stage: 'بكالوريا علمي',
    bio: 'طالب في منصة نبض التفوق، أعمل على تنظيم رحلتي الدراسية والوصول إلى أهدافي.',
    avatar: '', notifications: true, theme: 'dark', motion: true, studentId: '', gender: '', verificationRequested: false, verificationStatus: ''
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
  let studyTasks = readStorage('study_tasks', []);
  studyTasks = Array.isArray(studyTasks) ? studyTasks : [];
  let activeStudyFilter = 'today';
  let adminStudents = readStorage('admin_students', []);
  let verificationRequests = readStorage('verification_requests', []);
  let supportTickets = readStorage('support_tickets', []);
  let adminActivity = readStorage('admin_activity', []);
  adminStudents = Array.isArray(adminStudents) ? adminStudents : [];
  verificationRequests = Array.isArray(verificationRequests) ? verificationRequests : [];
  supportTickets = Array.isArray(supportTickets) ? supportTickets : [];
  adminActivity = Array.isArray(adminActivity) ? adminActivity : [];
  let adminUsers = [];
  let adminUsersLoaded = false;
  let adminControlsBound = false;
  let remoteAdminVerified = false;
  let adminShortcutChecked = false;
  let appNotifications = [];
  let notificationsLoaded = false;
  let notificationsEventsBound = false;
  let adminStats = { total_users: 0, total_notifications: 0, total_news_posts: 0, total_news_comments: 0, open_support_threads: 0 };
  let adminNotifications = [];
  let activeAdminTab = 'overview';
  const adminLoadedTabs = new Set();
  let adminNewsActivity = [];
  let adminSupportThreads = [];
  const defaultCustomCountdown = { title: 'هدفي الخاص', target: new Date('2027-01-01T08:00:00').getTime() };
  const storedCustomCountdown = readStorage('custom_countdown', defaultCustomCountdown);
  let customCountdown = {
    ...defaultCustomCountdown,
    ...(storedCustomCountdown && typeof storedCustomCountdown === 'object' ? storedCustomCountdown : {})
  };
  if (!customCountdown.title || !String(customCountdown.title).trim()) customCountdown.title = defaultCustomCountdown.title;
  if (!Number.isFinite(Number(customCountdown.target))) customCountdown.target = defaultCustomCountdown.target;
  let uploadImages = [];
  let newsIsAdmin = false;
  let newsRemotePostsLoaded = false;
  let activeChatId = null;
  let activeExam = 'bac';
  let activeFeedFilter = 'all';
  const openComments = new Set();
  const expandedNewsPosts = new Set();
  const likePulsePosts = new Set();
  const defaultCommunityPromo = { visible: true, title: 'مساحة طلاب نبض', body: 'تابع جديد المنصة، وشارك إنجازاتك، وكن جزءًا من مجتمع دراسي منظم ومحترم.', ctaLabel: 'اكتشف المزيد', link: '' };
  let communityPromo = { ...defaultCommunityPromo, ...readStorage('community_promo', {}) };
  communityPromo.visible = communityPromo.visible !== false;

  const escapeHTML = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));

  const fullName = () => `${student.first || 'طالب'} ${student.father || ''} ${student.last || ''}`.replace(/\s+/g, ' ').trim();
  const initials = () => fullName().split(/\s+/).map(word => word[0]).join('').slice(0, 2);
  const profileIncomplete = () => !(student.first && student.father && student.last && student.stage);

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

  function saveCommunityPromo() {
    try { localStorage.setItem(STORE + 'community_promo', JSON.stringify(communityPromo)); return true; }
    catch { toast('تعذر حفظ إعداد مساحة المجتمع محليًا.'); return false; }
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

  function isAdminAuthenticated() {
    return Boolean(remoteAdminVerified && currentAuthUser?.id);
  }

  function showAdminWorkspace(allowed) {
    const screen = $('#adminLoginScreen');
    const workspace = $('#adminWorkspace');
    if (screen) screen.classList.toggle('hidden', allowed);
    if (workspace) workspace.classList.toggle('hidden', !allowed);
    document.body.classList.toggle('admin-authenticated', allowed);
  }

  function logoutAdmin() {
    remoteAdminVerified = false;
    showAdminWorkspace(false);
    const note = $('.admin-login-note');
    if (note) note.innerHTML = '<i class="fa-solid fa-lock"></i> تم قفل البوابة. أعد فتحها لإجراء تحقق جديد من حسابك.';
    toast('تم قفل بوابة المشرفين.');
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
    $$('[data-theme-choice]').forEach(button => button.classList.toggle('active', button.dataset.themeChoice === student.theme));
    const status = $('#settingsThemeStatus');
    if (status) status.textContent = student.theme === 'dark' ? 'المظهر الداكن مفعّل' : 'المظهر الفاتح مفعّل';
    if (persist) saveState();
  }

  function applyMotion(enabled = student.motion !== false, persist = true) {
    student.motion = Boolean(enabled);
    document.documentElement.classList.toggle('reduced-motion', !student.motion);
    const switcher = $('#motionSwitch');
    if (switcher) switcher.checked = student.motion;
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
    actions.insertAdjacentHTML('afterbegin', '<button class="icon-button share-platform" id="sharePlatform" type="button" title="مشاركة المنصة" aria-label="مشاركة المنصة"><i class="fa-solid fa-arrow-up-from-bracket"></i></button>');
  }

  async function sharePlatform() {
    const url = location.href; const payload = { title: 'نبض التفوق', text: 'منصة نبض التفوق التعليمية', url, dialogTitle: 'مشاركة نبض التفوق' };
    try {
      const nativeShare = capacitorPlugin('Share');
      if (isNativeNabd() && nativeShare?.share) { await nativeShare.share(payload); return; }
      if (navigator.share) await navigator.share(payload);
      else if (navigator.clipboard) { await navigator.clipboard.writeText(url); toast('تم نسخ رابط المنصة.'); }
      else toast('ميزة المشاركة متاحة عند نشر التطبيق على الهاتف.');
    } catch (error) {
      if (error.name !== 'AbortError') toast('تعذر تنفيذ المشاركة حاليًا.');
    }
  }

  function openNativeChatViewer(url, title) {
    try {
      if (isNativeNabd() && typeof window.NabdAndroid?.openNativeChatViewer === 'function') { window.NabdAndroid.openNativeChatViewer(url, title, 'dark'); return; }
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) { console.warn('تعذر فتح نافذة الدردشة الأصلية', error); toast('تعذر فتح الصفحة الآن.'); }
  }

  async function openExternalUrl(rawUrl) {
    const url = String(rawUrl || '').trim();
    if (!/^https?:\/\//i.test(url)) return;
    try {
      const browser = capacitorPlugin('Browser');
      if (isNativeNabd() && browser?.open) { await browser.open({ url }); return; }
      if (isNativeNabd() && typeof window.NabdAndroid?.openExternalUrl === 'function') { window.NabdAndroid.openExternalUrl(url); return; }
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (!opened) window.location.href = url;
    } catch (error) {
      console.warn('تعذر فتح رابط الخبر', error);
      toast('تعذر فتح الرابط الآن.');
    }
  }

  function verifiedBadgeMarkup(verified = false) {
    return verified ? '<span class="verified-badge" role="img" aria-label="حساب موثّق" title="حساب موثّق"><i class="fa-solid fa-check"></i></span>' : '';
  }

  async function revealPremiumAdminShortcut() {
    const shortcuts = $$('#premiumAdminHomeShortcut, #adminPortalShortcut');
    if (!shortcuts.length || adminShortcutChecked || !supabaseClient || !currentAuthUser) return;
    try {
      const result = await supabaseClient.rpc('premium_is_admin');
      if (result.error) return;
      adminShortcutChecked = true;
      if (result.data === true) shortcuts.forEach(shortcut => shortcut.classList.remove('hidden'));
    } catch { /* يبقى الرابط مخفيًا للمستخدم غير المشرف */ }
  }

  function renderShell() {

    const bottomNav = $('#bottomNav');
    if (bottomNav) {
      bottomNav.innerHTML = `
        <button class="bottom-link" type="button" data-native-chat-url="https://open-chat-vibe.lovable.app" data-native-chat-title="الدردشة"><i class="fa-solid fa-comments"></i><span>الدردشة</span></button>
        <button class="bottom-link" type="button" data-native-chat-url="https://rtl-pulse-chat.lovable.app/" data-native-chat-title="AI"><i class="fa-solid fa-robot"></i><span>AI</span></button>
        <a class="bottom-link ${PAGE === 'home' ? 'active' : ''}" href="index.html"><i class="fa-solid fa-house"></i><span>الرئيسية</span></a>
        <a class="bottom-link ${PAGE === 'news' ? 'active' : ''}" href="news.html"><i class="fa-regular fa-newspaper"></i><span>الأخبار</span></a>
        <a class="bottom-link ${PAGE === 'profile' ? 'active' : ''}" href="profile.html"><i class="fa-regular fa-user"></i><span>حسابي</span></a>`;
    }
  }

  function safeNotificationUrl(value) {
    try {
      const url = new URL(String(value || '').trim());
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch { return ''; }
  }

  function updateNotificationBadges() {
    const unread = appNotifications.filter(item => !item.read_at).length;
    $$('.notification-dot').forEach(dot => {
      dot.classList.toggle('has-unread', unread > 0);
      dot.setAttribute('aria-label', unread ? `${unread} إشعار غير مقروء` : 'لا توجد إشعارات غير مقروءة');
      dot.title = unread ? `${unread} إشعار غير مقروء` : 'لا توجد إشعارات غير مقروءة';
    });
  }

  function notificationCardMarkup(notification) {
    const unread = !notification.read_at;
    return `<article class="notification-card ${unread ? 'is-unread' : ''}" data-notification-open="${escapeHTML(notification.id)}" tabindex="0" aria-label="${escapeHTML(notification.title)}"><span class="notification-card-marker" aria-hidden="true"></span><span class="notification-card-avatar" aria-hidden="true"><i class="fa-solid fa-bell"></i></span><div class="notification-card-content"><div class="notification-card-topline"><b>${unread ? 'إشعار جديد' : 'إشعار'}</b><time datetime="${escapeHTML(notification.created_at || '')}">${escapeHTML(displayAdminDate(notification.created_at))}</time></div><h3>${escapeHTML(notification.title)}</h3><p>${escapeHTML(notification.body).replace(/\n/g, '<br>')}</p></div><button class="notification-mark-read" type="button" data-notification-read="${escapeHTML(notification.id)}" ${unread ? '' : 'disabled'} aria-label="${unread ? 'تعليم الإشعار كمقروء' : 'تمت قراءة الإشعار'}">${unread ? '<i class="fa-solid fa-check"></i><span>تعليم كمقروء</span>' : '<i class="fa-solid fa-check-double"></i><span>مقروء</span>'}</button></article>`;
  }

  function notificationGroupLabel(notification, index) {
    if (index === 0) return 'أبرز الإشعارات';
    const date = new Date(notification.created_at || Date.now());
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const target = new Date(date); target.setHours(0, 0, 0, 0);
    const dayDiff = Math.max(0, Math.round((today - target) / 86400000));
    if (dayDiff === 0) return 'اليوم';
    if (dayDiff === 1) return 'أمس';
    if (dayDiff < 7) return 'آخر 7 أيام';
    return 'أقدم';
  }
  function renderNotifications() {
    const list = $('#notificationsList');
    const empty = $('#notificationsEmpty');
    const loading = $('#notificationsLoading');
    if (!list) { updateNotificationBadges(); return; }
    if (!notificationsLoaded) {
      list.innerHTML = '';
      if (loading) loading.hidden = false;
      if (empty) empty.hidden = true;
      updateNotificationBadges();
      return;
    }
    if (loading) loading.hidden = true;
    const groups = [];
    const grouped = new Map();
    appNotifications.forEach((notification, index) => {
      const label = notificationGroupLabel(notification, index);
      if (!grouped.has(label)) { grouped.set(label, []); groups.push(label); }
      grouped.get(label).push(notification);
    });
    list.innerHTML = groups.map(label => `<section class="notification-group" aria-label="${label}"><h3 class="notification-group-title">${label}<span>${grouped.get(label).length}</span></h3><div class="notification-group-items">${grouped.get(label).map(notificationCardMarkup).join('')}</div></section>`).join('');
    const count = $('#notificationsCount');
    if (count) { const unread = appNotifications.filter(item => !item.read_at).length; count.textContent = appNotifications.length ? `${appNotifications.length} إشعار${unread ? ` · ${unread} جديد` : ''}` : ''; }
    if (empty) empty.hidden = appNotifications.length > 0;
    updateNotificationBadges();
  }

  async function loadAppNotifications() {
    if (!supabaseClient || !currentAuthUser) return;
    const { data, error } = await supabaseClient.rpc('get_notifications', { p_limit: 50 });
    if (error) {
      console.warn('تعذر تحميل الإشعارات', error);
      const loading = $('#notificationsLoading');
      if (loading) { loading.hidden = false; loading.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i><span>تعذر تحميل الإشعارات الآن. حاول التحديث لاحقًا.</span>'; }
      return;
    }
    appNotifications = Array.isArray(data) ? data : [];
    notificationsLoaded = true;
    renderNotifications();
    updateNotificationBadges();
  }

  async function markNotificationRead(notificationId) {
    const notification = appNotifications.find(item => item.id === notificationId);
    if (!notification || notification.read_at || !supabaseClient || !currentAuthUser) return;
    const { error } = await supabaseClient.rpc('mark_notification_read', { p_notification_id: notificationId });
    if (error) return toast('تعذر تحديث حالة الإشعار الآن.');
    notification.read_at = new Date().toISOString();
    renderNotifications();
  }

  async function markAllNotificationsRead() {
    const unread = appNotifications.filter(item => !item.read_at);
    if (!unread.length) return toast('جميع الإشعارات مقروءة.');
    const button = $('#markAllNotificationsRead');
    if (button) { button.disabled = true; button.dataset.originalLabel = button.innerHTML; button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جارٍ التحديث'; }
    try {
      const results = await Promise.all(unread.map(item => supabaseClient.rpc('mark_notification_read', { p_notification_id: item.id })));
      if (results.some(result => result.error)) throw new Error('تعذر تعليم بعض الإشعارات.');
      const now = new Date().toISOString();
      appNotifications.forEach(item => { if (!item.read_at) item.read_at = now; });
      renderNotifications();
      toast('تم تعليم جميع الإشعارات كمقروءة.');
    } catch (error) { console.warn('تعذر تعليم الإشعارات', error); toast('تعذر تحديث الإشعارات الآن.'); }
    finally { if (button) { button.disabled = false; button.innerHTML = button.dataset.originalLabel || '<i class="fa-solid fa-check-double"></i> تعليم الكل كمقروء'; } }
  }

  function initNotifications() {
    if (!$('#notificationsList')) return;
    if (!notificationsEventsBound) {
      notificationsEventsBound = true;
      $('#markAllNotificationsRead')?.addEventListener('click', markAllNotificationsRead);
      $('#notificationsList')?.addEventListener('click', event => {
        const readButton = event.target.closest('[data-notification-read]');
        const card = event.target.closest('[data-notification-open]');
        const id = readButton?.dataset.notificationRead || card?.dataset.notificationOpen;
        if (id && !event.target.closest('a')) void markNotificationRead(id);
      });
      $('#notificationsList')?.addEventListener('keydown', event => {
        if ((event.key !== 'Enter' && event.key !== ' ') || event.target.closest('button, a')) return;
        event.preventDefault();
        const card = event.target.closest('[data-notification-open]');
        if (card) void markNotificationRead(card.dataset.notificationOpen);
      });
    }
    renderNotifications();
    void loadAppNotifications();
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
    document.body.classList.add('sheet-open');
    backdrop.classList.add('show');
    window.setTimeout(() => modal.querySelector('input[autofocus], textarea[autofocus], select[autofocus]')?.focus(), 180);
  }

  const NEWS_MODAL_STATE = 'nabdNewsModal';

  function newsModalState() {
    return window.history.state?.[NEWS_MODAL_STATE] || null;
  }

  function pushNewsModalState(mode, postId, commentId = null) {
    const current = newsModalState();
    const nextCommentId = commentId || null;
    if (current?.mode === mode && current?.postId === postId && (current.commentId || null) === nextCommentId) return;
    const depth = (Number(current?.depth) || 0) + 1;
    window.history.pushState({ ...(window.history.state || {}), [NEWS_MODAL_STATE]: { mode, postId, commentId: nextCommentId, depth } }, '', window.location.href);
  }

  function clearNewsModalState() {
    if (!newsModalState()) return;
    const nextState = { ...(window.history.state || {}) };
    delete nextState[NEWS_MODAL_STATE];
    window.history.replaceState(nextState, document.title, window.location.href);
  }

  function closeModal({ preserveHistory = false } = {}) {
    const activeNewsView = $('#modalContent .comments-screen, #modalContent .comment-replies-screen');
    const state = newsModalState();
    if (!preserveHistory && activeNewsView && state?.depth) {
      window.history.go(-Math.max(1, Number(state.depth) || 1));
      return;
    }
    if (!preserveHistory) clearNewsModalState();
    $('#modalBackdrop')?.classList.remove('show');
    document.body.classList.remove('sheet-open');
  }

  function handleNewsModalPopState(event) {
    const state = event.state?.[NEWS_MODAL_STATE];
    if (state?.mode === 'comments' && state.postId) return openPostComments(state.postId, null, { fromHistory: true });
    if (state?.mode === 'replies' && state.postId && state.commentId) return openPostReplies(state.postId, state.commentId, null, { fromHistory: true });
    if ($('#modalBackdrop')?.classList.contains('show')) closeModal({ preserveHistory: true });
  }

  window.addEventListener('popstate', handleNewsModalPopState);

  function confirmAction(title, message, action, confirmLabel = 'حذف') {
    window.nabdConfirmAction = action;
    openModal(`<div class="confirm-sheet"><span class="confirm-sheet-icon"><i class="fa-solid fa-triangle-exclamation"></i></span><h3>${escapeHTML(title)}</h3><p>${escapeHTML(message)}</p><div class="form-actions"><button type="button" class="outline-button close-modal">إلغاء</button><button type="button" class="danger-button" data-confirm-action>${escapeHTML(confirmLabel)}</button></div></div>`);
  }

  function openNamedModal(name) {
    if (name === 'contact') { window.location.href = 'support-chat.html'; return; }
    const modals = {
      edit: `<div class="modal-head"><h3>تعديل الملف الشخصي</h3><button class="close-modal" aria-label="إغلاق">×</button></div>
        <form id="editForm"><div class="form-grid">
          <div class="form-group"><label>الاسم الأول</label><input name="first" required maxlength="32" value="${escapeHTML(student.first)}"></div>
          <div class="form-group"><label>اسم الأب</label><input name="father" required maxlength="32" value="${escapeHTML(student.father || '')}"></div>
          <div class="form-group"><label>الكنية</label><input name="last" required maxlength="32" value="${escapeHTML(student.last)}"></div>
          <div class="form-group"><label>رقم الهاتف</label><input name="phone" type="tel" inputmode="tel" maxlength="20" value="${escapeHTML(student.phone)}"></div>
          <div class="form-group"><label>تاريخ الميلاد</label><input name="birth" type="date" value="${escapeHTML(student.birth)}"></div>
          <div class="form-group"><label>المنطقة</label><input name="city" maxlength="40" value="${escapeHTML(student.city)}"></div>
          <div class="form-group"><label>الجنس</label><select name="gender"><option value="" ${!student.gender ? 'selected' : ''}>أفضل عدم التحديد</option><option value="ذكر" ${student.gender === 'ذكر' ? 'selected' : ''}>ذكر</option><option value="أنثى" ${student.gender === 'أنثى' ? 'selected' : ''}>أنثى</option></select></div>
          <div class="form-group"><label>المرحلة الدراسية</label><select name="stage"><option ${student.stage === 'بكالوريا علمي' ? 'selected' : ''}>بكالوريا علمي</option><option ${student.stage === 'بكالوريا أدبي' ? 'selected' : ''}>بكالوريا أدبي</option><option ${student.stage === 'التاسع' || student.stage === 'التاسع الأساسي' ? 'selected' : ''}>التاسع</option><option ${student.stage === 'ثانوي' ? 'selected' : ''}>ثانوي</option><option ${student.stage === 'جامعة' || student.stage === 'مرحلة جامعية' ? 'selected' : ''}>مرحلة جامعية</option><option ${student.stage === 'معهد' ? 'selected' : ''}>معهد</option></select></div>
          <div class="form-group full"><label>السيرة الذاتية</label><textarea name="bio" maxlength="240">${escapeHTML(student.bio)}</textarea></div>
        </div><div class="form-actions"><button type="button" class="outline-button close-modal">إلغاء</button><button class="primary-button" type="submit">حفظ التغييرات</button></div></form>`,
      customCountdown: `<div class="modal-head"><h3>ضبط العداد المخصص</h3><button class="close-modal" aria-label="إغلاق">×</button></div>
        <form id="customCountdownForm"><div class="form-group"><label>اسم الهدف</label><input name="title" required maxlength="34" value="${escapeHTML(customCountdown.title)}"></div><div class="form-group" style="margin-top:12px"><label>موعد الهدف</label><input name="target" type="datetime-local" required min="${formatDate(Date.now())}" value="${formatDate(customCountdown.target)}"></div><p class="onboarding-note">يحفظ العداد على جهازك داخل المتصفح.</p><div class="form-actions"><button type="button" class="outline-button close-modal">إلغاء</button><button class="primary-button" type="submit">حفظ العداد</button></div></form>`,
      appGuide: `<div class="modal-head"><h3>شرح استخدام التطبيق</h3><button class="close-modal" aria-label="إغلاق">×</button></div><div class="info-page"><div class="info-icon"><i class="fa-regular fa-circle-play"></i></div><h2>ابدأ بخطوات بسيطة</h2><p>من الرئيسية تابع عدادات الامتحان واستخدم الأدوات الدراسية. اختر «مخصص» لضبط هدفك وموعده.</p><p>في الملف الشخصي عدّل بياناتك وصورتك وإعداداتك، ثم استخدم مجتمع الأخبار لمشاركة الأخبار والصور والتفاعل باحترام.</p></div>`,
      contribute: `<div class="modal-head"><h3>ساهم في التطبيق</h3><button class="close-modal" aria-label="إغلاق">×</button></div><div class="info-page"><div class="info-icon"><i class="fa-solid fa-hand-holding-heart"></i></div><h2>رأيك يصنع فرقًا</h2><p>شارك اقتراحاتك للأقسام والأدوات الدراسية التي ترغب برؤيتها في الإصدارات القادمة.</p></div>`,
      contact: `<div class="modal-head"><h3>تواصل مع الدعم</h3><button class="close-modal" aria-label="إغلاق">×</button></div><form id="supportForm"><div class="info-page"><div class="info-icon"><i class="fa-regular fa-comment-dots"></i></div><h2>كيف يمكننا مساعدتك؟</h2><p>اكتب رسالتك، وستظهر في صندوق الدعم داخل بوابة المشرفين على هذا المتصفح.</p><div class="form-group" style="text-align:right"><label>نوع الرسالة</label><select name="category"><option>مساعدة دراسية</option><option>مشكلة تقنية</option><option>اقتراح تطوير</option><option>استفسار عام</option></select></div><div class="form-group" style="text-align:right;margin-top:11px"><label>رسالتك</label><textarea name="message" required maxlength="700" placeholder="اكتب تفاصيل المساعدة التي تحتاجها..."></textarea></div><div class="form-actions"><button type="button" class="outline-button close-modal">إلغاء</button><button class="primary-button" type="submit">إرسال للدعم</button></div></div></form>`,
    };
    openModal(modals[name] || modals.appGuide);
  }

  function updateProfileUI() {
    ensureStudentId();
    const activeTaskCount = Array.isArray(studyTasks) ? studyTasks.filter(task => !task.completed).length : 0;
    const savedAverage = Number(gradeCalculator?.lastAverage);
    const values = {
      profileName: fullName(),
      profileNameData: fullName(),
      profileFather: student.father || '—',
      profileStageData: student.stage || '—',
      profileEmail: currentAuthUser?.email || '—',
      profileHandle: '@' + fullName().replaceAll(' ', '_'),
      profileBio: student.bio || 'أضف نبذة بسيطة لتظهر في مجتمع الأخبار.',
      profilePhone: student.phone || '—',
      profileCity: student.city || '—',
      profileStudentId: student.studentId,
      profilePosts: posts.filter(post => post.mine).length,
      profileActiveTasks: activeTaskCount,
      profileStudyAverage: Number.isFinite(savedAverage) ? `${savedAverage.toFixed(1)}%` : '—',
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
    const notificationSwitch = $('#notificationsSwitch');
    if (notificationSwitch) notificationSwitch.checked = Boolean(student.notifications);
    setAvatar('profileAvatar', 'profile-avatar');
    setAvatar('composerAvatar', 'avatar');
    renderShell();
    revealPremiumAdminShortcut();
  }

  const homeExams = {
    bac: { title: 'امتحانات البكالوريا', badge: 'الثانوية العامة', note: 'موعد الفحص: 6 يونيو 2027 · رتّب خطتك اليومية لتصل إلى الموعد بثقة.', target: new Date('2027-06-06T08:00:00').getTime() },
    nine: { title: 'امتحانات التاسع', badge: 'التعليم الأساسي', note: 'موعد الفحص: 2 يونيو 2027 · اجعل المراجعة اليومية عادة ثابتة قبل الموعد.', target: new Date('2027-06-02T08:00:00').getTime() },
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

  function updateCountdownShareButton() {
    const button = $('#shareCountdownImage'); const exam = homeExams[activeExam];
    if (!button || !exam) return;
    button.dataset.examKey = activeExam;
    const label = $('span', button); if (label) label.textContent = `مشاركة صورة ${exam.title}`;
  }
  async function shareExamCountdownImage() {
    const target = $('#examCountdown'); const exam = homeExams[activeExam]; const button = $('#shareCountdownImage');
    if (!target || !exam) return;
    if (typeof window.html2canvas !== 'function') return toast('تعذر تجهيز صورة العداد الآن.');
    const originalLabel = button?.querySelector('span')?.textContent || 'مشاركة صورة العداد';
    if (button) { button.disabled = true; button.classList.add('is-loading'); const label = button.querySelector('span'); if (label) label.textContent = 'جارٍ تجهيز الصورة...'; }
    try {
      const canvas = await window.html2canvas(target, { backgroundColor: getComputedStyle(target).backgroundColor || '#0b1220', scale: Math.min(2, Math.max(1, window.devicePixelRatio || 1)), useCORS: true, logging: false });
      const dataUrl = canvas.toDataURL('image/png');
      const response = await fetch(dataUrl); const blob = await response.blob(); const file = new File([blob], 'nabd-countdown.png', { type: 'image/png' });
      const title = `عداد ${exam.title}`; const text = `أستعد لـ ${exam.title} في منصة نبض التفوق. ${exam.note}`;
      const nativeShare = capacitorPlugin('Share'); const filesystem = capacitorPlugin('Filesystem');
      if (isNativeNabd() && nativeShare?.share && filesystem?.writeFile) {
        const saved = await filesystem.writeFile({ path: `nabd-countdown-${Date.now()}.png`, data: dataUrl.split(',')[1], directory: 'CACHE', recursive: true });
        if (saved?.uri) { await nativeShare.share({ title, text, files: [saved.uri], dialogTitle: 'مشاركة صورة العداد' }); return; }
      }
      if (navigator.canShare?.({ files: [file] }) && navigator.share) { await navigator.share({ title, text, files: [file] }); return; }
      if (navigator.share) { await navigator.share({ title, text }); return; }
      const download = document.createElement('a'); download.href = dataUrl; download.download = 'nabd-countdown.png'; download.click(); await navigator.clipboard?.writeText(text); toast('تم تنزيل صورة PNG ونسخ النص للمشاركة.');
    } catch (error) { if (error?.name !== 'AbortError') toast('تعذر مشاركة صورة العداد حاليًا.'); }
    finally { if (button) { button.disabled = false; button.classList.remove('is-loading'); const label = button.querySelector('span'); if (label) label.textContent = originalLabel; updateCountdownShareButton(); } }
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
    updateCountdownShareButton();
  }

  function setExamCountdownCollapsed(collapsed, persist = true) {
    const wrap = $('#examCountdownWrap'); const toggle = $('#examCountdownToggle');
    if (!wrap || !toggle) return;
    wrap.classList.toggle('is-collapsed', collapsed);
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', collapsed ? 'إظهار عداد الامتحانات' : 'إخفاء عداد الامتحانات');
    toggle.title = collapsed ? 'إظهار عداد الامتحانات' : 'إخفاء عداد الامتحانات';
    toggle.innerHTML = `<i class="fa-solid ${collapsed ? 'fa-chevron-down' : 'fa-chevron-up'}"></i>`;
    if (persist) { try { localStorage.setItem(STORE + 'exam_countdown_collapsed_v2', JSON.stringify(Boolean(collapsed))); } catch { /* يظل السلوك مرئيًا عند تعذر حفظ التفضيل */ } }
  }

  function updateHomeMetrics() {
    const activeTasks = studyTasks.filter(task => !task.completed).length;
    const activePlans = Array.isArray(completionPlans) ? completionPlans.filter(plan => completionProgress(plan) < 100).length : 0;
    const savedResources = Array.isArray(personalLibraryResources) ? personalLibraryResources.length : 0;
    const average = Number(gradeCalculator.lastAverage);
    const taskMetric = $('#homeTaskMetric'); const gradeMetric = $('#homeGradeMetric');
    const setServiceStatus = (id, value) => { const element = $('#' + id); if (element) element.textContent = value; };
    if (taskMetric) taskMetric.textContent = activeTasks ? `${activeTasks} مهام` : 'ابدأ خطتك';
    if (gradeMetric) gradeMetric.textContent = Number.isFinite(average) ? `${average.toFixed(1)}%` : 'احسب نتيجتك';
    setServiceStatus('serviceStatusGrade', Number.isFinite(average) ? `آخر معدل ${average.toFixed(1)}%` : 'اختر النظام المناسب');
    setServiceStatus('serviceStatusSchedule', activeTasks ? `${activeTasks} مهام قيد الإنجاز` : 'أضف أول مهمة');
    setServiceStatus('serviceStatusTests', 'نماذج ونتائج مراجعة');
    setServiceStatus('serviceStatusCompletion', activePlans ? `${activePlans} خطط قيد التنفيذ` : 'أنشئ خطة جديدة');
    setServiceStatus('serviceStatusLibrary', savedResources ? `${savedResources} موارد شخصية` : 'أضف موردك الأول');
  }

  function initHome() {
    updateHomeMetrics();
    if (!$('#homeExamTitle')) return;
    $$('.exam-tab').forEach(tab => tab.addEventListener('click', () => setExam(tab.dataset.exam)));
    $('#customCountdownButton')?.addEventListener('click', () => openNamedModal('customCountdown'));
    $('#shareCountdownImage')?.addEventListener('click', () => { void shareExamCountdownImage(); });
    const storedCollapsed = readStorage('exam_countdown_collapsed_v2', true);
    setExamCountdownCollapsed(Boolean(storedCollapsed), false);
    $('#examCountdownToggle')?.addEventListener('click', () => setExamCountdownCollapsed(!$('#examCountdownWrap')?.classList.contains('is-collapsed')));
    setExam('bac');
    let timer = window.setInterval(() => { if (!document.hidden) updateCountdown(); }, 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) updateCountdown(); });
    window.addEventListener('pagehide', () => window.clearInterval(timer), { once: true });
  }

  const APP_MEDIA_BUCKET = 'notification-assets';

  function mapRemoteNewsPost(row) {
    return {
      id: row.id,
      authorId: row.author_id || '',
      name: row.author_name || 'مشرف نبض',
      meta: row.author_meta || 'إدارة الأخبار · نبض التفوق',
      text: row.body || '',
      images: Array.isArray(row.images) ? row.images : [],
      likes: Number(row.like_count || 0),
      liked: Boolean(row.liked_by_me),
      comments: Array.isArray(row.comments) ? row.comments.map(comment => ({ id: comment.id, authorId: comment.author_id || '', parentId: comment.parent_id || comment.parentId || '', name: comment.name || 'طالب نبض', meta: comment.meta || 'مجتمع الأخبار', text: comment.text || '', mine: Boolean(currentAuthUser && comment.author_id === currentAuthUser.id), verified: false, createdAt: comment.created_at })) : [],
      remote: true,
      mine: Boolean(currentAuthUser && row.author_id === currentAuthUser.id),
      verified: true,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async function loadRemoteNewsPosts(force = false) {
    if (!supabaseClient || (newsRemotePostsLoaded === true && !force)) return;
    const { data, error } = await supabaseClient.rpc('news_list_posts', { p_limit: 100 });
    if (error) throw error;
    posts = Array.isArray(data) ? data.map(mapRemoteNewsPost) : [];
    newsRemotePostsLoaded = true;
  }

  function feedPost(id) {
    return posts.find(post => post.id === id) || null;
  }

  function refreshNewsOwnership() {
    if (!currentAuthUser || PAGE !== 'news') return;
    posts.forEach(post => {
      if (post.authorId) post.mine = post.authorId === currentAuthUser.id;
      (post.comments || []).forEach(comment => {
        if (comment.authorId) comment.mine = comment.authorId === currentAuthUser.id;
      });
    });
    renderFeed();
  }

  function enrichedPost(post) {
    const interaction = postInteractions[post.id] || {};
    return {
      ...post,
      liked: post.remote ? Boolean(post.liked) : Boolean(interaction.liked ?? post.liked),
      likes: post.remote ? Number(post.likes || 0) : (Number.isFinite(interaction.likes) ? interaction.likes : (post.likes || 0)),
      comments: [...(post.comments || []), ...(interaction.comments || [])]
    };
  }

  const NEWS_COLLAPSE_CHARS = 320;

  function newsLinkMarkup(value) {
    const source = String(value ?? '');
    const pattern = /((?:https?:\/\/|www\.)[^\s<]+)/gi;
    let output = '';
    let cursor = 0;
    for (const match of source.matchAll(pattern)) {
      const raw = match[0];
      const start = match.index ?? cursor;
      output += escapeHTML(source.slice(cursor, start));
      const trailing = raw.match(/[),.;:!?؟،؛\]}]+$/)?.[0] || '';
      const clean = trailing ? raw.slice(0, -trailing.length) : raw;
      const href = /^www\./i.test(clean) ? `https://${clean}` : clean;
      output += `<a class="post-link" data-external-url="${escapeHTML(href)}" href="${escapeHTML(href)}" target="_blank" rel="noopener noreferrer">${escapeHTML(clean)}</a>${escapeHTML(trailing)}`;
      cursor = start + raw.length;
    }
    return output + escapeHTML(source.slice(cursor));
  }

  function newsTextMarkup(post) {
    const text = String(post.text || '');
    const isLong = text.length > NEWS_COLLAPSE_CHARS || text.split(/\r?\n/).length > 6;
    const expanded = expandedNewsPosts.has(post.id);
    const copyClass = `post-copy${isLong && !expanded ? ' is-collapsed' : ''}`;
    const readMore = isLong ? `<button type="button" class="read-more-button" data-news-more="${escapeHTML(post.id)}" aria-controls="post-copy-${escapeHTML(post.id)}" aria-expanded="${expanded}">${expanded ? 'إخفاء النص' : 'قراءة المزيد...'}</button>` : '';
    return `<div class="post-content"><span id="post-copy-${escapeHTML(post.id)}" class="${copyClass}">${newsLinkMarkup(text)}</span>${readMore}</div>`;
  }

  function postTemplate(rawPost) {
    const post = enrichedPost(rawPost);
    const avatar = rawPost.mine ? avatarMarkup() : `<span class="avatar">${escapeHTML((post.name || 'ط')[0])}</span>`;
    const verified = rawPost.mine ? student.verificationStatus === 'approved' : Boolean(post.verified);
    const images = (post.images || []).length
      ? `<div class="post-images ${(post.images || []).length > 1 ? 'multiple' : ''}">${post.images.map(src => `<img loading="lazy" src="${escapeHTML(src)}" alt="صورة مرفقة بالمنشور">`).join('')}</div><div class="post-media-indicator">${post.images.length > 1 ? `<i class="fa-solid fa-images"></i> اسحب لمشاهدة الصور ${post.images.length}` : ''}</div>`
      : '';
    const rootComments = post.comments.filter(comment => !comment.parentId);
    const comments = rootComments.map(comment => { const commentVerified = comment.mine ? student.verificationStatus === 'approved' : Boolean(comment.verified); const commentAvatar = comment.mine ? avatarMarkup('comment-avatar') : `<span class="comment-avatar">${escapeHTML((comment.name || 'ط')[0])}</span>`; const replyCount = post.comments.filter(reply => reply.parentId === comment.id).length; return `<div class="comment">${commentAvatar}<div><b>${escapeHTML(comment.name)}${verifiedBadgeMarkup(commentVerified)}</b><p>${newsLinkMarkup(comment.text)}</p>${commentActionsMarkup(comment, post.id, replyCount)}</div></div>`; }).join('');
    const menu = newsIsAdmin ? `<button class="post-menu" type="button" data-action="post-menu" title="إدارة الخبر" aria-label="إدارة الخبر"><i class="fa-solid fa-ellipsis-vertical"></i></button>` : '';
    return `<article class="post ${likePulsePosts.has(post.id) ? 'like-pulse' : ''}" data-post="${escapeHTML(post.id)}"><div class="post-head">${avatar}<div class="post-author"><strong class="post-author-name"><span>${escapeHTML(post.name)}</span>${verifiedBadgeMarkup(verified)}</strong><span>${escapeHTML(post.meta || `${student.stage} · ${student.city}`)} · الآن</span></div>${menu}</div>${newsTextMarkup(post)}${images}<div class="post-insights"><span>${post.likes} إعجاب</span><span>${post.comments.length} تعليق</span></div><div class="post-tools"><button class="tool-button ${post.liked ? 'liked' : ''}" type="button" data-action="like"><i class="${post.liked ? 'fa-solid' : 'fa-regular'} fa-heart"></i> إعجاب</button><button class="tool-button" type="button" data-action="comments"><i class="fa-regular fa-comment"></i> تعليق</button><button class="tool-button" type="button" data-action="share"><i class="fa-solid fa-arrow-up-from-bracket"></i> مشاركة</button></div><div class="comments ${openComments.has(post.id) ? '' : 'hidden'}">${comments}<form class="comment-form"><input required maxlength="280" placeholder="أضف تعليقًا محترمًا..."><button title="إرسال" aria-label="إرسال التعليق"><i class="fa-solid fa-paper-plane"></i></button></form></div></article>`;
  }

  function commentActionsMarkup(comment, postId, replyCount = 0) {
    const replyButton = `<button type="button" class="comment-reply-button" data-comment-reply="${escapeHTML(comment.id || '')}" data-comment-post="${escapeHTML(postId)}" data-comment-name="${escapeHTML(comment.name || 'طالب نبض')}"><i class="fa-solid fa-reply"></i> رد</button>`;
    const repliesButton = replyCount ? `<button type="button" class="comment-replies-button" data-comment-replies="${escapeHTML(comment.id || '')}" data-comment-post="${escapeHTML(postId)}" aria-label="عرض ردود ${escapeHTML(comment.name || 'التعليق')}"><i class="fa-solid fa-comments"></i> عرض الردود <span class="comment-replies-count">${replyCount}</span></button>` : '';
    const deleteButton = comment.mine ? `<button type="button" class="comment-delete-button" data-comment-delete="${escapeHTML(comment.id || '')}" data-comment-post="${escapeHTML(postId)}" aria-label="حذف تعليقي"><i class="fa-regular fa-trash-can"></i> حذف</button>` : '';
    return `<div class="comment-actions">${replyButton}${repliesButton}${deleteButton}</div>`;
  }

  function commentItemMarkup(comment, postId, replies = []) {
    const verified = comment.mine ? student.verificationStatus === 'approved' : Boolean(comment.verified);
    const avatar = comment.mine ? avatarMarkup('comment-avatar') : `<span class="comment-avatar">${escapeHTML((comment.name || 'ط')[0])}</span>`;
    return `<article class="comment-thread-item" data-comment-id="${escapeHTML(comment.id || '')}"><div class="comment-thread-head">${avatar}<div><b>${escapeHTML(comment.name || 'طالب نبض')}${verifiedBadgeMarkup(verified)}</b><small>${escapeHTML(comment.meta || 'مجتمع الأخبار')}</small></div></div><p>${newsLinkMarkup(comment.text || '')}</p>${commentActionsMarkup(comment, postId, replies.length)}</article>`;
  }

  function commentReplyItemMarkup(comment, postId, replyCount = 0) {
    const verified = comment.mine ? student.verificationStatus === 'approved' : Boolean(comment.verified);
    const avatar = comment.mine ? avatarMarkup('comment-avatar') : `<span class="comment-avatar">${escapeHTML((comment.name || 'ط')[0])}</span>`;
    return `<article class="comment-thread-item" data-comment-id="${escapeHTML(comment.id || '')}"><div class="comment-thread-head">${avatar}<div><b>${escapeHTML(comment.name || 'طالب نبض')}${verifiedBadgeMarkup(verified)}</b><small>${escapeHTML(comment.meta || 'مجتمع الأخبار')}</small></div></div><p>${newsLinkMarkup(comment.text || '')}</p>${commentActionsMarkup(comment, postId, replyCount)}</article>`;
  }

  function commentThreadMarkup(post) {
    const comments = post.comments || [];
    const roots = comments.filter(comment => !comment.parentId);
    if (!roots.length) return '<div class="comment-thread-empty"><i class="fa-regular fa-comments"></i><b>ابدأ الحوار</b><span>كن أول من يضيف تعليقًا محترمًا.</span></div>';
    return roots.map(comment => commentItemMarkup(comment, post.id, comments.filter(reply => reply.parentId === comment.id))).join('');
  }

  function openPostComments(postId, replyTo = null, options = {}) {
    const rawPost = feedPost(postId); if (!rawPost) return;
    if (!options.fromHistory) pushNewsModalState('comments', postId);
    const post = enrichedPost(rawPost);
    const replyHint = replyTo ? `<div class="comment-reply-target"><i class="fa-solid fa-reply"></i><span>رد على <b>${escapeHTML(replyTo.name)}</b></span><button type="button" data-clear-comment-reply="${escapeHTML(postId)}" title="إلغاء الرد"><i class="fa-solid fa-xmark"></i></button></div>` : '';
    openModal(`<div class="comments-screen" data-comment-post-id="${escapeHTML(postId)}"><div class="modal-head comments-modal-head"><div class="comments-modal-title"><span class="comment-modal-icon"><i class="fa-regular fa-comments"></i></span><div><span class="eyebrow">مجتمع الأخبار</span><h3>التعليقات</h3><small>${post.comments.length} تعليق · شارك باحترام</small></div></div><button class="close-modal" aria-label="إغلاق">×</button></div><section class="comment-thread-list">${commentThreadMarkup(post)}</section><form class="comment-modal-form" data-post-id="${escapeHTML(postId)}" data-parent-id="${escapeHTML(replyTo?.id || '')}">${replyHint}<div><input name="comment" required maxlength="280" placeholder="اكتب تعليقك..." autocomplete="off"><button type="submit" title="إرسال التعليق"><i class="fa-solid fa-paper-plane"></i></button></div></form></div>`);
  }

  function openPostReplies(postId, commentId, replyTo = null, options = {}) {
    const rawPost = feedPost(postId); if (!rawPost) return;
    if (!options.fromHistory) pushNewsModalState('replies', postId, commentId);
    const post = enrichedPost(rawPost);
    const parent = (post.comments || []).find(comment => comment.id === commentId);
    if (!parent) return;
    const replies = (post.comments || []).filter(comment => comment.parentId === parent.id);
    const replyList = replies.length ? replies.map(reply => commentReplyItemMarkup(reply, postId, (post.comments || []).filter(child => child.parentId === reply.id).length)).join('') : '<div class="comment-thread-empty"><i class="fa-regular fa-comment-dots"></i><b>لا توجد ردود بعد</b><span>كن أول من يرد على هذا التعليق.</span></div>';
    const parentAvatar = parent.mine ? avatarMarkup('comment-avatar') : `<span class="comment-avatar">${escapeHTML((parent.name || 'ط')[0])}</span>`;
    const parentVerified = parent.mine ? student.verificationStatus === 'approved' : Boolean(parent.verified);
    const replyHint = replyTo ? `<div class="comment-reply-target"><i class="fa-solid fa-reply"></i><span>رد على <b>${escapeHTML(replyTo.name || 'التعليق')}</b></span><button type="button" data-clear-comment-reply="${escapeHTML(postId)}" data-return-replies="${escapeHTML(parent.id)}" title="إلغاء الرد"><i class="fa-solid fa-xmark"></i></button></div>` : '<div class="comment-reply-target"><i class="fa-solid fa-reply"></i><span>رد على التعليق الأصلي</span></div>';
    const parentMarkup = `<article class="comment-thread-item comment-replies-origin" data-comment-id="${escapeHTML(parent.id || '')}"><div class="comment-thread-head">${parentAvatar}<div><b>${escapeHTML(parent.name || 'طالب نبض')}${verifiedBadgeMarkup(parentVerified)}</b><small>${escapeHTML(parent.meta || 'مجتمع الأخبار')}</small></div></div><p>${newsLinkMarkup(parent.text || '')}</p>${commentActionsMarkup(parent, postId)}</article>`;
    openModal(`<div class="comment-replies-screen" data-root-comment-id="${escapeHTML(parent.id)}"><div class="modal-head comment-replies-head"><button type="button" class="comment-page-back" data-comments-back="${escapeHTML(postId)}"><i class="fa-solid fa-arrow-right"></i><span>التعليقات</span></button><div class="comments-modal-title"><span class="comment-modal-icon replies-icon"><i class="fa-solid fa-reply"></i></span><div><span class="eyebrow">مجتمع الأخبار</span><h3>الردود</h3><small>${replies.length} رد على التعليق</small></div></div><button class="close-modal" aria-label="إغلاق">×</button></div><section class="comment-replies-body"><div class="comment-replies-label"><i class="fa-solid fa-reply"></i><span>الحوار مستمر هنا</span></div>${parentMarkup}<div class="comment-replies-list">${replyList}</div></section><form class="comment-modal-form" data-post-id="${escapeHTML(postId)}" data-parent-id="${escapeHTML(replyTo?.id || parent.id)}">${replyHint}<div><input name="comment" required maxlength="280" placeholder="اكتب ردك..." autocomplete="off"><button type="submit" title="إرسال الرد"><i class="fa-solid fa-paper-plane"></i></button></div></form></div>`);
  }

  function renderFeed() {
    const feed = $('#feed');
    if (!feed) return;
    const entries = [...posts];
    const visible = entries;
    const listing = visible.length ? visible.map(postTemplate).join('') : '<div class="empty-feed"><i class="fa-regular fa-newspaper"></i><b>لا توجد منشورات منشورة حاليًا.</b><span>ستظهر هنا الأخبار التي ينشرها المشرف.</span></div>';
    feed.innerHTML = listing;
    const postCount = $('#profilePosts');
    if (postCount) postCount.textContent = posts.filter(post => post.mine).length;
  }

  function renderPreview() {
    const preview = $('#composePreview'); const clear = $('#clearImages'); const status = $('#composeImageStatus');
    if (preview) preview.innerHTML = uploadImages.map(source => `<img loading="lazy" src="${source}" alt="معاينة الصورة">`).join('');
    if (clear) clear.hidden = !uploadImages.length;
    if (status) status.textContent = uploadImages.length ? `${uploadImages.length} صورة جاهزة` : '';
  }

  function resizeNewsComposer() {
    const input = $('#postText'); if (!input) return;
    input.style.height = 'auto'; input.style.height = `${Math.min(Math.max(input.scrollHeight, 44), 118)}px`;
    $('#newsComposerDock')?.classList.toggle('has-text', Boolean(input.value.trim()));
  }

  async function uploadNewsImageToStorage(dataUrl) {
    if (!supabaseClient || !currentAuthUser) throw new Error('يلزم تسجيل الدخول لرفع الصورة.');
    const response = await fetch(String(dataUrl));
    if (!response.ok) throw new Error('تعذر تجهيز الصورة للرفع.');
    const blob = await response.blob();
    const mime = blob.type || 'image/jpeg';
    const extension = (mime.split('/')[1] || 'jpeg').replace('jpeg', 'jpg').replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'jpg';
    const uniqueId = typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const path = `news/${currentAuthUser.id}/${uniqueId}.${extension}`;
    const { error } = await supabaseClient.storage.from(APP_MEDIA_BUCKET).upload(path, blob, { cacheControl: '31536000', upsert: false, contentType: mime });
    if (error) throw error;
    const { data } = supabaseClient.storage.from(APP_MEDIA_BUCKET).getPublicUrl(path);
    return data?.publicUrl || null;
  }

  async function publishPost() {
    if (!newsIsAdmin) return toast('المشرف فقط يستطيع نشر الأخبار.');
    const text = $('#postText')?.value.trim() || '';
    if (!text && !uploadImages.length) return toast('اكتب الخبر أو أرفق صورة قبل النشر.');
    if (text.length > 1200) return toast('يرجى اختصار الخبر إلى 1200 حرف أو أقل.');
    const button = $('#publishPost');
    if (button) { button.disabled = true; button.dataset.originalLabel = button.innerHTML; button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; }
    try {
      const images = await Promise.all(uploadImages.map(uploadNewsImageToStorage));
      const { data: postId, error } = await supabaseClient.rpc('news_admin_create_post', { p_body: text, p_images: images });
      if (error) throw error;
      const draft = { id: postId, name: fullName(), meta: `${student.stage} · إدارة الأخبار`, text, images, likes: 0, liked: false, comments: [], remote: true, mine: true, verified: true, createdAt: new Date().toISOString() };
      posts.unshift(draft);
      uploadImages = [];
      const input = $('#postText');
      if (input) { input.value = ''; input.style.height = ''; }
      renderPreview();
      resizeNewsComposer();
      renderFeed();
      updateProfileUI();
      toast('تم نشر الخبر وحفظ الصور بنجاح.');
    } catch (error) {
      toast(error.message || 'تعذر نشر الخبر.');
    } finally {
      if (button) { button.disabled = false; button.innerHTML = button.dataset.originalLabel || '<i class="fa-solid fa-paper-plane"></i>'; }
    }
  }

  async function toggleLike(postId) {
    const post = feedPost(postId);
    if (!post) return;
    if (post.remote) {
      try {
        const { data, error } = await supabaseClient.rpc('news_toggle_like', { p_post_id: postId });
        if (error) throw error;
        const result = Array.isArray(data) ? data[0] : data;
        post.liked = Boolean(result?.liked);
        post.likes = Number(result?.like_count || 0);
        if (post.liked) { likePulsePosts.add(postId); window.setTimeout(() => { likePulsePosts.delete(postId); renderFeed(); }, 360); }
        renderFeed();
      } catch (error) {
        toast(error.message || 'تعذر حفظ الإعجاب حاليًا.');
      }
      return;
    }
    const current = enrichedPost(post);
    const next = { liked: !current.liked, likes: Math.max(0, current.likes + (current.liked ? -1 : 1)), comments: postInteractions[postId]?.comments || [] };
    post.liked = next.liked;
    post.likes = next.likes;
    if (next.liked) { likePulsePosts.add(postId); window.setTimeout(() => { likePulsePosts.delete(postId); renderFeed(); }, 360); }
    saveState();
    renderFeed();
  }

  async function sharePost(postId) {
    const post = feedPost(postId);
    const text = String(post?.text || '').trim();
    if (!text) return toast('لا يوجد نص في هذا المنشور لمشاركته.');
    const payload = { text };
    try {
      const nativeShare = capacitorPlugin('Share');
      if (isNativeNabd() && nativeShare?.share) { await nativeShare.share(payload); return; }
      if (navigator.share) await navigator.share(payload);
      else if (navigator.clipboard) { await navigator.clipboard.writeText(text); toast('تم نسخ محتوى المنشور.'); }
      else toast('ميزة المشاركة متاحة عند نشر التطبيق على الهاتف.');
    } catch (error) {
      if (error.name !== 'AbortError') toast('تعذر تنفيذ المشاركة حاليًا.');
    }
  }

  function openPostMenu(postId) {
    const post = posts.find(item => item.id === postId);
    if (!newsIsAdmin || !post?.remote) return toast('المشرف فقط يستطيع إدارة الأخبار.');
    openModal(`<div class="modal-head"><div><span class="eyebrow">خيارات الخبر</span><h3>إدارة خبر المشرف</h3></div><button class="close-modal" aria-label="إغلاق">×</button></div><div class="post-management-menu"><button type="button" data-news-manage="edit" data-post-id="${escapeHTML(post.id)}"><i class="fa-solid fa-pen"></i><span><b>تعديل الخبر</b><small>تحديث النص مع الاحتفاظ بالصور الحالية</small></span></button><button type="button" class="danger" data-news-manage="delete" data-post-id="${escapeHTML(post.id)}"><i class="fa-regular fa-trash-can"></i><span><b>حذف الخبر</b><small>حذفه نهائيًا من الأخبار وقاعدة البيانات</small></span></button></div>`);
  }

  function openPostEditor(postId) {
    const post = posts.find(item => item.id === postId); if (!newsIsAdmin || !post?.remote) return;
    openModal(`<div class="modal-head"><div><span class="eyebrow">تعديل الخبر</span><h3>تحديث خبر المشرف</h3></div><button class="close-modal" aria-label="إغلاق">×</button></div><form id="postEditForm" data-post-id="${escapeHTML(post.id)}"><div class="form-group full"><label>نص الخبر</label><textarea name="text" maxlength="1200" placeholder="يمكنك إبقاء الخبر بصورة فقط">${escapeHTML(post.text || '')}</textarea></div><p class="sheet-hint">تبقى الصور الحالية محفوظة كما هي عند تعديل النص.</p><div class="form-actions"><button class="outline-button close-modal" type="button">إلغاء</button><button class="primary-button" type="submit"><i class="fa-solid fa-floppy-disk"></i> حفظ التعديل</button></div></form>`);
  }

  async function savePostEdit(form) {
    const post = posts.find(item => item.id === form.dataset.postId); const text = String(new FormData(form).get('text') || '').trim();
    if (!newsIsAdmin || !post?.remote) return toast('المشرف فقط يستطيع تعديل الأخبار.');
    if (!text && !(post.images || []).length) return toast('اكتب الخبر أو أرفق صورة قبل الحفظ.');
    const submit = form.querySelector('[type="submit"]');
    if (submit) { submit.disabled = true; submit.dataset.originalLabel = submit.innerHTML; submit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جارٍ الحفظ'; }
    try {
      const { data, error } = await supabaseClient.rpc('news_admin_update_post', { p_post_id: post.id, p_body: text, p_images: post.images || [] });
      if (error) throw error;
      if (data !== true) throw new Error('لم يتم العثور على الخبر.');
      post.text = text;
      post.updatedAt = new Date().toISOString();
      closeModal();
      renderFeed();
      toast('تم تعديل الخبر وحفظه بنجاح.');
    } catch (error) {
      toast(error.message || 'تعذر تعديل الخبر حاليًا.');
    } finally {
      if (submit) { submit.disabled = false; submit.innerHTML = submit.dataset.originalLabel || '<i class="fa-solid fa-floppy-disk"></i> حفظ التعديل'; }
    }
  }

  function deleteNewsPost(postId) {
    const post = posts.find(item => item.id === postId); if (!newsIsAdmin || !post?.remote) return toast('المشرف فقط يستطيع حذف الأخبار.');
    confirmAction('حذف الخبر؟', 'سيتم حذف الخبر نهائيًا من المنصة، وتبقى الإعجابات والتعليقات المرتبطة به محذوفة تلقائيًا.', async () => {
      try {
        const { data, error } = await supabaseClient.rpc('news_admin_delete_post', { p_post_id: postId });
        if (error) throw error;
        if (data !== true) throw new Error('لم يتم العثور على الخبر.');
        posts = posts.filter(item => item.id !== postId);
        openComments.delete(postId);
        renderFeed();
        toast('تم حذف الخبر نهائيًا.');
      } catch (error) {
        toast(error.message || 'تعذر حذف الخبر حاليًا.');
      }
    }, 'حذف الخبر');
  }

  async function addComment(form) {
    const postId = form.dataset.postId || form.closest('[data-post]')?.dataset.post;
    const parentId = String(form.dataset.parentId || '');
    const post = feedPost(postId);
    const input = $('input[name="comment"], input', form);
    const text = input?.value.trim();
    if (!post || !text) return;
    const submit = $('button[type="submit"], button', form);
    if (submit) submit.disabled = true;
    const localComment = { id: `comment-${Date.now()}-${Math.random().toString(16).slice(2)}`, parentId, name: fullName(), meta: `${student.stage} · ${student.city}`, text, mine: true, verified: student.verificationStatus === 'approved', createdAt: new Date().toISOString() };
    try {
      if (post.remote) {
        let result = null;
        const response = await supabaseClient.rpc('news_add_comment_with_reply', { p_post_id: postId, p_body: text, p_parent_id: parentId || null });
        if (!response.error) result = Array.isArray(response.data) ? response.data[0] : response.data;
        if (response.error || !result) {
          if (parentId) throw response.error || new Error('تعذر حفظ الرد في قاعدة البيانات.');
          const legacy = await supabaseClient.rpc('news_add_comment', { p_post_id: postId, p_body: text });
          if (legacy.error) throw legacy.error;
          result = Array.isArray(legacy.data) ? legacy.data[0] : legacy.data;
        }
        if (!result) throw new Error('تعذر حفظ التعليق.');
        post.comments = [...(post.comments || []), { ...localComment, id: result.id || localComment.id, parentId: result.parent_id || parentId, name: result.name || localComment.name, meta: result.meta || localComment.meta, text: result.text || localComment.text, createdAt: result.created_at || localComment.createdAt }];
      } else {
        postInteractions[postId] = { ...(postInteractions[postId] || {}), comments: [...(postInteractions[postId]?.comments || []), localComment] };
        saveState();
      }
      input.value = '';
      renderFeed();
      if (form.matches('.comment-modal-form')) {
        const repliesScreen = form.closest('.comment-replies-screen');
        if (repliesScreen) openPostReplies(postId, repliesScreen.dataset.rootCommentId);
        else openPostComments(postId);
      }
    } catch (error) {
      toast(parentId ? (error.message || 'تعذر حفظ الرد في قاعدة البيانات حاليًا.') : (error.message || 'تعذر حفظ التعليق حاليًا.'));
    } finally {
      if (submit) submit.disabled = false;
    }
  }

  async function deleteComment(postId, commentId) {
    const post = feedPost(postId);
    const comment = enrichedPost(post || {}).comments.find(item => item.id === commentId);
    if (!post || !comment) return;
    if (!comment.mine) return toast('لا يمكنك حذف إلا تعليقاتك الخاصة.');
    confirmAction('حذف تعليقك؟', 'سيتم حذف التعليق وجميع الردود التابعة له نهائيًا من الأخبار.', async () => {
      try {
        if (post.remote) {
          const { data, error } = await supabaseClient.rpc('news_delete_comment', { p_comment_id: commentId });
          if (error) throw error;
          if (data !== true) throw new Error('لم يتم العثور على التعليق أو لا تملك صلاحية حذفه.');
        }
        const comments = post.remote ? (post.comments || []) : (postInteractions[postId]?.comments || []);
        const removedIds = new Set([commentId]);
        let changed = true;
        while (changed) {
          changed = false;
          comments.forEach(item => { if (item.parentId && removedIds.has(item.parentId) && !removedIds.has(item.id)) { removedIds.add(item.id); changed = true; } });
        }
        if (post.remote) post.comments = comments.filter(item => !removedIds.has(item.id));
        else {
          postInteractions[postId] = { ...(postInteractions[postId] || {}), comments: comments.filter(item => !removedIds.has(item.id)) };
          saveState();
        }
        const repliesScreen = $('.comment-replies-screen');
        renderFeed();
        if (repliesScreen && repliesScreen.dataset.rootCommentId !== commentId) openPostReplies(postId, repliesScreen.dataset.rootCommentId);
        else if (repliesScreen) closeModal();
        else openPostComments(postId);
        toast('تم حذف تعليقك بنجاح.');
      } catch (error) {
        toast(error.message || 'تعذر حذف التعليق حاليًا.');
      }
    }, 'حذف التعليق');
  }

  function elevateNewsComposer() {
    const dock = $('#newsComposerDock');
    if (!dock || dock.dataset.viewportLayer === 'true') return;
    document.body.append(dock);
    dock.dataset.viewportLayer = 'true';
  }

  async function initNews() {
    if (!$('#feed')) return;
    elevateNewsComposer();
    const dock = $('#newsComposerDock');
    if (dock) dock.hidden = true;
    const cachedPosts = posts.slice();

    // اعرض المحتوى المحلي فورًا، ولا تجعل طلبات الأخبار حاجزًا أمام بقية الصفحة.
    renderFeed();
    if (document.body.dataset.newsComposerBound !== 'true') {
      document.body.dataset.newsComposerBound = 'true';
      $('#publishPost')?.addEventListener('click', publishPost);
      $('#clearImages')?.addEventListener('click', () => { uploadImages = []; renderPreview(); });
      $('#postImages')?.addEventListener('change', event => {
        const files = [...event.target.files].slice(0, 2);
        const invalid = files.some(file => file.size > 700 * 1024);
        if (invalid) { event.target.value = ''; return toast('اختر حتى صورتين، وحجم كل صورة لا يتجاوز 700 كيلوبايت.'); }
        Promise.all(files.map(file => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }))).then(images => { uploadImages = images; renderPreview(); }).catch(() => toast('تعذر قراءة الصور المحددة.'));
      });
      $('#postText')?.addEventListener('input', resizeNewsComposer);
    }
    resizeNewsComposer();

    if (!supabaseClient) return;
    try {
      await loadRemoteNewsPosts();
      const { data, error } = await supabaseClient.rpc('premium_is_admin');
      newsIsAdmin = !error && data === true;
    } catch (error) {
      // احتفظ بالنسخة المحلية عند بطء الشبكة أو فشل الطلب بدل إفراغ القسم.
      newsIsAdmin = false;
      posts = cachedPosts;
      console.warn('تعذر تحديث أخبار المشرف؛ تم الإبقاء على النسخة المحلية.', error);
    }
    document.body.classList.toggle('news-admin', newsIsAdmin);
    if (dock) dock.hidden = !newsIsAdmin;
    renderFeed();
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
    const mode = $('#gallerySort')?.value || 'newest'; const query = String($('#gallerySearch')?.value || '').trim().toLowerCase();
    const items = studyGallery.filter(photo => !query || `${photo.category || 'أخرى'} ${photo.date} ${galleryDateLabel(photo.date)}`.toLowerCase().includes(query));
    if (mode === 'manual') return items;
    return items.sort((first, second) => mode === 'oldest' ? first.date.localeCompare(second.date) : second.date.localeCompare(first.date));
  }

  function renderGallery() {
    const gallery = $('#studyGallery'); const count = $('#galleryCount'); if (!gallery) return;
    const visiblePhotos = orderedGallery(); if (count) count.textContent = `${studyGallery.length} صورة${studyGallery.length ? ` · ${visiblePhotos.length} ظاهرة` : ''}`;
    if (!studyGallery.length) { gallery.innerHTML = '<div class="gallery-empty"><i class="fa-regular fa-images"></i><b>ألبومك الدراسي جاهز</b><span>ارفع صور ملخصاتك أو لوحاتك، وستظهر مرتبة حسب اليوم هنا.</span></div>'; return; }
    if (!visiblePhotos.length) { gallery.innerHTML = '<div class="gallery-empty"><i class="fa-solid fa-magnifying-glass"></i><b>لا توجد صور مطابقة</b><span>جرّب البحث باسم تصنيف آخر أو بتاريخ مختلف.</span></div>'; return; }
    const grouped = visiblePhotos.reduce((groups, photo) => { (groups[photo.date] ||= []).push(photo); return groups; }, {});
    gallery.innerHTML = Object.entries(grouped).map(([date, photos]) => `<section class="gallery-day"><header><div><i class="fa-regular fa-calendar"></i><b>${galleryDateLabel(date)}</b></div><span>${photos.length} صور</span></header><div class="gallery-grid">${photos.map(photo => `<article class="study-photo"><button type="button" class="gallery-image-open" data-gallery-image="${photo.id}" title="عرض الصورة بالحجم الكامل"><img loading="lazy" src="${photo.src}" alt="صورة دراسية بتاريخ ${escapeHTML(date)}"><em>${escapeHTML(photo.category || 'أخرى')}</em></button><div class="gallery-image-actions"><button type="button" data-gallery-share="${photo.id}" title="مشاركة الصورة"><i class="fa-solid fa-share-nodes"></i></button><button type="button" data-gallery-move="${photo.id}" data-direction="up" title="تقديم الصورة"><i class="fa-solid fa-arrow-up"></i></button><button type="button" data-gallery-move="${photo.id}" data-direction="down" title="تأخير الصورة"><i class="fa-solid fa-arrow-down"></i></button><button type="button" class="gallery-image-remove" data-gallery-remove="${photo.id}" title="حذف الصورة"><i class="fa-solid fa-xmark"></i></button></div></article>`).join('')}</div></section>`).join('');
  }

  function openGalleryImage(id) {
    const photo = studyGallery.find(item => item.id === id); if (!photo) return; const position = studyGallery.findIndex(item => item.id === id);
    openModal(`<div class="modal-head"><div><span class="eyebrow">${escapeHTML(photo.category || 'أخرى')}</span><h3>صورة دراسية</h3></div><button class="close-modal" aria-label="إغلاق">×</button></div><div class="image-viewer"><img src="${photo.src}" alt="صورة دراسية"><span><i class="fa-regular fa-calendar"></i> ${galleryDateLabel(photo.date)}</span></div><div class="gallery-viewer-actions"><button class="outline-button" type="button" data-gallery-nav="previous" data-gallery-current="${photo.id}" ${position <= 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-right"></i> السابقة</button><button class="outline-button" type="button" data-gallery-share="${photo.id}"><i class="fa-solid fa-share-nodes"></i> مشاركة</button><button class="outline-button" type="button" data-gallery-nav="next" data-gallery-current="${photo.id}" ${position >= studyGallery.length - 1 ? 'disabled' : ''}>التالية <i class="fa-solid fa-arrow-left"></i></button></div>`);
  }

  async function shareGalleryImage(id) {
    const photo = studyGallery.find(item => item.id === id); if (!photo) return;
    const title = `صورة دراسية · ${photo.category || 'أخرى'}`; const text = `صورة دراسية محفوظة بتاريخ ${galleryDateLabel(photo.date)} ضمن منصة نبض التفوق.`;
    try {
      const response = await fetch(photo.src); const blob = await response.blob(); const file = new File([blob], 'nabd-study-image.jpg', { type: blob.type || 'image/jpeg' });
      if (navigator.canShare?.({ files: [file] }) && navigator.share) { await navigator.share({ title, text, files: [file] }); return; }
      const nativeShare = capacitorPlugin('Share'); if (isNativeNabd() && nativeShare?.share) { await nativeShare.share({ title, text, dialogTitle: 'مشاركة صورة دراسية' }); return; }
      if (navigator.share) { await navigator.share({ title, text }); return; }
      await navigator.clipboard?.writeText(text); toast('تم نسخ وصف الصورة للمشاركة.');
    } catch (error) { if (error?.name !== 'AbortError') toast('تعذر مشاركة الصورة حاليًا.'); }
  }

  function navigateGalleryImage(id, direction) { const index = studyGallery.findIndex(item => item.id === id); const next = studyGallery[index + (direction === 'next' ? 1 : -1)]; if (next) openGalleryImage(next.id); }

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
    $('#gallerySearch')?.addEventListener('input', renderGallery);
    upload.addEventListener('change', event => {
      const files = [...event.target.files].slice(0, 4);
      if (!files.length) return;
      if (studyGallery.length + files.length > 12) { event.target.value = ''; return toast('يمكن حفظ 12 صورة دراسية كحد أقصى. احذف صورة ثم حاول مجددًا.'); }
      if (files.some(file => !file.type.startsWith('image/') || file.size > 650 * 1024)) { event.target.value = ''; return toast('اختر صورًا صالحة بحجم لا يتجاوز 650 كيلوبايت للصورة.'); }
      const before = [...studyGallery];
      Promise.all(files.map(file => new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(file); }))).then(images => {
        const selectedDate = date?.value || dateInputValue(); const category = $('#galleryCategory')?.value || 'أخرى';
        studyGallery = images.map((src, index) => ({ id: `study-${Date.now()}-${index}`, src, date: selectedDate, category })).concat(studyGallery);
        if (!saveGallery()) { studyGallery = before; return; }
        event.target.value = '';
        renderGallery();
        toast(`تمت إضافة ${images.length} صور إلى الأرشيف الدراسي.`);
      });
    });
    $('#galleryClear')?.addEventListener('click', () => {
      if (!studyGallery.length) return toast('لا توجد صور لحذفها.');
      confirmAction('حذف الألبوم الدراسي؟', 'سيتم حذف الصور الدراسية المحفوظة على هذا الجهاز فقط.', () => { studyGallery = []; saveGallery(); renderGallery(); toast('تم إفراغ الألبوم الدراسي.'); });
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

  const gradeLabel = average => average >= 85 ? 'ممتاز' : average >= 65 ? 'جيد' : average >= 50 ? 'مقبول' : 'بحاجة إلى تحسين';

  function updateGradeSummary() {
    const average = Number(gradeCalculator.lastAverage);
    const savedMarkCount = Object.values(gradeCalculator.marks || {}).filter(value => String(value ?? '').trim() !== '').length;
    const fallbackSubjectCount = gradeCalculator.mode === 'custom' ? customGradeSubjects().length : savedMarkCount;
    const subjectCount = Number(gradeCalculator.lastSubjectCount || fallbackSubjectCount || 0);
    const summaryAverage = $('#gradeSummaryAverage'); const summarySubjects = $('#gradeSummarySubjects');
    if (summaryAverage) summaryAverage.textContent = Number.isFinite(average) ? `${average.toFixed(1)}%` : '—';
    if (summarySubjects) summarySubjects.textContent = subjectCount || 0;
  }

  function showGradeResult({ average, totalScore, totalMax, subjectCount, label, detail, weighted = false }) {
    const result = $('#gradeResult'); if (!result) return;
    const resultClass = average >= 85 ? 'excellent' : average >= 65 ? 'good' : average >= 50 ? 'pass' : 'needs-work';
    result.className = `grade-result panel ${resultClass}`;
    result.innerHTML = `<div class="grade-result-icon"><i class="fa-solid fa-chart-line"></i></div><div class="grade-result-copy"><span>معدلك الحالي</span><b>${average.toFixed(2)}<small> / 100</small></b><p>${escapeHTML(detail)}</p><div class="grade-result-breakdown"><span><b>${Number(totalScore).toFixed(1)}</b><small>${weighted ? 'إجمالي العلامات المرجّحة' : 'مجموع العلامات'}</small></span><span><b>${Number(totalMax).toFixed(1)}</b><small>${weighted ? 'إجمالي الأوزان الممكنة' : 'المجموع التام'}</small></span><span><b>${subjectCount}</b><small>مواد محسوبة</small></span></div></div><div class="grade-result-tag">${escapeHTML(label || gradeLabel(average))}</div>`;
    result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function renderGradeSubjects() {
    const select = $('#gradeStage'); const container = $('#gradeSubjects');
    if (!select || !container) return;
    const stage = select.value || defaultGradeStage(); const curriculum = gradeCurricula[stage];
    gradeCalculator.stage = stage; gradeCalculator.marks ||= {};
    const title = $('#gradeTitle'); const count = $('#gradeSubjectCount');
    if (title) title.textContent = curriculum.title;
    if (count) count.textContent = `${curriculum.subjects.length} مواد`;
    container.innerHTML = curriculum.subjects.map((subject, index) => `<label class="grade-subject"><span><b>${escapeHTML(subject.name)}</b><small>التامة ${subject.max} · حد الكسر ${subject.pass}</small></span><input class="grade-input" data-subject="${escapeHTML(subject.name)}" data-max="${subject.max}" data-pass="${subject.pass}" type="number" inputmode="decimal" min="0" max="${subject.max}" step="0.01" placeholder="/ ${subject.max}" value="${gradeCalculator.marks[subject.name] ?? ''}"><i>${String(index + 1).padStart(2, '0')}</i></label>`).join('');
  }

  function calculateGrade() {
    const inputs = $$('.grade-input');
    const values = inputs.map(input => ({ subject: input.dataset.subject, raw: input.value.trim(), value: Number(input.value), max: Number(input.dataset.max), pass: Number(input.dataset.pass) })).filter(item => item.raw !== '' && Number.isFinite(item.value) && item.value >= 0 && item.value <= item.max);
    if (!values.length) return toast('أدخل علامة مادة واحدة على الأقل لعرض المعدل.');
    const totalScore = values.reduce((sum, item) => sum + item.value, 0); const totalMax = values.reduce((sum, item) => sum + item.max, 0);
    const average = (totalScore / totalMax) * 100; const passedSubjects = values.filter(item => item.value >= item.pass).length;
    gradeCalculator.marks = Object.fromEntries(inputs.map(input => [input.dataset.subject, input.value]));
    gradeCalculator.lastAverage = average; gradeCalculator.lastSubjectCount = values.length; gradeCalculator.mode = 'official';
    saveGradeCalculator(); updateGradeSummary();
    showGradeResult({ average, totalScore, totalMax, subjectCount: values.length, label: gradeLabel(average), detail: `مجموعك الحالي ${totalScore.toFixed(0)} من ${totalMax.toFixed(0)} عبر ${values.length} مواد، وقد تجاوزت حد الكسر في ${passedSubjects} مواد.` });
  }

  function customGradeSubjects() { return Array.isArray(gradeCalculator.customSubjects) ? gradeCalculator.customSubjects : []; }

  function renderCustomGradeSubjects() {
    const list = $('#customGradeList'); const count = $('#customGradeCount'); if (!list) return;
    const subjects = customGradeSubjects(); if (count) count.textContent = `${subjects.length} مواد`;
    list.innerHTML = subjects.length ? subjects.map((subject, index) => `<article class="custom-grade-row"><span class="custom-grade-index">${String(index + 1).padStart(2, '0')}</span><div><b>${escapeHTML(subject.name)}</b><small>${Number(subject.score).toFixed(1)} من ${Number(subject.max).toFixed(1)} · وزن ${Number(subject.weight).toFixed(1)}</small></div><b class="custom-grade-percent">${((Number(subject.score) / Number(subject.max)) * 100).toFixed(1)}%</b><button type="button" data-custom-grade-remove="${escapeHTML(subject.id)}" aria-label="حذف مادة ${escapeHTML(subject.name)}"><i class="fa-solid fa-xmark"></i></button></article>`).join('') : `<div class="custom-grade-empty"><i class="fa-solid fa-layer-group"></i><div><b>لم تضف موادًا بعد</b><small>أضف أول مادة ثم احسب المعدل المرجّح.</small></div></div>`;
  }

  function setGradeMode(mode, persist = true) {
    const chosen = mode === 'custom' ? 'custom' : 'official'; gradeCalculator.mode = chosen;
    $('#gradeOfficialView')?.classList.toggle('hidden', chosen !== 'official'); $('#gradeCustomView')?.classList.toggle('hidden', chosen !== 'custom');
    $$('[data-grade-mode]').forEach(button => button.classList.toggle('active', button.dataset.gradeMode === chosen));
    $('#gradeResult')?.classList.add('hidden'); if (persist) saveGradeCalculator();
  }

  function addCustomGradeSubject(form) {
    const data = new FormData(form); const name = String(data.get('name') || '').trim(); const score = Number(data.get('score')); const max = Number(data.get('max')); const weight = Number(data.get('weight'));
    if (!name || !Number.isFinite(score) || !Number.isFinite(max) || !Number.isFinite(weight) || score < 0 || max <= 0 || score > max || weight <= 0) return toast('تحقق من اسم المادة والعلامة والوزن قبل الإضافة.');
    gradeCalculator.customSubjects = [...customGradeSubjects(), { id: `custom-grade-${Date.now()}-${Math.random().toString(16).slice(2)}`, name, score, max, weight }];
    saveGradeCalculator(); form.reset(); form.elements.max.value = '100'; form.elements.weight.value = '1'; renderCustomGradeSubjects(); updateGradeSummary(); toast('تمت إضافة المادة إلى قائمتك.');
  }

  function calculateCustomGrade() {
    const subjects = customGradeSubjects(); if (!subjects.length) return toast('أضف مادة واحدة على الأقل لحساب المعدل.');
    const weightedScore = subjects.reduce((sum, subject) => sum + ((Number(subject.score) / Number(subject.max)) * 100 * Number(subject.weight)), 0); const totalWeight = subjects.reduce((sum, subject) => sum + Number(subject.weight), 0);
    const average = weightedScore / totalWeight; gradeCalculator.lastAverage = average; gradeCalculator.lastSubjectCount = subjects.length; gradeCalculator.mode = 'custom'; saveGradeCalculator(); updateGradeSummary();
    showGradeResult({ average, totalScore: weightedScore, totalMax: totalWeight * 100, subjectCount: subjects.length, label: gradeLabel(average), weighted: true, detail: `حُسب المعدل من نسب المواد بعد ضرب كل مادة بوزنها أو عدد ساعاتها. مجموع الأوزان المستخدمة ${totalWeight.toFixed(1)}.` });
  }

  function initCalculator() {
    const select = $('#gradeStage'); if (!select) return;
    select.value = defaultGradeStage(); renderGradeSubjects(); renderCustomGradeSubjects(); updateGradeSummary(); setGradeMode(gradeCalculator.mode || 'official', false);
    select.addEventListener('change', () => { gradeCalculator.marks = {}; renderGradeSubjects(); saveGradeCalculator(); $('#gradeResult')?.classList.add('hidden'); });
    $('#gradeForm')?.addEventListener('submit', event => { event.preventDefault(); calculateGrade(); });
    $('#gradeReset')?.addEventListener('click', () => { gradeCalculator.marks = {}; saveGradeCalculator(); renderGradeSubjects(); $('#gradeResult')?.classList.add('hidden'); updateGradeSummary(); toast('تم مسح العلامات المدخلة.'); });
    $$('[data-grade-mode]').forEach(button => button.addEventListener('click', () => setGradeMode(button.dataset.gradeMode)));
    $('#customGradeSubjectForm')?.addEventListener('submit', event => { event.preventDefault(); addCustomGradeSubject(event.currentTarget); });
    $('#customGradeList')?.addEventListener('click', event => { const remove = event.target.closest('[data-custom-grade-remove]'); if (!remove) return; gradeCalculator.customSubjects = customGradeSubjects().filter(subject => subject.id !== remove.dataset.customGradeRemove); saveGradeCalculator(); renderCustomGradeSubjects(); updateGradeSummary(); });
    $('#customGradeReset')?.addEventListener('click', () => { if (!customGradeSubjects().length) return; confirmAction('مسح المواد المخصصة؟', 'سيُحذف جدول المواد المخصصة المحفوظ على هذا الجهاز.', () => { gradeCalculator.customSubjects = []; saveGradeCalculator(); renderCustomGradeSubjects(); updateGradeSummary(); $('#gradeResult')?.classList.add('hidden'); }, 'مسح المواد'); });
    $('#customGradeCalculate')?.addEventListener('click', calculateCustomGrade);
  }

  const testCatalogData = [
    { id: 'physics-motion', title: 'مراجعة الحركة والقوى', subject: 'الفيزياء', category: 'science', level: 'متوسط', duration: 8, score: 20, questions: [
      { text: 'ما وحدة قياس القوة في النظام الدولي؟', options: ['نيوتن', 'جول', 'واط', 'باسكال'], correct: 0, explain: 'القوة تقاس بوحدة النيوتن (N).' },
      { text: 'تزداد سرعة جسم عندما تكون محصلة القوى المؤثرة عليه:', options: ['تساوي صفرًا', 'غير متوازنة', 'ثابتة عند الصفر', 'معدومة دائمًا'], correct: 1, explain: 'القوة المحصلة غير الصفرية تسبب تسارعًا، أي تغيرًا في السرعة أو الاتجاه.' },
      { text: 'أي كمية مما يلي تعد كمية متجهة؟', options: ['الزمن', 'الكتلة', 'الإزاحة', 'الطاقة'], correct: 2, explain: 'الإزاحة تحتاج مقدارًا واتجاهًا، لذلك هي كمية متجهة.' }
    ] },
    { id: 'arabic-grammar', title: 'أساسيات النحو العربي', subject: 'اللغة العربية', category: 'language', level: 'أساسي', duration: 7, score: 20, questions: [
      { text: 'الاسم الذي يأتي بعد حرف الجر يسمى:', options: ['مبتدأ', 'مفعولًا به', 'اسمًا مجرورًا', 'خبرًا'], correct: 2, explain: 'كل اسم يأتي بعد حرف جر يكون مجرورًا.' },
      { text: 'في الجملة «كتبَ الطالبُ الدرسَ»، كلمة «الطالبُ» هي:', options: ['فاعل', 'مفعول به', 'خبر', 'حال'], correct: 0, explain: 'الطالب هو من قام بالفعل، لذا يعرب فاعلًا مرفوعًا.' },
      { text: 'أي الكلمات التالية فعل مضارع؟', options: ['درسَ', 'يدرسُ', 'اُدرسْ', 'دراسةٌ'], correct: 1, explain: 'يدرس فعل مضارع يدل على الحاضر أو المستقبل.' }
    ] },
    { id: 'math-functions', title: 'الدوال والمعادلات', subject: 'الرياضيات', category: 'science', level: 'متقدم', duration: 10, score: 30, questions: [
      { text: 'حل المعادلة 2س + 6 = 14 هو:', options: ['2', '3', '4', '5'], correct: 2, explain: 'بطرح 6 نحصل على 2س = 8، وبالتالي س = 4.' },
      { text: 'الدالة التي تربط كل عنصر من المجال بعنصر واحد فقط في المجال المقابل تسمى:', options: ['علاقة عكسية', 'دالة', 'متباينة', 'متجهة'], correct: 1, explain: 'هذا هو تعريف الدالة.' },
      { text: 'قيمة س² عند س = -3 هي:', options: ['-9', '6', '9', '3'], correct: 2, explain: 'تربيع العدد السالب يعطي قيمة موجبة: (-3)² = 9.' }
    ] },
    { id: 'general-study', title: 'مهارات الدراسة الذكية', subject: 'مهارات عامة', category: 'general', level: 'أساسي', duration: 5, score: 15, questions: [
      { text: 'أفضل خطوة عند مواجهة درس طويل هي:', options: ['تأجيله دائمًا', 'تقسيمه إلى أجزاء قصيرة', 'قراءته مرة واحدة بسرعة', 'حفظه دون فهم'], correct: 1, explain: 'تقسيم الدرس إلى أهداف قصيرة يجعل المتابعة أسهل وأكثر واقعية.' },
      { text: 'أي ممارسة تساعد على تثبيت التعلم؟', options: ['الاسترجاع النشط', 'تجنب الأسئلة', 'القراءة دون توقف', 'إلغاء المراجعة'], correct: 0, explain: 'استرجاع الفكرة والإجابة عنها يساعد على كشف ما تحتاجه من مراجعة.' },
      { text: 'متى يُفضل مراجعة أخطاء الاختبار؟', options: ['بعد الحصول على النتيجة مباشرة', 'بعد شهر دون ملاحظات', 'لا حاجة لمراجعتها', 'قبل بدء الاختبار فقط'], correct: 0, explain: 'المراجعة المباشرة تربط الخطأ بتفسيره وتساعد على منع تكراره.' }
    ] }
  ];
  let activeTestFilter = 'all'; let activeTestId = ''; let activeTestIndex = 0; let activeTestAnswers = {};
  const savedTestHistory = () => { const history = readStorage('test_history', []); return Array.isArray(history) ? history : []; };
  const saveTestHistory = history => { try { localStorage.setItem(STORE + 'test_history', JSON.stringify(history.slice(0, 20))); } catch { toast('تعذر حفظ نتيجة الاختبار محليًا.'); } };
  const activeTest = () => testCatalogData.find(test => test.id === activeTestId);

  function renderTestCatalog() {
    const catalog = $('#testCatalog'); if (!catalog) return;
    const query = String($('#testSearch')?.value || '').trim().toLowerCase();
    const filtered = testCatalogData.filter(test => (activeTestFilter === 'all' || test.category === activeTestFilter) && `${test.title} ${test.subject} ${test.level}`.toLowerCase().includes(query));
    const history = savedTestHistory(); const best = history.reduce((highest, record) => Math.max(highest, Number(record.percentage) || 0), 0);
    if ($('#testAvailableCount')) $('#testAvailableCount').textContent = testCatalogData.length;
    if ($('#testBestScore')) $('#testBestScore').textContent = history.length ? `${best.toFixed(0)}%` : '—';
    catalog.innerHTML = filtered.length ? filtered.map(test => { const previous = history.find(record => record.testId === test.id); return `<article class="test-card"><div class="test-card-top"><span class="test-subject-chip ${escapeHTML(test.category)}">${escapeHTML(test.subject)}</span><span class="test-level">${escapeHTML(test.level)}</span></div><h3>${escapeHTML(test.title)}</h3><div class="test-meta"><span><i class="fa-regular fa-circle-question"></i> ${test.questions.length} أسئلة</span><span><i class="fa-regular fa-clock"></i> ${test.duration} دقائق</span><span><i class="fa-solid fa-star"></i> ${test.score} درجة</span></div>${previous ? `<p class="test-previous"><i class="fa-solid fa-clock-rotate-left"></i> آخر نتيجة: ${Number(previous.percentage).toFixed(0)}%</p>` : '<p class="test-previous muted">لم تبدأ هذا النموذج بعد</p>'}<button class="primary-button test-start" type="button" data-start-test="${escapeHTML(test.id)}"><i class="fa-solid fa-play"></i> ابدأ الاختبار</button></article>`; }).join('') : `<div class="learning-empty panel"><i class="fa-solid fa-magnifying-glass"></i><h3>لا توجد نماذج مطابقة</h3><p>جرّب البحث باسم مادة أخرى أو اختر تصنيفًا مختلفًا.</p></div>`;
  }

  function renderTestSession() {
    const test = activeTest(); const session = $('#testSession'); if (!test || !session) return;
    const question = test.questions[activeTestIndex]; const answered = Object.keys(activeTestAnswers).length;
    $('#testCatalogToolbar')?.classList.add('hidden'); $('#testCatalog')?.classList.add('hidden'); $('#testResultView')?.classList.add('hidden'); session.classList.remove('hidden');
    session.innerHTML = `<header class="test-session-head panel"><button class="test-quiet-button" type="button" data-exit-test><i class="fa-solid fa-arrow-right"></i> العودة للنماذج</button><div><span>${escapeHTML(test.subject)} · ${escapeHTML(test.level)}</span><h2>${escapeHTML(test.title)}</h2></div><div class="test-clock"><i class="fa-regular fa-clock"></i><b>${test.duration} د</b><small>مدة مقترحة</small></div></header><section class="test-progress-wrap"><div><span>السؤال ${activeTestIndex + 1} من ${test.questions.length}</span><b>${answered}/${test.questions.length} مجاب</b></div><div class="test-progress"><i style="width:${((activeTestIndex + 1) / test.questions.length) * 100}%"></i></div></section><article class="question-card panel"><span class="question-number">${String(activeTestIndex + 1).padStart(2, '0')}</span><h3>${escapeHTML(question.text)}</h3><div class="answer-options">${question.options.map((option, index) => `<button type="button" class="answer-option ${activeTestAnswers[activeTestIndex] === index ? 'selected' : ''}" data-test-answer="${index}"><span>${String.fromCharCode(1571 + index)}</span>${escapeHTML(option)}</button>`).join('')}</div></article><footer class="test-navigation"><button class="outline-button" type="button" data-test-nav="previous" ${activeTestIndex === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-right"></i> السابق</button>${activeTestIndex === test.questions.length - 1 ? '<button class="primary-button" type="button" data-finish-test>إنهاء وعرض النتيجة <i class="fa-solid fa-check"></i></button>' : '<button class="primary-button" type="button" data-test-nav="next">التالي <i class="fa-solid fa-arrow-left"></i></button>'}</footer>`;
  }

  function startTest(testId) { activeTestId = testId; activeTestIndex = 0; activeTestAnswers = {}; renderTestSession(); }
  function exitTest() { activeTestId = ''; activeTestIndex = 0; activeTestAnswers = {}; $('#testSession')?.classList.add('hidden'); $('#testResultView')?.classList.add('hidden'); $('#testCatalogToolbar')?.classList.remove('hidden'); $('#testCatalog')?.classList.remove('hidden'); renderTestCatalog(); }
  function chooseTestAnswer(index) { activeTestAnswers[activeTestIndex] = Number(index); renderTestSession(); }
  function moveTestQuestion(direction) { const test = activeTest(); if (!test) return; activeTestIndex = Math.min(test.questions.length - 1, Math.max(0, activeTestIndex + direction)); renderTestSession(); }

  function finishTest() {
    const test = activeTest(); if (!test) return; const missing = test.questions.findIndex((_, index) => activeTestAnswers[index] === undefined);
    if (missing >= 0) { activeTestIndex = missing; renderTestSession(); return toast('أجب عن جميع الأسئلة قبل إنهاء الاختبار.'); }
    const correct = test.questions.filter((question, index) => activeTestAnswers[index] === question.correct).length; const percentage = (correct / test.questions.length) * 100;
    const record = { id: `test-${Date.now()}`, testId: test.id, title: test.title, subject: test.subject, correct, total: test.questions.length, percentage, completedAt: Date.now() }; saveTestHistory([record, ...savedTestHistory()]);
    const result = $('#testResultView'); if (!result) return; $('#testSession')?.classList.add('hidden'); result.classList.remove('hidden');
    result.innerHTML = `<section class="test-result-summary panel"><span class="test-result-icon ${percentage >= 65 ? 'success' : 'retry'}"><i class="fa-solid ${percentage >= 65 ? 'fa-trophy' : 'fa-rotate-right'}"></i></span><div><span>نتيجتك في ${escapeHTML(test.title)}</span><b>${percentage.toFixed(0)}<small>%</small></b><p>${percentage >= 85 ? 'أداء ممتاز، حافظ على هذا المستوى.' : percentage >= 65 ? 'نتيجة جيدة، راجع الإجابات التي أخطأت فيها.' : 'هذه فرصة جيدة لمعرفة المحاور التي تحتاج مراجعة إضافية.'}</p></div><div class="test-result-numbers"><span><b>${correct}</b><small>صحيحة</small></span><span><b>${test.questions.length - correct}</b><small>خاطئة</small></span><span><b>${test.questions.length}</b><small>إجمالي</small></span></div></section><section class="answer-review"><div class="section-list-head"><div><span class="eyebrow">مراجعة الإجابات</span><h3>تعلم من كل سؤال</h3></div><button class="outline-button" type="button" data-retry-test="${escapeHTML(test.id)}"><i class="fa-solid fa-rotate-right"></i> إعادة الاختبار</button></div>${test.questions.map((question, index) => { const selected = activeTestAnswers[index]; const right = selected === question.correct; return `<article class="review-item ${right ? 'right' : 'wrong'}"><span><i class="fa-solid ${right ? 'fa-check' : 'fa-xmark'}"></i></span><div><b>${index + 1}. ${escapeHTML(question.text)}</b><p>إجابتك: ${escapeHTML(question.options[selected])}</p>${!right ? `<p class="correct-answer">الإجابة الصحيحة: ${escapeHTML(question.options[question.correct])}</p>` : ''}<small><i class="fa-solid fa-lightbulb"></i> ${escapeHTML(question.explain)}</small></div></article>`; }).join('')}</section><button class="test-back-catalog" type="button" data-exit-test><i class="fa-solid fa-arrow-right"></i> العودة إلى جميع الاختبارات</button>`;
    renderTestCatalog();
  }

  function initTests() {
    if (!$('#testCatalog')) return; renderTestCatalog();
    $('#testSearch')?.addEventListener('input', renderTestCatalog);
    $$('[data-test-filter]').forEach(button => button.addEventListener('click', () => { activeTestFilter = button.dataset.testFilter; $$('[data-test-filter]').forEach(item => item.classList.toggle('active', item === button)); renderTestCatalog(); }));
    $('#testCatalog')?.addEventListener('click', event => { const start = event.target.closest('[data-start-test]'); if (start) startTest(start.dataset.startTest); });
    $('#testSession')?.addEventListener('click', event => { const answer = event.target.closest('[data-test-answer]'); const navigation = event.target.closest('[data-test-nav]'); if (answer) chooseTestAnswer(answer.dataset.testAnswer); if (navigation) moveTestQuestion(navigation.dataset.testNav === 'next' ? 1 : -1); if (event.target.closest('[data-finish-test]')) finishTest(); if (event.target.closest('[data-exit-test]')) exitTest(); });
    $('#testResultView')?.addEventListener('click', event => { const retry = event.target.closest('[data-retry-test]'); if (retry) startTest(retry.dataset.retryTest); if (event.target.closest('[data-exit-test]')) exitTest(); });
  }

  let completionPlans = readStorage('completion_plans', []); completionPlans = Array.isArray(completionPlans) ? completionPlans : [];
  const saveCompletionPlans = () => { try { localStorage.setItem(STORE + 'completion_plans', JSON.stringify(completionPlans)); } catch { toast('تعذر حفظ خطة الختم محليًا.'); } };
  const completionDateKey = date => localDateKey(new Date(`${date}T12:00:00`));
  const completionDaysBetween = (start, end) => Math.max(1, Math.floor((new Date(`${end}T12:00:00`) - new Date(`${start}T12:00:00`)) / 86400000) + 1);
  const completionProgress = plan => Math.min(100, (Number(plan.completedUnits || 0) / Number(plan.totalUnits || 1)) * 100);
  const completionRemainingDays = plan => Math.max(1, completionDaysBetween(localDateKey(), plan.endDate));
  const completionTodayTarget = plan => Math.ceil(Math.max(0, Number(plan.totalUnits) - Number(plan.completedUnits || 0)) / completionRemainingDays(plan));

  function renderCompletionPlans() {
    const list = $('#completionList'); const empty = $('#completionEmpty'); if (!list || !empty) return;
    const totalPlans = completionPlans.length;
    empty.classList.toggle('hidden', totalPlans > 0); if (!totalPlans) { list.innerHTML = ''; return; }
    list.innerHTML = completionPlans.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0)).map(plan => { const progress = completionProgress(plan); const done = Number(plan.completedUnits || 0); const total = Number(plan.totalUnits); const complete = progress >= 100; const remaining = Math.max(0, total - done); const today = complete ? 0 : completionTodayTarget(plan); return `<article class="completion-card panel ${complete ? 'complete' : ''}"><header><div><span class="eyebrow">${escapeHTML(plan.unitLabel || 'وحدات دراسية')}</span><h3>${escapeHTML(plan.title)}</h3><p><i class="fa-regular fa-calendar"></i> من ${studyDateText(plan.startDate)} إلى ${studyDateText(plan.endDate)}</p></div><div class="completion-percent"><b>${progress.toFixed(0)}%</b><span>الإنجاز</span></div></header><div class="completion-progress"><i style="width:${progress}%"></i></div><div class="completion-stats"><span><b>${done} / ${total}</b><small>تم إنجازه</small></span><span><b>${remaining}</b><small>المتبقي</small></span><span><b>${today}</b><small>المطلوب اليوم</small></span></div>${complete ? '<div class="completion-done"><i class="fa-solid fa-circle-check"></i> اكتملت الخطة، أحسنت الاستمرار.</div>' : `<div class="completion-update"><label>سجّل المنجز الآن<input id="completionProgress-${escapeHTML(plan.id)}" type="number" min="0" max="${total}" value="${done}"></label><button class="primary-button" type="button" data-completion-action="update" data-plan-id="${escapeHTML(plan.id)}"><i class="fa-solid fa-check"></i> تحديث الإنجاز</button></div>`}<footer><button type="button" data-completion-action="edit" data-plan-id="${escapeHTML(plan.id)}"><i class="fa-solid fa-pen"></i> تعديل الخطة</button><button type="button" data-completion-action="delete" data-plan-id="${escapeHTML(plan.id)}"><i class="fa-regular fa-trash-can"></i> حذف</button></footer></article>`; }).join('');
  }

  function openCompletionPlanEditor(planId = '') {
    const plan = completionPlans.find(item => item.id === planId) || {}; const start = plan.startDate || localDateKey(); const endDate = new Date(`${start}T12:00:00`); endDate.setDate(endDate.getDate() + 14); const end = plan.endDate || localDateKey(endDate);
    openModal(`<div class="modal-head"><h3>${plan.id ? 'تعديل خطة الختم' : 'إنشاء خطة ختم'}</h3><button class="close-modal" aria-label="إغلاق">×</button></div><form id="completionPlanForm" data-plan-id="${plan.id || ''}"><div class="form-grid"><div class="form-group full"><label>اسم المادة أو الخطة</label><input name="title" maxlength="100" required placeholder="مثال: خطة ختم الكيمياء" value="${escapeHTML(plan.title || '')}"></div><div class="form-group"><label>نوع الوحدة</label><select name="unitLabel"><option value="صفحات" ${(plan.unitLabel || 'صفحات') === 'صفحات' ? 'selected' : ''}>صفحات</option><option value="دروس" ${plan.unitLabel === 'دروس' ? 'selected' : ''}>دروس</option><option value="وحدات" ${plan.unitLabel === 'وحدات' ? 'selected' : ''}>وحدات</option><option value="فصول" ${plan.unitLabel === 'فصول' ? 'selected' : ''}>فصول</option></select></div><div class="form-group"><label>إجمالي الوحدات</label><input name="totalUnits" type="number" min="1" required value="${escapeHTML(plan.totalUnits || '')}" placeholder="200"></div><div class="form-group"><label>تاريخ البداية</label><input name="startDate" type="date" required value="${escapeHTML(start)}"></div><div class="form-group"><label>تاريخ النهاية</label><input name="endDate" type="date" required value="${escapeHTML(end)}"></div>${plan.id ? `<div class="form-group full"><label>ما أنجزته حتى الآن</label><input name="completedUnits" type="number" min="0" max="${escapeHTML(plan.totalUnits || 1)}" value="${escapeHTML(plan.completedUnits || 0)}"></div>` : ''}</div><div class="form-actions"><button class="outline-button close-modal" type="button">إلغاء</button><button class="primary-button" type="submit"><i class="fa-solid fa-floppy-disk"></i> حفظ الخطة</button></div></form>`);
  }

  function saveCompletionPlan(form) {
    const data = new FormData(form); const id = form.dataset.planId; const old = completionPlans.find(item => item.id === id); const title = String(data.get('title') || '').trim(); const totalUnits = Number(data.get('totalUnits')); const startDate = String(data.get('startDate')); const endDate = String(data.get('endDate')); const completedUnits = Math.max(0, Math.min(totalUnits, Number(data.get('completedUnits') ?? old?.completedUnits ?? 0)));
    if (!title || !Number.isFinite(totalUnits) || totalUnits <= 0 || !startDate || !endDate || new Date(`${endDate}T12:00:00`) < new Date(`${startDate}T12:00:00`)) return toast('تحقق من اسم الخطة وعدد الوحدات وتواريخها.');
    const plan = { id: id || `plan-${Date.now()}-${Math.random().toString(16).slice(2)}`, title, unitLabel: String(data.get('unitLabel') || 'وحدات'), totalUnits, completedUnits, startDate, endDate, createdAt: old?.createdAt || Date.now(), updatedAt: Date.now() };
    completionPlans = old ? completionPlans.map(item => item.id === id ? plan : item) : [plan, ...completionPlans]; saveCompletionPlans(); closeModal(); renderCompletionPlans(); toast('تم حفظ خطة الختم.');
  }

  function handleCompletionAction(button) {
    const plan = completionPlans.find(item => item.id === button.dataset.planId); if (!plan) return; const action = button.dataset.completionAction;
    if (action === 'edit') return openCompletionPlanEditor(plan.id);
    if (action === 'delete') return confirmAction('حذف خطة الختم؟', 'لن تتمكن من استرجاع تقدم هذه الخطة بعد حذفها.', () => { completionPlans = completionPlans.filter(item => item.id !== plan.id); saveCompletionPlans(); renderCompletionPlans(); toast('تم حذف الخطة.'); });
    const input = $(`#completionProgress-${plan.id}`); const value = Number(input?.value); if (!Number.isFinite(value) || value < 0 || value > Number(plan.totalUnits)) return toast('أدخل عددًا صالحًا لما أنجزته.'); plan.completedUnits = value; plan.updatedAt = Date.now(); saveCompletionPlans(); renderCompletionPlans(); toast(value >= Number(plan.totalUnits) ? 'اكتملت الخطة، أحسنت!' : 'تم تحديث إنجازك.');
  }

  const baccalaureatePrograms = {
    scientific: { label: 'بكالوريا علمي', icon: 'fa-flask', tone: 'scientific', programs: {
      full: { label: 'بكالوريا', title: 'البرنامج العلمي الكامل', subtitle: 'جدول شامل للدراسة طوال اليوم', icon: 'fa-flask', entries: [['05:30 ص','الاستيقاظ، شرب ماء، وضوء، صلاة، قرآن','30 د'],['06:00 ص','تحضير النفس والكتب','10 د'],['06:10 ص','الجلسة الأولى: التركيز العالي (أحياء، عربي، إنجليزي)','2 س'],['08:10 ص','استراحة','15 د'],['08:25 ص','الجلسة الثانية: كيمياء وفيزياء (حفظ فقط)','2 س'],['10:25 ص','استراحة (مشي، شاي)','30 د'],['10:55 ص','الجلسة الثالثة: مراجعة الصباح','1.5 س'],['12:25 م','استراحة طويلة','1.5 س'],['02:00 م','الجلسة الرابعة: الرياضيات','2 س'],['04:00 م','استراحة','20 د'],['04:20 م','الجلسة الخامسة: مادة خفيفة','1.5 س'],['05:50 م','اللحظة الذهبية: مراجعة سريعة','45 د'],['06:35 م','راحة وعشاء','55 د'],['07:30 م','الجلسة السادسة: فيزياء، كيمياء، رياضيات','1.5 س'],['09:00 م','الجلسة الأخيرة: مراجعة','1 س'],['10:00 م','النوم','7.5 س']] },
      morning: { label: 'دوام صباحي', title: 'العلمي — دوام صباحي', subtitle: 'جلسات الصباح للفرع العلمي', icon: 'fa-sun', entries: [['06:00 ص','الاستيقاظ، تحضير النفس','30 د'],['06:30 ص','الجلسة الأولى: رياضيات','1.5 س'],['08:00 ص','استراحة','15 د'],['08:15 ص','الجلسة الثانية: فيزياء','1.5 س'],['09:45 ص','استراحة','30 د'],['10:15 ص','الجلسة الثالثة: كيمياء','1.5 س'],['11:45 ص','مراجعة الصباح','45 د'],['12:30 م','اختتام الجلسة الصباحية','30 د']] },
      evening: { label: 'دوام مسائي', title: 'العلمي — دوام مسائي', subtitle: 'جلسات المساء للفرع العلمي', icon: 'fa-moon', entries: [['03:00 م','الاستعداد للدراسة','30 د'],['03:30 م','الجلسة الأولى: أحياء','1.5 س'],['05:00 م','استراحة','20 د'],['05:20 م','الجلسة الثانية: رياضيات','2 س'],['07:20 م','استراحة (عشاء)','40 د'],['08:00 م','الجلسة الثالثة: فيزياء/كيمياء','1.5 س'],['09:30 م','مراجعة المساء','1 س'],['10:30 م','اختتام الجلسة المسائية','30 د']] }
    }},
    literary: { label: 'بكالوريا أدبي', icon: 'fa-book-open', tone: 'literary', programs: {
      full: { label: 'بكالوريا', title: 'البرنامج الأدبي الكامل', subtitle: 'جدول شامل للدراسة طوال اليوم', icon: 'fa-book-open', entries: [['05:30 ص','الاستيقاظ، شرب ماء، وضوء، صلاة، قرآن','30 د'],['06:00 ص','تحضير النفس والكتب','10 د'],['06:10 ص','الجلسة الأولى: التركيز العالي (عربي، إسلامية، إنجليزي)','2 س'],['08:10 ص','استراحة','15 د'],['08:25 ص','الجلسة الثانية: تاريخ، جغرافيا','2 س'],['10:25 ص','استراحة','30 د'],['10:55 ص','الجلسة الثالثة: مراجعة الصباح','1.5 س'],['12:25 م','استراحة طويلة','1.5 س'],['02:00 م','الجلسة الرابعة: فلسفة وعلم نفس','2 س'],['04:00 م','استراحة','20 د'],['04:20 م','الجلسة الخامسة: مادة خفيفة','1.5 س'],['05:50 م','اللحظة الذهبية: مراجعة سريعة','45 د'],['06:35 م','راحة وعشاء','55 د'],['07:30 م','الجلسة السادسة: حل تمارين','1.5 س'],['09:00 م','الجلسة الأخيرة: مراجعة','1 س'],['10:00 م','النوم','7.5 س']] },
      morning: { label: 'دوام صباحي', title: 'الأدبي — دوام صباحي', subtitle: 'جلسات الصباح للفرع الأدبي', icon: 'fa-sun', entries: [['06:00 ص','الاستيقاظ، تحضير النفس','30 د'],['06:30 ص','الجلسة الأولى: عربي','1.5 س'],['08:00 ص','استراحة','15 د'],['08:15 ص','الجلسة الثانية: تاريخ/جغرافيا','1.5 س'],['09:45 ص','استراحة','30 د'],['10:15 ص','الجلسة الثالثة: إسلامية/فلسفة','1.5 س'],['11:45 ص','مراجعة الصباح','45 د'],['12:30 م','اختتام الجلسة الصباحية','30 د']] },
      evening: { label: 'دوام مسائي', title: 'الأدبي — دوام مسائي', subtitle: 'جلسات المساء للفرع الأدبي', icon: 'fa-moon', entries: [['03:00 م','الاستعداد للدراسة','30 د'],['03:30 م','الجلسة الأولى: عربي/إنجليزي','1.5 س'],['05:00 م','استراحة','20 د'],['05:20 م','الجلسة الثانية: علم نفس/اجتماع','2 س'],['07:20 م','استراحة (عشاء)','40 د'],['08:00 م','الجلسة الثالثة: حل تمارين','1.5 س'],['09:30 م','مراجعة المساء','1 س'],['10:30 م','اختتام الجلسة المسائية','30 د']] }
    }}
  };
  let activeCompletionTrack = 'scientific'; let activeCompletionProgram = 'full';
  function renderBaccalaureateSchedule() {
    const holder = $('#completionSchedule'); const track = baccalaureatePrograms[activeCompletionTrack]; const program = track?.programs?.[activeCompletionProgram]; if (!holder || !track || !program) return;
    const tabs = Object.entries(track.programs).map(([key, item]) => `<button class="completion-program-tab ${key === activeCompletionProgram ? 'active' : ''}" type="button" role="tab" aria-selected="${key === activeCompletionProgram}" data-completion-program="${key}"><i class="fa-solid ${key === 'morning' ? 'fa-sun' : key === 'evening' ? 'fa-moon' : track.icon}"></i>${escapeHTML(item.label)}</button>`).join('');
    const entries = program.entries.map(([time, text, duration], index) => `<article class="completion-schedule-row"><span class="completion-schedule-index">${String(index + 1).padStart(2, '0')}</span><time>${escapeHTML(time)}</time><div><b>${escapeHTML(text)}</b><small><i class="fa-regular fa-clock"></i> ${escapeHTML(duration)}</small></div></article>`).join('');
    holder.dataset.tone = track.tone; holder.innerHTML = `<header class="completion-schedule-head"><div><span class="completion-schedule-icon"><i class="fa-solid ${program.icon}"></i></span><div><span>${escapeHTML(track.label)}</span><h4>${escapeHTML(program.title)}</h4><p>${escapeHTML(program.subtitle)}</p></div></div><span class="completion-schedule-count">${program.entries.length} محطة</span></header><nav class="completion-program-tabs" role="tablist" aria-label="اختيار نمط الدوام">${tabs}</nav><div class="completion-schedule-list">${entries}</div>`;
  }
  function initCompletion() {
    if (!$('#completionList')) return; renderCompletionPlans(); renderBaccalaureateSchedule();
    $('#createCompletionPlan')?.addEventListener('click', () => openCompletionPlanEditor()); $('#createFirstCompletionPlan')?.addEventListener('click', () => openCompletionPlanEditor()); $('#createCompletionPlanInline')?.addEventListener('click', () => openCompletionPlanEditor());
    $('#completionList')?.addEventListener('click', event => { const action = event.target.closest('[data-completion-action]'); if (action) handleCompletionAction(action); });
    $$('.completion-track-card[data-completion-track]').forEach(button => button.addEventListener('click', () => { activeCompletionTrack = button.dataset.completionTrack; activeCompletionProgram = 'full'; $$('.completion-track-card').forEach(item => { const isActive = item === button; item.classList.toggle('active', isActive); item.setAttribute('aria-selected', String(isActive)); }); renderBaccalaureateSchedule(); }));
    $('#completionSchedule')?.addEventListener('click', event => { const tab = event.target.closest('[data-completion-program]'); if (!tab) return; activeCompletionProgram = tab.dataset.completionProgram; renderBaccalaureateSchedule(); });
  }

  const universityDirectory = [{"id":"guide-1","name":"جامعة دمشق","type":"حكومية","entity":"جامعة","location":"دمشق","province":"دمشق","founded":1923,"fields":["صحي","هندسي","إداري","إنساني","علمي"],"highlights":["صحي","هندسي","إداري","إنساني","علمي"],"note":"جامعة وطنية عريقة تأسست منذ 1923","details":"تضم كليات الطب والهندسة والآداب والعلوم والاقتصاد","advantages":["تضم كليات الطب والهندسة والآداب والعلوم والاقتصاد","جامعة حكومية ضمن بيانات الكود المرفق."],"official":"https://damascusuniversity.edu.sy/"},{"id":"guide-2","name":"جامعة حلب","type":"حكومية","entity":"جامعة","location":"حلب","province":"حلب","founded":1958,"fields":["صحي","هندسي","إداري","إنساني","علمي"],"highlights":["صحي","هندسي","إداري","إنساني","علمي"],"note":"جامعة شمالية رائدة","details":"تضم كليات الطب والهندسة والآداب والعلوم والتجارة","advantages":["تضم كليات الطب والهندسة والآداب والعلوم والتجارة","جامعة حكومية ضمن بيانات الكود المرفق."],"official":"http://www.alepuniv.edu.sy/"},{"id":"guide-3","name":"جامعة اللاذقية","type":"حكومية","entity":"جامعة","location":"اللاذقية","province":"اللاذقية","founded":1971,"fields":["صحي","هندسي","إنساني","علمي"],"highlights":["صحي","هندسي","إنساني","علمي"],"note":"جامعة ساحلية عريقة","details":"تضم كليات الطب والهندسة والعلوم والآداب","advantages":["تضم كليات الطب والهندسة والعلوم والآداب","جامعة حكومية ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-4","name":"جامعة حمص","type":"حكومية","entity":"جامعة","location":"حمص","province":"حمص","founded":1979,"fields":["صحي","هندسي","إنساني","علمي"],"highlights":["صحي","هندسي","إنساني","علمي"],"note":"جامعة إقليمية متميزة","details":"تضم كليات الطب والهندسة والزراعة والعلوم والآداب","advantages":["تضم كليات الطب والهندسة والزراعة والعلوم والآداب","جامعة حكومية ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-5","name":"الجامعة الافتراضية السورية","type":"حكومية","entity":"جامعة","location":"دمشق","province":"دمشق","founded":2002,"fields":["تقاني"],"highlights":["تقاني"],"note":"جامعة إلكترونية","details":"تقدم برامج التعليم عن بعد في كافة التخصصات","advantages":["تقدم برامج التعليم عن بعد في كافة التخصصات","جامعة حكومية ضمن بيانات الكود المرفق."],"official":"https://svuonline.org/"},{"id":"guide-6","name":"جامعة الفرات","type":"حكومية","entity":"جامعة","location":"دير الزور","province":"دير الزور","founded":2006,"fields":["هندسي","إداري","علمي"],"highlights":["هندسي","إداري","علمي"],"note":"جامعة إقليمية","details":"تضم برامج العلوم والهندسة والاقتصاد","advantages":["تضم برامج العلوم والهندسة والاقتصاد","جامعة حكومية ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-7","name":"جامعة حماة","type":"حكومية","entity":"جامعة","location":"حماة","province":"حماة","founded":2014,"fields":["صحي","هندسي","إنساني","علمي"],"highlights":["صحي","هندسي","إنساني","علمي"],"note":"جامعة متوسطة الحجم","details":"تضم كليات الطب والهندسة والعلوم والآداب","advantages":["تضم كليات الطب والهندسة والعلوم والآداب","جامعة حكومية ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-8","name":"جامعة طرطوس","type":"حكومية","entity":"جامعة","location":"طرطوس","province":"طرطوس","founded":2015,"fields":["هندسي","إنساني","علمي"],"highlights":["هندسي","إنساني","علمي"],"note":"جامعة ساحلية","details":"تضم كليات الآداب والعلوم والهندسة","advantages":["تضم كليات الآداب والعلوم والهندسة","جامعة حكومية ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-9","name":"جامعة إدلب","type":"حكومية","entity":"جامعة","location":"إدلب","province":"إدلب","founded":2015,"fields":["إنساني","علمي"],"highlights":["إنساني","علمي"],"note":"جامعة حديثة","details":"تضم برامج أساسية في العلوم والآداب","advantages":["تضم برامج أساسية في العلوم والآداب","جامعة حكومية ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-10","name":"جامعة حلب في المناطق المحررة","type":"حكومية","entity":"جامعة","location":"حلب","province":"حلب","founded":null,"fields":["علمي"],"highlights":["علمي"],"note":"جامعة جديدة","details":"تضم برامج تعليمية متنوعة","advantages":["تضم برامج تعليمية متنوعة","جامعة حكومية ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-11","name":"جامعة حلب الشهباء","type":"حكومية","entity":"جامعة","location":"إدلب","province":"إدلب","founded":null,"fields":["هندسي","علمي"],"highlights":["هندسي","علمي"],"note":"جامعة جديدة","details":"تضم برامج الهندسة والعلوم","advantages":["تضم برامج الهندسة والعلوم","جامعة حكومية ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-12","name":"الأكاديمية العربية للعلوم والتكنولوجيا والنقل البحري","type":"خاصة","entity":"معهد","location":"اللاذقية","province":"اللاذقية","founded":null,"fields":["هندسي","تقاني","علمي"],"highlights":["هندسي","تقاني","علمي"],"note":"جامعة خاصة","details":"تقدم برامج علوم وتكنولوجيا","advantages":["تقدم برامج علوم وتكنولوجيا","معهد خاصة ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-13","name":"جامعة القلمون","type":"خاصة","entity":"جامعة","location":"ريف دمشق","province":"ريف دمشق","founded":null,"fields":["علمي"],"highlights":["علمي"],"note":"جامعة خاصة","details":"برامج متنوعة","advantages":["برامج متنوعة","جامعة خاصة ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-14","name":"الجامعة العربية الدولية","type":"خاصة","entity":"جامعة","location":"درعا","province":"درعا","founded":null,"fields":["علمي"],"highlights":["علمي"],"note":"جامعة خاصة","details":"برامج إدارية وعلمية","advantages":["برامج إدارية وعلمية","جامعة خاصة ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-15","name":"الجامعة السورية الخاصة","type":"خاصة","entity":"جامعة","location":"ريف دمشق","province":"ريف دمشق","founded":null,"fields":["علمي"],"highlights":["علمي"],"note":"جامعة خاصة","details":"برامج متعددة","advantages":["برامج متعددة","جامعة خاصة ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-16","name":"الجامعة الدولية الخاصة للعلوم والتكنولوجيا","type":"خاصة","entity":"جامعة","location":"درعا","province":"درعا","founded":null,"fields":["هندسي","تقاني","علمي"],"highlights":["هندسي","تقاني","علمي"],"note":"جامعة خاصة","details":"تخصصات علمية وتقنية","advantages":["تخصصات علمية وتقنية","جامعة خاصة ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-17","name":"جامعة الوادي الدولية","type":"خاصة","entity":"جامعة","location":"حمص","province":"حمص","founded":null,"fields":["علمي"],"highlights":["علمي"],"note":"جامعة خاصة","details":"برامج متنوعة","advantages":["برامج متنوعة","جامعة خاصة ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-18","name":"جامعة الرشيد الدولية الخاصة للعلوم والتكنولوجيا","type":"خاصة","entity":"جامعة","location":"درعا","province":"درعا","founded":null,"fields":["هندسي","تقاني","علمي"],"highlights":["هندسي","تقاني","علمي"],"note":"جامعة خاصة","details":"علوم وتكنولوجيا","advantages":["علوم وتكنولوجيا","جامعة خاصة ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-19","name":"جامعة اليرموك الخاصة","type":"خاصة","entity":"جامعة","location":"درعا","province":"درعا","founded":null,"fields":["علمي"],"highlights":["علمي"],"note":"جامعة خاصة","details":"تخصصات متعددة","advantages":["تخصصات متعددة","جامعة خاصة ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-20","name":"الجامعة الوطنية الخاصة","type":"خاصة","entity":"جامعة","location":"حماة","province":"حماة","founded":null,"fields":["علمي"],"highlights":["علمي"],"note":"جامعة خاصة","details":"برامج تعليمية متنوعة","advantages":["برامج تعليمية متنوعة","جامعة خاصة ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-21","name":"جامعة قرطبة الخاصة","type":"خاصة","entity":"جامعة","location":"حلب","province":"حلب","founded":null,"fields":["صحي"],"highlights":["صحي"],"note":"جامعة خاصة","details":"تخصصات متعددة","advantages":["تخصصات متعددة","جامعة خاصة ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-22","name":"جامعة الاتحاد الخاصة","type":"خاصة","entity":"جامعة","location":"الرقة","province":"الرقة","founded":null,"fields":["علمي"],"highlights":["علمي"],"note":"جامعة خاصة","details":"برامج متقدمة","advantages":["برامج متقدمة","جامعة خاصة ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-23","name":"جامعة الشهباء الخاصة","type":"خاصة","entity":"جامعة","location":"حلب","province":"حلب","founded":null,"fields":["علمي"],"highlights":["علمي"],"note":"جامعة خاصة","details":"تخصصات علمية","advantages":["تخصصات علمية","جامعة خاصة ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-24","name":"جامعة الجزيرة","type":"خاصة","entity":"جامعة","location":"دير الزور","province":"دير الزور","founded":null,"fields":["علمي"],"highlights":["علمي"],"note":"جامعة خاصة","details":"تقدم برامج متعددة","advantages":["تقدم برامج متعددة","جامعة خاصة ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-25","name":"الجامعة العربية الخاصة للعلوم والتكنولوجيا","type":"خاصة","entity":"جامعة","location":"حماة","province":"حماة","founded":null,"fields":["هندسي","تقاني","علمي"],"highlights":["هندسي","تقاني","علمي"],"note":"جامعة خاصة","details":"علوم وتكنولوجيا","advantages":["علوم وتكنولوجيا","جامعة خاصة ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-26","name":"جامعة الأندلس للعلوم الطبية","type":"خاصة","entity":"جامعة","location":"طرطوس","province":"طرطوس","founded":null,"fields":["صحي","علمي"],"highlights":["صحي","علمي"],"note":"جامعة طبية خاصة","details":"تضم برامج العلوم الطبية","advantages":["تضم برامج العلوم الطبية","جامعة خاصة ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-27","name":"جامعة الحواش الخاصة","type":"خاصة","entity":"جامعة","location":"حمص","province":"حمص","founded":null,"fields":["علمي"],"highlights":["علمي"],"note":"جامعة خاصة","details":"برامج متنوعة","advantages":["برامج متنوعة","جامعة خاصة ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-28","name":"جامعة إبيلا الخاصة","type":"خاصة","entity":"جامعة","location":"إدلب","province":"إدلب","founded":null,"fields":["علمي"],"highlights":["علمي"],"note":"جامعة خاصة","details":"تخصصات متنوعة","advantages":["تخصصات متنوعة","جامعة خاصة ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-29","name":"جامعة الشام الخاصة","type":"خاصة","entity":"جامعة","location":"ريف دمشق","province":"ريف دمشق","founded":null,"fields":["إداري","علمي"],"highlights":["إداري","علمي"],"note":"جامعة خاصة","details":"برامج إدارة الأعمال والعلوم","advantages":["برامج إدارة الأعمال والعلوم","جامعة خاصة ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-30","name":"جامعة بلاد الشام للعلوم الشرعية","type":"خاصة","entity":"جامعة","location":"دمشق","province":"دمشق","founded":null,"fields":["إنساني","علمي"],"highlights":["إنساني","علمي"],"note":"جامعة خاصة","details":"علوم شرعية","advantages":["علوم شرعية","جامعة خاصة ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-31","name":"جامعة قاسيون الخاصة","type":"خاصة","entity":"جامعة","location":"درعا","province":"درعا","founded":null,"fields":["علمي"],"highlights":["علمي"],"note":"جامعة خاصة","details":"تخصصات متعددة","advantages":["تخصصات متعددة","جامعة خاصة ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-32","name":"جامعة الشمال الخاصة","type":"خاصة","entity":"جامعة","location":"إدلب","province":"إدلب","founded":null,"fields":["هندسي","علمي"],"highlights":["هندسي","علمي"],"note":"جامعة حديثة","details":"برامج علوم وهندسة","advantages":["برامج علوم وهندسة","جامعة خاصة ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-33","name":"جامعة ماري الخاصة","type":"خاصة","entity":"جامعة","location":"إدلب","province":"إدلب","founded":null,"fields":["هندسي","علمي"],"highlights":["هندسي","علمي"],"note":"جامعة صغيرة","details":"تركز على العلوم الأساسية والهندسة","advantages":["تركز على العلوم الأساسية والهندسة","جامعة خاصة ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-34","name":"جامعة الشام","type":"خاصة","entity":"جامعة","location":"حلب / اعزاز","province":"حلب","founded":null,"fields":["علمي"],"highlights":["علمي"],"note":"جامعة خاصة","details":"برامج متعددة","advantages":["برامج متعددة","جامعة خاصة ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-35","name":"جامعة الحياة للعلوم الطبية","type":"خاصة","entity":"جامعة","location":"إدلب","province":"إدلب","founded":null,"fields":["صحي","علمي"],"highlights":["صحي","علمي"],"note":"جامعة طبية","details":"برامج علوم طبية","advantages":["برامج علوم طبية","جامعة خاصة ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-36","name":"جامعة المنارة","type":"خاصة","entity":"جامعة","location":"اللاذقية","province":"اللاذقية","founded":null,"fields":["علمي"],"highlights":["علمي"],"note":"جامعة خاصة","details":"برامج متنوعة","advantages":["برامج متنوعة","جامعة خاصة ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-37","name":"الأكاديمية العربية للأعمال الإلكترونية","type":"خاصة","entity":"معهد","location":"حلب","province":"حلب","founded":null,"fields":["تقاني","إداري"],"highlights":["تقاني","إداري"],"note":"جامعة إلكترونية","details":"برامج أعمال إلكترونية","advantages":["برامج أعمال إلكترونية","معهد خاصة ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-38","name":"جامعة أنطاكية السورية الخاصة","type":"خاصة","entity":"جامعة","location":"ريف دمشق","province":"ريف دمشق","founded":null,"fields":["علمي"],"highlights":["علمي"],"note":"جامعة خاصة","details":"برامج متنوعة","advantages":["برامج متنوعة","جامعة خاصة ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-39","name":"الجامعة الدولية للعلوم والنهضة","type":"خاصة","entity":"جامعة","location":"حلب/ إعزاز","province":"حلب","founded":null,"fields":["هندسي","تقاني","علمي"],"highlights":["هندسي","تقاني","علمي"],"note":"جامعة خاصة","details":"برامج علمية وتقنية","advantages":["برامج علمية وتقنية","جامعة خاصة ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-40","name":"جامعة آرام للعلوم","type":"خاصة","entity":"جامعة","location":"حلب/ إعزاز","province":"حلب","founded":null,"fields":["علمي"],"highlights":["علمي"],"note":"جامعة خاصة","details":"برامج متعددة","advantages":["برامج متعددة","جامعة خاصة ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-41","name":"الجامعة السورية للعلوم والتكنولوجيا","type":"خاصة","entity":"جامعة","location":"حلب / اعزاز","province":"حلب","founded":null,"fields":["هندسي","تقاني","علمي"],"highlights":["هندسي","تقاني","علمي"],"note":"جامعة خاصة","details":"برامج علمية وتقنية","advantages":["برامج علمية وتقنية","جامعة خاصة ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-42","name":"جامعة باشاك شهير","type":"خاصة","entity":"جامعة","location":"حلب / الباب","province":"حلب","founded":null,"fields":["علمي"],"highlights":["علمي"],"note":"جامعة خاصة","details":"برامج متعددة","advantages":["برامج متعددة","جامعة خاصة ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-43","name":"جامعة الزهراء","type":"خاصة","entity":"جامعة","location":"حلب/ جرابلس","province":"حلب","founded":null,"fields":["علمي"],"highlights":["علمي"],"note":"جامعة خاصة","details":"برامج متنوعة","advantages":["برامج متنوعة","جامعة خاصة ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-44","name":"جامعة المعالي","type":"خاصة","entity":"جامعة","location":"حلب / الباب","province":"حلب","founded":null,"fields":["علمي"],"highlights":["علمي"],"note":"جامعة خاصة","details":"برامج متعددة","advantages":["برامج متعددة","جامعة خاصة ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-45","name":"جامعة الزيتونة","type":"خاصة","entity":"جامعة","location":"حلب/ اعزاز","province":"حلب","founded":null,"fields":["علمي"],"highlights":["علمي"],"note":"جامعة خاصة","details":"برامج متعددة","advantages":["برامج متعددة","جامعة خاصة ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-46","name":"جامعة الرواد للعلوم والثقافة","type":"خاصة","entity":"جامعة","location":"حلب / جرابلس","province":"حلب","founded":null,"fields":["علمي"],"highlights":["علمي"],"note":"جامعة خاصة","details":"برامج متنوعة","advantages":["برامج متنوعة","جامعة خاصة ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-47","name":"جامعة الأمانوس","type":"خاصة","entity":"جامعة","location":"حلب/ عفرين","province":"حلب","founded":null,"fields":["علمي"],"highlights":["علمي"],"note":"جامعة خاصة","details":"برامج متعددة","advantages":["برامج متعددة","جامعة خاصة ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-48","name":"كلية اللاهوت","type":"خاصة","entity":"جامعة","location":"دمشق","province":"دمشق","founded":null,"fields":["علمي"],"highlights":["علمي"],"note":"جامعة خاصة","details":"برامج تعليمية متنوعة","advantages":["برامج تعليمية متنوعة","جامعة خاصة ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-49","name":"جامعة المعارف الخاصة","type":"خاصة","entity":"جامعة","location":"إدلب","province":"إدلب","founded":null,"fields":["علمي"],"highlights":["علمي"],"note":"جامعة خاصة","details":"برامج متعددة","advantages":["برامج متعددة","جامعة خاصة ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-50","name":"الجامعة الإسلامية","type":"خاصة","entity":"جامعة","location":"إدلب","province":"إدلب","founded":null,"fields":["علمي"],"highlights":["علمي"],"note":"جامعة خاصة","details":"برامج تعليمية متنوعة","advantages":["برامج تعليمية متنوعة","جامعة خاصة ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-51","name":"معهد التخطيط الاقتصادي والاجتماعي","type":"حكومية","entity":"معهد","location":"دمشق","province":"دمشق","founded":1966,"fields":["إداري","إنساني"],"highlights":["إداري","إنساني"],"note":"معهد حكومي","details":"تأسس عام 1966 لتقديم الدراسات الاقتصادية والاجتماعية","advantages":["تأسس عام 1966 لتقديم الدراسات الاقتصادية والاجتماعية","معهد حكومية ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-52","name":"المعهد العالي للفنون المسرحية","type":"حكومية","entity":"معهد","location":"دمشق","province":"دمشق","founded":1977,"fields":["فني","إنساني"],"highlights":["فني","إنساني"],"note":"معهد حكومي","details":"تأسس عام 1977 لتقديم برامج الفنون المسرحية","advantages":["تأسس عام 1977 لتقديم برامج الفنون المسرحية","معهد حكومية ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-53","name":"المعهد العالي للعلوم التطبيقية والتكنولوجيا","type":"حكومية","entity":"معهد","location":"دمشق","province":"دمشق","founded":1983,"fields":["صحي","هندسي","تقاني","علمي"],"highlights":["صحي","هندسي","تقاني","علمي"],"note":"معهد حكومي","details":"تأسس عام 1983 لتقديم العلوم التطبيقية والتكنولوجيا","advantages":["تأسس عام 1983 لتقديم العلوم التطبيقية والتكنولوجيا","معهد حكومية ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-54","name":"المعهد العالي للموسيقا","type":"حكومية","entity":"معهد","location":"دمشق","province":"دمشق","founded":1990,"fields":["فني","إنساني"],"highlights":["فني","إنساني"],"note":"معهد حكومي","details":"تأسس عام 1990 لتقديم برامج الموسيقى","advantages":["تأسس عام 1990 لتقديم برامج الموسيقى","معهد حكومية ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-55","name":"المعهد العالي لإدارة الأعمال","type":"حكومية","entity":"معهد","location":"دمشق","province":"دمشق","founded":2001,"fields":["إداري"],"highlights":["إداري"],"note":"معهد حكومي","details":"تأسس عام 2001 لتقديم برامج الإدارة","advantages":["تأسس عام 2001 لتقديم برامج الإدارة","معهد حكومية ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-56","name":"المعهد الوطني للإدارة العامة","type":"حكومية","entity":"معهد","location":"دمشق","province":"دمشق","founded":2002,"fields":["إداري"],"highlights":["إداري"],"note":"معهد حكومي","details":"تأسس عام 2002 لتقديم الدراسات الإدارية","advantages":["تأسس عام 2002 لتقديم الدراسات الإدارية","معهد حكومية ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-57","name":"المعهد العالي للدراسات والبحوث السكانية","type":"حكومية","entity":"معهد","location":"دمشق","province":"دمشق","founded":2003,"fields":["إداري","إنساني"],"highlights":["إداري","إنساني"],"note":"معهد حكومي","details":"تأسس عام 2003 لتقديم الدراسات السكانية","advantages":["تأسس عام 2003 لتقديم الدراسات السكانية","معهد حكومية ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-58","name":"المعهد العالي للفنون السينمائية","type":"حكومية","entity":"معهد","location":"دمشق","province":"دمشق","founded":2021,"fields":["فني"],"highlights":["فني"],"note":"معهد حكومي","details":"تأسس عام 2021 لتقديم برامج السينما والإعلام","advantages":["تأسس عام 2021 لتقديم برامج السينما والإعلام","معهد حكومية ضمن بيانات الكود المرفق."],"official":""},{"id":"guide-59","name":"المعهد العالي للإدارة","type":"حكومية","entity":"معهد","location":"إدلب","province":"إدلب","founded":2024,"fields":["إداري"],"highlights":["إداري"],"note":"معهد حكومي","details":"تأسس عام 2024 لتقديم برامج الإدارة والأعمال","advantages":["تأسس عام 2024 لتقديم برامج الإدارة والأعمال","معهد حكومية ضمن بيانات الكود المرفق."],"official":""}];
  const universityProvinces = ["دمشق", "ريف دمشق", "حلب", "حمص", "اللاذقية", "حماة", "طرطوس", "إدلب", "درعا", "السويداء", "الحسكة", "دير الزور", "الرقة", "القنيطرة"];
  let comparedUniversities = readStorage('university_compare', []); comparedUniversities = Array.isArray(comparedUniversities) ? comparedUniversities.filter(id => universityDirectory.some(item => item.id === id)).slice(0, 3) : [];
  let universityVisibleLimit = 12;
  const saveUniversityCompare = () => { try { localStorage.setItem(STORE + 'university_compare', JSON.stringify(comparedUniversities)); } catch {} };
  saveUniversityCompare();

  function populateUniversityProvinces() {
    const select = $('#universityCity'); if (!select) return;
    const current = select.value || 'all';
    select.innerHTML = `<option value="all">كل المحافظات</option>${universityProvinces.map(province => `<option value="${escapeHTML(province)}">${escapeHTML(province)}</option>`).join('')}`;
    select.value = universityProvinces.includes(current) ? current : 'all';
  }

  function renderUniversityCoverage() {
    const coverage = $('#universityCoverage'); if (!coverage) return;
    const provincesInData = new Set(universityDirectory.map(item => item.province));
    const institutions = universityDirectory.length; const universities = universityDirectory.filter(item => item.entity === 'جامعة').length; const institutes = universityDirectory.filter(item => item.entity === 'معهد').length;
    coverage.innerHTML = `<div class="coverage-main"><span class="coverage-icon"><i class="fa-solid fa-map-location-dot"></i></span><div><b>دليل المؤسسات حسب المحافظات</b><small>اختر المحافظة من الخانة التالية؛ تظهر المؤسسة فقط حين تكون مذكورة في البيانات الواردة بالكود المرفق.</small></div></div><div class="coverage-stats"><span><b>${institutions}</b><small>مؤسسة</small></span><span><b>${universityProvinces.length}</b><small>محافظات بالدليل</small></span><span><b>${universities}</b><small>جامعات</small></span><span><b>${institutes}</b><small>معاهد وأكاديميات</small></span></div>`;
  }

  const expandedUniversityCards = new Set();
  const normalizeUniversitySearch = value => String(value || '').toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim();

  function filteredUniversities() {
    const query = normalizeUniversitySearch($('#universitySearch')?.value); const province = $('#universityCity')?.value || 'all'; const type = $('#universityType')?.value || 'all'; const entity = $('#universityEntity')?.value || 'all'; const field = $('#universityField')?.value || 'all';
    return universityDirectory.filter(item => {
      const searchable = normalizeUniversitySearch([item.name, item.location, item.province, item.type, item.entity, item.note, item.details, ...item.fields, ...item.highlights].join(' '));
      return (province === 'all' || item.province === province) && (type === 'all' || item.type === type) && (entity === 'all' || item.entity === entity) && (field === 'all' || item.fields.includes(field)) && (!query || searchable.includes(query));
    });
  }

  function updateUniversitySearchState(total) {
    const input = $('#universitySearch'); const clear = $('#clearUniversitySearch'); const hint = $('#universitySearchHint'); const query = input?.value.trim() || '';
    if (clear) clear.hidden = !query;
    if (hint) hint.textContent = query ? `${total} نتيجة مطابقة لعبارة «${query}».` : 'اكتب اسم المؤسسة أو المحافظة أو أحد المجالات للعثور عليها بسرعة.';
  }

  function renderUniversityDirectory() {
    const grid = $('#universityGrid'); if (!grid) return; const items = filteredUniversities(); const visibleItems = items.slice(0, universityVisibleLimit); const bar = $('#universityCompareBar');
    if (bar) bar.classList.toggle('hidden', !comparedUniversities.length); if ($('#universityCompareCount')) $('#universityCompareCount').textContent = comparedUniversities.length; if ($('#universityResultsCount')) $('#universityResultsCount').textContent = items.length; updateUniversitySearchState(items.length);
    const selectedProvince = $('#universityCity')?.value || 'all';
    grid.innerHTML = visibleItems.length ? visibleItems.map(item => { const selected = comparedUniversities.includes(item.id); const founded = item.founded ? item.founded : 'غير مذكورة'; const expanded = expandedUniversityCards.has(item.id); const detailsId = `university-details-${item.id}`; return `<article class="university-card panel university-disclosure ${expanded ? 'is-expanded' : ''}" data-university-card="${escapeHTML(item.id)}"><button class="university-card-trigger" type="button" data-university-toggle="${escapeHTML(item.id)}" aria-expanded="${expanded}" aria-controls="${detailsId}"><span class="university-card-title"><span class="university-card-icon"><i class="fa-solid ${item.entity === 'معهد' ? 'fa-graduation-cap' : 'fa-building-columns'}"></i></span><span><b>${escapeHTML(item.name)}</b><small><i class="fa-solid fa-location-dot"></i> ${escapeHTML(item.location)} <em>·</em> ${escapeHTML(item.entity)}</small></span></span><span class="university-card-chevron"><i class="fa-solid fa-chevron-down"></i></span></button><div class="university-card-details" id="${detailsId}" ${expanded ? '' : 'hidden'}><p class="university-note">${escapeHTML(item.note)}</p><div class="university-facts"><span><i class="fa-solid fa-location-dot"></i>${escapeHTML(item.province)}</span><span><i class="fa-regular fa-calendar"></i>${founded}</span><span><i class="fa-solid fa-building-columns"></i>${escapeHTML(item.type)}</span></div><div class="university-fields">${item.fields.map(field => `<span>${escapeHTML(field)}</span>`).join('')}</div><div class="university-highlights"><b>مجالات مذكورة</b>${item.highlights.map(highlight => `<span>${escapeHTML(highlight)}</span>`).join('')}</div><div class="university-card-actions"><label class="compare-toggle"><input type="checkbox" data-university-compare="${escapeHTML(item.id)}" ${selected ? 'checked' : ''}><span>أضف للمقارنة</span></label><button class="outline-button" type="button" data-university-details="${escapeHTML(item.id)}"><i class="fa-solid fa-circle-info"></i> التفاصيل والميزات</button></div></div></article>`; }).join('') : `<div class="learning-empty panel"><i class="fa-solid fa-building-columns"></i><h3>لا توجد مؤسسة مذكورة</h3><p>${selectedProvince !== 'all' ? `لا يحتوي الكود المرفق على مؤسسة مسجلة ضمن محافظة ${escapeHTML(selectedProvince)}.` : 'غيّر المحافظة أو النوع أو المجال أو كلمات البحث.'}</p></div>`;
    const more = $('#loadMoreUniversities'); if (more) more.classList.toggle('hidden', items.length <= universityVisibleLimit);
  }

  function toggleUniversityCompare(id, checked) {
    if (checked && !comparedUniversities.includes(id)) { if (comparedUniversities.length >= 2) { renderUniversityDirectory(); return toast('يمكن مقارنة فرعين فقط في المرة الواحدة.'); } comparedUniversities.push(id); }
    if (!checked) comparedUniversities = comparedUniversities.filter(item => item !== id); saveUniversityCompare(); renderUniversityDirectory();
  }

  function openUniversityDetails(id) {
    const item = universityDirectory.find(university => university.id === id); if (!item) return; const founded = item.founded || 'غير مذكورة في الكود المرفق'; const official = item.official ? `<a class="outline-button" href="${escapeHTML(item.official)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-arrow-up-right-from-square"></i> الموقع الرسمي</a>` : '';
    openModal(`<div class="modal-head"><div><span class="eyebrow">تفاصيل المؤسسة</span><h3>${escapeHTML(item.name)}</h3></div><button class="close-modal" aria-label="إغلاق">×</button></div><div class="university-modal"><div class="university-detail-facts"><span><i class="fa-solid fa-location-dot"></i>${escapeHTML(item.location)}</span><span><i class="fa-regular fa-calendar"></i>${escapeHTML(String(founded))}</span><span><i class="fa-solid fa-building-columns"></i>${escapeHTML(item.type)} · ${escapeHTML(item.entity)}</span></div><p>${escapeHTML(item.note)}</p><h4>لمحة وميزات مذكورة</h4><ul>${item.advantages.map(advantage => `<li><i class="fa-solid fa-check"></i>${escapeHTML(advantage)}</li>`).join('')}</ul><h4>المجالات الظاهرة في البيانات</h4><div class="university-fields">${item.highlights.map(highlight => `<span>${escapeHTML(highlight)}</span>`).join('')}</div><div class="modal-actions">${official}<button class="primary-button close-modal" type="button"><i class="fa-solid fa-code-compare"></i> أضفها للمقارنة من القائمة</button></div></div>`);
  }

  function openUniversityCompare() {
    const items = comparedUniversities.map(id => universityDirectory.find(item => item.id === id)).filter(Boolean); if (!items.length) return;
    openModal(`<div class="modal-head"><div><span class="eyebrow">مقارنة إرشادية</span><h3>قارن خياراتك</h3></div><button class="close-modal" aria-label="إغلاق">×</button></div><div class="university-compare-table" style="--cols:${items.length + 1}"><div class="compare-row heading"><b>المعيار</b>${items.map(item => `<b>${escapeHTML(item.name)}</b>`).join('')}</div><div class="compare-row"><span>الموقع</span>${items.map(item => `<span>${escapeHTML(item.location)}</span>`).join('')}</div><div class="compare-row"><span>النوع</span>${items.map(item => `<span>${escapeHTML(item.type)} · ${escapeHTML(item.entity)}</span>`).join('')}</div><div class="compare-row"><span>سنة التأسيس</span>${items.map(item => `<span>${item.founded || 'غير مذكورة'}</span>`).join('')}</div><div class="compare-row"><span>المجالات</span>${items.map(item => `<span>${escapeHTML(item.fields.join(' · '))}</span>`).join('')}</div><div class="compare-row"><span>اللمحة</span>${items.map(item => `<span>${escapeHTML(item.details)}</span>`).join('')}</div></div><p class="comparison-disclaimer"><i class="fa-solid fa-circle-info"></i> المقارنة تنظيمية فقط ومبنية على الكود المرفق؛ تحقق من الجهة الرسمية من أجل البرنامج وشروط القبول الحالية.</p>`);
  }

  function resetUniversityVisibleLimit() { universityVisibleLimit = 12; renderUniversityDirectory(); }

  function initUniversities() {
    if (!$('#universityGrid')) return; populateUniversityProvinces(); renderUniversityCoverage(); renderUniversityDirectory();
    if (new URLSearchParams(location.search).get('compare') === '1') { requestAnimationFrame(() => { $('#universityGrid')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); toast('اختر فرعين من البطاقات ثم اضغط عرض المقارنة.'); }); }
    let searchFrame = 0;
    $('#universitySearch')?.addEventListener('input', () => { cancelAnimationFrame(searchFrame); searchFrame = requestAnimationFrame(resetUniversityVisibleLimit); });
    $('#clearUniversitySearch')?.addEventListener('click', () => { const input = $('#universitySearch'); if (!input) return; input.value = ''; input.focus(); resetUniversityVisibleLimit(); });
    ['universityCity', 'universityType', 'universityEntity', 'universityField'].forEach(id => $(`#${id}`)?.addEventListener('change', resetUniversityVisibleLimit));
    $('#universityCoverage')?.addEventListener('click', event => { const button = event.target.closest('[data-coverage-province]'); if (!button) return; const select = $('#universityCity'); if (select) { select.value = button.dataset.coverageProvince; resetUniversityVisibleLimit(); select.scrollIntoView({ behavior: 'smooth', block: 'center' }); } });
    $('#universityGrid')?.addEventListener('change', event => { const input = event.target.closest('[data-university-compare]'); if (input) toggleUniversityCompare(input.dataset.universityCompare, input.checked); });
    $('#universityGrid')?.addEventListener('click', event => { const trigger = event.target.closest('[data-university-toggle]'); if (trigger) { const id = trigger.dataset.universityToggle; const details = $(`#university-details-${id}`); const expanded = !expandedUniversityCards.has(id); expanded ? expandedUniversityCards.add(id) : expandedUniversityCards.delete(id); if (details) details.hidden = !expanded; trigger.setAttribute('aria-expanded', String(expanded)); trigger.closest('[data-university-card]')?.classList.toggle('is-expanded', expanded); return; } const details = event.target.closest('[data-university-details]'); if (details) openUniversityDetails(details.dataset.universityDetails); });
    $('#loadMoreUniversities')?.addEventListener('click', () => { universityVisibleLimit += 12; renderUniversityDirectory(); });
    $('#openUniversityCompare')?.addEventListener('click', openUniversityCompare); $('#clearUniversityCompare')?.addEventListener('click', () => { comparedUniversities = []; saveUniversityCompare(); renderUniversityDirectory(); });
  }

  const majorCatalogData = [
    { id: 'media', name: 'الإعلام', description: 'دراسة الإعلام المكتوب والمرئي والمسموع وتقنيات الاتصال.', fields: ['الصحافة', 'التلفزيون', 'الإذاعة', 'العلاقات العامة'], jobs: ['القنوات الإعلامية', 'الصحف', 'شركات الإنتاج', 'وكالات العلاقات العامة'], category: 'arts', icon: 'fa-tower-broadcast', tone: 'blue' },
    { id: 'history', name: 'التاريخ', description: 'دراسة الأحداث والحضارات وتطور الشعوب عبر الزمن.', fields: ['التاريخ القديم', 'التاريخ الحديث', 'علم الآثار', 'التاريخ السياسي'], jobs: ['التعليم', 'البحث', 'المتاحف', 'الإعلام'], category: 'arts', icon: 'fa-landmark', tone: 'violet' },
    { id: 'lab', name: 'التحاليل المخبرية', description: 'تحليل العينات الطبية للمساعدة في التشخيص ومتابعة العلاج.', fields: ['الكيمياء السريرية', 'علم الدم', 'علم المناعة', 'الأحياء الدقيقة'], jobs: ['مختبرات طبية', 'مستشفيات', 'مراكز أبحاث'], category: 'medical', icon: 'fa-vial', tone: 'red' },
    { id: 'anesthesia', name: 'التخدير', description: 'مجال صحي يهتم بالتخدير وإدارة حالة المريض أثناء الإجراءات الطبية.', fields: ['التخدير العام', 'التخدير الموضعي', 'الرعاية المركزة', 'تخدير الأطفال'], jobs: ['المستشفيات', 'مراكز الجراحة', 'العيادات التخصصية'], category: 'medical', icon: 'fa-syringe', tone: 'orange' },
    { id: 'nursing', name: 'التمريض', description: 'تقديم الرعاية الصحية والدعم المباشر للمرضى في المؤسسات الصحية.', fields: ['تمريض الأطفال', 'تمريض الطوارئ', 'تمريض الصحة النفسية', 'التمريض المجتمعي'], jobs: ['مستشفيات', 'مراكز رعاية صحية', 'دور رعاية', 'تعليم التمريض'], category: 'medical', icon: 'fa-user-nurse', tone: 'green' },
    { id: 'geography', name: 'الجغرافيا', description: 'دراسة الأرض والمناخ والسكان والظواهر الطبيعية.', fields: ['الجغرافيا الطبيعية', 'الجغرافيا البشرية', 'نظم المعلومات الجغرافية'], jobs: ['التخطيط العمراني', 'البيئة', 'التعليم', 'المراكز البحثية'], category: 'science', icon: 'fa-earth-americas', tone: 'teal' },
    { id: 'law', name: 'الحقوق', description: 'دراسة القوانين المدنية والجنائية والدولية وحقوق الإنسان.', fields: ['القانون المدني', 'القانون الجنائي', 'القانون الدولي', 'القانون التجاري'], jobs: ['المحاماة', 'القضاء', 'المؤسسات الحكومية', 'الشركات'], category: 'law', icon: 'fa-scale-balanced', tone: 'slate' },
    { id: 'mathematics', name: 'الرياضيات', description: 'دراسة الحساب والجبر والهندسة والإحصاء والرياضيات التطبيقية.', fields: ['التدريس', 'الإحصاء', 'الرياضيات المالية', 'البرمجة', 'البحث العلمي'], jobs: ['التعليم', 'البنوك', 'شركات التكنولوجيا', 'الأبحاث'], category: 'science', icon: 'fa-square-root-variable', tone: 'violet' },
    { id: 'sharia', name: 'الشريعة', description: 'دراسة القانون الإسلامي وأحكامه في العبادات والمعاملات.', fields: ['الفقه', 'أصول الفقه', 'القانون الإسلامي', 'الدراسات القرآنية'], jobs: ['القضاء الشرعي', 'التدريس', 'العمل في الهيئات الدينية'], category: 'law', icon: 'fa-mosque', tone: 'amber' },
    { id: 'pharmacy', name: 'الصيدلة', description: 'دراسة الأدوية وتركيبها وتأثيراتها وتحضيرها.', fields: ['الصيدلة السريرية', 'الصيدلة الصناعية', 'الصيدلة المجتمعية', 'أبحاث الدواء'], jobs: ['صيدليات', 'شركات الأدوية', 'مختبرات الأبحاث', 'الرقابة الدوائية'], category: 'medical', icon: 'fa-pills', tone: 'blue' },
    { id: 'medicine', name: 'الطب البشري', description: 'دراسة الرعاية الصحية للإنسان بهدف التشخيص والعلاج والوقاية.', fields: ['الجراحة', 'الباطنة', 'الأطفال', 'الجلدية', 'الطب النفسي', 'الطب الطارئ'], jobs: ['مستشفيات', 'عيادات', 'مراكز أبحاث', 'التعليم الطبي', 'الصحة العامة'], category: 'medical', icon: 'fa-user-doctor', tone: 'red' },
    { id: 'science', name: 'العلوم', description: 'دراسة العلوم الأساسية مثل الفيزياء والكيمياء والأحياء.', fields: ['الفيزياء', 'الكيمياء', 'الأحياء', 'الأبحاث العلمية'], jobs: ['التعليم', 'الأبحاث', 'المختبرات', 'الصناعات'], category: 'science', icon: 'fa-atom', tone: 'green' },
    { id: 'political-science', name: 'العلوم السياسية', description: 'دراسة الأنظمة السياسية والعلاقات الدولية والنظريات السياسية.', fields: ['السياسة المحلية', 'العلاقات الدولية', 'حقوق الإنسان', 'السياسات العامة'], jobs: ['المؤسسات الحكومية', 'المنظمات', 'الأبحاث', 'الإعلام'], category: 'law', icon: 'fa-landmark', tone: 'blue' },
    { id: 'english', name: 'اللغة الإنجليزية', description: 'دراسة اللغة الإنجليزية وآدابها وقواعدها وثقافتها.', fields: ['الترجمة', 'تعليم اللغة', 'الأدب الإنجليزي', 'اللغويات'], jobs: ['التعليم', 'الترجمة', 'الإعلام', 'الشركات'], category: 'arts', icon: 'fa-language', tone: 'violet' },
    { id: 'arabic', name: 'اللغة العربية', description: 'دراسة اللغة العربية وآدابها من النحو والبلاغة والأدب.', fields: ['التعليم', 'الأدب', 'الصحافة', 'الترجمة'], jobs: ['المدارس', 'الإعلام', 'مؤسسات الترجمة', 'البحث العلمي'], category: 'arts', icon: 'fa-book', tone: 'amber' },
    { id: 'electrical', name: 'الهندسة الكهربائية', description: 'دراسة الكهرباء والإلكترونيات وتطبيقاتها في الطاقة والتحكم.', fields: ['أنظمة القوى', 'الإلكترونيات', 'الاتصالات', 'التحكم الآلي'], jobs: ['شركات الطاقة', 'تصنيع الأجهزة', 'قطاع الاتصالات'], category: 'engineering', icon: 'fa-bolt', tone: 'amber' },
    { id: 'civil', name: 'الهندسة المدنية', description: 'تصميم وتنفيذ البنية التحتية مثل الطرق والجسور والمباني.', fields: ['الطرق', 'المنشآت', 'النقل', 'هندسة البيئة'], jobs: ['المقاولات', 'التخطيط العمراني', 'الهيئات الحكومية', 'الاستشارات'], category: 'engineering', icon: 'fa-helmet-safety', tone: 'orange' },
    { id: 'informatics', name: 'الهندسة المعلوماتية', description: 'دراسة تصميم وتطوير وصيانة نظم الحاسوب والبرمجيات.', fields: ['تطوير البرمجيات', 'شبكات الحاسوب', 'قواعد البيانات', 'الأمن السيبراني', 'الذكاء الاصطناعي'], jobs: ['شركات التقنية', 'البنوك', 'المؤسسات', 'مشاريع البرمجة'], category: 'engineering', icon: 'fa-laptop-code', tone: 'blue' },
    { id: 'architecture', name: 'الهندسة المعمارية', description: 'تصميم المباني والمساحات الحضرية مع التركيز على الجمال والوظيفة.', fields: ['التصميم المعماري', 'تخطيط المدن', 'التراث العمراني', 'التصميم الداخلي'], jobs: ['مكاتب التصميم', 'شركات المقاولات', 'الجهات الحكومية', 'الاستشارات'], category: 'engineering', icon: 'fa-compass-drafting', tone: 'slate' },
    { id: 'dentistry', name: 'طب الأسنان', description: 'تخصص يهتم بصحة الفم والأسنان واللثة والفكين.', fields: ['تقويم الأسنان', 'جراحة الفم', 'أسنان الأطفال', 'التجميل'], jobs: ['عيادات الأسنان', 'المستشفيات', 'مراكز العناية بالفم', 'البحث العلمي'], category: 'medical', icon: 'fa-tooth', tone: 'teal' },
    { id: 'design-institute', name: 'معهد التصميم', description: 'دراسة الفنون التطبيقية مثل التصميم الجرافيكي والأزياء والمنتجات.', fields: ['التصميم الجرافيكي', 'الديكور', 'التصميم الصناعي'], jobs: ['وكالات الإعلان', 'شركات التصميم', 'الصناعات الإبداعية'], category: 'tech', icon: 'fa-palette', tone: 'red' }
  ];
  let activeMajorCategory = 'all';

  function filteredMajors() {
    const query = String($('#majorSearch')?.value || '').trim().toLowerCase();
    return majorCatalogData.filter(item => (activeMajorCategory === 'all' || item.category === activeMajorCategory) && (!query || `${item.name} ${item.description} ${item.fields.join(' ')} ${item.jobs.join(' ')}`.toLowerCase().includes(query)));
  }

  function renderMajorCatalog() {
    const catalog = $('#majorCatalog'); if (!catalog) return; const items = filteredMajors();
    if ($('#majorCount')) $('#majorCount').textContent = items.length;
    $$('[data-major-category]').forEach(button => button.classList.toggle('active', button.dataset.majorCategory === activeMajorCategory));
    catalog.innerHTML = items.length ? items.map(item => `<button class="major-list-card ${escapeHTML(item.tone)}" type="button" data-major-details="${escapeHTML(item.id)}"><span class="major-list-icon"><i class="fa-solid ${escapeHTML(item.icon)}"></i></span><span class="major-list-copy"><b>${escapeHTML(item.name)}</b><small>${escapeHTML(item.description)}</small></span><i class="fa-solid fa-chevron-left"></i></button>`).join('') : '<div class="learning-empty panel"><i class="fa-solid fa-magnifying-glass"></i><h3>لا توجد نتائج مطابقة</h3><p>جرّب اسمًا أو مجالًا مختلفًا.</p></div>';
  }

  function openMajorDetails(id) {
    const item = majorCatalogData.find(major => major.id === id); if (!item) return;
    openModal(`<div class="modal-head"><div><span class="eyebrow">دليل التخصصات</span><h3>${escapeHTML(item.name)}</h3></div><button class="close-modal" aria-label="إغلاق">×</button></div><div class="major-modal"><span class="major-modal-icon ${escapeHTML(item.tone)}"><i class="fa-solid ${escapeHTML(item.icon)}"></i></span><p>${escapeHTML(item.description)}</p><h4>مجالات التخصص</h4><ul>${item.fields.map(field => `<li><i class="fa-solid fa-check"></i>${escapeHTML(field)}</li>`).join('')}</ul><h4>فرص عمل محتملة</h4><ul>${item.jobs.map(job => `<li><i class="fa-solid fa-briefcase"></i>${escapeHTML(job)}</li>`).join('')}</ul><p class="comparison-disclaimer"><i class="fa-solid fa-circle-info"></i> توفر التخصص وفرص العمل والاعتراف تختلف بحسب الجهة والسنة؛ تحقق من المصدر الرسمي قبل القرار.</p></div>`);
  }

  function initUniversityMajors() {
    if (!$('#majorCatalog')) return; renderMajorCatalog();
    $('#majorSearch')?.addEventListener('input', renderMajorCatalog);
    $('#majorCategories')?.addEventListener('click', event => { const button = event.target.closest('[data-major-category]'); if (!button) return; activeMajorCategory = button.dataset.majorCategory; renderMajorCatalog(); });
    $('#majorCatalog')?.addEventListener('click', event => { const button = event.target.closest('[data-major-details]'); if (button) openMajorDetails(button.dataset.majorDetails); });
  }

  const universityWhatsAppChannel = 'https://whatsapp.com/channel/0029Vb84gXUISTkDgZDFVd2L';
  const universityInfoData = {
    admission: {
      mode: 'announcement', icon: 'fa-file-lines', tone: 'amber', kicker: 'المفاضلة الجامعية', title: 'المفاضلة الجامعية 2026',
      announcementTitle: 'دورة 2026 لم تصدر بعد', announcement: 'سيتم الإعلان عنها عبر منصة نبض التفوق. سارع للانضمام إلى القناة لمتابعة المستجدات فور نشرها.',
      support: 'لا تعتمد أي موعد أو شرط قبل صدوره من الجهة الرسمية المختصة.'
    },
    registration: {
      mode: 'announcement', icon: 'fa-user-plus', tone: 'violet', kicker: 'التسجيل على المفاضلات', title: 'طريقة التسجيل على المفاضلات',
      announcementTitle: 'الخدمة سيتم الإعلان عنها قريبًا', announcement: 'سيتم الإعلان عنها عبر قناة نبض التفوق. سارع للانضمام لتصلك خطوات التسجيل عند توفرها.',
      support: 'سيتضمن الدليل خطوات مرتبة ومبسطة عند إعلان آلية التسجيل الرسمية.'
    },
    transfer: {
      mode: 'transfer', icon: 'fa-right-left', tone: 'red', kicker: 'دليل النقل والتحويل', title: 'النقل والتحويل بين الجامعات',
      description: 'ملخص منظم مستخرج من النص المرفق لمساعدتك على فهم المسار والوثائق والنقاط التي يجب مراجعتها قبل تقديم أي طلب.',
      sections: [
        { number: '01', title: 'إجراءات التحويل', subtitle: 'المسار الإداري الوارد في النص', points: ['يُقدّم طلب التحويل إلى ديوان الكلية أو المعهد المقصود.', 'تُرفق الوثائق المطلوبة، ثم يدرس مجلس الكلية أو المعهد الطلب.', 'يُرفع الطلب إلى مجلس الجامعة لإصدار القرار، ويُبلّغ الطالب بعد الموافقة لتثبيت التسجيل الجديد.'] },
        { number: '02', title: 'الوثائق والتنظيم', subtitle: 'تجهيزات قبل تقديم الطلب', points: ['طلب رسمي، وصورة عن الشهادة الثانوية، وكشف بالمقررات التي دُرست.', 'براءة ذمة مالية من الجامعة الأصلية، وموافقة الجامعة المستقبلة عند طلبها.', 'لا يُحفظ قيدان جامعيان في الوقت نفسه؛ يُشطب القيد القديم عند قبول التحويل وفق النص المرفق.'] },
        { number: '03', title: 'نقاط يجب التحقق منها', subtitle: 'شروط واردة في النص المرفق', points: ['في النقل الحكومي، يُذكر تطابق الاختصاص وتشابه الخطة الدراسية واجتياز السنة الأولى بنجاح.', 'قد تُنظر مبررات أكاديمية أو إنسانية، وقد تتطلب الحالات الخاصة موافقات إضافية.', 'يمكن لمجلس الكلية تحديد المقررات المعادلة عند اختلاف بعض المواد بين الخطتين.'] }
      ],
      rules: [
        { title: 'الاختصاص والخطة الدراسية', text: 'يركز النص المرفق على تطابق الاختصاص أو قربه، وعلى تشابه المقررات والخطة الدراسية مع الجهة المراد الانتقال إليها.' },
        { title: 'المعدل والمقعد والشروط الخاصة', text: 'يشير النص إلى ضرورة استيفاء معدل الجهة المستقبلة عندما يكون مطلوبًا، وإلى مراعاة الشواغر والموافقات في بعض الحالات.' },
        { title: 'الجهة صاحبة القرار', text: 'يذكر النص أن القرار يمر عبر مجالس الكلية والجامعة، وقد يحتاج موافقة الوزارة أو جهات أخرى بحسب حالة النقل.' }
      ],
      support: 'هذا الملخص مستخرج من الملف المرفق لغرض التنظيم فقط، وقد تختلف الضوابط والمواعيد والوثائق حسب القرار الرسمي والسنة والجهة.'
    }
  };

  function universityInfoHero(item) {
    return `<header class="university-info-hero ${escapeHTML(item.tone)}"><span><i class="fa-solid ${escapeHTML(item.icon)}"></i></span><div><small>${escapeHTML(item.kicker)}</small><h2>${escapeHTML(item.title)}</h2>${item.description ? `<p>${escapeHTML(item.description)}</p>` : ''}</div></header>`;
  }

  function initUniversityInfo() {
    const view = $('#universityInfoView'); if (!view) return;
    const topic = new URLSearchParams(location.search).get('topic'); const item = universityInfoData[topic] || universityInfoData.admission;
    document.title = `نبض التفوق | ${item.title}`;
    if (item.mode === 'announcement') {
      view.innerHTML = `${universityInfoHero(item)}<section class="university-announcement-card panel"><span class="university-announcement-icon"><i class="fa-solid fa-bullhorn"></i></span><div><span class="eyebrow">تنبيه للطلاب</span><h3>${escapeHTML(item.announcementTitle)}</h3><p>${escapeHTML(item.announcement)}</p></div><a class="primary-button university-whatsapp-button" href="${universityWhatsAppChannel}" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-whatsapp"></i> انضم إلى قناة واتساب</a></section><aside class="university-data-note"><i class="fa-solid fa-circle-info"></i><p>${escapeHTML(item.support)}</p></aside>`;
      return;
    }
    view.innerHTML = `${universityInfoHero(item)}<section class="university-transfer-intro panel"><span><i class="fa-solid fa-clipboard-check"></i></span><p>${escapeHTML(item.description)}</p></section><section class="university-info-stack">${item.sections.map(section => `<article class="university-info-card"><header><span>${escapeHTML(section.number)}</span><div><b>${escapeHTML(section.title)}</b><small>${escapeHTML(section.subtitle)}</small></div></header><ol>${section.points.map(point => `<li>${escapeHTML(point)}</li>`).join('')}</ol></article>`).join('')}</section><section class="university-transfer-rules panel"><header><span><i class="fa-solid fa-scale-balanced"></i></span><div><span class="eyebrow">مراجعة سريعة</span><h3>أحكام ونقاط مهمة</h3></div></header>${item.rules.map((rule, index) => `<details class="university-transfer-rule" ${index === 0 ? 'open' : ''}><summary><span>${escapeHTML(rule.title)}</span><i class="fa-solid fa-chevron-down"></i></summary><p>${escapeHTML(rule.text)}</p></details>`).join('')}</section><aside class="university-data-note"><i class="fa-solid fa-circle-info"></i><p>${escapeHTML(item.support)}</p></aside>`;
  }

  const curriculumHub = {
    science: {
      label: 'بكالوريا علمي', subtitle: 'كتب وملخصات ونماذج تدريب وحدود النجاح للفرع العلمي.', icon: 'fa-flask', accent: 'science',
      resources: {
        books: { title: 'كتب المنهاج', description: 'بطاقات المواد الأساسية للمنهاج العلمي.', cards: [
          ['الرياضيات', 'التفاضل والتكامل والجبر', 'fa-square-root-variable'], ['الفيزياء', 'الميكانيك والكهرباء والحديثة', 'fa-atom'], ['الكيمياء', 'العضوية واللاعضوية والحسابات', 'fa-flask'], ['العلوم', 'الوراثة والأجهزة الحيوية', 'fa-dna'], ['العربية واللغات', 'عربي وإنكليزي وفرنسي وإسلامية', 'fa-language']
        ] },
        summaries: { title: 'ملخصات', description: 'محاور تلخيص سريعة لتنظيم المراجعة قبل الاختبار.', cards: [
          ['ملخص قوانين الرياضيات', 'قواعد أساسية ومسائل متدرجة', 'fa-function'], ['ملخص الفيزياء', 'قوانين ووحدات ومخططات', 'fa-bolt'], ['ملخص الكيمياء', 'معادلات ومقارنات وتفاعلات', 'fa-vial'], ['ملخص العلوم', 'مصطلحات ورسوم وعمليات حيوية', 'fa-leaf']
        ] },
        exams: { title: 'أسئلة دورات ونماذج', description: 'نماذج تدريبية مرتبة بحسب المادة ونمط السؤال.', cards: [
          ['دورات الرياضيات', 'تدريب على المسائل المركبة', 'fa-file-circle-check'], ['نماذج الفيزياء', 'قوانين وتطبيقات ومسائل', 'fa-clipboard-question'], ['نماذج الكيمياء والعلوم', 'أسئلة فهم وتطبيق', 'fa-file-pen'], ['نماذج اللغات', 'قراءة وقواعد وتعبير', 'fa-spell-check']
        ] },
        success: { title: 'حدود النجاح', description: 'العلامة التامة وحد الكسر لكل مادة في البكالوريا العلمي.', cards: [
          ['الرياضيات', '600 علامة · حد الكسر 240', 'fa-square-root-variable'], ['العربي والفيزياء', '400 لكل مادة · حد الكسر 160', 'fa-book-open'], ['الإنكليزي والفرنسي والعلوم', '300 لكل مادة · حد الكسر 120', 'fa-chart-simple'], ['الإسلامية والكيمياء', '200 لكل مادة · حد الكسر 80', 'fa-scale-balanced'], ['مجموع المرحلة', '2700 علامة · مجموع حدود الكسر 1080', 'fa-calculator']
        ] },
        channels: { title: 'القنوات التعليمية المجانية', description: 'انتقل إلى قائمة القنوات التعليمية المتاحة للمواد.', cards: [
          { title: 'قنوات البكالوريا العلمي', note: 'روابط المواد والمراجعات المجانية', icon: 'fa-bullhorn', href: 'free-channels.html' }, { title: 'المكتبة المجانية', note: 'مصادر وملخصات داخل التطبيق', icon: 'fa-book-bookmark', href: 'library.html' }
        ] }
      }
    },
    literary: {
      label: 'بكالوريا أدبي', subtitle: 'كتب وملخصات ونماذج تدريب وحدود النجاح للفرع الأدبي.', icon: 'fa-feather-pointed', accent: 'literary',
      resources: {
        books: { title: 'كتب المنهاج', description: 'بطاقات المواد الأساسية للمنهاج الأدبي.', cards: [
          ['اللغة العربية', 'الأدب والنحو والقراءة', 'fa-language'], ['التاريخ والجغرافيا', 'أحداث وخرائط ومصطلحات', 'fa-landmark'], ['الفلسفة', 'مفاهيم ومدارس ومنطق', 'fa-brain'], ['اللغات والإسلامية', 'إنكليزي وفرنسي وإسلامية', 'fa-book-open']
        ] },
        summaries: { title: 'ملخصات', description: 'تلخيصات منظمة لربط المفاهيم والتواريخ والنصوص.', cards: [
          ['ملخصات الأدب والنحو', 'شواهد وقواعد وأفكار نصوص', 'fa-pen-nib'], ['ملخصات التاريخ', 'خطوط زمنية وأحداث وشخصيات', 'fa-timeline'], ['ملخصات الجغرافيا', 'خرائط ومفاهيم اقتصادية', 'fa-map-location-dot'], ['ملخصات الفلسفة', 'تعريفات ومقارنات وأمثلة', 'fa-lightbulb']
        ] },
        exams: { title: 'أسئلة دورات ونماذج', description: 'نماذج مراجعة للتدريب على صياغة الإجابة وترتيبها.', cards: [
          ['نماذج العربية', 'النصوص والقواعد والتعبير', 'fa-file-lines'], ['دورات التاريخ والجغرافيا', 'أسئلة الأحداث والخرائط', 'fa-earth-americas'], ['نماذج الفلسفة', 'مفاهيم ومقارنات وتحليل', 'fa-comments'], ['نماذج اللغات', 'قواعد وقراءة وتعبير', 'fa-language']
        ] },
        success: { title: 'حدود النجاح', description: 'العلامة التامة وحد الكسر لكل مادة في البكالوريا الأدبي.', cards: [
          ['اللغة العربية', '600 علامة · حد الكسر 300', 'fa-language'], ['الإنكليزي والفرنسي', '400 لكل مادة · حد الكسر 160', 'fa-book-open'], ['الإسلامية والتاريخ والجغرافيا والفلسفة', '200 لكل مادة · حد الكسر 80', 'fa-scale-balanced'], ['مجموع المرحلة', '2200 علامة · مجموع حدود الكسر 940', 'fa-calculator']
        ] },
        channels: { title: 'القنوات التعليمية المجانية', description: 'انتقل إلى قائمة القنوات التعليمية المتاحة للمواد.', cards: [
          { title: 'قنوات البكالوريا الأدبي', note: 'روابط المواد والمراجعات المجانية', icon: 'fa-bullhorn', href: 'free-channels.html' }, { title: 'المكتبة المجانية', note: 'مصادر وملخصات داخل التطبيق', icon: 'fa-book-bookmark', href: 'library.html' }
        ] }
      }
    },
    nine: {
      label: 'التاسع', subtitle: 'كتب وملخصات ونماذج تدريب وحدود النجاح لمرحلة التاسع.', icon: 'fa-school', accent: 'nine',
      resources: {
        books: { title: 'كتب المنهاج', description: 'بطاقات المواد الأساسية لمنهاج التاسع.', cards: [
          ['اللغة العربية', 'نصوص وقواعد وتعبير', 'fa-language'], ['الرياضيات', 'جبر وهندسة ومسائل', 'fa-square-root-variable'], ['العلوم العامة', 'فيزياء وكيمياء وعلوم حياة', 'fa-flask'], ['الاجتماعيات', 'تاريخ وجغرافيا وتربية وطنية', 'fa-earth-americas'], ['اللغات والإسلامية', 'إنكليزي وفرنسي وإسلامية', 'fa-book-open']
        ] },
        summaries: { title: 'ملخصات', description: 'خطط تلخيص صغيرة لتثبيت المفاهيم والرسوم والقواعد.', cards: [
          ['ملخص الرياضيات', 'قوانين وأمثلة متدرجة', 'fa-ruler-combined'], ['ملخص العلوم', 'عمليات وتجارب ومصطلحات', 'fa-microscope'], ['ملخص الاجتماعيات', 'خرائط وتواريخ وأفكار', 'fa-map'], ['ملخص اللغات', 'قواعد ومفردات وقراءة', 'fa-spell-check']
        ] },
        exams: { title: 'أسئلة دورات ونماذج', description: 'مجموعة تدريبية لمراجعة نوع السؤال قبل الاختبار.', cards: [
          ['نماذج الرياضيات', 'تمارين جبر وهندسة', 'fa-file-circle-check'], ['نماذج العلوم', 'أسئلة فهم ورسوم وتجارب', 'fa-clipboard-question'], ['نماذج الاجتماعيات', 'أحداث وخرائط ومصطلحات', 'fa-file-pen'], ['نماذج اللغات', 'قراءة وقواعد وتعبير', 'fa-language']
        ] },
        success: { title: 'حدود النجاح', description: 'العلامة التامة وحد الكسر لكل مادة في مرحلة التاسع.', cards: [
          ['العربي والاجتماعيات والرياضيات', '600 لكل مادة · حدود الكسر 300 و240 و240', 'fa-calculator'], ['العلوم العامة', '400 علامة · حد الكسر 120', 'fa-flask'], ['الإنكليزي والفرنسي', '400 لكل مادة · حد الكسر 160', 'fa-language'], ['الإسلامية', '200 علامة · حد الكسر 80', 'fa-scale-balanced'], ['مجموع المرحلة', '3200 علامة · مجموع حدود الكسر 1300', 'fa-chart-simple']
        ] },
        channels: { title: 'القنوات التعليمية المجانية', description: 'انتقل إلى قائمة القنوات التعليمية المتاحة للمواد.', cards: [
          { title: 'قنوات التاسع', note: 'روابط المواد والمراجعات المجانية', icon: 'fa-bullhorn', href: 'free-channels.html' }, { title: 'المكتبة المجانية', note: 'مصادر وملخصات داخل التطبيق', icon: 'fa-book-bookmark', href: 'library.html' }
        ] }
      }
    }
  };
  const curriculumResourceMeta = {
    books: { kicker: 'مراجع الدراسة', icon: 'fa-book' }, summaries: { kicker: 'مراجعة مركزة', icon: 'fa-note-sticky' }, exams: { kicker: 'تدريب واختبار', icon: 'fa-file-circle-check' }, success: { kicker: 'العلامات والحدود', icon: 'fa-chart-simple' }, channels: { kicker: 'مصادر مجانية', icon: 'fa-bullhorn' }
  };
  const curriculumSubjects = {
    science: [
      { title: 'عربي', scope: 'الأدب والنحو والقراءة', summary: 'قواعد وشواهد وأفكار النصوص', exam: 'نصوص وقواعد وتعبير', icon: 'fa-language', max: 400, pass: 160 },
      { title: 'رياضيات', scope: 'التفاضل والتكامل والجبر', summary: 'قوانين وأمثلة ومسائل متدرجة', exam: 'مسائل ونماذج تدريبية', icon: 'fa-square-root-variable', max: 600, pass: 240 },
      { title: 'علوم', scope: 'الوراثة والأجهزة الحيوية', summary: 'رسوم ومصطلحات وعمليات', exam: 'فهم وتطبيق وأسئلة شاملة', icon: 'fa-dna', max: 300, pass: 120 },
      { title: 'فيزياء', scope: 'الميكانيك والكهرباء والحديثة', summary: 'قوانين ووحدات ومخططات', exam: 'مسائل وقوانين ونماذج', icon: 'fa-atom', max: 400, pass: 160 },
      { title: 'كيمياء', scope: 'العضوية واللاعضوية والحسابات', summary: 'معادلات وتفاعلات ومقارنات', exam: 'أسئلة تفاعلات وحسابات', icon: 'fa-flask', max: 200, pass: 80 },
      { title: 'إسلامية', scope: 'التربية الإسلامية ومحاورها', summary: 'مفاهيم وتعريفات وأدلة', exam: 'أسئلة حفظ وفهم وتطبيق', icon: 'fa-mosque', max: 200, pass: 80 },
      { title: 'إنكليزي', scope: 'قواعد وقراءة ومفردات', summary: 'قواعد وكلمات أساسية', exam: 'قراءة وقواعد وتعبير', icon: 'fa-book-open', max: 300, pass: 120 },
      { title: 'فرنسي', scope: 'قواعد وقراءة ومفردات', summary: 'قواعد وكلمات أساسية', exam: 'قراءة وقواعد وتعبير', icon: 'fa-language', max: 300, pass: 120 }
    ],
    literary: [
      { title: 'عربي', scope: 'الأدب والنحو والقراءة', summary: 'قواعد وشواهد وأفكار النصوص', exam: 'نصوص وقواعد وتعبير', icon: 'fa-language', max: 600, pass: 300 },
      { title: 'تاريخ', scope: 'الأحداث والشخصيات والعصور', summary: 'خطوط زمنية وأفكار أساسية', exam: 'أسئلة أحداث وتعليل ومقارنة', icon: 'fa-landmark', max: 200, pass: 80 },
      { title: 'جغرافيا', scope: 'الخرائط والسكان والاقتصاد', summary: 'مصطلحات وخرائط مفاهيم', exam: 'خرائط ومفاهيم وتطبيقات', icon: 'fa-map-location-dot', max: 200, pass: 80 },
      { title: 'فلسفة', scope: 'المنطق والمدارس والمفاهيم', summary: 'تعريفات ومقارنات وأمثلة', exam: 'تحليل ومقارنة وشرح', icon: 'fa-brain', max: 200, pass: 80 },
      { title: 'إسلامية', scope: 'التربية الإسلامية ومحاورها', summary: 'مفاهيم وتعريفات وأدلة', exam: 'أسئلة حفظ وفهم وتطبيق', icon: 'fa-mosque', max: 200, pass: 80 },
      { title: 'إنكليزي', scope: 'قواعد وقراءة ومفردات', summary: 'قواعد وكلمات أساسية', exam: 'قراءة وقواعد وتعبير', icon: 'fa-book-open', max: 400, pass: 160 },
      { title: 'فرنسي', scope: 'قواعد وقراءة ومفردات', summary: 'قواعد وكلمات أساسية', exam: 'قراءة وقواعد وتعبير', icon: 'fa-language', max: 400, pass: 160 }
    ],
    nine: [
      { title: 'عربي', scope: 'نصوص وقواعد وتعبير', summary: 'قواعد وشواهد وأفكار النصوص', exam: 'نصوص وقواعد وتعبير', icon: 'fa-language', max: 600, pass: 300 },
      { title: 'علوم عامة', scope: 'فيزياء وكيمياء وعلوم حياة', summary: 'رسوم وتجارب ومصطلحات', exam: 'فهم وتطبيق وأسئلة شاملة', icon: 'fa-flask', max: 400, pass: 120 },
      { title: 'رياضيات', scope: 'جبر وهندسة ومسائل', summary: 'قوانين وأمثلة ومسائل متدرجة', exam: 'تمارين جبر وهندسة', icon: 'fa-square-root-variable', max: 600, pass: 240 },
      { title: 'إسلامية', scope: 'التربية الإسلامية ومحاورها', summary: 'مفاهيم وتعريفات وأدلة', exam: 'أسئلة حفظ وفهم وتطبيق', icon: 'fa-mosque', max: 200, pass: 80 },
      { title: 'تاريخ', scope: 'أحداث وشخصيات ومفاهيم', summary: 'خطوط زمنية وأفكار أساسية', exam: 'ضمن مادة الاجتماعيات', icon: 'fa-landmark', success: 'ضمن الاجتماعيات: 600 علامة · حد الكسر 240' },
      { title: 'جغرافيا', scope: 'خرائط وسكان واقتصاد', summary: 'مصطلحات وخرائط مفاهيم', exam: 'ضمن مادة الاجتماعيات', icon: 'fa-map-location-dot', success: 'ضمن الاجتماعيات: 600 علامة · حد الكسر 240' },
      { title: 'إنكليزي', scope: 'قواعد وقراءة ومفردات', summary: 'قواعد وكلمات أساسية', exam: 'قراءة وقواعد وتعبير', icon: 'fa-book-open', max: 400, pass: 160 },
      { title: 'فرنسي', scope: 'قواعد وقراءة ومفردات', summary: 'قواعد وكلمات أساسية', exam: 'قراءة وقواعد وتعبير', icon: 'fa-language', max: 400, pass: 160 }
    ]
  };
  let activeCurriculumStage = 'science';
  let activeCurriculumResource = 'books';

  function curriculumCards(stageKey, resourceKey) {
    const resource = curriculumHub[stageKey]?.resources?.[resourceKey];
    if (!resource) return [];
    if (!['books', 'summaries', 'exams', 'success'].includes(resourceKey)) return resource.cards;
    return (curriculumSubjects[stageKey] || []).map(subject => {
      const note = resourceKey === 'books' ? `كتاب المنهاج · ${subject.scope}` : resourceKey === 'summaries' ? `ملخص ${subject.title} · ${subject.summary}` : resourceKey === 'exams' ? `أسئلة دورات ونماذج · ${subject.exam}` : subject.success || `${subject.max} علامة · حد الكسر ${subject.pass}`;
      return { title: subject.title, note, icon: subject.icon };
    });
  }

  function normalizeCurriculumItem(item) {
    return Array.isArray(item) ? { title: item[0], note: item[1], icon: item[2] } : item;
  }

  function renderCurriculum() {
    const grid = $('#curriculumGrid'); const stage = curriculumHub[activeCurriculumStage]; if (!grid || !stage) return;
    const resource = stage.resources[activeCurriculumResource]; const meta = curriculumResourceMeta[activeCurriculumResource] || curriculumResourceMeta.books;
    $$('#curriculumStageTabs [data-curriculum-stage]').forEach(button => button.classList.toggle('active', button.dataset.curriculumStage === activeCurriculumStage));
    $$('#curriculumResourceTabs [data-curriculum-resource]').forEach(button => button.classList.toggle('active', button.dataset.curriculumResource === activeCurriculumResource));
    const summary = $('#curriculumStageSummary'); if (summary) summary.innerHTML = `<span class="curriculum-stage-summary-icon ${escapeHTML(stage.accent)}"><i class="fa-solid ${escapeHTML(stage.icon)}"></i></span><div><b>${escapeHTML(stage.label)}</b><small>${escapeHTML(stage.subtitle)}</small></div>`;
    if ($('#curriculumResourceKicker')) $('#curriculumResourceKicker').innerHTML = `<i class="fa-solid ${escapeHTML(meta.icon)}"></i> ${escapeHTML(meta.kicker)}`;
    if ($('#curriculumResourceTitle')) $('#curriculumResourceTitle').textContent = resource.title;
    if ($('#curriculumResourceDescription')) $('#curriculumResourceDescription').textContent = resource.description;
    const cards = curriculumCards(activeCurriculumStage, activeCurriculumResource);
    if ($('#curriculumResourceCount')) $('#curriculumResourceCount').textContent = cards.length;
    grid.innerHTML = cards.map((source, index) => { const item = normalizeCurriculumItem(source); const content = `<span class="curriculum-resource-icon"><i class="fa-solid ${escapeHTML(item.icon)}"></i></span><div><b>${escapeHTML(item.title)}</b><small>${escapeHTML(item.note)}</small></div><i class="fa-solid fa-arrow-left"></i>`; return item.href ? `<a class="curriculum-resource-card ${escapeHTML(stage.accent)}" href="${escapeHTML(item.href)}">${content}</a>` : `<button class="curriculum-resource-card ${escapeHTML(stage.accent)}" type="button" data-curriculum-item="${index}">${content}</button>`; }).join('');
  }

  function openCurriculumResource(index) {
    const stage = curriculumHub[activeCurriculumStage]; const resource = stage?.resources?.[activeCurriculumResource]; const item = normalizeCurriculumItem(curriculumCards(activeCurriculumStage, activeCurriculumResource)[Number(index)]); if (!stage || !resource || !item) return;
    openModal(`<div class="modal-head"><div><span class="eyebrow">${escapeHTML(stage.label)} · ${escapeHTML(resource.title)}</span><h3>${escapeHTML(item.title)}</h3></div><button class="close-modal" aria-label="إغلاق">×</button></div><div class="curriculum-resource-modal"><div class="curriculum-resource-modal-icon ${escapeHTML(stage.accent)}"><i class="fa-solid ${escapeHTML(item.icon)}"></i></div><p>${escapeHTML(item.note)}</p><div class="curriculum-resource-modal-note"><i class="fa-solid fa-circle-info"></i><span>هذه البوابة تنظّم مسارات المراجعة داخل التطبيق. استخدم قائمة القنوات أو المكتبة للوصول إلى الموارد المتاحة.</span></div><div class="modal-actions"><a class="outline-button" href="time-organizer.html"><i class="fa-solid fa-calendar-plus"></i> أضفها لجدولي</a><a class="primary-button" href="tests.html"><i class="fa-solid fa-clipboard-check"></i> افتح الاختبارات</a></div></div>`);
  }

  function initCurriculum() {
    if (!$('#curriculumGrid')) return;
    const scope = document.body.dataset.curriculumScope || 'all';
    const allowedStages = scope === 'nine' ? ['nine'] : scope === 'baccalaureate' ? ['science', 'literary'] : Object.keys(curriculumHub);
    const requestedStage = new URLSearchParams(location.search).get('stage') || location.hash.replace('#', '');
    activeCurriculumStage = allowedStages.includes(requestedStage) ? requestedStage : allowedStages.includes(activeCurriculumStage) ? activeCurriculumStage : allowedStages[0];
    renderCurriculum();
    $$('#curriculumStageTabs [data-curriculum-stage]').forEach(button => button.addEventListener('click', () => { const nextStage = button.dataset.curriculumStage; if (!allowedStages.includes(nextStage)) return; activeCurriculumStage = nextStage; activeCurriculumResource = 'books'; renderCurriculum(); }));
    $$('#curriculumResourceTabs [data-curriculum-resource]').forEach(button => button.addEventListener('click', () => { activeCurriculumResource = button.dataset.curriculumResource; renderCurriculum(); }));
    $('#curriculumGrid')?.addEventListener('click', event => { const item = event.target.closest('[data-curriculum-item]'); if (item) openCurriculumResource(item.dataset.curriculumItem); });
  }

  const predictionItems = [
    { id: 'physics-laws', stage: 'science', subject: 'الفيزياء', title: 'قوانين الحركة والكهرباء', type: 'محور مراجعة', source: 'إرشادي · تنظيم دراسة', points: ['اكتب القانون ووحداته قبل البدء بالحل.', 'راجع المسائل التي تجمع أكثر من فكرة.', 'قارن بين الحالات المتشابهة في جدول صغير.'], updated: '20 آب 2026' },
    { id: 'math-functions', stage: 'science', subject: 'الرياضيات', title: 'الدوال والتفاضل والتكامل', type: 'تدريب مركز', source: 'إرشادي · تمارين ذاتية', points: ['ابدأ بالتعريفات ثم القواعد الأساسية.', 'انتقل من سؤال مباشر إلى سؤال مركب.', 'دوّن الأخطاء المتكررة في ورقة مستقلة.'], updated: '20 آب 2026' },
    { id: 'arabic-reading', stage: 'literary', subject: 'اللغة العربية', title: 'النصوص والقواعد والتعبير', type: 'محور مراجعة', source: 'إرشادي · بناء مهارة', points: ['خصّص مراجعة منفصلة للنص والقواعد.', 'اجمع الشواهد في بطاقات مختصرة.', 'تدرّب على كتابة إجابة مرتبة وواضحة.'], updated: '20 آب 2026' },
    { id: 'history-maps', stage: 'literary', subject: 'التاريخ والجغرافيا', title: 'التسلسل الزمني والخرائط', type: 'تدريب مركز', source: 'إرشادي · تنظيم معلومات', points: ['اربط الأحداث بأسبابها ونتائجها.', 'راجع الخرائط بالمفتاح والموقع.', 'ضع التواريخ الأساسية في خط زمني.'], updated: '20 آب 2026' },
    { id: 'nine-science', stage: 'nine', subject: 'العلوم العامة', title: 'التجارب والمفاهيم الأساسية', type: 'محور مراجعة', source: 'إرشادي · مراجعة فهم', points: ['ارسم خطوات التجربة وملاحظاتها.', 'راجع المصطلح مع مثال بسيط.', 'حل أسئلة متنوعة بدل حفظ النص فقط.'], updated: '20 آب 2026' },
    { id: 'nine-math', stage: 'nine', subject: 'الرياضيات', title: 'الجبر والهندسة والمسائل', type: 'تدريب مركز', source: 'إرشادي · حل مسائل', points: ['راجع القاعدة مع مثال واحد على الأقل.', 'افصل بين معطيات المسألة والمطلوب.', 'تحقق من الناتج بالتعويض عند الإمكان.'], updated: '20 آب 2026' }
  ];
  let activePredictionFilter = 'all';

  function renderPredictions() {
    const grid = $('#predictionGrid'); if (!grid) return; const query = String($('#predictionSearch')?.value || '').trim().toLowerCase();
    const items = predictionItems.filter(item => (activePredictionFilter === 'all' || item.stage === activePredictionFilter) && (!query || `${item.subject} ${item.title} ${item.points.join(' ')}`.toLowerCase().includes(query)));
    $$('[data-prediction-filter]').forEach(button => button.classList.toggle('active', button.dataset.predictionFilter === activePredictionFilter));
    grid.innerHTML = items.length ? items.map(item => `<article class="prediction-card panel"><header><span class="prediction-stage ${escapeHTML(item.stage)}">${item.stage === 'science' ? 'بكالوريا علمي' : item.stage === 'literary' ? 'بكالوريا أدبي' : 'التاسع'}</span><span class="prediction-source"><i class="fa-solid fa-bookmark"></i> ${escapeHTML(item.source)}</span></header><h3>${escapeHTML(item.title)}</h3><p class="prediction-subject"><i class="fa-solid fa-book-open"></i> ${escapeHTML(item.subject)} · ${escapeHTML(item.type)}</p><ul>${item.points.slice(0, 2).map(point => `<li>${escapeHTML(point)}</li>`).join('')}</ul><footer><span><i class="fa-regular fa-calendar"></i> ${escapeHTML(item.updated)}</span><button class="outline-button" type="button" data-prediction-details="${item.id}">تفاصيل المراجعة <i class="fa-solid fa-arrow-left"></i></button></footer></article>`).join('') : '<div class="learning-empty panel"><i class="fa-solid fa-magnifying-glass"></i><h3>لا توجد محاور مطابقة</h3><p>اختر مرحلة أخرى أو ابحث باسم المادة.</p></div>';
  }

  function openPredictionDetails(id) {
    const item = predictionItems.find(entry => entry.id === id); if (!item) return;
    openModal(`<div class="modal-head"><div><span class="eyebrow">${escapeHTML(item.source)}</span><h3>${escapeHTML(item.title)}</h3></div><button class="close-modal" aria-label="إغلاق">×</button></div><div class="prediction-modal"><p><i class="fa-solid fa-book-open"></i> ${escapeHTML(item.subject)} · تم التحديث: ${escapeHTML(item.updated)}</p><h4>خطوات مراجعة عملية</h4><ol>${item.points.map(point => `<li>${escapeHTML(point)}</li>`).join('')}</ol><div class="modal-actions"><a class="outline-button" href="time-organizer.html"><i class="fa-solid fa-calendar-plus"></i> أضفها إلى خطتك</a><a class="primary-button" href="tests.html"><i class="fa-solid fa-clipboard-check"></i> ابدأ التدريب</a></div><small class="verification-text"><i class="fa-solid fa-circle-info"></i> تحقق دائمًا من المنهاج والنماذج والقرارات الرسمية الأحدث قبل الاعتماد على أي توقع.</small></div>`);
  }

  function initPredictions() {
    if (!$('#predictionGrid')) return; renderPredictions(); $('#predictionSearch')?.addEventListener('input', renderPredictions);
    $$('#predictionFilters [data-prediction-filter]').forEach(button => button.addEventListener('click', () => { activePredictionFilter = button.dataset.predictionFilter; renderPredictions(); }));
    $('#predictionGrid')?.addEventListener('click', event => { const details = event.target.closest('[data-prediction-details]'); if (details) openPredictionDetails(details.dataset.predictionDetails); });
  }

  const builtInLibraryResources = [
    { id: 'study-map', category: 'ملخص', subject: 'مهارات الدراسة', title: 'خريطة جلسة مراجعة فعّالة', description: 'تسلسل قصير للقراءة والاسترجاع والتدريب.', content: 'ابدأ بتحديد هدف واحد للجلسة. اقرأ الفكرة الأساسية، ثم أغلق المصدر واسترجعها بصوتك أو كتابتك. أخيرًا أجب عن سؤال أو مثال صغير وحدد نقطة واحدة تحتاج مراجعة لاحقة.' },
    { id: 'physics-units', category: 'قواعد', subject: 'الفيزياء', title: 'قائمة تحقق قبل حل المسألة', description: 'خطوات منظمة لفهم المعطيات والقانون والوحدة.', content: 'حدّد المعطيات والمطلوب، اكتب القانون المناسب، وحّد الوحدات، ثم عوّض بوضوح. بعد ظهور النتيجة افحص وحدتها ومنطقيتها مقارنة بالمعطيات.' },
    { id: 'arabic-review', category: 'ملخص', subject: 'اللغة العربية', title: 'بطاقة مراجعة النص والقواعد', description: 'تقسيم بسيط للنص والشواهد والقواعد.', content: 'في النص: الفكرة العامة والأفكار الفرعية والمفردات. في القواعد: القاعدة ومثال واحد واستثناء إن وجد. راجعها في بطاقة مختصرة بدل إعادة قراءة الدرس كاملًا.' },
    { id: 'test-routine', category: 'تدريب', subject: 'الاختبارات', title: 'روتين ما بعد الاختبار', description: 'طريقة مراجعة الأخطاء لتحويلها إلى خطة تعلم.', content: 'صنّف الخطأ: فهم، قانون، قراءة السؤال، أو إدارة وقت. اكتب التصحيح بجانب السبب، ثم أنشئ مثالًا واحدًا مشابهًا لتتأكد أن الفكرة ثبتت.' }
  ];
  let personalLibraryResources = readStorage('personal_library_resources', []); personalLibraryResources = Array.isArray(personalLibraryResources) ? personalLibraryResources : [];
  let activeLibraryFilter = 'all';
  const savePersonalLibraryResources = () => { try { localStorage.setItem(STORE + 'personal_library_resources', JSON.stringify(personalLibraryResources)); } catch { toast('تعذر حفظ المورد محليًا.'); } };
  const allLibraryResources = () => [...builtInLibraryResources];

  function renderLibrary() {
    const grid = $('#libraryGrid'); const empty = $('#libraryEmpty'); if (!grid || !empty) return; const query = String($('#librarySearch')?.value || '').trim().toLowerCase();
    const resources = allLibraryResources().filter(resource => (activeLibraryFilter === 'all' || resource.category === activeLibraryFilter) && (!query || `${resource.title} ${resource.subject} ${resource.description || ''}`.toLowerCase().includes(query)));
    $$('#libraryFilters [data-library-filter]').forEach(button => button.classList.toggle('active', button.dataset.libraryFilter === activeLibraryFilter)); empty.classList.toggle('hidden', resources.length > 0);
    grid.innerHTML = resources.map(resource => `<article class="library-card panel ${resource.category === 'شخصي' ? 'personal' : ''}"><header><span class="library-category ${escapeHTML(resource.category)}">${escapeHTML(resource.category)}</span>${resource.personal ? '<span class="library-personal"><i class="fa-solid fa-user"></i> محفوظ لدي</span>' : ''}</header><div class="library-card-icon"><i class="fa-solid ${resource.category === 'تدريب' ? 'fa-clipboard-check' : resource.category === 'قواعد' ? 'fa-list-check' : resource.category === 'شخصي' ? 'fa-bookmark' : 'fa-book-open'}"></i></div><h3>${escapeHTML(resource.title)}</h3><p class="library-subject"><i class="fa-solid fa-tag"></i> ${escapeHTML(resource.subject || 'عام')}</p><p>${escapeHTML(resource.description || resource.notes || '')}</p><footer><button class="outline-button" type="button" data-library-open="${escapeHTML(resource.id)}"><i class="fa-solid fa-book-open"></i> فتح المورد</button>${resource.personal ? `<button class="library-delete" type="button" data-library-delete="${escapeHTML(resource.id)}" title="حذف المورد"><i class="fa-regular fa-trash-can"></i></button>` : ''}</footer></article>`).join('');
  }

  function openLibraryResource(id) {
    const resource = allLibraryResources().find(item => item.id === id); if (!resource) return;
    const external = resource.url ? `<a class="primary-button" href="${escapeHTML(resource.url)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-arrow-up-right-from-square"></i> فتح الرابط</a>` : '';
    openModal(`<div class="modal-head"><div><span class="eyebrow">${escapeHTML(resource.category)} · ${escapeHTML(resource.subject || 'عام')}</span><h3>${escapeHTML(resource.title)}</h3></div><button class="close-modal" aria-label="إغلاق">×</button></div><article class="library-resource-view"><p>${escapeHTML(resource.content || resource.notes || resource.description || '')}</p>${external}<small><i class="fa-solid fa-lock"></i> يبقى المورد الشخصي محفوظًا على جهازك فقط.</small></article>`);
  }

  function openLibraryResourceEditor() {
    openModal(`<div class="modal-head"><h3>إضافة مورد شخصي</h3><button class="close-modal" aria-label="إغلاق">×</button></div><form id="libraryResourceForm"><div class="form-grid"><div class="form-group full"><label>عنوان المورد</label><input name="title" maxlength="100" required placeholder="مثال: ملخص الكيمياء العضوية"></div><div class="form-group"><label>المادة أو المجال</label><input name="subject" maxlength="60" placeholder="مثال: الكيمياء"></div><div class="form-group"><label>التصنيف</label><select name="category"><option value="شخصي">شخصي</option><option value="ملخص">ملخص</option><option value="قواعد">قواعد</option><option value="تدريب">تدريب</option></select></div><div class="form-group full"><label>رابط اختياري</label><input name="url" type="url" placeholder="https://example.com"></div><div class="form-group full"><label>ملاحظة أو وصف</label><textarea name="notes" maxlength="900" placeholder="اكتب ما تريد تذكره عن هذا المورد..."></textarea></div></div><div class="form-actions"><button class="outline-button close-modal" type="button">إلغاء</button><button class="primary-button" type="submit"><i class="fa-solid fa-floppy-disk"></i> حفظ المورد</button></div></form>`);
  }

  function saveLibraryResource(form) {
    const data = new FormData(form); const title = String(data.get('title') || '').trim(); const url = String(data.get('url') || '').trim(); const notes = String(data.get('notes') || '').trim();
    if (!title) return toast('أدخل عنوان المورد.'); if (url && !/^https?:\/\//i.test(url)) return toast('استخدم رابطًا يبدأ بـ https:// أو http://.');
    personalLibraryResources.unshift({ id: `library-${Date.now()}-${Math.random().toString(16).slice(2)}`, personal: true, title, subject: String(data.get('subject') || 'عام').trim() || 'عام', category: String(data.get('category') || 'شخصي'), url, notes, description: notes || 'مورد شخصي محفوظ محليًا.', content: notes || 'لا توجد ملاحظة إضافية لهذا المورد.' }); savePersonalLibraryResources(); closeModal(); renderLibrary(); toast('تم حفظ المورد في مكتبتك.');
  }

  function initLibrary() {
    if (!$('#libraryGrid')) return; renderLibrary(); $('#librarySearch')?.addEventListener('input', renderLibrary);
    $$('#libraryFilters [data-library-filter]').forEach(button => button.addEventListener('click', () => { activeLibraryFilter = button.dataset.libraryFilter; renderLibrary(); }));
    $('#libraryGrid')?.addEventListener('click', event => { const open = event.target.closest('[data-library-open]'); const remove = event.target.closest('[data-library-delete]'); if (open) openLibraryResource(open.dataset.libraryOpen); if (remove) { personalLibraryResources = personalLibraryResources.filter(resource => resource.id !== remove.dataset.libraryDelete); savePersonalLibraryResources(); renderLibrary(); toast('تم حذف المورد الشخصي.'); } });
  }

  const assistantServices = {
    profile: { label: 'فتح ملفي الشخصي', href: 'profile.html', icon: 'fa-regular fa-user' },
    news: { label: 'فتح مجتمع الأخبار', href: 'news.html', icon: 'fa-regular fa-newspaper' },
    tools: { label: 'فتح أدوات الدراسة', href: 'index.html#tools', icon: 'fa-solid fa-toolbox' },
    gallery: { label: 'فتح تنظيم الصور', href: 'gallery.html', icon: 'fa-regular fa-images' },
    calculator: { label: 'فتح حاسبة المعدل', href: 'grade-calculator.html', icon: 'fa-solid fa-calculator' },
    schedule: { label: 'فتح الجدول الدراسي', href: 'time-organizer.html', icon: 'fa-solid fa-calendar-check' },
    tests: { label: 'فتح الاختبارات', href: 'tests.html', icon: 'fa-solid fa-clipboard-check' },
    library: { label: 'فتح المكتبة', href: 'library.html', icon: 'fa-solid fa-book-bookmark' },
    curriculum: { label: 'فتح بوابة المناهج', href: 'curriculum.html', icon: 'fa-solid fa-user-graduate' },
    universities: { label: 'فتح دليل الجامعات', href: 'universities.html', icon: 'fa-solid fa-building-columns' },
    predictions: { label: 'فتح محاور المراجعة', href: 'predictions.html', icon: 'fa-solid fa-bullseye' },
    completion: { label: 'فتح برنامج الختم', href: 'completion-program.html', icon: 'fa-solid fa-list-check' },
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
      return answer('حاسبة المعدل تمنحك نظامين: منهاج رسمي للمرحلة، أو مواد وأوزان خاصة إذا كنت تريد حسابًا مرجّحًا. أدخل العلامات ثم راجع بطاقة النتيجة وتفصيل المواد المحتسبة.', [assistantServices.calculator]);
    }
    if (/جدول|مهمه|مهام|مذاكره|تذكير|خطه يوم|انظم|نظم وقت|خطط/.test(query)) {
      return answer('ابدأ بالجدول الدراسي: أضف المادة واسم المهمة والملاحظات واليوم والوقت، ثم فعّل التذكير إذا أردت إشعارًا عند الموعد داخل التطبيق. استخدم تبويبات اليوم وغدًا والقادمة والمتأخرة لتبقى خطتك واضحة.', [assistantServices.schedule]);
    }
    if (/اختبار|تمرين|سؤال|راجع اجاب/.test(query)) {
      return answer('اختر نموذجًا من صفحة الاختبارات ثم أجب عن كل الأسئلة. بعد الإنهاء تظهر نتيجتك ومراجعة للإجابات الصحيحة والخاطئة حتى تعرف المحاور التي تحتاج تدريبًا إضافيًا.', [assistantServices.tests]);
    }
    if (/جامع|كليه|اختصاص|مفاضل|دراسه جامعي/.test(query)) {
      return answer('دليل الجامعات يساعدك على تصفية الخيارات حسب المدينة والنوع والمجال، ثم مقارنة ما يصل إلى ثلاث جامعات. اعتبره نقطة بداية فقط وتحقق من شروط القبول والبرامج والمواعيد عبر المصدر الرسمي قبل التقديم.', [assistantServices.universities]);
    }
    if (/منهاج|تاسع|علمي|ادبي|ماده|محور/.test(query)) {
      return answer('بوابة المناهج ترتب مواد التاسع والبكالوريا ضمن محاور مراجعة صغيرة. اختر مرحلتك، افتح خطة المادة، ثم انتقل إلى الجدول أو الاختبارات من داخل البطاقة.', [assistantServices.curriculum, assistantServices.schedule, assistantServices.tests]);
    }
    if (/مكتبه|ملخص|مصدر|رابط|كتاب/.test(query)) {
      return answer('المكتبة تجمع الموارد التعليمية الرسمية الجاهزة. يمكنك البحث باسم المورد أو المادة وفتح المحتوى المتاح للمراجعة.', [assistantServices.library]);
    }
    if (/توقع|مراجعه مركز|محاور مهم/.test(query)) {
      return answer('محاور المراجعة تقدم أولويات إرشادية وخطوات مراجعة، مع وسم المصدر وتاريخ التحديث. استخدمها لتنظيم وقتك، ولا تجعلها بديلًا عن المنهاج والنماذج أو القرارات الرسمية.', [assistantServices.predictions, assistantServices.schedule]);
    }
    if (/ختم|انجاز|صفحات|دروس يومي/.test(query)) {
      return answer('برنامج الختم يحول أي مادة إلى خطة بعدد صفحات أو دروس وتاريخ نهاية، ثم يحسب المطلوب اليومي ويعرض نسبة الإنجاز والمتبقي. حدّث ما أنجزته باستمرار لتبقى الخطة واقعية.', [assistantServices.completion]);
    }
    if (/خبر|مجتمع|منشور|تعليق|اعجاب|صور/.test(query)) {
      return answer('مجتمع الأخبار مخصص لمشاركة الأخبار التعليمية والإنجازات. اكتب الخبر، وأرفق حتى صورتين، ثم انشره. تستطيع التفاعل بالإعجاب والتعليقات، واستخدام الفلاتر لمشاهدة الأحدث أو الأكثر تفاعلًا أو منشوراتك.', [assistantServices.news]);
    }
    if (/عداد|هدف|موعد|بكالوريا|تاسع/.test(query)) {
      return answer('من الرئيسية ستجد عدادات البكالوريا والتاسع والعداد المخصص. لاستخدام العداد الشخصي اختر «مخصص»، ثم اضغط «ضبط» واكتب اسم هدفك وموعده. سيبقى محفوظًا في متصفحك.', [assistantServices.home]);
    }
    if (/اختبار|حاسب|معدل|مكتبه|جامع|توقع|تنظيم/.test(query)) {
      return answer('تضم الرئيسية أدوات الدراسة مثل الجدول الدراسي وحاسبة المعدل والاختبارات وتنظيم الصور والمكتبة والتوقعات. اختر الأداة المناسبة من بطاقات الخدمات، وسأرشدك إلى المكان الصحيح.', [assistantServices.tools, assistantServices.schedule, assistantServices.calculator]);
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
    area.innerHTML = chat.messages.map(message => `<div class="message-wrap ${message.role === 'assistant' ? 'assistant' : 'student'}"><div class="bubble">${escapeHTML(message.text)}</div>${message.role === 'assistant' && message.links?.length ? `<div class="assistant-links">${chatLinkMarkup(message.links)}</div>` : ''}</div>`).join('') + `<div class="guide-block"><b>دليل ذكي لخدمات نبض:</b> اذكر هدفك الدراسي أو اسم القسم، وسأشرح الخطوة المناسبة وأضع لك زر انتقال مباشر.</div><div class="suggestions"><button class="suggestion" type="button">كيف أنظم مهامي اليوم؟</button><button class="suggestion" type="button">أين الاختبارات؟</button><button class="suggestion" type="button">كيف أختار جامعة؟</button><button class="suggestion" type="button">كيف أضيف موردًا للمكتبة؟</button></div>`;
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

  async function handleProfileSave(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    student = { ...student, ...data, first: String(data.first || '').trim(), father: String(data.father || '').trim(), last: String(data.last || '').trim(), phone: String(data.phone || '').trim(), city: String(data.city || '').trim(), bio: String(data.bio || '').trim() || defaultStudent.bio };
    saveState();
    await persistStudentProfile();
    syncAdminStudent(true);
    closeModal();
    updateProfileUI();
    renderAdminDashboard();
    toast(profileIncomplete() ? 'تم حفظ البيانات. أكمل الحقول المتبقية متى شئت.' : 'تم حفظ بيانات الملف الشخصي.');
  }

  function handleCountdownSave(form) {
    const data = new FormData(form);
    const title = String(data.get('title') || '').trim();
    const target = new Date(data.get('target')).getTime();
    if (title.length < 2) return toast('أضف اسمًا واضحًا للعداد.');
    if (!Number.isFinite(target) || target <= Date.now()) return toast('اختر موعدًا مستقبليًا صحيحًا.');
    customCountdown = { title: title.slice(0, 34), target };
    homeExams.custom = { title: customCountdown.title, badge: 'عداد مخصص', note: `موعد الهدف: ${new Date(target).toLocaleDateString('ar-SY', { day: 'numeric', month: 'long', year: 'numeric' })} · استمر بخطوات صغيرة كل يوم.`, target };
    saveState();
    closeModal();
    setExam('custom');
    toast('تم حفظ العداد المخصص على جهازك.');
  }


  function supportThread(ticket) {
    if (!ticket) return [];
    if (Array.isArray(ticket.messages) && ticket.messages.length) return ticket.messages;
    return ticket.message ? [{ id: `legacy-${ticket.id}`, sender: 'student', text: ticket.message, createdAt: ticket.createdAt || Date.now() }] : [];
  }

  function mySupportTicket() {
    ensureStudentId();
    const ownerId = currentAuthUser?.id || student.studentId;
    return supportTickets.filter(ticket => ticket.studentId === ownerId || (!currentAuthUser?.id && ticket.studentId === student.studentId)).sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0))[0] || null;
  }

  function remoteSupportTicket(payload) {
    if (!payload?.id) return null;
    return { id: payload.id, studentId: currentAuthUser?.id || student.studentId, name: fullName(), category: payload.category || 'استفسار عام', status: payload.status || 'open', createdAt: payload.created_at || Date.now(), updatedAt: payload.updated_at || payload.created_at || Date.now(), messages: Array.isArray(payload.messages) ? payload.messages.map(message => ({ id: message.id, sender: message.sender, text: message.text, createdAt: message.created_at || Date.now() })) : [] };
  }

  async function loadMySupportThread() {
    if (!supabaseClient || !currentAuthUser?.id || !$('#supportChatMessages')) { renderSupportChat(); return false; }
    const { data, error } = await supabaseClient.rpc('support_get_my_thread');
    if (error) { console.warn('تعذر تحميل محادثة الدعم', error); renderSupportChat(); return false; }
    const remote = remoteSupportTicket(data);
    if (remote) supportTickets = [remote, ...supportTickets.filter(ticket => ticket.id !== remote.id)];
    renderSupportChat();
    return true;
  }

  function renderSupportChat() {
    const holder = $('#supportChatMessages'); if (!holder) return;
    const ticket = mySupportTicket(); const messages = supportThread(ticket);
    const status = $('#supportChatStatus'); if (status) status.textContent = ticket?.status === 'resolved' ? 'تمت المعالجة' : ticket ? 'الدعم متاح للمتابعة' : 'ابدأ محادثة جديدة';
    holder.innerHTML = messages.length ? messages.map(message => `<article class="support-message ${message.sender === 'admin' ? 'admin' : 'student'}"><span class="support-message-avatar"><i class="fa-solid ${message.sender === 'admin' ? 'fa-headset' : 'fa-user'}"></i></span><div><p>${escapeHTML(message.text)}</p><small>${message.sender === 'admin' ? 'دعم نبض التفوق' : 'أنت'} · ${displayAdminDate(message.createdAt || message.created_at || Date.now())}</small></div></article>`).join('') : '<div class="support-chat-empty"><i class="fa-regular fa-comments"></i><b>كيف يمكننا مساعدتك؟</b><span>اكتب رسالتك وسيتابعها المشرف من بوابة الدعم.</span></div>';
    holder.scrollTop = holder.scrollHeight;
  }

  async function initSupportChat() {
    if (!$('#supportChatMessages')) return;
    renderSupportChat();
    if (currentAuthUser?.id) await loadMySupportThread();
  }

  async function sendSupportChatMessage(form) {
    const input = $('[name="message"]', form); const text = String(input?.value || '').trim(); const category = String($('[name="category"]', form)?.value || 'استفسار عام');
    if (!text) return;
    if (supabaseClient && currentAuthUser?.id) {
      const { error } = await supabaseClient.rpc('support_send_message', { p_category: category, p_body: text });
      if (error) { console.warn('تعذر إرسال رسالة الدعم', error); toast('تعذر إرسال الرسالة الآن. حاول مجددًا.'); return; }
      input.value = ''; await loadMySupportThread(); toast('تم إرسال رسالتك إلى الدعم.'); return;
    }
    ensureStudentId(); const now = Date.now(); let ticket = mySupportTicket();
    const entry = { id: `support-message-${now}-${Math.random().toString(16).slice(2)}`, sender: 'student', text, createdAt: now };
    if (!ticket) { const snapshot = studentSnapshot(); ticket = { id: `support-${now}`, studentId: snapshot.id, name: snapshot.name, phone: snapshot.phone, city: snapshot.city, gender: snapshot.gender, category, message: text, messages: [entry], status: 'open', createdAt: now, updatedAt: now }; supportTickets.unshift(ticket); }
    else { ticket.messages = [...supportThread(ticket), entry]; ticket.message = text; ticket.category = category || ticket.category; ticket.status = 'open'; ticket.updatedAt = now; }
    saveAdminState(); adminLog('support', `رسالة دعم جديدة: ${ticket.name}`, ticket.category); input.value = ''; renderSupportChat(); toast('تم إرسال رسالتك إلى الدعم.');
  }

  function openSupportReply(ticketId) {
    const ticket = adminSupportThreads.find(item => item.id === ticketId) || supportTickets.find(item => item.id === ticketId); if (!ticket) return;
    const messages = supportThread(ticket).map(message => `<article class="admin-support-bubble ${message.sender === 'admin' ? 'admin' : 'student'}"><div><b>${message.sender === 'admin' ? 'فريق نبض التفوق' : escapeHTML(ticket.name || 'الطالب')}</b><p>${escapeHTML(message.text)}</p><small>${displayAdminDate(message.createdAt || message.created_at || ticket.createdAt || ticket.created_at)}</small></div></article>`).join('');
    openModal(`<div class="admin-support-chat-modal"><header class="modal-head admin-support-chat-modal-head"><div class="admin-support-chat-modal-head"><span class="admin-support-chat-modal-avatar"><i class="fa-solid fa-headset"></i></span><div class="admin-support-chat-modal-copy"><h3>${escapeHTML(ticket.name || 'طالب نبض')}</h3><small><i class="fa-solid fa-circle"></i> محادثة الدعم</small></div></div><button class="close-modal" aria-label="إغلاق">×</button></header><section class="admin-support-thread admin-support-live-chat" aria-live="polite">${messages || '<p class="sheet-hint">لا توجد رسائل بعد.</p>'}</section><form class="admin-support-chat-composer" data-ticket-id="${escapeHTML(ticket.id)}"><div class="admin-support-reply-row"><textarea name="reply" required maxlength="700" placeholder="اكتب ردًا للطالب..." autofocus></textarea><button type="submit" class="admin-support-send" aria-label="إرسال الرد" title="إرسال الرد"><i class="fa-solid fa-paper-plane"></i></button></div><div class="form-actions"><button type="button" class="outline-button close-modal">إغلاق</button><span class="sheet-hint">سيظهر الرد داخل محادثة الطالب.</span></div></form></div>`);
  }

  async function sendAdminSupportReply(form) {
    const ticketId = form.dataset.ticketId; const ticket = adminSupportThreads.find(item => item.id === ticketId) || supportTickets.find(item => item.id === ticketId); const text = String($('[name="reply"]', form)?.value || '').trim(); if (!ticket || !text) return;
    const sendButton = $('button[type="submit"]', form); if (sendButton) sendButton.disabled = true;
    if (supabaseClient && currentAuthUser?.id && adminSupportThreads.some(item => item.id === ticketId)) {
      const { error } = await supabaseClient.rpc('support_admin_reply', { p_thread_id: ticketId, p_body: text });
      if (error) { if (sendButton) sendButton.disabled = false; console.warn('تعذر إرسال رد الدعم', error); toast('تعذر إرسال الرد الآن. حاول مجددًا.'); return; }
      await loadAdminSupport(); openSupportReply(ticketId); toast('تم إرسال الرد وحفظ المحادثة.'); return;
    }
    const now = Date.now(); ticket.messages = [...supportThread(ticket), { id: `support-reply-${now}`, sender: 'admin', text, createdAt: now }]; ticket.status = 'resolved'; ticket.updatedAt = now; saveAdminState(); adminLog('support', `رد على رسالة الدعم: ${ticket.name}`, ticket.category); openSupportReply(ticketId); toast('تم إرسال الرد وحفظ المحادثة.');
  }

  async function submitSupportRequest(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    const message = String(data.message || '').trim();
    if (!message) return toast('اكتب رسالتك قبل الإرسال.');
    if (supabaseClient && currentAuthUser?.id) {
      const { error } = await supabaseClient.rpc('support_send_message', { p_category: String(data.category || 'استفسار عام'), p_body: message });
      if (error) { console.warn('تعذر إرسال طلب الدعم', error); toast('تعذر إرسال الرسالة الآن. حاول مجددًا.'); return; }
      closeModal(); toast('تم إرسال رسالتك إلى صندوق الدعم.'); return;
    }
    syncAdminStudent(false);
    const snapshot = studentSnapshot();
    supportTickets.unshift({ id: `support-${Date.now()}`, studentId: snapshot.id, name: snapshot.name, phone: snapshot.phone, city: snapshot.city, gender: snapshot.gender, category: String(data.category || 'استفسار عام'), message, status: 'open', createdAt: Date.now() });
    adminLog('support', `رسالة دعم من ${snapshot.name}`, String(data.category || 'استفسار عام'));
    saveAdminState(); closeModal(); renderAdminDashboard(); toast('تم إرسال رسالتك إلى صندوق الدعم.');
  }

  function setAdminNotificationStatus(message = '', tone = '') {
    const status = $('#adminNotificationStatus');
    if (!status) return;
    status.textContent = message;
    status.className = `admin-internal-notification-status ${tone}`;
  }

  async function sendAdminNotification(form) {
    if (!isAdminAuthenticated() || !supabaseClient) return setAdminNotificationStatus('يلزم فتح جلسة مشرف صالحة قبل النشر.', 'error');
    const data = new FormData(form);
    const title = String(data.get('title') || '').trim();
    const body = String(data.get('body') || '').trim();
    if (title.length < 1 || title.length > 120) return setAdminNotificationStatus('اكتب عنوانًا بين حرف واحد و120 حرفًا.', 'error');
    if (body.length < 1 || body.length > 2000) return setAdminNotificationStatus('اكتب وصفًا بين حرف واحد و2000 حرف.', 'error');
    const button = $('#sendAdminNotification');
    if (button) { button.disabled = true; button.dataset.originalLabel = button.innerHTML; button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>جارٍ النشر</span>'; }
    setAdminNotificationStatus('جارٍ حفظ الإشعار...', 'loading');
    try {
      const { data: result, error } = await supabaseClient.functions.invoke('send-admin-notification', { body: { title, body } });
      if (error || !result?.saved) throw new Error(result?.error || 'تعذر حفظ الإشعار.');
      form.reset();
      setAdminNotificationStatus('تم نشر الإشعار داخل التطبيق بنجاح.', 'success');
      void loadAdminNotifications();
    } catch (error) {
      console.warn('تعذر نشر الإشعار الداخلي', error);
      setAdminNotificationStatus('تعذر نشر الإشعار الآن. تحقق من الاتصال ثم حاول مجددًا.', 'error');
    } finally {
      if (button) { button.disabled = false; button.innerHTML = button.dataset.originalLabel || '<i class="fa-solid fa-paper-plane"></i><span>نشر الإشعار</span>'; }
    }
  }

  function renderAdminNotifications() {
    const holder = $('#adminNotificationsRows');
    if (!holder) return;
    if (!adminNotifications.length) { holder.innerHTML = '<div class="admin-empty">لا توجد إشعارات منشورة حاليًا.</div>'; return; }
    holder.innerHTML = adminNotifications.map(notification => `<article class="admin-notification-item"><div class="admin-notification-item-main"><span class="admin-notification-item-icon"><i class="fa-regular fa-bell"></i></span><div><div class="admin-notification-item-top"><b>${escapeHTML(notification.title || 'إشعار')}</b><small>${escapeHTML(displayAdminDate(notification.created_at))}</small></div><p>${escapeHTML(notification.body || '')}</p></div></div><button class="danger-button admin-notification-delete" type="button" data-admin-action="delete-notification" data-notification-id="${escapeHTML(notification.id)}" data-notification-title="${escapeHTML(notification.title || 'هذا الإشعار')}" aria-label="حذف الإشعار"><i class="fa-regular fa-trash-can"></i><span>حذف</span></button></article>`).join('');
  }

  async function loadAdminOverview() {
    if (!supabaseClient || !remoteAdminVerified) return;
    const { data, error } = await supabaseClient.rpc('admin_get_dashboard_stats');
    if (error || !data || typeof data !== 'object') { console.warn('تعذر تحميل إحصاءات الإدارة', error); return; }
    adminStats = { ...adminStats, ...data };
    renderAdminDashboard();
  }
  async function loadAdminNotifications() {
    const holder = $('#adminNotificationsRows');
    if (!supabaseClient || !remoteAdminVerified || !holder) return;
    holder.innerHTML = '<div class="admin-users-loading"><i class="fa-solid fa-spinner fa-spin"></i> جارٍ تحميل الإشعارات</div>';
    const { data, error } = await supabaseClient.rpc('admin_list_notifications', { p_limit: 100 });
    if (error || !Array.isArray(data)) { adminNotifications = []; holder.innerHTML = '<div class="admin-empty">تعذر تحميل الإشعارات.</div>'; console.warn('تعذر تحميل الإشعارات الإدارية', error); return; }
    adminNotifications = data;
    adminStats.total_notifications = data.length;
    renderAdminNotifications();
  }

  async function deleteAdminNotification(notificationId, notificationTitle) {
    if (!isAdminAuthenticated() || !notificationId) return;
    confirmAction('حذف الإشعار؟', `سيختفي «${notificationTitle || 'هذا الإشعار'}» من صناديق جميع المستخدمين ولن يظهر مجددًا.`, async () => {
      const { data, error } = await supabaseClient.rpc('admin_delete_notification', { p_notification_id: notificationId });
      if (error || data !== true) { toast(error?.message || 'تعذر حذف الإشعار.'); return; }
      adminNotifications = adminNotifications.filter(item => item.id !== notificationId);
      adminStats.total_notifications = Math.max(0, Number(adminStats.total_notifications || 1) - 1);
      renderAdminNotifications(); renderAdminDashboard();
      toast('تم حذف الإشعار.');
    }, 'حذف الإشعار');
  }

  function renderAdminNewsActivity() {
    const holder = $('#adminNewsActivityRows');
    if (!holder) return;
    if (!adminNewsActivity.length) { holder.innerHTML = '<div class="admin-empty">لا يوجد نشاط أخبار حتى الآن.</div>'; return; }
    holder.innerHTML = adminNewsActivity.map(item => `<article class="admin-activity-item ${item.kind === 'comment' ? 'is-comment' : 'is-post'}"><span class="admin-activity-icon"><i class="fa-solid ${item.kind === 'comment' ? 'fa-comment' : 'fa-newspaper'}"></i></span><div class="admin-activity-copy"><div><b>${item.kind === 'comment' ? 'تعليق جديد' : 'منشور جديد'}</b><small>${escapeHTML(item.author_name || 'مستخدم')} · ${escapeHTML(displayAdminDate(item.created_at))}</small></div><p>${escapeHTML(item.body || '')}</p>${item.kind === 'comment' && item.post_body ? `<small class="admin-activity-context">على منشور: ${escapeHTML(String(item.post_body).slice(0, 100))}${String(item.post_body).length > 100 ? '…' : ''}</small>` : ''}</div></article>`).join('');
  }

  async function loadAdminNewsActivity() {
    const holder = $('#adminNewsActivityRows');
    if (!supabaseClient || !remoteAdminVerified || !holder) return;
    holder.innerHTML = '<div class="admin-users-loading"><i class="fa-solid fa-spinner fa-spin"></i> جارٍ تحميل نشاط الأخبار</div>';
    const { data, error } = await supabaseClient.rpc('admin_list_news_activity', { p_limit: 60 });
    if (error || !Array.isArray(data)) { adminNewsActivity = []; holder.innerHTML = '<div class="admin-empty">تعذر تحميل نشاط الأخبار.</div>'; console.warn('تعذر تحميل نشاط الأخبار', error); return; }
    adminNewsActivity = data;
    renderAdminNewsActivity();
  }

  function renderAdminSupport() {
    const holder = $('#adminSupportRows');
    if (!holder) return;
    if (!adminSupportThreads.length) { holder.innerHTML = '<div class="admin-empty">لا توجد رسائل دعم حتى الآن.</div>'; return; }
    holder.innerHTML = adminSupportThreads.map(thread => { const messages = supportThread(thread); const last = messages[messages.length - 1]; const isOpen = thread.status !== 'resolved'; return `<article class="admin-support-card ${isOpen ? 'is-open' : 'is-resolved'}"><div class="admin-support-card-main"><span class="admin-support-avatar"><i class="fa-solid ${isOpen ? 'fa-headset' : 'fa-circle-check'}"></i></span><div class="admin-support-copy"><div class="admin-support-title"><b>${escapeHTML(thread.name || 'طالب نبض')}</b><span class="admin-support-status">${isOpen ? 'بانتظار الرد' : 'تمت المتابعة'}</span></div><small>${escapeHTML(thread.category || 'استفسار عام')} · ${escapeHTML(displayAdminDate(thread.updated_at || thread.created_at))}</small><p>${escapeHTML(last?.text || 'لا توجد رسالة')}</p></div></div><button class="outline-button admin-support-reply" type="button" data-admin-action="support-reply" data-support-id="${escapeHTML(thread.id)}"><i class="fa-regular fa-comment-dots"></i><span>${isOpen ? 'قراءة والرد' : 'فتح المحادثة'}</span></button></article>`; }).join('');
  }

  async function loadAdminSupport() {
    const holder = $('#adminSupportRows');
    if (!supabaseClient || !remoteAdminVerified || !holder) return;
    holder.innerHTML = '<div class="admin-users-loading"><i class="fa-solid fa-spinner fa-spin"></i> جارٍ تحميل رسائل الدعم</div>';
    const { data, error } = await supabaseClient.rpc('admin_list_support_threads', { p_limit: 100 });
    if (error || !Array.isArray(data)) { adminSupportThreads = []; holder.innerHTML = '<div class="admin-empty">تعذر تحميل رسائل الدعم.</div>'; console.warn('تعذر تحميل رسائل الدعم', error); return; }
    adminSupportThreads = data;
    renderAdminSupport();
  }

  async function loadAdminUsers() {
    if (!supabaseClient || !remoteAdminVerified || !$('#adminStudentsRows')) return;
    const rows = $('#adminStudentsRows');
    rows.innerHTML = '<div class="admin-users-loading"><i class="fa-solid fa-spinner fa-spin"></i> جارٍ تحميل المستخدمين</div>';
    const { data, error } = await supabaseClient.functions.invoke('admin-manage-users', { body: { action: 'list', page: 1, per_page: 100 } });
    if (error || !Array.isArray(data?.users)) {
      adminUsersLoaded = false;
      rows.innerHTML = '<div class="admin-empty">تعذر تحميل المستخدمين. حاول تحديث القائمة.</div>';
      console.warn('تعذر تحميل المستخدمين', error || data?.error);
      return;
    }
    adminUsers = data.users;
    adminUsersLoaded = true;
    const total = Number(data.total);
    adminStats.total_users = Number.isFinite(total) && total >= 0 ? total : adminUsers.length;
    renderAdminDashboard();
  }

  function renderAdminDashboard() {
    if (!$('#adminWorkspace')) return;
    const total = Number(adminStats.total_users);
    const count = Number.isFinite(total) && total >= 0 ? total : adminUsers.length;
    const setText = (id, value) => { const element = $('#' + id); if (element) element.textContent = String(Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0); };
    setText('adminTotalUsers', count);
    setText('adminUsersTotal', count);
    setText('adminTotalNewsPosts', adminStats.total_news_posts);
    setText('adminTotalNewsComments', adminStats.total_news_comments);
    setText('adminOpenSupport', adminStats.open_support_threads);
    renderAdminStudents($('#adminStudentSearch')?.value || '');
    renderAdminNotifications();
    renderAdminNewsActivity();
    renderAdminSupport();
  }

  function renderAdminStudents(query = '') {
    const rows = $('#adminStudentsRows');
    if (!rows) return;
    if (!adminUsersLoaded) return;
    const normalized = String(query).trim().toLocaleLowerCase('ar');
    const visible = adminUsers.filter(user => `${user.name || ''} ${user.email || ''} ${user.stage || ''}`.toLocaleLowerCase('ar').includes(normalized));
    rows.innerHTML = visible.length ? visible.map(user => {
      const name = user.name || user.email || 'مستخدم';
      const avatar = user.avatar_url ? `<img class="admin-user-avatar" src="${escapeHTML(user.avatar_url)}" alt="">` : `<span class="admin-user-avatar">${escapeHTML(name.slice(0, 1))}</span>`;
      return `<article class="admin-user-card"><div class="admin-user-card-main">${avatar}<div class="admin-user-copy"><b>${escapeHTML(name)}</b><span dir="ltr">${escapeHTML(user.email || 'بدون بريد')}</span><small>${escapeHTML(user.stage || '—')} · انضم ${escapeHTML(displayAdminDate(user.created_at))}</small></div></div><button class="danger-button admin-user-delete" type="button" data-admin-action="user-delete" data-admin-id="${escapeHTML(user.id)}" data-admin-name="${escapeHTML(name)}"><i class="fa-solid fa-trash"></i><span>حذف</span></button></article>`;
    }).join('') : '<div class="admin-empty">لا توجد حسابات مطابقة للبحث.</div>';
  }

  async function deleteAdminUser(userId, userName) {
    if (!isAdminAuthenticated() || !userId) return;
    confirmAction('حذف المستخدم؟', `سيُحذف حساب ${userName || 'هذا المستخدم'} نهائيًا من المنصة ولا يمكن التراجع عن العملية.`, async () => {
      const { data, error } = await supabaseClient.functions.invoke('admin-manage-users', { body: { action: 'delete', user_id: userId } });
      if (error || !data?.deleted) {
        toast(data?.error || 'تعذر حذف المستخدم.');
        return;
      }
      adminUsers = adminUsers.filter(user => user.id !== userId);
      adminStats.total_users = Math.max(0, Number(adminStats.total_users || adminUsers.length + 1) - 1);
      renderAdminDashboard();
      toast('تم حذف المستخدم نهائيًا.');
    }, 'حذف نهائي');
  }

  function handleAdminAction(button) {
    const action = button.dataset.adminAction;
    if (action === 'logout') return logoutAdmin();
    if (!isAdminAuthenticated()) return toast('افتح بوابة المشرفين أولًا لتنفيذ هذا الإجراء.');
    if (action === 'refresh-users') return void loadAdminUsers();
    if (action === 'refresh-notifications') return void loadAdminNotifications();
    if (action === 'delete-notification') return void deleteAdminNotification(button.dataset.notificationId, button.dataset.notificationTitle);
    if (action === 'refresh-news') return void loadAdminNewsActivity();
    if (action === 'refresh-support') return void loadAdminSupport();
    if (action === 'support-reply') return void openSupportReply(button.dataset.supportId);
    if (action === 'user-delete') return void deleteAdminUser(button.dataset.adminId, button.dataset.adminName);
  }

  const capacitorPlugin = name => window.Capacitor?.Plugins?.[name] || null;
  const isNativeNabd = () => Boolean(window.Capacitor?.isNativePlatform?.()) || Boolean(window.NabdAndroid);
  const nativeReady = () => {
    try {
      if (typeof window.nabdNativeReady === 'function') return window.nabdNativeReady();
      window.NabdAndroid?.webReady?.();
      window.android?.webReady?.();
      const splash = window.Capacitor?.Plugins?.SplashScreen;
      if (typeof splash?.hide === 'function') splash.hide();
    } catch (error) { console.warn('تعذر إرسال إشارة الجاهزية للتطبيق', error); }
  };

  function saveStudyTasks() {
    try { localStorage.setItem(STORE + 'study_tasks', JSON.stringify(studyTasks)); } catch { toast('تعذر حفظ المهام محليًا.'); }
    const preferences = capacitorPlugin('Preferences');
    if (isNativeNabd() && preferences?.set) preferences.set({ key: 'nabd_study_tasks', value: JSON.stringify(studyTasks) }).catch(() => {});
  }

  async function loadStudyTasks() {
    const preferences = capacitorPlugin('Preferences');
    if (isNativeNabd() && preferences?.get) {
      try { const result = await preferences.get({ key: 'nabd_study_tasks' }); const parsed = result?.value ? JSON.parse(result.value) : null; if (Array.isArray(parsed)) studyTasks = parsed; } catch { /* يبقى التخزين المحلي بديلًا آمنًا */ }
    }
  }

  const localDateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const studyAt = task => new Date(`${task.date}T${task.reminderTime || '23:59'}:00`);
  const studyStatus = task => task.completed ? 'completed' : studyAt(task).getTime() < Date.now() ? 'overdue' : 'active';
  const studyDateText = value => { try { return new Intl.DateTimeFormat('ar-SY', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${value}T12:00:00`)); } catch { return value; } };
  const studyTimeText = value => { try { return new Intl.DateTimeFormat('ar-SY', { hour: 'numeric', minute: '2-digit' }).format(new Date(`2000-01-01T${value}:00`)); } catch { return value; } };

  async function cancelStudyNotification(task) {
    if (!task?.notificationId) return true;
    const native = capacitorPlugin('LocalNotifications');
    if (!isNativeNabd() || !native?.cancel) return true;
    try { await native.cancel({ notifications: [{ id: Number(task.notificationId) }] }); return true; } catch { toast('تعذر إلغاء التذكير الأصلي القديم.'); return false; }
  }

  async function scheduleStudyNotification(task) {
    if (!task.reminderEnabled) return true;
    const scheduledAt = studyAt(task);
    if (scheduledAt.getTime() <= Date.now()) { toast('يرجى اختيار وقت مستقبلي للتذكير.'); return false; }
    const native = capacitorPlugin('LocalNotifications');
    if (!isNativeNabd() || !native?.schedule) { toast('حُفظت المهمة. ستُجدول التذكيرات الحقيقية داخل تطبيق نبض عند توفر إضافة الإشعارات الأصلية.'); return true; }
    try {
      const permissions = await native.checkPermissions?.();
      const display = permissions?.display;
      if (display !== 'granted') { const requested = await native.requestPermissions?.(); if (requested?.display !== 'granted') { toast('فعّل صلاحية الإشعارات للحصول على تذكيرات الدراسة.'); return false; } }
      const subjectText = task.subject ? ` في مادة ${task.subject}` : '';
      await native.schedule({ notifications: [{ id: Number(task.notificationId), title: '📚 تذكير دراسي', body: `حان وقت ${task.title}${subjectText}.`, schedule: { at: scheduledAt }, extra: { taskId: task.id } }] });
      return true;
    } catch (error) { console.warn('فشل جدولة التذكير الأصلي', error); toast('تعذر جدولة التذكير الآن، لكن المهمة حُفظت.'); return false; }
  }

  function nextStudyNotificationId() { let id = Math.floor(Date.now() % 2000000000); const used = new Set(studyTasks.map(task => Number(task.notificationId))); while (used.has(id)) id += 1; return id; }
  function studyFilterTasks() {
    const now = new Date(); now.setHours(0, 0, 0, 0); const today = localDateKey(now); const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1); const tomorrowKey = localDateKey(tomorrow);
    return studyTasks.filter(task => { const status = studyStatus(task); if (activeStudyFilter === 'completed') return status === 'completed'; if (activeStudyFilter === 'overdue') return status === 'overdue'; if (activeStudyFilter === 'today') return !task.completed && task.date === today; if (activeStudyFilter === 'tomorrow') return !task.completed && task.date === tomorrowKey; return !task.completed && task.date > tomorrowKey; }).sort((a, b) => studyAt(a) - studyAt(b));
  }

  function renderStudyTasks() {
    const holder = $('#studyTasks'), empty = $('#studyEmpty'); if (!holder || !empty) return;
    const todayKey = localDateKey(); const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); const tomorrowKey = localDateKey(tomorrow);
    const counts = { today: studyTasks.filter(t => !t.completed && t.date === todayKey).length, tomorrow: studyTasks.filter(t => !t.completed && t.date === tomorrowKey).length, upcoming: studyTasks.filter(t => !t.completed && t.date > tomorrowKey).length, overdue: studyTasks.filter(t => studyStatus(t) === 'overdue').length, completed: studyTasks.filter(t => t.completed).length };
    Object.entries(counts).forEach(([key, count]) => { const el = $(`#study${key[0].toUpperCase()}${key.slice(1)}Count`); if (el) el.textContent = count; });
    $$('#studyTaskTabs button').forEach(button => button.classList.toggle('active', button.dataset.studyFilter === activeStudyFilter));
    const visible = studyFilterTasks(); holder.innerHTML = visible.map(task => { const status = studyStatus(task); const statusText = status === 'completed' ? 'مكتملة' : status === 'overdue' ? 'متأخرة' : 'قيد الإنجاز'; const legacySubject = task.subject ? `<span>${escapeHTML(task.subject)}</span>` : ''; return `<article class="study-task-card ${status}"><div class="study-task-icon"><i class="fa-solid ${status === 'completed' ? 'fa-circle-check' : status === 'overdue' ? 'fa-clock' : 'fa-book-open'}"></i></div><div class="study-task-main"><div class="study-task-title">${legacySubject}<h3>${escapeHTML(task.title)}</h3></div>${task.notes ? `<p>${escapeHTML(task.notes)}</p>` : ''}<div class="study-task-meta"><span><i class="fa-regular fa-calendar"></i>${studyDateText(task.date)}</span><span><i class="fa-regular fa-clock"></i>${studyTimeText(task.reminderTime)}</span>${task.reminderEnabled ? '<span><i class="fa-solid fa-bell"></i>تذكير</span>' : ''}</div></div><div class="study-task-actions"><span class="study-status ${status}">${statusText}</span><button data-study-action="edit" data-task-id="${task.id}" title="تعديل المهمة"><i class="fa-solid fa-pen"></i></button><button data-study-action="delete" data-task-id="${task.id}" title="حذف المهمة"><i class="fa-regular fa-trash-can"></i></button><button class="study-complete" data-study-action="complete" data-task-id="${task.id}" title="${task.completed ? 'إعادة المهمة' : 'تم الإنجاز'}"><i class="fa-solid ${task.completed ? 'fa-rotate-left' : 'fa-check'}"></i></button></div></article>`; }).join('');
    empty.classList.toggle('hidden', visible.length > 0);
  }

  function openStudyTaskEditor(taskId = '') {
    const task = studyTasks.find(item => item.id === taskId) || {}; const today = localDateKey(); const [hour = '18', savedMinute = '01'] = String(task.reminderTime || '18:01').split(':'); const minute = savedMinute === '00' ? '01' : savedMinute;
    const timeOptions = (total, selected, start = 0) => Array.from({ length: total - start }, (_, index) => { const value = String(index + start).padStart(2, '0'); return `<option value="${value}" ${value === selected ? 'selected' : ''}>${value}</option>`; }).join('');
    const remindersActive = task.reminderEnabled !== false;
    openModal(`<div class="modal-head"><h3>${task.id ? 'تعديل المهمة' : 'مهمة دراسية جديدة'}</h3><button class="close-modal" aria-label="إغلاق">×</button></div><form id="studyTaskForm" data-task-id="${task.id || ''}"><p class="sheet-hint">اكتب ما ستدرسه ثم اختر الموعد؛ سيصلك تذكير عند تفعيله داخل التطبيق.</p><div class="form-grid"><div class="form-group full"><label>اسم المهمة</label><input name="title" required maxlength="120" placeholder="مثال: دراسة مادة العربي" value="${escapeHTML(task.title || '')}" autofocus></div><div class="form-group full"><label>اليوم</label><input name="date" type="date" required min="${today}" value="${escapeHTML(task.date || today)}"></div><div class="form-group"><label>الساعة</label><select name="reminderHour" required>${timeOptions(24, hour)}</select></div><div class="form-group"><label>الدقيقة</label><select name="reminderMinute" required>${timeOptions(60, minute, 1)}</select></div><label class="study-reminder-toggle full"><input name="reminderEnabled" type="checkbox" ${remindersActive ? 'checked' : ''}><span><i class="fa-solid fa-bell"></i><b>تفعيل التذكير</b><small>إشعار عند الموعد داخل تطبيق نبض بعد منح الإذن.</small></span></label></div><div class="form-actions"><button class="outline-button close-modal" type="button">إلغاء</button><button class="primary-button" type="submit"><i class="fa-solid fa-floppy-disk"></i> حفظ المهمة</button></div></form>`);
  }

  async function saveStudyTask(form) {
    const data = new FormData(form), id = form.dataset.taskId, old = studyTasks.find(item => item.id === id); const hour = String(data.get('reminderHour') || '').padStart(2, '0'); const minute = String(data.get('reminderMinute') || '').padStart(2, '0');
    if (!/^([01]\d|2[0-3])$/.test(hour) || !/^(0[1-9]|[1-5]\d)$/.test(minute)) return toast('اختر ساعة ودقيقة من 01 إلى 59.');
    const task = { id: id || `task-${Date.now()}-${Math.random().toString(16).slice(2)}`, subject: old?.subject || '', title: String(data.get('title') || '').trim(), notes: old?.notes || '', date: String(data.get('date')), reminderTime: `${hour}:${minute}`, reminderEnabled: data.get('reminderEnabled') === 'on', completed: old?.completed || false, notificationId: old?.notificationId || nextStudyNotificationId(), createdAt: old?.createdAt || Date.now(), updatedAt: Date.now() };
    if (!task.title) return toast('أدخل اسم المهمة.'); if (task.reminderEnabled && studyAt(task).getTime() <= Date.now()) return toast('يرجى اختيار وقت مستقبلي للتذكير.');
    if (old) await cancelStudyNotification(old); const scheduled = await scheduleStudyNotification(task); if (task.reminderEnabled && isNativeNabd() && capacitorPlugin('LocalNotifications')?.schedule && !scheduled) return;
    if (old) studyTasks = studyTasks.map(item => item.id === id ? task : item); else studyTasks.unshift(task); saveStudyTasks(); closeModal(); renderStudyTasks(); const nativeReminder = task.reminderEnabled && isNativeNabd() && Boolean(capacitorPlugin('LocalNotifications')?.schedule); toast(task.reminderEnabled ? (nativeReminder ? 'تم حفظ المهمة وجدولة التذكير.' : 'تم حفظ المهمة. فعّل جسر التطبيق للإشعار الأصلي.') : 'تم حفظ المهمة دون تذكير.');
  }

  async function handleStudyAction(button) { const task = studyTasks.find(item => item.id === button.dataset.taskId); if (!task) return; const action = button.dataset.studyAction; if (action === 'edit') return openStudyTaskEditor(task.id); if (action === 'delete') return confirmAction('حذف المهمة؟', 'سيتم حذف المهمة وإلغاء التذكير المرتبط بها من هذا الجهاز.', async () => { await cancelStudyNotification(task); studyTasks = studyTasks.filter(item => item.id !== task.id); saveStudyTasks(); renderStudyTasks(); toast('تم حذف المهمة وإلغاء تذكيرها.'); }); task.completed = !task.completed; task.updatedAt = Date.now(); if (task.completed) { task.reminderEnabled = false; await cancelStudyNotification(task); } else if (task.reminderEnabled) await scheduleStudyNotification(task); saveStudyTasks(); renderStudyTasks(); toast(task.completed ? 'أحسنت، تم تسجيل المهمة كمكتملة.' : 'أعيدت المهمة إلى قائمة الإنجاز.'); }

  async function initStudySchedule() { if (!$('#studyTasks')) return; await loadStudyTasks(); const note = $('#studyNativeNote'); if (note) note.innerHTML = isNativeNabd() && capacitorPlugin('LocalNotifications') ? '<i class="fa-solid fa-mobile-screen-button"></i><span>التذكيرات الأصلية متاحة داخل التطبيق.</span>' : '<i class="fa-solid fa-globe"></i><span>يعمل الجدول في المتصفح؛ الإشعار الأصلي يحتاج جسر التطبيق.</span>'; renderStudyTasks(); }

  const ADMIN_TABS = new Set(['overview', 'notifications', 'news', 'support', 'users']);
  const adminTabLoaders = { overview: loadAdminOverview, notifications: loadAdminNotifications, news: loadAdminNewsActivity, support: loadAdminSupport, users: loadAdminUsers };
  async function loadAdminTabData(tab = activeAdminTab, force = false) {
    if (!remoteAdminVerified || !supabaseClient) return;
    if (!force && adminLoadedTabs.has(tab)) return;
    const loader = adminTabLoaders[tab];
    if (typeof loader !== 'function') return;
    adminLoadedTabs.add(tab);
    try { await loader(); } catch (error) { adminLoadedTabs.delete(tab); console.warn(`تعذر تحميل تبويب الإدارة: ${tab}`, error); }
  }
  function setAdminTab(tab) {
    activeAdminTab = ADMIN_TABS.has(tab) ? tab : 'overview';
    $$('#adminTabs [data-admin-tab]').forEach(button => {
      const isActive = button.dataset.adminTab === activeAdminTab;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-selected', String(isActive));
      button.tabIndex = isActive ? 0 : -1;
    });
    $$('#adminWorkspace [data-admin-panel]').forEach(panel => {
      const isActive = panel.dataset.adminPanel === activeAdminTab;
      panel.classList.toggle('is-active', isActive);
      panel.hidden = !isActive;
    });
    void loadAdminTabData(activeAdminTab);
  }
  function bindAdminDashboardControls() {
    if (adminControlsBound) return;
    adminControlsBound = true;
    $('#adminStudentSearch')?.addEventListener('input', event => renderAdminStudents(event.target.value));
    $('#adminTabs')?.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      const tabs = [...$$('#adminTabs [data-admin-tab]')];
      const current = tabs.indexOf(event.target.closest('[data-admin-tab]'));
      if (current < 0) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowLeft' ? -1 : 1) + tabs.length) % tabs.length;
      tabs[next]?.focus();
      setAdminTab(tabs[next]?.dataset.adminTab);
    });
  }

  async function initAdminDashboard() {
    if (!$('#adminLoginScreen')) return;
    showAdminWorkspace(false);
    const note = $('.admin-login-note');
    if (!currentAuthUser?.id) {
      if (note) note.innerHTML = '<i class="fa-solid fa-lock"></i> جارٍ التحقق من جلسة الحساب الحالية...';
      return;
    }
    if (note) note.innerHTML = '<i class="fa-solid fa-shield-halved"></i> جارٍ التحقق من صلاحية الحساب الحالي...';
    try {
      const result = await supabaseClient?.rpc('premium_is_admin');
      remoteAdminVerified = !result?.error && result?.data === true;
    } catch { remoteAdminVerified = false; }
    if (!remoteAdminVerified) {
      if (note) note.innerHTML = '<i class="fa-solid fa-lock"></i> هذا الحساب غير مخوّل للوصول إلى أدوات المشرفين.';
      return;
    }
    if (note) note.innerHTML = '<i class="fa-solid fa-circle-check"></i> تم التحقق من الصلاحية.';
    showAdminWorkspace(true);
    renderAdminDashboard();
    bindAdminDashboardControls();
    setAdminTab(activeAdminTab);
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      const adminTab = event.target.closest('[data-admin-tab]');
      if (adminTab) { event.preventDefault(); setAdminTab(adminTab.dataset.adminTab); return; }
      if (event.target.closest('.close-modal') || event.target.id === 'modalBackdrop') closeModal();
      const modalButton = event.target.closest('[data-modal]');
      if (modalButton) openNamedModal(modalButton.dataset.modal);
      const confirmButton = event.target.closest('[data-confirm-action]');
      if (confirmButton) { const action = window.nabdConfirmAction; window.nabdConfirmAction = null; closeModal(); if (typeof action === 'function') action(); return; }
      const adminButton = event.target.closest('[data-admin-action]');
      if (adminButton) handleAdminAction(adminButton);
      if (event.target.closest('#openEditProfile, #editProfileSmall, #completeProfile, #profileDataUpdate')) openNamedModal('edit');
      if (event.target.closest('#sharePlatform')) sharePlatform();
      const nativeChat = event.target.closest('[data-native-chat-url]');
      if (nativeChat) { event.preventDefault(); openNativeChatViewer(nativeChat.dataset.nativeChatUrl, nativeChat.dataset.nativeChatTitle); }
      if (event.target.closest('#studentLogout')) { event.preventDefault(); void signOutStudent(); return; }
      if (event.target.closest('#profileThemeButton')) applyTheme(student.theme === 'dark' ? 'light' : 'dark');
      const themeChoice = event.target.closest('[data-theme-choice]');
      if (themeChoice) applyTheme(themeChoice.dataset.themeChoice);
      const galleryOpen = event.target.closest('[data-gallery-image]');
      if (galleryOpen) openGalleryImage(galleryOpen.dataset.galleryImage);
      const galleryShare = event.target.closest('[data-gallery-share]');
      if (galleryShare) shareGalleryImage(galleryShare.dataset.galleryShare);
      const galleryNav = event.target.closest('[data-gallery-nav]');
      if (galleryNav) navigateGalleryImage(galleryNav.dataset.galleryCurrent, galleryNav.dataset.galleryNav);
      const galleryRemove = event.target.closest('[data-gallery-remove]');
      if (galleryRemove) removeGalleryImage(galleryRemove.dataset.galleryRemove);
      const galleryMove = event.target.closest('[data-gallery-move]');
      if (galleryMove) moveGalleryImage(galleryMove.dataset.galleryMove, galleryMove.dataset.direction);
      const studyAction = event.target.closest('[data-study-action]');
      if (studyAction) handleStudyAction(studyAction);
      if (event.target.closest('#addStudyTask, #addFirstStudyTask')) openStudyTaskEditor();
      const studyFilter = event.target.closest('[data-study-filter]');
      if (studyFilter) { activeStudyFilter = studyFilter.dataset.studyFilter; renderStudyTasks(); }
      const demo = event.target.closest('[data-demo]');
      if (demo) toast(demo.dataset.demo);

      const externalLink = event.target.closest('[data-external-url]');
      if (externalLink) { event.preventDefault(); void openExternalUrl(externalLink.dataset.externalUrl); return; }
      const readMore = event.target.closest('[data-news-more]');
      if (readMore) { const postId = readMore.dataset.newsMore; if (expandedNewsPosts.has(postId)) expandedNewsPosts.delete(postId); else expandedNewsPosts.add(postId); renderFeed(); return; }

      const newsManage = event.target.closest('[data-news-manage]');
      if (newsManage) { const id = newsManage.dataset.postId; if (newsManage.dataset.newsManage === 'edit') openPostEditor(id); if (newsManage.dataset.newsManage === 'delete') { closeModal(); deleteNewsPost(id); } return; }
      const commentDelete = event.target.closest('[data-comment-delete]');
      if (commentDelete) { deleteComment(commentDelete.dataset.commentPost, commentDelete.dataset.commentDelete); return; }
      const repliesButton = event.target.closest('[data-comment-replies]');
      if (repliesButton) { openPostReplies(repliesButton.dataset.commentPost, repliesButton.dataset.commentReplies); return; }
      const commentsBack = event.target.closest('[data-comments-back]');
      if (commentsBack) { if (newsModalState()?.mode === 'replies') window.history.back(); else openPostComments(commentsBack.dataset.commentsBack); return; }
      const replyButton = event.target.closest('[data-comment-reply]');
      if (replyButton) { const post = enrichedPost(feedPost(replyButton.dataset.commentPost) || {}); const comment = (post.comments || []).find(item => item.id === replyButton.dataset.commentReply); const repliesScreen = replyButton.closest('.comment-replies-screen'); if (comment) repliesScreen ? openPostReplies(replyButton.dataset.commentPost, repliesScreen.dataset.rootCommentId, comment) : openPostComments(replyButton.dataset.commentPost, comment); return; }
      const clearReply = event.target.closest('[data-clear-comment-reply]');
      if (clearReply) { if (clearReply.dataset.returnReplies) openPostReplies(clearReply.dataset.clearCommentReply, clearReply.dataset.returnReplies); else openPostComments(clearReply.dataset.clearCommentReply); return; }

      const tool = event.target.closest('[data-action]');
      if (tool) {
        const postId = tool.closest('[data-post]')?.dataset.post;
        if (tool.dataset.action === 'like') toggleLike(postId);
        if (tool.dataset.action === 'comments') openPostComments(postId);
        if (tool.dataset.action === 'share') sharePost(postId);
        if (tool.dataset.action === 'post-menu') openPostMenu(postId);
      }

      const suggestion = event.target.closest('.suggestion, .assistant-chip');
      if (suggestion) { const input = $('#chatInput'); if (input) { input.value = suggestion.dataset.prompt || suggestion.textContent; sendChat(); } }
      const history = event.target.closest('[data-chat]');
      if (history) { activeChatId = history.dataset.chat; renderChat(); }
    });

    document.addEventListener('submit', event => {
      if (event.target.id === 'adminNotificationForm') { event.preventDefault(); void sendAdminNotification(event.target); }
      if (event.target.id === 'editForm') { event.preventDefault(); handleProfileSave(event.target); }
      if (event.target.id === 'customCountdownForm') { event.preventDefault(); handleCountdownSave(event.target); }
      if (event.target.id === 'supportForm') { event.preventDefault(); void submitSupportRequest(event.target); }
      if (event.target.id === 'supportChatForm') { event.preventDefault(); void sendSupportChatMessage(event.target); }
      if (event.target.matches('.admin-support-reply-form, .admin-support-chat-composer')) { event.preventDefault(); void sendAdminSupportReply(event.target); }
      if (event.target.id === 'studyTaskForm') { event.preventDefault(); saveStudyTask(event.target); }
      if (event.target.id === 'completionPlanForm') { event.preventDefault(); saveCompletionPlan(event.target); }
      if (event.target.matches('.comment-form, .comment-modal-form')) { event.preventDefault(); addComment(event.target); }
      if (event.target.id === 'postEditForm') { event.preventDefault(); savePostEdit(event.target); }
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
    $('#motionSwitch')?.addEventListener('change', event => { applyMotion(event.target.checked); toast(event.target.checked ? 'تم تفعيل الحركات الخفيفة.' : 'تم تقليل الحركات والتأثيرات.'); });
    $('#notificationsSwitch')?.addEventListener('change', event => { student.notifications = event.target.checked; saveState(); toast(event.target.checked ? 'تم تفعيل الإشعارات.' : 'تم إيقاف الإشعارات.'); });
    document.addEventListener('focusin', event => {
      if (!window.matchMedia('(max-width: 980px)').matches || !event.target.matches('input, textarea, select')) return;
      window.setTimeout(() => event.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 170);
    });
  }

  function enableScreenCapture() {
    document.documentElement.dataset.screenCapture = 'allowed';
    try {
      const bridge = window.NabdAndroid;
      if (bridge) {
        if (typeof bridge.setScreenCaptureAllowed === 'function') bridge.setScreenCaptureAllowed(true);
        else if (typeof bridge.allowScreenshots === 'function') bridge.allowScreenshots();
        else if (typeof bridge.setSecureScreen === 'function') bridge.setSecureScreen(false);
      }
      const screenCapturePlugin = window.Capacitor?.Plugins?.ScreenCapture;
      if (screenCapturePlugin && typeof screenCapturePlugin.allowScreenshots === 'function') screenCapturePlugin.allowScreenshots();
    } catch (error) {
      console.warn('تعذر تفعيل التقاط الشاشة عبر الجسر الأصلي', error);
    }
  }

  function initMobileViewport() {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const updateKeyboardOffset = () => {
      const offset = Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
      document.documentElement.style.setProperty('--keyboard-offset', `${offset}px`);
    };
    viewport.addEventListener('resize', updateKeyboardOffset);
    viewport.addEventListener('scroll', updateKeyboardOffset);
    updateKeyboardOffset();
  }

  async function init() {
    // الخط الأول محلي بالكامل: لا تنتظر الخادم قبل إظهار القائمة أو ربط التفاعلات.
    nativeReady();
    enableScreenCapture();
    initMobileViewport();
    renderBrand();
    renderTopActions();
    applyTheme(student.theme, false);
    applyMotion(student.motion !== false, false);
    updateProfileUI();
    syncAdminStudent(false);
    bindEvents();

    const pageInitializers = {
      home: initHome,
      news: initNews,
      gallery: initGallery,
      calculator: initCalculator,
      tests: initTests,
      completion: initCompletion,
      'university-directory': initUniversities,
      'university-majors': initUniversityMajors,
      'university-info': initUniversityInfo,
      curriculum: initCurriculum,
      nine: initCurriculum,
      predictions: initPredictions,
      library: initLibrary,
      'study-schedule': initStudySchedule,
      ai: initChat,
      'support-chat': initSupportChat,
      notifications: initNotifications,
      supervision: initAdminDashboard,
      countdown: initHome
    };
    const initializePage = pageInitializers[PAGE];
    if (initializePage) {
      window.setTimeout(() => Promise.resolve().then(() => initializePage()).catch(error => console.warn(`تعذر تهيئة قسم ${PAGE} في الخلفية:`, error)), 0);
    }

    // الجلسة والملف الشخصي مزامنة خلفية؛ عند اكتمالها نحدّث العناصر دون إعادة حجب الصفحة.
    window.setTimeout(() => Promise.resolve().then(() => requireStudentSession()).then(ready => {
      if (!ready) return;
      updateProfileUI();
      syncAdminStudent(false);
      updateNotificationBadges();
      if (PAGE === 'notifications') initNotifications();
      else void loadAppNotifications();
      if (PAGE === 'support-chat') void loadMySupportThread();
      if (PAGE === 'supervision') void initAdminDashboard();
      refreshNewsOwnership();
    }).catch(error => console.warn('تعذر مزامنة جلسة الطالب في الخلفية:', error)), 0);

    nativeReady();
    window.setTimeout(nativeReady, 450);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
