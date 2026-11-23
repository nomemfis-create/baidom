/* БАЙДОМ — варианты фасада 3D-дома на первом экране.
   Когда дом достроился, варианты сами плавно сменяются (полоска внизу — сколько осталось до следующего).
   Нажали на вариант или повернули дом — автосмена выключается, смотреть можно сколько угодно; ▶ — включить снова.
   «Хочу такой дом» — окно со снимком выбранного варианта и звонком. Сам 3D и смена цвета — в hero.js (window.BD3D). */
(() => {
'use strict';
const sc = document.getElementById('showcase');
if (!sc) return;
const chips = Array.from(sc.querySelectorAll('.sc-chip'));
const nameEl = sc.querySelector('.sc-name'), numEl = sc.querySelector('.sc-n');
const playBtn = sc.querySelector('.sc-play'), wantBtn = sc.querySelector('.sc-want'), prog = sc.querySelector('.sc-prog');
const stage = sc.closest('.stage');
const DWELL = 6500;                         // сколько показываем каждый вариант, мс
let cur = 0, auto = true, built = false, acc = 0, last = performance.now();

function show(i) {
  cur = i;
  chips.forEach((c, k) => { c.classList.toggle('on', k === i); c.setAttribute('aria-checked', String(k === i)); });
  nameEl.textContent = chips[i].getAttribute('aria-label');
  numEl.textContent = `${i + 1} / ${chips.length}`;
}
function select(i, byUser) {
  show(i);
  if (window.BD3D) window.BD3D.setVariant(i);
  acc = 0;
  if (byUser) setAuto(false);
}
function setAuto(on) {
  auto = on; acc = 0;
  sc.classList.toggle('paused', !on);
  playBtn.setAttribute('aria-pressed', String(on));
  playBtn.setAttribute('aria-label', on ? 'Остановить смену вариантов' : 'Включить смену вариантов');
}
(function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(100, now - last); last = now;
  const running = auto && built && !document.hidden && !(stage && stage.classList.contains('scrolled')) && !document.documentElement.classList.contains('want-open');
  if (running) acc += dt;
  prog.style.transform = `scaleX(${Math.min(1, acc / DWELL).toFixed(4)})`;
  if (acc >= DWELL) select((cur + 1) % chips.length, false);
})(performance.now());

chips.forEach((c, i) => c.addEventListener('click', () => select(i, true)));
playBtn.addEventListener('click', () => {
  if (auto) { setAuto(false); return; }
  setAuto(true);
  select((cur + 1) % chips.length, false);  // включили — сразу показываем следующий
});
document.addEventListener('bd:built', () => { built = true; acc = 0; });
document.addEventListener('bd:interact', () => setAuto(false));
document.addEventListener('bd:variant', (e) => { if (e.detail !== cur) show(e.detail); });

// ---------- окно «Хочу такой дом» ----------
// крупный план: из кадра первого экрана вырезаем дом (границы даёт hero.js) в пропорции 16:10
function closeUp({ url, rect }) {
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => {
      const W = im.width, H = im.height, cx = (rect.x0 + rect.x1) / 2 * W, cy = (rect.y0 + rect.y1) / 2 * H;
      let w = (rect.x1 - rect.x0) * W * 1.08, h = (rect.y1 - rect.y0) * H * 1.08;
      if (w / h > 1.6) h = w / 1.6; else w = h * 1.6;
      w = Math.min(w, W); h = Math.min(h, H, w / 1.6); w = h * 1.6;
      const x = Math.min(Math.max(0, cx - w / 2), W - w), y = Math.min(Math.max(0, cy - h / 2), H - h);
      const cv = document.createElement('canvas'); cv.width = 960; cv.height = 600;
      cv.getContext('2d').drawImage(im, x, y, w, h, 0, 0, 960, 600);
      res(cv.toDataURL('image/jpeg', 0.88));
    };
    im.onerror = () => res(url);
    im.src = url;
  });
}
const modal = document.getElementById('want');
if (!modal) return;
const html = document.documentElement;
const mImg = modal.querySelector('.want-img'), mTitle = modal.querySelector('#want-t'), mClose = modal.querySelector('.want-x');
let lastFocus = null;
async function openWant() {
  setAuto(false);
  lastFocus = document.activeElement;
  mTitle.textContent = `Дом 101 м², фасад «${chips[cur].getAttribute('aria-label')}»`;
  mImg.removeAttribute('src');
  html.classList.add('want-open');
  modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false');
  mClose.focus({ preventScroll: true });
  if (window.BD3D) {
    const shot = await Promise.race([window.BD3D.snapshot(), new Promise((r) => setTimeout(() => r(null), 900))]);
    if (shot) mImg.src = await closeUp(shot);
  }
}
function closeWant() {
  if (!modal.classList.contains('open')) return;
  modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true');
  html.classList.remove('want-open');
  if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
}
wantBtn.addEventListener('click', openWant);
mClose.addEventListener('click', closeWant);
modal.addEventListener('click', (e) => { if (e.target === modal) closeWant(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeWant(); });
})();
