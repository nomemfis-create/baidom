/* БАЙДОМ — плавный переход по якорным ссылкам (меню, кнопки «Связаться», «Получить расчёт» и т.п.).
   Своя анимация вместо scroll-behavior: длительность зависит от расстояния, мягкий разгон и торможение,
   прокрутку можно перехватить колесом или касанием. Настройку «уменьшить движение» здесь сознательно не учитываем:
   в Windows она включается вместе с отключёнными анимациями системы, и переход превращался в резкий прыжок. */
(() => {
'use strict';
const header = document.querySelector('.top');
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
let raf = 0;
const stop = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };
['wheel', 'touchstart', 'keydown'].forEach((ev) => addEventListener(ev, stop, { passive: true }));

function targetY(hash) {
  if (hash === '#' || hash === '#top') return 0;
  const el = document.getElementById(decodeURIComponent(hash.slice(1)));
  if (!el) return null;
  const off = header && getComputedStyle(header).position === 'fixed' ? header.getBoundingClientRect().bottom + 6 : 0;
  const max = document.documentElement.scrollHeight - innerHeight;
  return Math.max(0, Math.min(max, el.getBoundingClientRect().top + scrollY - off));
}

function go(y) {
  stop();
  const y0 = scrollY, d = y - y0;
  if (Math.abs(d) < 2) return;
  const dur = Math.min(1500, Math.max(650, 380 + Math.sqrt(Math.abs(d)) * 14));
  const t0 = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - t0) / dur);
    scrollTo(0, y0 + d * ease(t));
    raf = t < 1 ? requestAnimationFrame(step) : 0;
  };
  raf = requestAnimationFrame(step);
}

const html = document.documentElement;
const dock = document.querySelector('.dock'), proj = document.getElementById('proekty'), foot = document.querySelector('.foot');
const calc = document.querySelector('.ip-stage');          // пока калькулятор на экране, панель не нужна и мешает
const menuBtn = document.querySelector('.menu-btn'), menu = document.getElementById('menu');
let tick = 0;
// шапка: над тёмным подвалом — тёмное стекло; нижняя панель действий (телефон) — от проектов до подвала
function upd() {
  tick = 0;
  const open = html.classList.contains('menu-open'), vh = innerHeight;
  if (header) {
    const hb = header.getBoundingClientRect(), mid = (hb.top + hb.bottom) / 2;
    header.classList.toggle('dark', !open && !!foot && foot.getBoundingClientRect().top < mid);
  }
  if (dock) {
    const c = calc && calc.getBoundingClientRect();
    const show = !open && !!proj && proj.getBoundingClientRect().top < vh * 0.75 && (!foot || foot.getBoundingClientRect().top > vh - 30)
      && !(c && c.top < vh - 60 && c.bottom > 90);
    dock.classList.toggle('on', show);
  }
}
addEventListener('scroll', () => { if (!tick) tick = requestAnimationFrame(upd); }, { passive: true });
addEventListener('resize', upd);
upd();
if (window.BDGlass) BDGlass.watch([[header, 30, 'blur(10px) saturate(1.7) brightness(1.04)'], [dock, 26, 'blur(10px) saturate(1.7) brightness(1.04)'], [document.getElementById('showcase'), 26, 'blur(10px) saturate(1.7) brightness(1.04)']]);

// длинные слова в заголовках («первоначального») целиком помещаются в строку — даже при крупном системном шрифте
// Android: если слово шире колонки, заголовок уменьшается ровно настолько, чтобы оно влезло
const fitEls = Array.from(document.querySelectorAll('.hero h1, .sec-head h2, .ip-text h2, .foot h2, .card h3, .step h2, .perk h3'));
function fitHeads() {
  // системное увеличение шрифта домножает и заданный нами размер — узнаём его коэффициент на пробном элементе
  const probe = document.createElement('i');
  probe.style.cssText = 'position:absolute;visibility:hidden;font-size:100px';
  document.body.appendChild(probe);
  const z = parseFloat(getComputedStyle(probe).fontSize) / 100 || 1;
  probe.remove();
  for (const el of fitEls) {
    el.style.fontSize = '';
    for (let i = 0; i < 6 && el.clientWidth && el.scrollWidth > el.clientWidth + 1; i++) {
      const fs = parseFloat(getComputedStyle(el).fontSize) / z;
      el.style.fontSize = (fs * el.clientWidth / el.scrollWidth * 0.98).toFixed(2) + 'px';
    }
  }
}
(document.fonts ? document.fonts.ready : Promise.resolve()).then(fitHeads);
addEventListener('resize', fitHeads);

// меню-шторка (телефон и планшет)
function setMenu(open) {
  if (!menu || !menuBtn) return;
  html.classList.toggle('menu-open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  menu.setAttribute('aria-hidden', String(!open));
  upd();
}
if (menuBtn) menuBtn.addEventListener('click', () => setMenu(!html.classList.contains('menu-open')));
addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest && e.target.closest('a[href^="#"]');
  if (!a) return;
  if (html.classList.contains('menu-open')) setMenu(false);          // переход из меню: сначала закрыть шторку
  const hash = a.getAttribute('href'), y = targetY(hash);
  if (y === null) return;
  e.preventDefault();
  go(y);
  if (hash.length > 1 && location.hash !== hash) history.pushState(null, '', hash);
  else if (hash === '#') history.pushState(null, '', location.pathname + location.search);
});
})();
