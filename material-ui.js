/* Shared Material Web bootstrap and app-like navigation */
(() => {
  'use strict';
  document.body.classList.add('md-page-ready');
  const reduceMotion = document.documentElement.classList.contains('reduced-motion') || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!reduceMotion) {
    document.addEventListener('click', event => {
      const link = event.target.closest('a[href]');
      if (!link || link.target === '_blank' || link.hasAttribute('download') || link.origin !== location.origin) return;
      const url = new URL(link.href);
      if (url.pathname === location.pathname && url.search === location.search) return;
      event.preventDefault();
      document.body.classList.add('md-page-leaving');
      window.setTimeout(() => { location.href = link.href; }, 140);
    }, { capture: true });
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('button, .primary-button, .outline-button, .icon-button');
    if (!button || button.disabled || reduceMotion) return;
    button.animate?.([{ transform: 'scale(.97)' }, { transform: 'scale(1)' }], { duration: 150, easing: 'cubic-bezier(.23,1,.32,1)' });
  }, { capture: true });
})();
