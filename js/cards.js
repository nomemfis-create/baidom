/* БАЙДОМ — карточки проектов: дом выезжает из рамки фото по мере прокрутки.
   Пока карточка внизу экрана, крыша вровень с рамкой; к середине экрана дом поднимается над ней целиком.
   Пишет --rise (0…1) в стиль карточки; сам сдвиг и маска силуэта — в CSS (.card-media). */
(() => {
'use strict';
const cards = Array.from(document.querySelectorAll('.card'));
if (!cards.length) return;
const ease = (t) => 1 - Math.pow(1 - t, 3);
const live = new Set();
let raf = 0;
function update() {
  raf = 0;
  const vh = innerHeight;
  for (const c of live) {
    const r = c.getBoundingClientRect();
    // 0 — верх карточки у нижнего края экрана, 1 — поднялся на 45 % высоты экрана
    const p = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.45)));
    const v = ease(p).toFixed(3);
    if (c.style.getPropertyValue('--rise') !== v) c.style.setProperty('--rise', v);
  }
}
const req = () => { if (!raf) raf = requestAnimationFrame(update); };
const io = new IntersectionObserver((es) => {
  for (const e of es) e.isIntersecting ? live.add(e.target) : live.delete(e.target);
  req();
}, { rootMargin: '0px 0px 200px 0px' });
cards.forEach((c) => { c.style.setProperty('--rise', '0'); io.observe(c); });
addEventListener('scroll', req, { passive: true });
addEventListener('resize', req);

// на телефоне карточки — лента со свайпом; ромбики под ней показывают, какая карточка в центре
const strip = document.querySelector('.cards'), dots = Array.from(document.querySelectorAll('.cards-dots i'));
if (strip && dots.length) {
  const onStrip = () => {
    const max = strip.scrollWidth - strip.clientWidth;
    const i = max > 0 ? Math.round(strip.scrollLeft / max * (dots.length - 1)) : 0;
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
  };
  strip.addEventListener('scroll', onStrip, { passive: true });
  onStrip();
}
})();
