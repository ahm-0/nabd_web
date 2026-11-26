/* سحب للتحديث: NabdPTR.attach({ scroller: عنصر|window, onRefresh: async fn }) */
(() => {
  'use strict';
  const TH = 70, MAX = 120;
  function attach({ scroller, onRefresh, host }) {
    const isWin = !scroller || scroller === window;
    const top = () => (isWin ? (window.scrollY || document.documentElement.scrollTop || 0) : scroller.scrollTop);
    const pill = document.createElement('div');
    pill.className = 'ptr-pill'; pill.setAttribute('aria-hidden', 'true'); pill.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg>';
    (host || document.body).appendChild(pill);
    let y0 = 0, dy = 0, pulling = false, busy = false, x0 = 0;
    const set = (d, ready) => { pill.style.transform = `translate(-50%, ${Math.min(d, MAX) - 46}px)`; pill.style.opacity = String(Math.min(1, d / 50)); pill.classList.toggle('ready', !!ready); pill.firstChild.style.transform = `rotate(${Math.min(180, d * 2.2)}deg)`; };
    const reset = () => { pill.classList.remove('spin', 'ready'); pill.style.transition = 'transform .25s, opacity .25s'; pill.style.transform = 'translate(-50%, -60px)'; pill.style.opacity = '0'; setTimeout(() => { pill.style.transition = ''; pill.firstChild.style.transform = ''; }, 260); };
    const el = isWin ? document : scroller;
    el.addEventListener('touchstart', e => {
      if (busy || e.touches.length !== 1 || top() > 0 || document.body.classList.contains('sheet-open')) { pulling = false; return; }
      if (e.target.closest && e.target.closest('input,textarea,[contenteditable],.no-ptr,.modal,.sheet')) { pulling = false; return; }
      y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; dy = 0; pulling = true;
    }, { passive: true });
    el.addEventListener('touchmove', e => {
      if (!pulling) return;
      const t = e.touches[0]; const d = t.clientY - y0;
      if (Math.abs(t.clientX - x0) > Math.abs(d) && d < 12) { pulling = false; return; }
      if (d <= 0 || top() > 0) { if (dy) { dy = 0; set(0); } return; }
      dy = d * 0.5; if (e.cancelable) e.preventDefault(); set(dy, dy >= TH);
    }, { passive: false });
    const end = async () => {
      if (!pulling) return; pulling = false;
      if (dy >= TH && !busy) {
        busy = true; pill.classList.add('spin'); set(TH, true);
        try { await Promise.all([Promise.resolve(onRefresh && onRefresh()), new Promise(r => setTimeout(r, 600))]); } catch { /* تجاهل */ }
        busy = false;
      }
      dy = 0; reset();
    };
    el.addEventListener('touchend', end, { passive: true });
    el.addEventListener('touchcancel', end, { passive: true });
  }
  window.NabdPTR = { attach };
})();
