/* БАЙДОМ — первый экран: реальные проекты в 3D и цвета фасада.
   Когда дом достроился, проекты сами сменяются (101 ↔ 118), полоска внизу — сколько до следующего.
   Нажали на проект или цвет — автосмена выключается, смотреть можно сколько угодно; ▶ — включить снова.
   «Хочу такой дом» — окно со снимком выбранного дома и цвета. Сам 3D — в hero.js (window.BD3D). */
(() => {
'use strict';
const sc = document.getElementById('showcase');
if (!sc) return;
const houseBtns = Array.from(sc.querySelectorAll('.sc-house'));
const chipsEl = sc.querySelector('.sc-chips'), nameEl = sc.querySelector('.sc-name');
const playBtn = sc.querySelector('.sc-play'), wantBtn = sc.querySelector('.sc-want'), prog = sc.querySelector('.sc-prog');
const stage = sc.closest('.stage');
const DWELL = 9000;                          // сколько показываем каждый проект, мс
let house = 0, auto = true, built = false, acc = 0, last = performance.now(), HOUSES = null;

function renderChips() {
  if (!HOUSES) return;
  const h = HOUSES[house], cur = window.BD3D ? window.BD3D.current : 0;
  chipsEl.innerHTML = h.palettes.map((p, i) => `<button class="sc-chip${i === cur ? ' on' : ''}" type="button" role="radio" aria-checked="${i === cur}" aria-label="${p.name}" data-i="${i}" style="--b:${p.b};--r:${p.r}"><i></i></button>`).join('');
  nameEl.textContent = h.palettes[cur] ? h.palettes[cur].name : '';
}
function showHouse(i) {
  house = i;
  houseBtns.forEach((b, k) => { b.classList.toggle('on', k === i); b.setAttribute('aria-selected', String(k === i)); });
  renderChips();
}
function setAuto(on) {
  auto = on; acc = 0;
  sc.classList.toggle('paused', !on);
  playBtn.setAttribute('aria-pressed', String(on));
  playBtn.setAttribute('aria-label', on ? 'Остановить смену домов' : 'Включить смену домов');
}
function init() { if (window.BD3D && !HOUSES) { HOUSES = window.BD3D.houses; showHouse(window.BD3D.house); } }
(function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(100, now - last); last = now;
  const running = auto && built && !document.hidden && !(stage && stage.classList.contains('scrolled')) && !document.documentElement.classList.contains('want-open');
  if (running) acc += dt;
  prog.style.transform = `scaleX(${Math.min(1, acc / DWELL).toFixed(4)})`;
  if (acc >= DWELL && window.BD3D) { acc = 0; window.BD3D.setHouse(1 - window.BD3D.house); }
})(performance.now());

houseBtns.forEach((b, i) => b.addEventListener('click', () => { if (window.BD3D) window.BD3D.setHouse(i); setAuto(false); }));
chipsEl.addEventListener('click', (e) => {
  const b = e.target.closest('.sc-chip');
  if (!b || !window.BD3D) return;
  window.BD3D.setVariant(+b.dataset.i); setAuto(false);
});
playBtn.addEventListener('click', () => {
  if (auto) { setAuto(false); return; }
  setAuto(true);
  if (window.BD3D) window.BD3D.setHouse(1 - window.BD3D.house);   // включили — сразу показываем другой дом
});
document.addEventListener('bd:ready', init);
document.addEventListener('bd:built', () => { built = true; acc = 0; init(); });
document.addEventListener('bd:house', (e) => showHouse(e.detail));
document.addEventListener('bd:variant', () => renderChips());
init();

// ---------- окно «Хочу такой дом» ----------
// крупный план: из кадра первого экрана вырезаем дом (границы даёт hero.js) в пропорции 16:10
function closeUp({ url, rect }) {
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => {
      const W = im.width, H = im.height, cx = (rect.x0 + rect.x1) / 2 * W, cy = (rect.y0 + rect.y1) / 2 * H;
      let w = (rect.x1 - rect.x0) * W * 1.06, h = (rect.y1 - rect.y0) * H * 1.06;
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
  const h = HOUSES ? HOUSES[house] : { name: 'Дом 101 м²', palettes: [] }, cur = window.BD3D ? window.BD3D.current : 0;
  mTitle.textContent = h.palettes[cur] ? `${h.name}, фасад «${h.palettes[cur].name}»` : h.name;
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
