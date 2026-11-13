/* Shared Material Web bootstrap and app-like navigation */
(() => {
  'use strict';
  document.body.classList.add('md-page-ready');
  const reduceMotion = document.documentElement.classList.contains('reduced-motion') || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  // التنقل بين الأقسام فوري الآن: لا تأخير ولا منع للنقر.
  // الانتقال البصري يتولاه View Transitions في nabd-pro.css.
  document.addEventListener('click', event => {
    const button = event.target.closest('button, .primary-button, .outline-button, .icon-button');
    if (!button || button.disabled || reduceMotion) return;
    button.animate?.([{ transform: 'scale(.97)' }, { transform: 'scale(1)' }], { duration: 150, easing: 'cubic-bezier(.23,1,.32,1)' });
  }, { capture: true });
})();
