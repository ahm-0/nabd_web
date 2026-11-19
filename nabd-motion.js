(() => {
  if (matchMedia('(prefers-reduced-motion:reduce)').matches || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .08 });
  const scan = () => document.querySelectorAll('.panel:not(.nm-reveal),.news-card:not(.nm-reveal),.admin-user-card:not(.nm-reveal)').forEach(el => { el.classList.add('nm-reveal'); io.observe(el); });
  document.addEventListener('DOMContentLoaded', scan); setTimeout(scan, 800);
  setTimeout(scan, 2500);
})();
