(() => {
  'use strict';

  // تنظيف توافقـي مبكر لإصدارات قديمة من شاشة الترحيب وقفل التمرير.
  // يعمل قبل تهيئة التطبيق حتى لا تمنع نسخة HTML مخزنة التفاعل أو التمرير.
  const removeLegacyStartupLock = () => {
    document.getElementById('startupScreen')?.remove();
    document.body?.classList.remove('startup-pending');
    document.documentElement.classList.remove('startup-pending');
    const visibleModal = document.querySelector('.modal-backdrop.show');
    if (!visibleModal) document.body?.classList.remove('sheet-open');
  };

  const recoverInitialScrollState = () => {
    const body = document.body;
    if (!body) return;
    removeLegacyStartupLock();
    // تنظيف حالة قديمة محفوظة فقط عند بدء الصفحة أو استعادتها من bfcache.
    body.classList.remove('sidebar-open');
    if (!document.querySelector('.modal-backdrop.show')) body.classList.remove('sheet-open');
  };

  recoverInitialScrollState();
  window.addEventListener('DOMContentLoaded', recoverInitialScrollState, { once: true });
  window.addEventListener('pageshow', recoverInitialScrollState);

  const isEditableTarget = target => {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest('input, textarea, select, [contenteditable="true"], [contenteditable="plaintext-only"]'));
  };

  const installProtectionStyles = () => {
    if (document.getElementById('nabd-content-protection-style')) return;
    const style = document.createElement('style');
    style.id = 'nabd-content-protection-style';
    style.textContent = 'html.content-protected,html.content-protected body{user-select:none!important;-webkit-user-select:none!important;-webkit-touch-callout:none!important}html.content-protected a,html.content-protected img,html.content-protected button{user-drag:none!important;-webkit-user-drag:none!important}html.content-protected input,html.content-protected textarea,html.content-protected select,html.content-protected [contenteditable="true"],html.content-protected [contenteditable="plaintext-only"]{user-select:text!important;-webkit-user-select:text!important;-webkit-touch-callout:default!important}';
    (document.head || document.documentElement).append(style);
  };

  const preventContextAndClipboard = event => {
    event.preventDefault();
  };

  const preventSelectionOrDrag = event => {
    if (!isEditableTarget(event.target)) event.preventDefault();
  };

  const installInteractionGuards = () => {
    document.addEventListener('contextmenu', preventContextAndClipboard, { capture: true });
    document.addEventListener('copy', preventContextAndClipboard, { capture: true });
    document.addEventListener('cut', preventContextAndClipboard, { capture: true });
    document.addEventListener('selectstart', preventSelectionOrDrag, { capture: true });
    document.addEventListener('dragstart', preventSelectionOrDrag, { capture: true });
    document.addEventListener('dragover', preventSelectionOrDrag, { capture: true });
    document.addEventListener('drop', preventSelectionOrDrag, { capture: true });
    document.addEventListener('keydown', event => {
      if (isEditableTarget(event.target)) return;
      const key = String(event.key || '').toLowerCase();
      if ((event.ctrlKey || event.metaKey) && ['a', 'c', 'x'].includes(key)) event.preventDefault();
    }, { capture: true });
  };

  document.documentElement.classList.add('content-protected');
  installProtectionStyles();
  installInteractionGuards();

  if (!('serviceWorker' in navigator)) return;

  let reloading = false;
  const refreshMarker = '__sw_refresh';

  const clearRefreshMarker = () => {
    const currentUrl = new URL(window.location.href);
    if (!currentUrl.searchParams.has(refreshMarker)) return;
    currentUrl.searchParams.delete(refreshMarker);
    const cleanUrl = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
    window.history.replaceState(null, document.title, cleanUrl);
  };

  const requestUpdate = registration => {
    registration.update().catch(error => {
      console.debug('تعذر فحص تحديثات نبض التفوق حاليًا:', error);
    });
  };

  const activateWaitingWorker = registration => {
    const waitingWorker = registration.waiting;
    if (!waitingWorker) return;
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  };

  const watchForUpdates = registration => {
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          activateWaitingWorker(registration);
        }
      });
    });

    // عالج تحديثًا اكتمل قبل فتح التطبيق؛ لا تنتظر دورة فتح جديدة.
    activateWaitingWorker(registration);
  };

  const reloadWithFreshNavigation = () => {
    if (reloading) return;
    reloading = true;
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set(refreshMarker, String(Date.now()));
    window.location.replace(nextUrl.toString());
  };

  clearRefreshMarker();

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', {
      scope: './',
      updateViaCache: 'none'
    }).then(registration => {
      watchForUpdates(registration);
      requestUpdate(registration);

      window.setInterval(() => requestUpdate(registration), 60 * 60 * 1000);
      window.addEventListener('online', () => requestUpdate(registration));
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          activateWaitingWorker(registration);
          requestUpdate(registration);
        }
      });
    }).catch(error => {
      console.warn('تعذر تفعيل وضع العمل دون اتصال:', error);
    });
  });

  navigator.serviceWorker.addEventListener('controllerchange', reloadWithFreshNavigation);
})();
