/* БАЙДОМ — первый экран «От чертежа до ключей».
   Дом — реальный проект заказчика: одноэтажный, 101,01 м², 12,08 × 11,56 м, вальмовая кровля.
   Всё собирается кодом при загрузке (three.js r147): кирпич за кирпичом, PBR-текстуры запекаются на видеокарте.
   Отладка: ?p=0.5 фиксирует прогресс; window.__bdSetP(0.5) — то же из консоли. */
(() => {
'use strict';

// ---------- утилиты ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (p, a, b) => clamp((p - a) / (b - a));
const sstep = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const backOut = (t) => { const c = 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const qs = new URLSearchParams(location.search);
let forcedP = qs.has('p') ? clamp(parseFloat(qs.get('p')) || 0) : null;
window.__bdSetP = (p) => { forcedP = p === null || p === undefined ? null : clamp(p); };
// «Уменьшить движение» не учитываем: в Windows оно включается вместе с отключёнными анимациями системы,
// и посетитель видел бы сайт без интро и плавности. Сайт держится на анимации.
const REDUCED = false;
const PAPER_HEX = '#ebe8e1';

// ============================================================
//  ДОМ: план (метры; x — вправо, z — к фасаду с крыльцом). Размеры — из «РП 2».
// ============================================================
const W = 12.08, D = 11.56, T = 0.5;
const NX0 = 4.8, NX1 = 7.3, NZ0 = 10.0;        // ниша крыльца
const FY = 0.5, WH = 3.0;                      // верх фундамента и высота стен
const OX = -W / 2, OZ = -D / 2;
const PITCH = 22 * Math.PI / 180, OVER = 0.6;
const CP = 0.075, NC = 40;                     // шаг ряда кладки (65 мм кирпич + 10 мм шов) и число рядов

// высоты проёмов кратны рядам кладки: подоконник 0,9 = 12 рядов, верх окна 2,25 = 30, двери 2,1 = 28
const win = (c, w, s = 0.9, h = 2.25) => ({ c, w, s, h, kind: 'win' });
const door = (c, w, h = 2.0, sw = 0) => ({ c, w, s: 0, h, kind: 'door', sw });

const WALLS = [
  { x0: 0, x1: W, z0: 0, z1: T, out: 1, ops: [win(2.4, 1.5), win(6.3, 1.5), win(9.6, 2.6, 0.6)] },
  { x0: 0, x1: T, z0: T, z1: D, out: 1, ops: [win(5.7, 0.6, 1.5), win(8.9, 1.2)] },
  { x0: W - T, x1: W, z0: T, z1: D, out: 1, ops: [win(3.0, 1.8), win(8.6, 1.5)] },
  { x0: T, x1: 4.3, z0: D - T, z1: D, out: 1, ops: [win(2.4, 1.5)] },
  { x0: 7.8, x1: W - T, z0: D - T, z1: D, out: 1, ops: [win(9.7, 1.8)] },
  { x0: 4.3, x1: NX0, z0: NZ0, z1: D, out: 1, ops: [] },
  { x0: NX1, x1: 7.8, z0: NZ0, z1: D, out: 1, ops: [] },
  { x0: 4.55, x1: 7.8, z0: NZ0 - 0.5, z1: NZ0, out: 1, ops: [door(6.05, 1.0, 2.1)] },
  { x0: 4.3, x1: 4.55, z0: T, z1: 4.6, ops: [door(3.7, 0.9)] },
  { x0: 4.3, x1: 4.55, z0: 6.8, z1: NZ0, ops: [door(7.6, 0.9)] },
  { x0: T, x1: 4.3, z0: 4.3, z1: 4.42, ops: [] },
  { x0: 3.1, x1: 3.22, z0: 4.42, z1: 7.0, ops: [door(5.7, 0.8)] },
  { x0: T, x1: 4.3, z0: 7.0, z1: 7.12, ops: [] },
  { x0: 6.28, x1: 7.92, z0: 4.6, z1: 4.72, ops: [] },
  { x0: 6.28, x1: 6.4, z0: 4.72, z1: 5.82, ops: [] },
  { x0: 6.28, x1: 7.92, z0: 5.7, z1: 5.82, ops: [door(7.1, 0.7)] },
  { x0: 7.8, x1: 7.92, z0: 4.72, z1: 5.7, ops: [] },
  { x0: 7.8, x1: W - T, z0: 6.18, z1: 6.3, ops: [] },
  { x0: 7.8, x1: 7.92, z0: 6.3, z1: NZ0 - 0.5, ops: [door(6.9, 0.8, 2.0, 1)] },
];
// наружные плоскости фасада: ось, координата плоскости, отрезок, наружу (+/−), типы углов (cv — внешний, cc — внутренний)
const RUNS = [
  { ax: 'x', f: 0, a0: 0, a1: W, o: -1, eA: 'cv', eB: 'cv', w: 0 },
  { ax: 'z', f: W, a0: 0, a1: D, o: 1, eA: 'cv', eB: 'cv', w: 2 },
  { ax: 'x', f: D, a0: NX1, a1: W, o: 1, eA: 'cv', eB: 'cv', w: 4, nA: 1 },
  { ax: 'z', f: NX1, a0: NZ0, a1: D, o: -1, eA: 'cc', eB: 'cv', w: 6, notch: 1 },
  { ax: 'x', f: NZ0, a0: NX0, a1: NX1, o: 1, eA: 'cc', eB: 'cc', w: 7, notch: 1 },
  { ax: 'z', f: NX0, a0: NZ0, a1: D, o: 1, eA: 'cc', eB: 'cv', w: 5, notch: 1 },
  { ax: 'x', f: D, a0: 0, a1: NX0, o: 1, eA: 'cv', eB: 'cv', w: 3, nB: 1 },
  { ax: 'z', f: 0, a0: 0, a1: D, o: -1, eA: 'cv', eB: 'cv', w: 1 },
];
RUNS.forEach((r) => { r.ops = WALLS[r.w].ops; });

const ROOMS = [
  ['Спальня 3', '14,45', 2.4, 2.4], ['С/у', '6,64', 1.8, 5.7], ['Спальня 2', '15,88', 2.4, 9.1],
  ['Кухня-гостиная', '28,18', 8.2, 3.0], ['Кладовка', '1,44', 7.1, 5.2], ['Коридор', '15,27', 6.1, 7.7],
  ['Спальня 1', '15,88', 9.8, 8.4], ['Крыльцо', '3,27', 6.05, 10.85],
];
const isOut = (x, z) => x < 0 || x > W || z < 0 || z > D || (x > NX0 && x < NX1 && z > NZ0);

// цифры дома
const PERIM = 2 * (W + D) + 2 * (D - NZ0);
let OPEN_AREA = 0, N_WIN = 0;
for (const w of WALLS) if (w.out) for (const o of w.ops) { OPEN_AREA += o.w * (o.h - o.s); if (o.kind === 'win') N_WIN++; }
let BRICKS = (PERIM * WH - OPEN_AREA) * 51.3;   // до запуска 3D — оценка по площади, потом — точный счёт модели
const ROOF_AREA = (W + 2 * OVER) * (D + 2 * OVER) / Math.cos(PITCH);

// этапы по прокрутке (0…1)
const S = {
  soil: [0.09, 0.16], found: [0.11, 0.2], inner: [0.14, 0.21], slab: [0.17, 0.25], planOut: [0.25, 0.3],
  walls: [0.25, 0.5], parts: [0.27, 0.49],
  raf: [0.505, 0.575], memb: [0.56, 0.61], bat: [0.58, 0.635], roof: [0.62, 0.705], trim: [0.615, 0.635],
  caps: [0.69, 0.715], gut: [0.685, 0.72],
  win: [0.725, 0.81], fin: [0.81, 0.875], lawn: [0.83, 0.92], trees: [0.86, 0.95], lights: [0.9, 0.98],
};
const sg = (p, k) => seg(p, S[k][0], S[k][1]);
const BOUNDS = [0.03, 0.11, 0.25, 0.505, 0.725, 0.84];

// ============================================================
//  ТЕКСТ: слова выезжают из-под маски вместе с прокруткой
// ============================================================
const build = $('#build'), stageEl = build.querySelector('.stage');
const heroEl = $('#hero'), steps = $$('.step'), railItems = $$('#rail li'), railFill = $('#rail .fill');
const hintEl = $('#hint'), topEl = $('#top');
const RO = { area: $('[data-k="area"]'), bricks: $('[data-k="bricks"]'), roof: $('[data-k="roof"]'), wins: $('[data-k="wins"]') };
const mobileQ = matchMedia('(max-width: 760px)');

function splitWords(el) {
  let i = 0;
  const walk = (node) => {
    for (const ch of Array.from(node.childNodes)) {
      if (ch.nodeType === 3) {
        const frag = document.createDocumentFragment();
        for (const part of ch.textContent.split(/( +)/)) {
          if (!part) continue;
          if (/^ +$/.test(part)) { frag.appendChild(document.createTextNode(' ')); continue; }
          const w = document.createElement('span'); w.className = 'w';
          const wi = document.createElement('span'); wi.className = 'wi'; wi.style.setProperty('--i', i++); wi.textContent = part;
          w.appendChild(wi); frag.appendChild(w);
        }
        node.replaceChild(frag, ch);
      } else if (ch.nodeType === 1 && ch.tagName !== 'BR') walk(ch);
    }
  };
  walk(el);
}
[heroEl, ...steps].forEach((block) => {
  let d = 0;
  for (const el of Array.from(block.children)) {
    if (/^H[12]$/.test(el.tagName)) { splitWords(el); d = 0.32; continue; }
    el.classList.add('fx');
    el.style.setProperty('--d', d.toFixed(2));
    el.style.setProperty('--dx', (d * 0.25).toFixed(2));
    d += 0.12;
  }
});
const TXT = [{ el: heroEl, a: -1, b: BOUNDS[0] }].concat(steps.map((el, i) => ({ el, a: BOUNDS[i], b: i + 1 < BOUNDS.length ? BOUNDS[i + 1] : 9 })));
TXT.forEach((t) => { t.k = -1; t.x = -1; t.vis = null; });
function textScrub(p, heroIn) {
  for (const t of TXT) {
    let k, x;
    if (t.a < 0) { k = heroIn; x = sstep(seg(p, 0.002, 0.024)); }
    else { k = sstep(seg(p, t.a + 0.003, t.a + 0.036)); x = t.b > 1 ? 0 : sstep(seg(p, t.b - 0.03, t.b - 0.004)); }
    if (Math.abs(k - t.k) > 0.0004 || Math.abs(x - t.x) > 0.0004) {
      t.el.style.setProperty('--k', k.toFixed(4)); t.el.style.setProperty('--x', x.toFixed(4)); t.k = k; t.x = x;
    }
    const vis = k > 0.001 && x < 0.999;
    if (vis !== t.vis) { t.el.style.visibility = vis ? 'visible' : 'hidden'; t.vis = vis; }
  }
}

function scrollProgress() {
  const r = build.getBoundingClientRect();
  return clamp(-r.top / Math.max(1, r.height - innerHeight));
}
let hudStage = -2;
const roCache = {};
function setRO(k, v) { if (roCache[k] !== v) { roCache[k] = v; RO[k].textContent = v; } }
function hud(p, p3 = p) {
  let s = -1;
  for (let i = 0; i < BOUNDS.length; i++) if (p >= BOUNDS[i]) s = i;
  if (s !== hudStage) {
    railItems.forEach((li, i) => { li.classList.toggle('on', i <= s); li.classList.toggle('cur', i === s); });
    hudStage = s;
  }
  railFill.style.transform = mobileQ.matches ? `scaleX(${p.toFixed(4)})` : `scaleY(${p.toFixed(4)})`;
  hintEl.classList.toggle('off', p > 0.012);
  if (r118eff > 0.5 && H118stats) {
    setRO('area', H118stats.area); setRO('bricks', '≈ ' + fmt(H118stats.bricks) + ' шт');
    setRO('roof', fmt(H118stats.roof) + ' м²'); setRO('wins', fmt(H118stats.wins) + ' шт');
  } else {
    setRO('area', '101,01 м²');
    setRO('bricks', '≈ ' + fmt(BRICKS * sg(p3, 'walls')) + ' шт');
    setRO('roof', fmt(ROOF_AREA * easeIO(sg(p3, 'roof'))) + ' м²');
    setRO('wins', fmt(N_WIN * sg(p3, 'win')) + ' шт');
  }
  topEl.classList.toggle('solid', build.getBoundingClientRect().bottom < 90);
}
railItems.forEach((li, i) => li.querySelector('button').addEventListener('click', () => {
  const top = build.getBoundingClientRect().top + scrollY;
  scrollTo({ top: top + (BOUNDS[i] + 0.04) * (build.offsetHeight - innerHeight), behavior: 'smooth' });
}));

// Автопостройка: на первом экране дом строится сам, без прокрутки (чертёж → стены → крыша → вечер),
// и камера за это время опускается с вида сверху до финального ракурса. Стоит начать листать —
// 3D и камера плавно переходят на этапы по прокрутке (дом «отматывается» к чертежу и строится заново).
const DEMO = { start: 2300, dur: 6500, end: 0.985 };       // мс после появления 3D; до какого этапа
let demoT0 = -1, camBlend = 1, camDemoK = 1, camScrollP = 0, lastHK = '';

// Два реальных проекта на первом экране: 101 (стройка по прокрутке) и 118 (отдельная модель).
// 101 → 118: стройка 101 «отматывается» к чертежу, участок с газоном и деревьями остаётся; 118 вырастает снизу вверх.
// 118 → 101: 118 уходит сверху вниз, 101 снова строится. При прокрутке к этапам всегда 101.
let houseCur = 0, houseTo = 0, hsT0 = -1, hsPending = -1, heroP101 = DEMO.end, r118 = 0, r118eff = 0, H118stats = null;
let hide101 = 0, hide101eff = 0;
function setHouse(i) {
  i = i ? 1 : 0;
  if (!builtSent) return;
  if (hsT0 !== -1) { hsPending = i; return; }
  if (i === houseCur) return;
  houseTo = i; hsT0 = -2;
  document.dispatchEvent(new CustomEvent('bd:house', { detail: i }));
}
function stepHouse(now) {
  if (hsT0 === -1) return;
  if (hsT0 === -2) hsT0 = now;
  const t = (now - hsT0) / 1000;
  if (houseTo === 1) {                       // 101 разбирается, потом у 118: чертёж → фундамент → стены и кровля → участок
    heroP101 = lerp(DEMO.end, 0.04, easeIO(clamp(t / 1.4)));
    hide101 = easeIO(clamp(t / 0.6));
    r118 = clamp((t - 1.15) / 3.9);
    if (t >= 5.1) { houseCur = 1; hsT0 = -1; r118 = 1; }
  } else {                                   // 118 уходит, у 101 проступает свой чертёж, и дом строится заново
    r118 = 1 - clamp(t / 1.3);
    hide101 = 1 - easeIO(clamp((t - 0.8) / 0.6));
    heroP101 = lerp(0.04, DEMO.end, easeIO(clamp((t - 1.1) / 3.6)));
    if (t >= 4.75) { houseCur = 0; hsT0 = -1; heroP101 = DEMO.end; hide101 = 0; }
  }
  if (hsT0 === -1 && hsPending >= 0) { const q = hsPending; hsPending = -1; setHouse(q); }
}

// интро (текст, чертёж, автопостройка) начинается, когда ушёл загрузчик
const isLoaded = () => document.documentElement.classList.contains('bd-loaded');
let builtSent = false;

// один цикл на всё: прогресс сглаживается, текст и шкала живут сразу, 3D подключается, когда готово
let render3D = null, pS = forcedP ?? scrollProgress(), lastT = performance.now(), heroT0 = -1;
heroEl.style.setProperty('--k', '0');
function uiLoop(now) {
  requestAnimationFrame(uiLoop);
  const rawDt = (now - lastT) / 1000; lastT = now;
  const dt = Math.min(0.2, rawDt);
  const pT = forcedP ?? scrollProgress();
  pS = forcedP !== null ? pT : lerp(pS, pT, 1 - Math.exp(-dt * 4.5));
  if (Math.abs(pS - pT) < 1e-4) pS = pT;
  if (heroT0 < 0 && isLoaded()) heroT0 = now;
  stepHouse(now);
  let p3 = pS, siteP = pS;                                              // прогресс стройки для 3D и счётчиков
  camScrollP = pS; camBlend = 1;
  if (render3D && forcedP === null && isLoaded()) {
    if (demoT0 < 0) demoT0 = now;
    camDemoK = sstep(clamp((now - demoT0 - DEMO.start) / DEMO.dur));
    camBlend = sstep(seg(pS, 0.004, 0.06));                 // 0 — первый экран, 1 — листают этапы
    const demoP = lerp(BOUNDS[0], DEMO.end, camDemoK);
    const houseP = houseCur === 0 && hsT0 === -1 ? demoP : heroP101;
    p3 = lerp(houseP, pS, camBlend); siteP = lerp(demoP, pS, camBlend);
    if (camDemoK >= 1 && !builtSent) { builtSent = true; document.dispatchEvent(new Event('bd:built')); }   // дом достроен — можно листать варианты
  }
  r118eff = r118 * (1 - camBlend); hide101eff = hide101 * (1 - camBlend);
  const hk = (1 - camBlend).toFixed(3);                     // «первый экран»: шкала этапов проявляется, когда начинают листать
  if (hk !== lastHK) { stageEl.style.setProperty('--hk', hk); stageEl.classList.toggle('scrolled', camBlend > 0.5); lastHK = hk; }
  hud(pS, p3);
  textScrub(pS, heroT0 < 0 ? 0 : REDUCED ? 1 : sstep(clamp((now - heroT0 - 120) / 1500)));
  if (render3D && isLoaded()) render3D(p3, now, rawDt, siteP);
}
requestAnimationFrame(uiLoop);
function webglOK() {
  try { const c = document.createElement('canvas'); return !!c.getContext('webgl2'); } catch (e) { return false; }
}
function start() {
  if (!window.THREE || !webglOK()) { document.body.classList.add('no3d'); document.dispatchEvent(new Event('bd:ready')); return; }
  try { render3D = init3D(window.THREE); }
  catch (e) { console.error('[БАЙДОМ] 3D не запустилось:', e); document.body.classList.add('no3d'); }
  document.dispatchEvent(new Event('bd:ready'));          // загрузчик уходит
}
// сцену собираем, когда заголовок уже выехал: тяжёлая сборка не дёргает первую анимацию
const go = () => setTimeout(start, 650);
if (document.readyState === 'complete') go(); else addEventListener('load', go);

// ============================================================
//  3D-СЦЕНА
// ============================================================
function init3D(THREE) {
  const canvas = $('#gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(new THREE.Color(PAPER_HEX), 1);
  const ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const V3 = THREE.Vector3, Q = THREE.Quaternion, M4 = THREE.Matrix4;
  const lin = (h) => new THREE.Color(h).convertSRGBToLinear();
  const glv = (c) => `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
  const fl = (x) => x.toFixed(4);
  const wx = (x) => x + OX, wz = (z) => z + OZ;
  const rnd = mulberry(20261115);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.3, 400);
  const u = (v) => ({ value: v });
  const U = {
    draw: u(0), planA: u(1), fillA: u(0), lineK: u(1), slabX: u(-1e3),
    bC: u(-9), kC: u(-9), wC: u(-9), aC: u(-9), pC: u(-9), mY: u(-1), lY: u(-1), eave: u(0),
    roofY: u(-10), membY: u(-10), soil: u(0), lawn: u(0), found: u(0), lights: u(0), time: u(0),
    lamps: u([new V3(0, -9, 0), new V3(0, -9, 0), new V3(0, -9, 0), new V3(0, -9, 0)]), lampK: u(1), gK1: u(0), gK2: u(1),
    varA: u(new V3(1, 1, 1)), varB: u(new V3(1, 1, 1)), tintA: u(0), tintB: u(0), varT: u(0), bandA: u(0), bandB: u(0), clip118: u(-10),
  };
  const SHARED = {
    FLOOR_Y: fl(FY), WALL_H: fl(WH),
    H_X0: fl(OX), H_X1: fl(OX + W), H_Z0: fl(OZ), H_Z1: fl(OZ + D),
    ACCENT_LIN: glv(lin('#c4561d')),
  };

  // ---------- геометрия ----------
  // коробка с UV в метрах (для бетона, раствора, утеплителя)
  function pushBox(G, x0, y0, z0, x1, y1, z1, us = 1) {
    const q = (a, b, c, d, n, ua, va) => {
      G.P.push(...a, ...b, ...c, ...a, ...c, ...d);
      for (let i = 0; i < 6; i++) G.N.push(...n);
      if (G.UV) for (const p of [a, b, c, a, c, d]) G.UV.push(p[ua] * us, p[va] * us);
    };
    q([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], 2, 1);
    q([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], 2, 1);
    q([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], 0, 2);
    q([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], 0, 2);
    q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], 0, 1);
    q([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], 0, 1);
  }
  const G0 = (uv = true) => ({ P: [], N: [], UV: uv ? [] : null });
  function geoFrom(G) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(G.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(G.N, 3));
    if (G.UV) g.setAttribute('uv', new THREE.Float32BufferAttribute(G.UV, 2));
    g.computeBoundingSphere();
    return g;
  }
  // брусок с фаской на каждом ребре: 6 граней, 12 фасок, 8 угловых треугольников
  function chamferBox(w, h, d, e, us, atlas, noBack) {
    const a = w / 2, b = h / 2, c = d / 2, P = [], N = [], UV = [];
    const px = (sx, sy, sz) => [sx * a, sy * (b - e), sz * (c - e)];
    const py = (sx, sy, sz) => [sx * (a - e), sy * b, sz * (c - e)];
    const pz = (sx, sy, sz) => [sx * (a - e), sy * (b - e), sz * c];
    const tri = (A, B, C) => {
      let n = new V3(B[0] - A[0], B[1] - A[1], B[2] - A[2]).cross(new V3(C[0] - A[0], C[1] - A[1], C[2] - A[2]));
      const cen = new V3((A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3, (A[2] + B[2] + C[2]) / 3);
      if (n.dot(cen) < 0) { const t = B; B = C; C = t; n.negate(); }
      n.normalize();
      if (noBack && n.z < -0.3) return;
      const ax = Math.abs(n.x) >= Math.abs(n.y) && Math.abs(n.x) >= Math.abs(n.z) ? 0 : (Math.abs(n.y) >= Math.abs(n.z) ? 1 : 2);
      for (const p of [A, B, C]) {
        P.push(...p); N.push(n.x, n.y, n.z);
        let uu, vv;
        if (atlas) {
          if (ax === 1) { uu = 0.5 + (p[0] + a) / w * 0.5; vv = (p[2] + c) / d; }
          else if (ax === 0) { uu = (p[2] + c) / d * 0.5; vv = (p[1] + b) / h; }
          else { uu = (p[0] + a) / w * 0.5; vv = (p[1] + b) / h; }
        } else if (ax === 0) { uu = p[2] * us; vv = p[1] * us; }
        else if (ax === 1) { uu = p[0] * us; vv = p[2] * us; }
        else { uu = p[0] * us; vv = p[1] * us; }
        UV.push(uu, vv);
      }
    };
    const quad = (A, B, C, D2) => { tri(A, B, C); tri(A, C, D2); };
    for (const s of [-1, 1]) {
      quad(px(s, -1, -1), px(s, 1, -1), px(s, 1, 1), px(s, -1, 1));
      quad(py(-1, s, -1), py(1, s, -1), py(1, s, 1), py(-1, s, 1));
      quad(pz(-1, -1, s), pz(1, -1, s), pz(1, 1, s), pz(-1, 1, s));
    }
    for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) {
      quad(px(s1, s2, -1), px(s1, s2, 1), py(s1, s2, 1), py(s1, s2, -1));
      quad(px(s1, -1, s2), px(s1, 1, s2), pz(s1, 1, s2), pz(s1, -1, s2));
      quad(py(-1, s1, s2), py(1, s1, s2), pz(1, s1, s2), pz(-1, s1, s2));
    }
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) tri(px(sx, sy, sz), py(sx, sy, sz), pz(sx, sy, sz));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    return g;
  }

  // подмешивание кода в стандартные шейдеры three.js
  function patch(mat, key, o) {
    if (o.defines) mat.defines = Object.assign({}, mat.defines, o.defines);
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, o.uniforms || {});
      let v = sh.vertexShader, f = sh.fragmentShader;
      const rv = (inc, code) => { if (code) v = v.replace(`#include <${inc}>`, `#include <${inc}>\n${code}`); };
      const rf = (inc, code) => { if (code) f = f.replace(`#include <${inc}>`, `#include <${inc}>\n${code}`); };
      rv('common', o.vHead); rv('beginnormal_vertex', o.vNormal); rv('begin_vertex', o.vBegin); rv('uv_vertex', o.vUv); rv('project_vertex', o.vEnd);
      rf('common', o.fHead); rf('clipping_planes_fragment', o.fStart); rf('color_fragment', o.fColor); rf('roughnessmap_fragment', o.fRough);
      rf('normal_fragment_begin', o.fNormal); rf('emissivemap_fragment', o.fEmis);
      sh.vertexShader = v; sh.fragmentShader = f;
    };
    mat.customProgramCacheKey = () => key;
    return mat;
  }
  const WP_END = `
#ifdef USE_INSTANCING
  vWP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
#else
  vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;
#endif`;

  // ============================================================
  //  PBR-текстуры: запекаются шейдерами в текстуры при загрузке (альбедо, нормали, шероховатость)
  // ============================================================
  const NOISE = `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float pn(vec2 p, vec2 per){ vec2 i = floor(p), f = fract(p); vec2 w = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(mod(i, per)), hash12(mod(i + vec2(1.0, 0.0), per)), w.x), mix(hash12(mod(i + vec2(0.0, 1.0), per)), hash12(mod(i + vec2(1.0, 1.0), per)), w.x), w.y); }
float fbm(vec2 uv, vec2 per, int oct){ float s = 0.0, a = 0.5; for (int i = 0; i < 7; i++){ if (i >= oct) break; s += a * pn(uv * per, per); per *= 2.0; a *= 0.5; } return s; }
float cell(vec2 uv, vec2 per){ vec2 p = uv * per; vec2 i = floor(p), f = fract(p); float d = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){ vec2 g = vec2(float(x), float(y)); vec2 o = hash22(mod(i + g, per)); vec2 r = g + o - f; d = min(d, dot(r, r)); }
  return sqrt(d); }
`;
  const BAKE_MAIN = `
varying vec2 vUv; uniform float uMode; uniform float uTexel;
void main(){
  vec2 uv = vUv;
  if (uMode < 0.5) gl_FragColor = vec4(clamp(A(uv), 0.0, 1.0), 1.0);
  else if (uMode < 1.5) {
    float e = uTexel;
    float hx = H(fract(uv + vec2(e, 0.0))) - H(fract(uv - vec2(e, 0.0)));
    float hy = H(fract(uv + vec2(0.0, e))) - H(fract(uv - vec2(0.0, e)));
    vec3 n = normalize(vec3(-hx / (2.0 * e) * NDEPTH, -hy / (2.0 * e) * NDEPTH, 1.0));
    gl_FragColor = vec4(n * 0.5 + 0.5, 1.0);
  } else { float r = clamp(R(uv), 0.0, 1.0); gl_FragColor = vec4(r, r, r, 1.0); }
}`;
  const bakeScene = new THREE.Scene(), bakeCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const bakeQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); bakeQuad.frustumCulled = false; bakeScene.add(bakeQuad);
  function bake(size, body, repeat = 1) {
    const out = [];
    for (let mode = 0; mode < 3; mode++) {
      const rt = new THREE.WebGLRenderTarget(size, size, {
        wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, magFilter: THREE.LinearFilter,
        minFilter: THREE.LinearMipmapLinearFilter, generateMipmaps: true, depthBuffer: false,
      });
      bakeQuad.material = new THREE.ShaderMaterial({
        uniforms: { uMode: u(mode), uTexel: u(1 / size) },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: NOISE + body + BAKE_MAIN,
      });
      renderer.setRenderTarget(rt); renderer.render(bakeScene, bakeCam);
      bakeQuad.material.dispose();
      rt.texture.anisotropy = ANISO; rt.texture.repeat.set(repeat, repeat);
      out.push(rt.texture);
    }
    renderer.setRenderTarget(null);
    return { map: out[0], normalMap: out[1], roughnessMap: out[2] };
  }
  const TX = {
    // облицовочный кирпич: пятна обжига, песчинки, раковины (1 тайл = 0,25 м)
    brick: bake(512, `
#define NDEPTH 0.004
float pits(vec2 uv){ return smoothstep(0.12, 0.035, cell(uv, vec2(9.0))) * step(0.45, hash12(floor(uv * 9.0) + 7.0)); }
float H(vec2 uv){ return fbm(uv, vec2(5.0), 6) * 0.55 + pn(uv * 128.0, vec2(128.0)) * 0.14 - pits(uv) * 0.7; }
vec3 A(vec2 uv){
  float m = fbm(uv + 0.37, vec2(3.0), 5);
  float sp = smoothstep(0.66, 0.74, pn(uv * 72.0, vec2(72.0)));
  float gl = smoothstep(0.72, 0.82, pn(uv * 140.0 + 3.0, vec2(140.0)));
  vec3 c = vec3(0.68 + 0.36 * m);
  c *= 1.0 - sp * 0.45; c += gl * 0.07; c *= 1.0 - pits(uv) * 0.45;
  c *= mix(vec3(1.0), vec3(1.08, 0.97, 0.9), smoothstep(0.5, 0.8, fbm(uv + 9.1, vec2(3.0), 4)));
  return c;
}
float R(vec2 uv){ return 0.74 + 0.2 * fbm(uv + 5.1, vec2(4.0), 4) - pits(uv) * 0.1; }`),
    mortar: bake(256, `
#define NDEPTH 0.006
float H(vec2 uv){ return fbm(uv, vec2(8.0), 5) * 0.5 + pn(uv * 128.0, vec2(128.0)) * 0.5; }
vec3 A(vec2 uv){ return vec3(0.76 + 0.24 * fbm(uv + 1.3, vec2(6.0), 5)) * (0.9 + 0.1 * pn(uv * 128.0, vec2(128.0))); }
float R(vec2 uv){ return 0.96; }`),
    concrete: bake(512, `
#define NDEPTH 0.0014
float pores(vec2 uv){ return smoothstep(0.07, 0.02, cell(uv, vec2(36.0))) * step(0.55, hash12(floor(uv * 36.0) + 3.0)); }
float H(vec2 uv){ return fbm(uv, vec2(4.0), 6) * 0.4 - pores(uv) * 0.8; }
vec3 A(vec2 uv){ float m = fbm(uv + 2.1, vec2(3.0), 6); return vec3(0.8 + 0.2 * m) * (1.0 - pores(uv) * 0.5) * (0.96 + 0.06 * pn(uv * 90.0, vec2(90.0))); }
float R(vec2 uv){ return 0.84 + 0.12 * fbm(uv + 7.7, vec2(5.0), 4); }`),
    // керамический блок: бока с рифлением, верх с пустотами (атлас: левая половина — бока, правая — верх)
    block: bake(256, `
#define NDEPTH 0.012
float H(vec2 uv){
  float n = fbm(fract(uv), vec2(6.0), 4) * 0.12;
  if (uv.x < 0.5) { return 0.5 + 0.3 * cos(uv.x * 2.0 * 6.2832 * 12.0) + n; }
  vec2 t = vec2((uv.x - 0.5) * 2.0, uv.y);
  vec2 g = fract(t * vec2(9.0, 5.0));
  float hole = step(0.18, g.x) * step(g.x, 0.82) * step(0.22, g.y) * step(g.y, 0.78);
  float border = step(0.04, t.x) * step(t.x, 0.96) * step(0.06, t.y) * step(t.y, 0.94);
  return (1.0 - hole * border) * 0.9 + n;
}
vec3 A(vec2 uv){ vec3 c = vec3(0.8 + 0.2 * fbm(fract(uv + 4.4), vec2(5.0), 4)); if (uv.x >= 0.5) c *= mix(0.22, 1.0, smoothstep(0.3, 0.6, H(uv))); return c; }
float R(vec2 uv){ return 0.9; }`),
    aac: bake(256, `
#define NDEPTH 0.0016
float pores(vec2 uv){ return smoothstep(0.1, 0.03, cell(uv, vec2(44.0))); }
float H(vec2 uv){ return fbm(uv, vec2(6.0), 4) * 0.2 - pores(uv) * 0.7; }
vec3 A(vec2 uv){ return vec3(0.9 + 0.08 * fbm(uv + 2.0, vec2(4.0), 4)) * (1.0 - pores(uv) * 0.32); }
float R(vec2 uv){ return 0.95; }`),
    wool: bake(256, `
#define NDEPTH 0.005
float fib(vec2 uv){ return pn(uv * vec2(12.0, 80.0), vec2(12.0, 80.0)) * 0.5 + pn(uv * vec2(24.0, 160.0), vec2(24.0, 160.0)) * 0.5; }
float H(vec2 uv){ return fib(uv) * 0.7 + fbm(uv, vec2(4.0), 4) * 0.3; }
vec3 A(vec2 uv){ return vec3(0.72 + 0.3 * fib(uv)) * (0.9 + 0.1 * fbm(uv + 1.0, vec2(3.0), 4)); }
float R(vec2 uv){ return 1.0; }`),
    // металлочерепица: 2 волны по ширине тайла (0,37 м) и одна ступень по высоте (0,35 м)
    roof: bake(512, `
#define NDEPTH 0.06
float H(vec2 uv){
  float wave = 0.5 + 0.5 * cos(uv.x * 6.2832 * 2.0);
  float rise = smoothstep(0.0, 0.07, uv.y);
  return wave * 0.45 + rise * (1.0 - uv.y * 0.35) * 0.55 + pn(uv * 64.0, vec2(64.0)) * 0.01;
}
vec3 A(vec2 uv){ return vec3(0.9 + 0.1 * fbm(uv, vec2(4.0), 3)); }
float R(vec2 uv){ return 0.34 + 0.08 * fbm(uv + 3.0, vec2(6.0), 3); }`),
    soffit: bake(256, `
#define NDEPTH 0.003
float H(vec2 uv){ float g = fract(uv.x * 10.0); return smoothstep(0.0, 0.08, g) * (1.0 - smoothstep(0.92, 1.0, g)) + pn(uv * 40.0, vec2(40.0)) * 0.03; }
vec3 A(vec2 uv){ return vec3(0.96); }
float R(vec2 uv){ return 0.55; }`),
  };

  // текстуры листвы, лап ели и коры — рисуются на canvas
  function canvasTex(w, h, draw) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    draw(cv.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.anisotropy = ANISO;
    return t;
  }
  function leafTex(cols, seed, size = 1) {
    return canvasTex(256, 256, (g, S) => {
      const r = mulberry(seed);
      g.strokeStyle = 'rgba(74,58,40,0.85)'; g.lineWidth = 2.2;
      for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(S / 2, S / 2); g.quadraticCurveTo(S / 2 + (r() - 0.5) * S * 0.4, S / 2 + (r() - 0.5) * S * 0.4, S / 2 + (r() - 0.5) * S * 0.8, S / 2 + (r() - 0.5) * S * 0.8); g.stroke(); }
      for (let i = 0; i < 64; i++) {
        const ang = r() * Math.PI * 2, rad = Math.sqrt(r()) * S * 0.4;
        const s = S * (0.05 + r() * 0.045) * size;
        g.save(); g.translate(S / 2 + Math.cos(ang) * rad, S / 2 + Math.sin(ang) * rad); g.rotate(r() * Math.PI * 2);
        g.fillStyle = cols[Math.floor(r() * cols.length)];
        g.beginPath(); g.moveTo(0, -s); g.bezierCurveTo(s * 0.72, -s * 0.5, s * 0.6, s * 0.55, 0, s); g.bezierCurveTo(-s * 0.6, s * 0.55, -s * 0.72, -s * 0.5, 0, -s); g.fill();
        g.fillStyle = `rgba(255,255,235,${(0.07 + r() * 0.1).toFixed(2)})`;
        g.beginPath(); g.moveTo(0, -s); g.bezierCurveTo(s * 0.72, -s * 0.5, s * 0.6, s * 0.55, 0, s); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(25,35,15,0.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -s * 0.9); g.lineTo(0, s * 0.9); g.stroke();
        g.restore();
      }
    });
  }
  const spruceTex = canvasTex(256, 128, (g, Wd, Ht) => {
    const r = mulberry(77), cols = ['#2f4a35', '#365540', '#2a4230', '#3d5d44', '#4a6c4d'];
    const needles = (x0, y0, x1, y1, len) => {
      const n = Math.hypot(x1 - x0, y1 - y0) / 1.6, dx = (x1 - x0) / n, dy = (y1 - y0) / n, a = Math.atan2(dy, dx);
      for (let i = 0; i < n; i++) {
        const x = x0 + dx * i, y = y0 + dy * i, l = len * (1 - (i / n) * 0.6) * (0.7 + r() * 0.5);
        for (const s of [-1, 1]) {
          const b = a + s * (0.95 + r() * 0.3);
          g.strokeStyle = cols[Math.floor(r() * cols.length)]; g.lineWidth = 1.3;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(b) * l, y + Math.sin(b) * l); g.stroke();
        }
      }
    };
    g.strokeStyle = '#4a3a2a'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(2, Ht / 2); g.lineTo(Wd - 6, Ht / 2 + 4); g.stroke();
    needles(2, Ht / 2, Wd - 6, Ht / 2 + 4, 24);
    for (let i = 0; i < 7; i++) {
      const t = 0.2 + i * 0.1, x = Wd * t, y = Ht / 2 + 4 * t, s = i % 2 ? 1 : -1, l = (1 - t) * 90 + 20;
      needles(x, y, x + l * 0.8, y + s * l * 0.45, 14);
    }
  });
  const barkTex = canvasTex(128, 256, (g, Wd, Ht) => {
    const r = mulberry(5); g.fillStyle = '#5d4a3a'; g.fillRect(0, 0, Wd, Ht);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${30 + r() * 40},${24 + r() * 30},${18 + r() * 20},0.5)`; g.fillRect(r() * Wd, r() * Ht, 1 + r() * 3, 8 + r() * 30); }
  });
  const birchTex = canvasTex(128, 256, (g, Wd, Ht) => {
    const r = mulberry(9); g.fillStyle = '#e9e6dd'; g.fillRect(0, 0, Wd, Ht);
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(30,28,26,${0.5 + r() * 0.4})`; g.fillRect(r() * Wd, r() * Ht, 6 + r() * 26, 1.5 + r() * 3); }
    for (let i = 0; i < 18; i++) { g.fillStyle = 'rgba(40,36,32,0.6)'; g.beginPath(); g.ellipse(r() * Wd, r() * Ht, 4 + r() * 10, 2 + r() * 5, 0, 0, Math.PI * 2); g.fill(); }
  });
  const LEAF_TEX = leafTex(['#5f7d44', '#6b8a4c', '#56713c', '#7a9656', '#4d6a37'], 3);
  const BIRCH_LEAF = leafTex(['#7f9c4c', '#8fa957', '#6f8d43', '#9ab35f'], 8, 0.8);
  const BUSH_LEAF = leafTex(['#4f6e3c', '#5b7c44', '#45633a', '#678a4b'], 13, 0.9);

  // ============================================================
  //  МАТЕРИАЛЫ
  // ============================================================
  const pbr = (tx, color, extra = {}) => new THREE.MeshStandardMaterial(Object.assign({
    color: lin(color), map: tx.map, normalMap: tx.normalMap, roughnessMap: tx.roughnessMap, roughness: 1, metalness: 0, envMapIntensity: 0.45,
  }, extra));
  // затенение у земли и под свесом кровли (дёшево, но сильно добавляет объёма)
  const AO_HEAD = `
varying vec3 vWP;
uniform float uEave;
float aoH(vec3 p){
  float g = mix(0.72, 1.0, smoothstep(0.0, 0.7, p.y));
  float e = 1.0 - uEave * 0.42 * smoothstep(FLOOR_Y + WALL_H - 1.1, FLOOR_Y + WALL_H, p.y);
  return g * e;
}`;
  // элементы кладки падают на место: aT — когда, uBuild — где сейчас «фронт» (в рядах кирпича)
  const DROP_HEAD = 'attribute float aT;\nattribute vec2 aUvOff;\nuniform float uBuild;\nvarying float vFresh;\nvarying vec3 vWP;';
  const dropBegin = (h) => `
  float dk = clamp((uBuild - aT) / 1.3, 0.0, 1.0);
  float de = 1.0 - pow(1.0 - dk, 3.0);
  transformed *= step(0.0001, dk);
  transformed.y += (1.0 - de) * ${h.toFixed(2)};
  vFresh = 1.0 - smoothstep(0.0, 2.5, uBuild - aT - 1.3);`;
  const VAR_HEAD = `
uniform vec3 uVarA, uVarB; uniform float uTintA, uTintB, uVarT;
float varY(float y){ return (y - FLOOR_Y) / WALL_H; }
float varFront(){ return uVarT * 1.3 - 0.15; }
vec3 varCol(vec3 c, vec3 tint, float use){
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return mix(c, tint * clamp(l / 0.034, 0.55, 1.6), use);
}
vec3 varMix(vec3 c, float y){
  float s = 1.0 - smoothstep(varFront() - 0.08, varFront() + 0.01, varY(y));
  return mix(varCol(c, uVarA, uTintA), varCol(c, uVarB, uTintB), s);
}
float varEdge(float y){
  return (1.0 - smoothstep(0.0, 0.022, abs(varY(y) - varFront()))) * step(0.001, uVarT) * step(uVarT, 0.999);
}`;
  function masonryMat(tx, color, uBuild, key, dropH, opts = {}) {
    const { noUvOff, noAO, ...params } = opts;
    const m = pbr(tx, color, params);
    const VAR = key === 'brick';                             // варианты фасада — только у облицовочного кирпича
    patch(m, 'bd-mas-' + key, {
      defines: SHARED,
      uniforms: Object.assign({ uBuild, uEave: U.eave }, VAR ? { uVarA: U.varA, uVarB: U.varB, uTintA: U.tintA, uTintB: U.tintB, uVarT: U.varT } : {}),
      vHead: DROP_HEAD, vBegin: dropBegin(dropH), vUv: noUvOff ? '' : 'vUv += aUvOff;', vEnd: WP_END,
      fHead: 'varying float vFresh;\n' + AO_HEAD + (VAR ? VAR_HEAD : ''),
      fColor: (VAR ? 'diffuseColor.rgb = varMix(diffuseColor.rgb, vWP.y);\n' : '') + (noAO ? '' : 'diffuseColor.rgb *= aoH(vWP);'),
      fEmis: 'totalEmissiveRadiance += ACCENT_LIN * vFresh * 0.16;' + (VAR ? '\ntotalEmissiveRadiance += ACCENT_LIN * varEdge(vWP.y) * 1.4;' : ''),
    });
    const dm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    patch(dm, 'bd-mas-d-' + key, { uniforms: { uBuild }, vHead: DROP_HEAD, vBegin: dropBegin(dropH) });
    return { m, dm };
  }

  // ============================================================
  //  ЗЕМЛЯ: бумага → площадка → газон (без освещения, тени — отдельным слоем)
  // ============================================================
  const paper = new THREE.Color(PAPER_HEX);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.ShaderMaterial({
    defines: SHARED,
    uniforms: { uPaper: u(new V3(paper.r, paper.g, paper.b)), uSoil: U.soil, uLawn: U.lawn, uFound: U.found, uLights: U.lights, uLamp: U.lamps, uLampK: U.lampK },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `
varying vec3 vW;
uniform vec3 uPaper; uniform float uSoil, uLawn, uFound, uLights, uLampK; uniform vec3 uLamp[4];
float h1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h1(i), h1(i + vec2(1.0, 0.0)), f.x), mix(h1(i + vec2(0.0, 1.0)), h1(i + vec2(1.0, 1.0)), f.x), f.y); }
float sdBox(vec2 p, vec2 b){ vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
void main(){
  vec2 p = vW.xz;
  vec2 c = vec2((H_X0 + H_X1) * 0.5, (H_Z0 + H_Z1) * 0.5), hb = vec2((H_X1 - H_X0) * 0.5, (H_Z1 - H_Z0) * 0.5);
  float dH = sdBox(p - c, hb), r = length(p - c);
  float n0 = vn(p * 0.32), n1 = vn(p * 0.9), n2 = vn(p * 3.1);
  vec3 col = uPaper;
  // площадка под стройку с комьями земли
  float dS = sdBox(p - c, hb + 1.4) - 1.0 - (n1 - 0.5) * 0.35;
  float soilM = (1.0 - smoothstep(-0.25, 0.25, dS + (1.0 - uSoil) * 9.0)) * step(0.001, uSoil);
  vec2 cq = p * 17.0; float cw = fwidth(cq.x);
  float clod = mix(vn(p * 6.0) * 0.5 + vn(cq) * 0.5, 0.5, clamp(cw - 0.4, 0.0, 1.0));
  vec3 soil = mix(vec3(0.66, 0.59, 0.50), vec3(0.55, 0.48, 0.40), n2) * (0.86 + 0.24 * clod);
  col = mix(col, soil, soilM);
  // газон: остров вокруг дома, полосы после стрижки, травинки
  float isl = 1.0 - smoothstep(-0.7, 0.9, dH - 6.0 - (n0 - 0.5) * 1.1);
  float grow = 1.0 - smoothstep(-2.5, 0.5, dH + (n1 - 0.5) * 1.5 - uLawn * 9.0);
  float lawnM = isl * grow * step(0.001, uLawn);
  float sx = (p.x + 100.0) / 2.6, sw = fwidth(sx);
  float stripe = smoothstep(0.5 - sw, 0.5 + sw, fract(sx));
  vec2 bq = vec2(p.x * 34.0, p.y * 9.0); float bw = max(fwidth(bq.x), fwidth(bq.y));
  float blade = mix(vn(bq) * 0.55 + vn(bq * 2.3 + 7.0) * 0.45, 0.5, clamp(bw * 0.7 - 0.3, 0.0, 1.0));
  vec3 grass = mix(vec3(0.45, 0.54, 0.31), vec3(0.39, 0.48, 0.28), stripe) * (0.84 + 0.26 * blade);
  grass = mix(grass, grass * vec3(1.07, 1.03, 0.86), smoothstep(0.55, 0.8, n1) * 0.5);
  col = mix(col, grass, lawnM);
  col *= 1.0 - (1.0 - smoothstep(0.0, 0.9, dH)) * step(0.0, dH) * 0.2 * uFound;
  vec3 glow = vec3(0.0);
  for (int i = 0; i < 4; i++){ vec2 d = p - uLamp[i].xz; glow += vec3(1.0, 0.7, 0.4) * exp(-dot(d, d) * 1.4); }
  col += glow * uLights * 0.2 * lawnM * uLampK;
  col = mix(col, uPaper, smoothstep(16.0, 30.0, r));
  gl_FragColor = vec4(col, 1.0);
}`,
  }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), new THREE.ShadowMaterial({ color: 0x2a1c10, opacity: 0.26, depthWrite: false }));
  shadowPlane.rotation.x = -Math.PI / 2; shadowPlane.position.y = 0.003; shadowPlane.receiveShadow = true; shadowPlane.renderOrder = 1;
  scene.add(shadowPlane);

  // ============================================================
  //  ЧЕРТЁЖ: линии рисуются сами; когда залита плита, разметка переезжает на неё
  // ============================================================
  const piers = [], planOpen = [];
  for (const w of WALLS) {
    const ax = (w.x1 - w.x0) >= (w.z1 - w.z0) ? 'x' : 'z';
    const a0 = ax === 'x' ? w.x0 : w.z0, a1 = ax === 'x' ? w.x1 : w.z1, b0 = ax === 'x' ? w.z0 : w.x0, b1 = ax === 'x' ? w.z1 : w.x1;
    const rect = (u0, u1) => piers.push({ r: ax === 'x' ? [u0, b0, u1, b1] : [b0, u0, b1, u1], out: !!w.out });
    let cur = a0;
    for (const o of [...w.ops].sort((p, q) => p.c - q.c)) {
      const o0 = o.c - o.w / 2, o1 = o.c + o.w / 2;
      if (o0 > cur + 1e-3) rect(cur, o0);
      planOpen.push({ ax, o0, o1, b0, b1, kind: o.kind, sw: o.sw || 0 });
      cur = o1;
    }
    if (a1 > cur + 1e-3) rect(cur, a1);
  }
  const RB = { a: [], b: [], s: [], t: [], o: [] };
  const CORNERS = [[0, -1], [1, -1], [1, 1], [0, -1], [1, 1], [0, 1]];
  function rib(ax, az, bx, bz, w, t0, t1, o = 1) {
    const A = [wx(ax), 0, wz(az)], B = [wx(bx), 0, wz(bz)];
    for (const [s, sd] of CORNERS) { RB.a.push(...A); RB.b.push(...B); RB.s.push(s, sd); RB.t.push(t0, t1, w); RB.o.push(o); }
  }
  const pt = (ax, uu, b) => (ax === 'x' ? [uu, b] : [b, uu]);
  const ribAx = (ax, u0, b0, u1, b1, w, t0, t1, o) => { const A = pt(ax, u0, b0), B = pt(ax, u1, b1); rib(A[0], A[1], B[0], B[1], w, t0, t1, o); };
  const AXV = [[0.25, '1'], [4.425, '2'], [11.83, '3']], AXH = [[0.25, 'А'], [6.24, 'Б'], [11.31, 'В']];
  function dashed(x0, z0, x1, z1, t0, t1) {
    const L = Math.hypot(x1 - x0, z1 - z0), dx = (x1 - x0) / L, dz = (z1 - z0) / L, pat = [0.9, 0.2, 0.08, 0.2];
    let uu = 0, k = 0;
    while (uu < L) {
      const len = Math.min(pat[k % 4], L - uu);
      if (k % 2 === 0) rib(x0 + dx * uu, z0 + dz * uu, x0 + dx * (uu + len), z0 + dz * (uu + len), 0.016, lerp(t0, t1, uu / L), lerp(t0, t1, (uu + len) / L), 0.5);
      uu += len; k++;
    }
  }
  AXV.forEach(([x], i) => dashed(x, -2.62, x, D + 0.4, 0.02 + i * 0.05, 0.3 + i * 0.05));
  AXH.forEach(([z], i) => dashed(-2.62, z, W + 0.4, z, 0.06 + i * 0.05, 0.34 + i * 0.05));
  piers.forEach((pr, i) => {
    const [x0, z0, x1, z1] = pr.r, t = 0.14 + 0.44 * (i / piers.length), d = 0.06, w = pr.out ? 0.034 : 0.026;
    rib(x0, z0, x1, z0, w, t, t + d); rib(x1, z0, x1, z1, w, t + 0.01, t + d + 0.01);
    rib(x1, z1, x0, z1, w, t + 0.02, t + d + 0.02); rib(x0, z1, x0, z0, w, t + 0.03, t + d + 0.03);
  });
  planOpen.forEach((o, i) => {
    const t = 0.5 + 0.22 * (i / planOpen.length), bm = (o.b0 + o.b1) / 2;
    if (o.kind === 'win') {
      ribAx(o.ax, o.o0, bm - 0.05, o.o1, bm - 0.05, 0.014, t, t + 0.07);
      ribAx(o.ax, o.o0, bm + 0.05, o.o1, bm + 0.05, 0.014, t + 0.01, t + 0.08);
      ribAx(o.ax, o.o0, o.b0, o.o1, o.b0, 0.01, t, t + 0.06, 0.6);
      ribAx(o.ax, o.o0, o.b1, o.o1, o.b1, 0.01, t, t + 0.06, 0.6);
    } else {
      const bs = o.sw ? o.b1 : o.b0, dir = o.sw ? 1 : -1, w = o.o1 - o.o0;
      ribAx(o.ax, o.o0, bs, o.o0, bs + dir * w, 0.02, t, t + 0.05);
      let pu = o.o0, pb = bs + dir * w;
      for (let k = 1; k <= 12; k++) {
        const th = (k / 12) * Math.PI / 2, uu = o.o0 + Math.sin(th) * w, b = bs + dir * Math.cos(th) * w;
        ribAx(o.ax, pu, pb, uu, b, 0.011, t + 0.03 + k * 0.005, t + 0.04 + k * 0.005, 0.65);
        pu = uu; pb = b;
      }
    }
  });
  const labelsEl = $('#labels'), LBL = [];
  function label(html, cls, x, z, room) {
    const el = document.createElement('div'); el.className = 'lbl ' + cls; el.innerHTML = html; labelsEl.appendChild(el);
    LBL.push({ el, p: new V3(wx(x), 0.02, wz(z)), o: -1, room });
  }
  const mm = (v) => fmt(v * 1000);
  function dimX(xs, z, t0) {
    xs.forEach((x, i) => {
      rib(x, D + 0.35, x, z + 0.25, 0.01, t0, t0 + 0.08, 0.55);
      rib(x - 0.17, z + 0.17, x + 0.17, z - 0.17, 0.03, t0 + 0.05, t0 + 0.08);
      if (i) { rib(xs[i - 1], z, x, z, 0.014, t0 + 0.02 * i, t0 + 0.06 + 0.02 * i); label(mm(x - xs[i - 1]), 'dim', (x + xs[i - 1]) / 2, z - 0.3); }
    });
  }
  function dimZ(zs, x, t0) {
    zs.forEach((z, i) => {
      rib(-0.35, z, x - 0.25, z, 0.01, t0, t0 + 0.08, 0.55);
      rib(x - 0.17, z + 0.17, x + 0.17, z - 0.17, 0.03, t0 + 0.05, t0 + 0.08);
      if (i) { rib(x, zs[i - 1], x, z, 0.014, t0 + 0.02 * i, t0 + 0.06 + 0.02 * i); label(mm(z - zs[i - 1]), 'dim', x + 0.42, (z + zs[i - 1]) / 2); }
    });
  }
  dimX([0, NX0, NX1, W], D + 1.25, 0.6); dimX([0, W], D + 2.15, 0.66);
  dimZ([0, 4.36, 7.06, D], -1.0, 0.62); dimZ([0, D], -1.9, 0.68);
  AXV.forEach(([x, n]) => label(n, 'ax', x, -3.0));
  AXH.forEach(([z, n]) => label(n, 'ax', -3.0, z));
  ROOMS.forEach(([n, a, x, z]) => label(`<b>${n}</b>${a} м²`, 'room', x, z, true));
  const ribG = new THREE.BufferGeometry();
  ribG.setAttribute('position', new THREE.Float32BufferAttribute(RB.a, 3));
  ribG.setAttribute('aA', new THREE.Float32BufferAttribute(RB.a, 3));
  ribG.setAttribute('aB', new THREE.Float32BufferAttribute(RB.b, 3));
  ribG.setAttribute('aS', new THREE.Float32BufferAttribute(RB.s, 2));
  ribG.setAttribute('aT', new THREE.Float32BufferAttribute(RB.t, 3));
  ribG.setAttribute('aO', new THREE.Float32BufferAttribute(RB.o, 1));
  const lines = new THREE.Mesh(ribG, new THREE.ShaderMaterial({
    defines: SHARED,
    uniforms: { uDraw: U.draw, uAlpha: U.planA, uLineK: U.lineK, uSlabX: U.slabX, uColor: u(new V3(0.105, 0.11, 0.118)) },
    vertexShader: `
attribute vec3 aA; attribute vec3 aB; attribute vec2 aS; attribute vec3 aT; attribute float aO;
uniform float uDraw, uLineK, uSlabX; varying float vO;
void main(){
  float k = clamp((uDraw - aT.x) / max(aT.y - aT.x, 1e-4), 0.0, 1.0);
  vec3 dv = aB - aA; float L = max(length(dv), 1e-5); vec3 d = dv / L;
  vec3 n = vec3(-d.z, 0.0, d.x);
  float hw = aT.z * 0.5 * uLineK;
  vec3 p = aA + d * (aS.x * L * k + (aS.x * 2.0 - 1.0) * hw) + n * aS.y * hw;
  float inside = step(H_X0 - 0.02, aA.x) * step(aA.x, H_X1 + 0.02) * step(H_Z0 - 0.02, aA.z) * step(aA.z, H_Z1 + 0.02);
  p.y = mix(0.012, FLOOR_Y + 0.004, inside * step(aA.x, uSlabX));
  vO = aO * step(1e-4, k);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`,
    fragmentShader: 'uniform vec3 uColor; uniform float uAlpha; varying float vO; void main(){ float a = vO * uAlpha; if (a < 0.004) discard; gl_FragColor = vec4(uColor, a); }',
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }));
  lines.frustumCulled = false; lines.renderOrder = 3;
  scene.add(lines);
  const FPs = [];
  for (const pr of piers) { const [x0, z0, x1, z1] = pr.r; const a = [wx(x0), 0.007, wz(z0)], b = [wx(x1), 0.007, wz(z0)], c = [wx(x1), 0.007, wz(z1)], d = [wx(x0), 0.007, wz(z1)]; FPs.push(...a, ...c, ...b, ...a, ...d, ...c); }
  const fillG = new THREE.BufferGeometry(); fillG.setAttribute('position', new THREE.Float32BufferAttribute(FPs, 3));
  const fills = new THREE.Mesh(fillG, new THREE.ShaderMaterial({
    uniforms: { uColor: u(new V3(0.105, 0.11, 0.118)), uAlpha: U.fillA },
    vertexShader: 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uColor; uniform float uAlpha; void main(){ if (uAlpha < 0.004) discard; gl_FragColor = vec4(uColor, uAlpha); }',
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }));
  fills.renderOrder = 2;
  scene.add(fills);

  // ============================================================
  //  ФУНДАМЕНТ: ленты под стенами и плита пола (бетон с порами)
  // ============================================================
  const concreteMat = pbr(TX.concrete, '#b2aea6');
  patch(concreteMat, 'bd-concrete', { defines: SHARED, uniforms: { uEave: U.eave }, vHead: 'varying vec3 vWP;', vEnd: WP_END, fHead: AO_HEAD, fColor: 'diffuseColor.rgb *= aoH(vWP);' });
  function stripGeo(sel) {
    const G = G0(), e = 0.07;
    for (const w of WALLS) if (sel(w)) pushBox(G, wx(w.x0 - e), -1.4, wz(w.z0 - e), wx(w.x1 + e), FY, wz(w.z1 + e), 0.8);
    return geoFrom(G);
  }
  const stripsOut = new THREE.Mesh(stripGeo((w) => w.out), concreteMat);
  const stripsIn = new THREE.Mesh(stripGeo((w) => !w.out && w.x1 - w.x0 > 0.2 && w.z1 - w.z0 > 0.2), concreteMat);
  const SG = G0(), sy0 = FY - 0.25, sy1 = FY - 0.004;
  pushBox(SG, 0, sy0, wz(0), W, sy1, wz(NZ0), 0.8);
  pushBox(SG, 0, sy0, wz(NZ0), NX0, sy1, wz(D), 0.8);
  pushBox(SG, NX1, sy0, wz(NZ0), W, sy1, wz(D), 0.8);
  pushBox(SG, NX0, sy0, wz(NZ0), NX1, FY - 0.03, wz(D), 0.8);
  pushBox(SG, NX0 + 0.1, 0, wz(D), NX1 - 0.1, FY - 0.18, wz(D + 0.35), 0.8);
  pushBox(SG, NX0 + 0.1, 0, wz(D + 0.35), NX1 - 0.1, FY - 0.34, wz(D + 0.7), 0.8);
  const slab = new THREE.Mesh(geoFrom(SG), concreteMat);
  slab.position.x = OX;
  for (const m of [stripsOut, stripsIn, slab]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); }

  // ============================================================
  //  КЛАДКА: облицовочный кирпич + утеплитель + керамический блок; перегородки из газобетона
  // ============================================================
  const FD = 0.12, BJ = 0.01, BL = 0.25, BH = 0.065, SOLW = 0.13;
  function freeSegs(a, b, blocked) {
    let segs = [[a, b]];
    for (const [c0, c1] of blocked) {
      const nx = [];
      for (const [s0, s1] of segs) { if (c1 <= s0 || c0 >= s1) nx.push([s0, s1]); else { if (c0 > s0) nx.push([s0, c0]); if (c1 < s1) nx.push([c1, s1]); } }
      segs = nx;
    }
    return segs.filter(([s0, s1]) => s1 - s0 > 0.02);
  }
  function slots(f0, f1, origin, L, J, minPiece) {
    const P = L + J, out = [];
    for (let s = origin + Math.floor((f0 - origin) / P) * P; s < f1 - 1e-4; s += P) {
      const a = Math.max(s, f0), b = Math.min(s + L, f1);
      if (b - a > 1e-3) out.push([a, b]);
    }
    if (out.length > 1 && out[0][1] - out[0][0] < minPiece) { out[1][0] = out[0][0]; out.shift(); }
    if (out.length > 1 && out[out.length - 1][1] - out[out.length - 1][0] < minPiece) { out[out.length - 2][1] = out[out.length - 1][1]; out.pop(); }
    return out.filter(([a, b]) => b - a > minPiece * 0.45);
  }
  const runXZ = (run, uu, depth) => { const n = run.f - run.o * depth; return run.ax === 'x' ? [wx(uu), wz(n)] : [wx(n), wz(uu)]; };
  const runYaw = (run) => (run.ax === 'x' ? (run.o > 0 ? 0 : Math.PI) : (run.o > 0 ? Math.PI / 2 : -Math.PI / 2));
  // начало/конец слоя на углу: внешний угол — перевязка через ряд, внутренний — заход за угол
  function layerEnds(run, d0, d1, ext) {
    const end = (type) => (type === 'cv' ? (ext ? d0 : d1 + 0.01) : (ext ? -d1 : -d0 + 0.01));
    return [run.a0 + end(run.eA), run.a1 - end(run.eB)];
  }

  const BRICK_PAL = ['#4a2c21', '#523022', '#5a3626', '#43281d', '#4d2e23', '#3f261c'].map(lin);
  const BRICK_FLASH = ['#74402a', '#7e472e', '#6c3b27'].map(lin);
  const BRICK_DARK = ['#2f1e18', '#36231b'].map(lin);
  const brickColor = () => { const r = rnd(); const pal = r < 0.07 ? BRICK_FLASH : r < 0.17 ? BRICK_DARK : BRICK_PAL; return pal[Math.floor(rnd() * pal.length)].clone().multiplyScalar(0.92 + rnd() * 0.16); };

  const bricks = [], blocks = [], wools = [], aacs = [];
  const LG = G0(), MG = G0();     // перемычки над проёмами и раствор за кирпичом
  for (const run of RUNS) {
    const yaw = runYaw(run), span = run.a1 - run.a0;
    // облицовочный кирпич ряд за рядом
    for (let k = 0; k < NC; k++) {
      const y0 = k * CP + 0.005, ext = (run.ax === 'x') === (k % 2 === 0);
      const [ua, ub] = layerEnds(run, 0, FD, ext);
      const blocked = [];
      for (const o of run.ops) {
        if (y0 + BH > o.s + 0.002 && y0 < o.h - 0.002) blocked.push([o.c - o.w / 2, o.c + o.w / 2]);
        const kh = Math.round(o.h / CP);
        if (k >= kh && k < kh + 4) blocked.push([o.c - o.w / 2 - SOLW, o.c + o.w / 2 + SOLW]);
      }
      const origin = run.eA === 'cv' ? ua : run.a0 + (k % 2) * (BL + BJ) / 2;
      for (const [f0, f1] of freeSegs(ua, ub, blocked)) {
        for (const [p0, p1] of slots(f0, f1, origin, BL, BJ, 0.08)) {
          const uc = (p0 + p1) / 2, [x, z] = runXZ(run, uc, FD / 2 - 0.0005 + (rnd() - 0.5) * 0.0025);
          bricks.push({ x, y: FY + y0 + BH / 2, z, yaw: yaw + (rnd() - 0.5) * 0.006, rx: (rnd() - 0.5) * 0.006, rz: (rnd() - 0.5) * 0.004,
            sx: (p1 - p0) / BL, t: y0 / CP + 0.85 * (uc - run.a0) / span + rnd() * 0.12, col: brickColor() });
        }
      }
    }
    // солдатский ряд над окнами и дверью: кирпич стоит торчком
    for (const o of run.ops) {
      const kh = Math.round(o.h / CP), a = o.c - o.w / 2 - SOLW, b = o.c + o.w / 2 + SOLW;
      const n = Math.floor((b - a + BJ) / (BH + BJ)), st = (a + b) / 2 - (n * (BH + BJ) - BJ) / 2, hg = 4 * CP - BJ;
      for (let i = 0; i < n; i++) {
        const uc = st + i * (BH + BJ) + BH / 2, [x, z] = runXZ(run, uc, FD / 2);
        bricks.push({ x, y: FY + kh * CP + 0.005 + hg / 2, z, yaw, roll: Math.PI / 2, rx: 0, rz: (rnd() - 0.5) * 0.004,
          sx: hg / BL, t: kh + 1.5 + 0.85 * (uc - run.a0) / span + rnd() * 0.1, col: brickColor() });
      }
    }
    // раствор за кирпичом (виден в швах)
    {
      const [ua, ub] = layerEnds(run, 0.008, 0.105, true);
      for (const rc of subtractRects(ua, ub, 0, WH, run.ops.map((o) => [o.c - o.w / 2, o.c + o.w / 2, o.s, o.h]))) {
        const [xa, za] = runXZ(run, rc[0], 0.012), [xb, zb] = runXZ(run, rc[1], 0.1);
        pushBox(MG, Math.min(xa, xb), FY + rc[2], Math.min(za, zb), Math.max(xa, xb), FY + rc[3], Math.max(za, zb), 4);
      }
    }
    // утеплитель: плиты 1200 × 600 вокруг проёмов
    {
      const [ua, ub] = layerEnds(run, 0.125, 0.225, run.ax === 'x');
      for (const rc of subtractRects(ua, ub, 0, WH, run.ops.map((o) => [o.c - o.w / 2, o.c + o.w / 2, o.s, o.h]))) {
        for (let gy = Math.floor(rc[2] / 0.6) * 0.6; gy < rc[3] - 1e-3; gy += 0.6) {
          for (let gx = ua + Math.floor((rc[0] - ua) / 1.2) * 1.2; gx < rc[1] - 1e-3; gx += 1.2) {
            const x0 = Math.max(gx, rc[0]), x1 = Math.min(gx + 1.2, rc[1]), y0 = Math.max(gy, rc[2]), y1 = Math.min(gy + 0.6, rc[3]);
            if (x1 - x0 < 0.02 || y1 - y0 < 0.02) continue;
            const uc = (x0 + x1) / 2, [x, z] = runXZ(run, uc, 0.175);
            wools.push({ x, y: FY + (y0 + y1) / 2, z, yaw, sx: (x1 - x0 - 0.004) / 1.2, sy: (y1 - y0 - 0.004) / 0.6, t: y0 / CP + 0.85 * (uc - run.a0) / span, uv: [rnd(), rnd()] });
          }
        }
      }
    }
    // керамический блок: 380 × 219 × 250, свой шаг рядов
    for (let k = 0; k < 13; k++) {
      const y0 = k * 0.229 + 0.005, ext = (run.ax === 'x') === (k % 2 === 0);
      const [ua, ub] = layerEnds(run, 0.235, 0.485, ext);
      const blocked = [];
      for (const o of run.ops) if (y0 + 0.219 > o.s + 0.03 && y0 < o.h - 0.03) blocked.push([o.c - o.w / 2, o.c + o.w / 2]);
      for (const [f0, f1] of freeSegs(ua, ub, blocked)) {
        for (const [p0, p1] of slots(f0, f1, ua, 0.38, 0.01, 0.1)) {
          const uc = (p0 + p1) / 2, [x, z] = runXZ(run, uc, 0.36);
          blocks.push({ x, y: FY + y0 + 0.1095, z, yaw: yaw + (rnd() - 0.5) * 0.004, sx: (p1 - p0) / 0.38, t: y0 / CP + 0.85 * (uc - run.a0) / span + rnd() * 0.15,
            col: lin(['#a2603f', '#9a5a3b', '#a96845', '#925437'][Math.floor(rnd() * 4)]) });
        }
      }
    }
    // железобетонные перемычки во внутреннем слое над проёмами
    for (const o of run.ops) {
      let kUp = 0;
      while (kUp < 13 && kUp * 0.229 + 0.005 < o.h - 0.03) kUp++;
      const yTop = kUp * 0.229;
      if (yTop - o.h > 0.01) {
        const [xa, za] = runXZ(run, o.c - o.w / 2 - 0.2, 0.235), [xb, zb] = runXZ(run, o.c + o.w / 2 + 0.2, 0.485);
        pushBox(LG, Math.min(xa, xb), FY + o.h, Math.min(za, zb), Math.max(xa, xb), FY + yTop, Math.max(za, zb), 0.8);
      }
    }
  }
  function subtractRects(a0, a1, y0, y1, holes) {
    const xs = [a0, a1];
    for (const h of holes) { if (h[0] > a0 && h[0] < a1) xs.push(h[0]); if (h[1] > a0 && h[1] < a1) xs.push(h[1]); }
    xs.sort((p, q) => p - q);
    const out = [];
    for (let i = 0; i < xs.length - 1; i++) {
      const s0 = xs[i], s1 = xs[i + 1], m = (s0 + s1) / 2;
      if (s1 - s0 < 1e-3) continue;
      let ys = [[y0, y1]];
      for (const h of holes) if (m > h[0] && m < h[1]) {
        const nx = [];
        for (const [v0, v1] of ys) { if (h[3] <= v0 || h[2] >= v1) nx.push([v0, v1]); else { if (h[2] > v0) nx.push([v0, h[2]]); if (h[3] < v1) nx.push([h[3], v1]); } }
        ys = nx;
      }
      for (const [v0, v1] of ys) out.push([s0, s1, v0, v1]);
    }
    return out;
  }
  // перегородки и несущая стена внутри: газобетон 600 × 250
  for (const w of WALLS) {
    if (w.out) continue;
    const ax = (w.x1 - w.x0) >= (w.z1 - w.z0) ? 'x' : 'z';
    const a0 = ax === 'x' ? w.x0 : w.z0, a1 = ax === 'x' ? w.x1 : w.z1, b0 = ax === 'x' ? w.z0 : w.x0, b1 = ax === 'x' ? w.z1 : w.x1;
    const bm = (b0 + b1) / 2, th = b1 - b0, yaw = ax === 'x' ? 0 : Math.PI / 2;
    for (let k = 0; k < 12; k++) {
      const y0 = k * 0.25 + 0.003, blocked = [];
      for (const o of w.ops) if (y0 < o.h - 0.01) blocked.push([o.c - o.w / 2, o.c + o.w / 2]);
      for (const [f0, f1] of freeSegs(a0, a1, blocked)) {
        for (const [p0, p1] of slots(f0, f1, a0 + (k % 2) * 0.3015, 0.6, 0.003, 0.12)) {
          const uc = (p0 + p1) / 2, x = ax === 'x' ? wx(uc) : wx(bm), z = ax === 'x' ? wz(bm) : wz(uc);
          aacs.push({ x, y: FY + y0 + 0.1235, z, yaw: yaw + (rnd() - 0.5) * 0.004, sx: (p1 - p0 - 0.002) / 0.6, sz: th / 0.25,
            t: y0 / CP + 0.85 * (uc - a0) / (a1 - a0), uv: [rnd(), rnd()], col: new THREE.Color(1, 1, 1).multiplyScalar(0.93 + rnd() * 0.07) });
        }
      }
    }
  }

  // сборка инстансов
  const _q = new Q(), _qy = new Q(), _qr = new Q(), _e = new THREE.Euler(), _m = new M4(), _p = new V3(), _s = new V3(), _zAx = new V3(0, 0, 1);
  function instanced(geo, mats, items, uvRand) {
    const n = items.length, mesh = new THREE.InstancedMesh(geo, mats.m, n);
    const aT = new Float32Array(n), aUv = new Float32Array(n * 2);
    items.forEach((it, i) => {
      _e.set(it.rx || 0, it.yaw || 0, it.rz || 0, 'YXZ'); _q.setFromEuler(_e);
      if (it.roll) { _qr.setFromAxisAngle(_zAx, it.roll); _q.multiply(_qr); }
      _p.set(it.x, it.y, it.z); _s.set(it.sx || 1, it.sy || 1, it.sz || 1);
      mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
      if (it.col) mesh.setColorAt(i, it.col);
      aT[i] = it.t;
      const uvv = it.uv || (uvRand ? [rnd() * 8, rnd() * 8] : [0, 0]);
      aUv[i * 2] = uvv[0]; aUv[i * 2 + 1] = uvv[1];
    });
    geo.setAttribute('aT', new THREE.InstancedBufferAttribute(aT, 1));
    geo.setAttribute('aUvOff', new THREE.InstancedBufferAttribute(aUv, 2));
    mesh.customDepthMaterial = mats.dm;
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    scene.add(mesh);
    return mesh;
  }
  const brickMats = masonryMat(TX.brick, '#ffffff', U.bC, 'brick', 0.26, { envMapIntensity: 0.4 });
  const brickMesh = instanced(chamferBox(BL, BH, FD, 0.0065, 4, false, true), brickMats, bricks, true);
  const blockMats = masonryMat(TX.block, '#ffffff', U.kC, 'block', 0.34, { noUvOff: true });
  const blockMesh = instanced(chamferBox(0.38, 0.219, 0.25, 0.004, 1, true), blockMats, blocks, false);
  const woolMats = masonryMat(TX.wool, '#cdbd7a', U.wC, 'wool', 0.4);
  const woolMesh = instanced(chamferBox(1.2, 0.6, 0.1, 0.006, 1.6), woolMats, wools, false);
  const aacMats = masonryMat(TX.aac, '#e1ded7', U.aC, 'aac', 0.34);
  const aacMesh = instanced(chamferBox(0.6, 0.247, 0.25, 0.004, 1.6), aacMats, aacs, false);
  BRICKS = bricks.length;
  // раствор и перемычки растут по высоте вслед за кладкой
  const clampMat = (base, uY, key) => patch(base, key, {
    defines: SHARED, uniforms: { uY, uEave: U.eave },
    vHead: 'uniform float uY;\nvarying vec3 vWP;', vBegin: 'transformed.y = min(transformed.y, uY);', vEnd: WP_END,
    fHead: AO_HEAD, fColor: 'diffuseColor.rgb *= aoH(vWP);',
  });
  const mortarMesh = new THREE.Mesh(geoFrom(MG), clampMat(pbr(TX.mortar, '#5a5550'), U.mY, 'bd-mortar'));
  const lintelMesh = new THREE.Mesh(geoFrom(LG), clampMat(pbr(TX.concrete, '#9d9992'), U.lY, 'bd-lintel'));
  for (const m of [mortarMesh, lintelMesh]) { m.receiveShadow = true; scene.add(m); }

  // ============================================================
  //  КРОВЛЯ: стропила → мембрана → обрешётка → металлочерепица
  // ============================================================
  const tanP = Math.tan(PITCH), sinP = Math.sin(PITCH), cosP = Math.cos(PITCH);
  const ex0 = wx(-OVER), ex1 = wx(W + OVER), ez0 = wz(-OVER), ez1 = wz(D + OVER);
  const yHeel = FY + WH + 0.18, yE = yHeel - OVER * tanP;
  const ha = (ez1 - ez0) / 2, yR = yE + ha * tanP, zc = (ez0 + ez1) / 2;
  const R0 = [ex0 + ha, yR, zc], R1 = [ex1 - ha, yR, zc];
  const C00 = [ex0, yE, ez0], C10 = [ex1, yE, ez0], C01 = [ex0, yE, ez1], C11 = [ex1, yE, ez1];
  function roofGeo(dy) {
    const P = [], N = [], UV = [];
    const tri = (A, B, C, alongX) => {
      const a = new V3(...A), b = new V3(...B), c = new V3(...C);
      const n = new V3().subVectors(b, a).cross(new V3().subVectors(c, a)).normalize();
      let pts = [A, B, C];
      if (n.y < 0) { n.negate(); pts = [A, C, B]; }
      for (const p of pts) {
        P.push(p[0], p[1] + dy, p[2]); N.push(n.x, n.y, n.z);
        UV.push((alongX ? p[0] : p[2]) / 0.37, (p[1] - yE) / sinP / 0.35);
      }
    };
    tri(C01, C11, R1, true); tri(C01, R1, R0, true);
    tri(C10, C00, R0, true); tri(C10, R0, R1, true);
    tri(C00, C01, R0, false); tri(C11, C10, R1, false);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    return g;
  }
  const revealPatch = (mat, key, uY, edge) => patch(mat, key, {
    defines: SHARED, uniforms: { uY },
    vHead: 'varying vec3 vWP;', vEnd: WP_END,
    fHead: 'varying vec3 vWP;\nuniform float uY;',
    fStart: 'if (vWP.y > uY) discard;\nfloat rvEdge = 1.0 - smoothstep(0.0, 0.25, uY - vWP.y);',
    fEmis: edge ? `totalEmissiveRadiance += ACCENT_LIN * rvEdge * ${edge.toFixed(2)};` : '',
  });
  const revealDepth = (uY, key) => patch(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), key, {
    uniforms: { uY }, vHead: 'varying vec3 vWP;', vEnd: WP_END, fHead: 'varying vec3 vWP;\nuniform float uY;', fStart: 'if (vWP.y > uY) discard;',
  });
  const roofMat = revealPatch(new THREE.MeshStandardMaterial({
    color: lin('#34383c'), map: TX.roof.map, normalMap: TX.roof.normalMap, roughnessMap: TX.roof.roughnessMap,
    metalness: 0.55, roughness: 1, envMapIntensity: 1.1, side: THREE.DoubleSide,
  }), 'bd-roof', U.roofY, 0.28);
  roofMat.normalScale.set(1.2, 1.2);
  const roof = new THREE.Mesh(roofGeo(0), roofMat);
  roof.customDepthMaterial = revealDepth(U.roofY, 'bd-roof-d');
  const membrane = new THREE.Mesh(roofGeo(-0.075), revealPatch(new THREE.MeshStandardMaterial({ color: lin('#3b4650'), roughness: 0.55, metalness: 0.1, side: THREE.DoubleSide }), 'bd-memb', U.membY, 0));
  membrane.customDepthMaterial = revealDepth(U.membY, 'bd-memb-d');
  for (const m of [roof, membrane]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); }

  const anth = new THREE.MeshStandardMaterial({ color: lin('#2a2e32'), roughness: 0.42, metalness: 0.35, envMapIntensity: 0.9 });
  const frameMat = anth.clone();
  const soffitMat = new THREE.MeshStandardMaterial({ color: lin('#e4dfd6'), map: TX.soffit.map, normalMap: TX.soffit.normalMap, roughnessMap: TX.soffit.roughnessMap, roughness: 1 });
  const trim = new THREE.Group();
  {
    const G = G0(), ys = yE - 0.2;
    const quadDown = (x0, z0, x1, z1) => {
      const pts = [[x0, z0], [x1, z0], [x1, z1], [x0, z0], [x1, z1], [x0, z1]];
      for (const [x, z] of pts) { G.P.push(x, ys, z); G.N.push(0, -1, 0); G.UV.push(x, z); }
    };
    quadDown(ex0, wz(D), ex1, ez1); quadDown(ex0, ez0, ex1, wz(0));
    quadDown(ex0, wz(0), wx(0), wz(D)); quadDown(wx(W), wz(0), ex1, wz(D));
    quadDown(wx(NX0), wz(NZ0), wx(NX1), wz(D));
    trim.add(new THREE.Mesh(geoFrom(G), soffitMat));
    const F = G0(false), t = 0.04, y0 = yE - 0.22, y1 = yE + 0.02;
    pushBox(F, ex0 - t, y0, ez1 - t, ex1 + t, y1, ez1 + t * 0.2);
    pushBox(F, ex0 - t, y0, ez0 - t * 0.2, ex1 + t, y1, ez0 + t);
    pushBox(F, ex0 - t * 0.2, y0, ez0, ex0 + t, y1, ez1);
    pushBox(F, ex1 - t, y0, ez0, ex1 + t * 0.2, y1, ez1);
    const fascia = new THREE.Mesh(geoFrom(F), anth); fascia.castShadow = true; trim.add(fascia);
  }
  scene.add(trim);
  const pipeMesh = (A, B, rad, mat, grp) => {
    const a = new V3(...A), b = new V3(...B), len = a.distanceTo(b);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, len, 12), mat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new V3(0, 1, 0), b.clone().sub(a).normalize());
    m.castShadow = true; grp.add(m); return m;
  };
  const gutters = new THREE.Group();
  {
    const gy = yE - 0.12, r = 0.065, o = 0.1;
    pipeMesh([ex0 - o, gy, ez1 + o], [ex1 + o, gy, ez1 + o], r, anth, gutters);
    pipeMesh([ex0 - o, gy, ez0 - o], [ex1 + o, gy, ez0 - o], r, anth, gutters);
    pipeMesh([ex0 - o, gy, ez0 - o], [ex0 - o, gy, ez1 + o], r, anth, gutters);
    pipeMesh([ex1 + o, gy, ez0 - o], [ex1 + o, gy, ez1 + o], r, anth, gutters);
    for (const [px, side] of [[0.35, 1], [W - 0.35, 1], [0.35, -1], [W - 0.35, -1]]) {
      const zg = side > 0 ? ez1 + o : ez0 - o, zw = side > 0 ? wz(D) + 0.09 : wz(0) - 0.09, x = wx(px);
      pipeMesh([x, gy, zg], [x, 2.95, zg], 0.045, anth, gutters);
      pipeMesh([x, 2.95, zg], [x, 2.62, zw], 0.045, anth, gutters);
      pipeMesh([x, 2.62, zw], [x, 0.18, zw], 0.045, anth, gutters);
      for (const yy of [0.8, 1.7, 2.4]) pipeMesh([x, yy - 0.02, zw], [x, yy + 0.02, zw], 0.052, anth, gutters);
    }
  }
  scene.add(gutters);
  const caps = new THREE.Group();
  {
    const capMat = new THREE.MeshStandardMaterial({ color: lin('#33373c'), roughness: 0.38, metalness: 0.5, envMapIntensity: 1 });
    const capGeo = new THREE.CylinderGeometry(0.11, 0.11, 1, 14, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).translate(0, 0, 0.5);
    const cap = (A, B) => {
      const a = new V3(A[0], A[1] + 0.03, A[2]), b = new V3(B[0], B[1] + 0.03, B[2]);
      const m = new THREE.Mesh(capGeo, capMat); m.position.copy(a); m.lookAt(b); m.userData.len = a.distanceTo(b); m.castShadow = true; caps.add(m);
    };
    cap(C00, R0); cap(C01, R0); cap(C10, R1); cap(C11, R1); cap(R0, R1);
    // снегозадержатели: две трубы на кронштейнах на каждом скате
    const sgMat = anth, s0 = 1.15;
    const off = (s) => [s * cosP, yE + s * sinP];
    for (const s of [s0, s0 + 0.06]) {
      const [dz, y] = off(s), lift = s === s0 ? 0.07 : 0.12;
      pipeMesh([ex0 + dz + 0.3, y + lift, ez1 - dz], [ex1 - dz - 0.3, y + lift, ez1 - dz], 0.016, sgMat, caps);
      pipeMesh([ex0 + dz + 0.3, y + lift, ez0 + dz], [ex1 - dz - 0.3, y + lift, ez0 + dz], 0.016, sgMat, caps);
      pipeMesh([ex0 + dz, y + lift, ez0 + dz + 0.3], [ex0 + dz, y + lift, ez1 - dz - 0.3], 0.016, sgMat, caps);
      pipeMesh([ex1 - dz, y + lift, ez0 + dz + 0.3], [ex1 - dz, y + lift, ez1 - dz - 0.3], 0.016, sgMat, caps);
    }
    caps.children.forEach((m) => { if (m.userData.len === undefined) m.userData.pipe = true; });
  }
  scene.add(caps);

  // стропила, обрешётка — инстансы, растут по длине
  const woodMat = new THREE.MeshStandardMaterial({ color: lin('#c79a63'), roughness: 0.8, metalness: 0, map: TX.wool.map });
  function beamSet(list, w, h, mat) {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(w, h, 1).translate(0, 0, 0.5), mat, list.length);
    const lk = new M4();
    for (const bm of list) { lk.lookAt(bm.b, bm.a, bm.up || new V3(0, 1, 0)); bm.q = new Q().setFromRotationMatrix(lk); bm.len = bm.a.distanceTo(bm.b); }
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    scene.add(mesh);
    let last = -1;
    return {
      mesh,
      set(k, dur = 0.3, sp = 1.35) {
        if (Math.abs(k - last) < 1e-4) return; last = k;
        list.forEach((bm, i) => {
          const g = easeOut(clamp((k * sp - bm.d) / dur));
          _s.set(g > 0 ? 1 : 0, g > 0 ? 1 : 0, Math.max(1e-4, g * bm.len));
          mesh.setMatrixAt(i, _m.compose(bm.a, bm.q, _s));
        });
        mesh.instanceMatrix.needsUpdate = true;
      },
    };
  }
  const rafterList = [];
  {
    const add = (A, B, d, dy = -0.11) => rafterList.push({ a: new V3(A[0], A[1] + dy, A[2]), b: new V3(B[0], B[1] + dy, B[2]), d });
    const yM = FY + WH + 0.07;
    add([wx(0), yM, wz(0.12)], [wx(W), yM, wz(0.12)], 0.0, 0);
    add([wx(W - 0.12), yM, wz(0)], [wx(W - 0.12), yM, wz(D)], 0.02, 0);
    add([wx(W), yM, wz(D - 0.12)], [wx(0), yM, wz(D - 0.12)], 0.04, 0);
    add([wx(0.12), yM, wz(D)], [wx(0.12), yM, wz(0)], 0.06, 0);
    add(C00, R0, 0.1); add(C01, R0, 0.12); add(C10, R1, 0.14); add(C11, R1, 0.16); add(R0, R1, 0.2);
    const ang = (x, z) => (Math.atan2(z, x) + Math.PI) / (2 * Math.PI);
    for (let x = ex0 + 0.35; x <= ex1 - 0.35; x += 0.6) {
      const d = Math.min(x - ex0, ex1 - x, ha);
      if (d < 0.3) continue;
      add([x, yE, ez1], [x, yE + d * tanP, ez1 - d], 0.24 + 0.56 * ang(x, ez1));
      add([x, yE, ez0], [x, yE + d * tanP, ez0 + d], 0.24 + 0.56 * ang(x, ez0));
    }
    for (let z = ez0 + 0.35; z <= ez1 - 0.35; z += 0.6) {
      const d = Math.min(z - ez0, ez1 - z);
      if (d < 0.3) continue;
      add([ex0, yE, z], [ex0 + d, yE + d * tanP, z], 0.24 + 0.56 * ang(ex0, z));
      add([ex1, yE, z], [ex1 - d, yE + d * tanP, z], 0.24 + 0.56 * ang(ex1, z));
    }
  }
  const rafters = beamSet(rafterList, 0.06, 0.16, woodMat);
  const battenList = [];
  {
    const Ls = ha / cosP;
    const nF = new V3(0, cosP, sinP), nB = new V3(0, cosP, -sinP), nL = new V3(-sinP, cosP, 0), nR = new V3(sinP, cosP, 0);
    for (let s = 0.12, i = 0; s < Ls - 0.1; s += 0.35, i++) {
      const dz = s * cosP, y = yE + s * sinP - 0.045, d = i / (Ls / 0.35);
      if (ex1 - dz - (ex0 + dz) > 0.2) {
        battenList.push({ a: new V3(ex0 + dz, y, ez1 - dz), b: new V3(ex1 - dz, y, ez1 - dz), up: nF, d });
        battenList.push({ a: new V3(ex1 - dz, y, ez0 + dz), b: new V3(ex0 + dz, y, ez0 + dz), up: nB, d });
      }
      if (ez1 - dz - (ez0 + dz) > 0.2) {
        battenList.push({ a: new V3(ex0 + dz, y, ez0 + dz), b: new V3(ex0 + dz, y, ez1 - dz), up: nL, d });
        battenList.push({ a: new V3(ex1 - dz, y, ez1 - dz), b: new V3(ex1 - dz, y, ez0 + dz), up: nR, d });
      }
    }
  }
  const battens = beamSet(battenList, 0.1, 0.025, woodMat);

  // ============================================================
  //  ОКНА И ДВЕРЬ
  // ============================================================
  const sillMat = new THREE.MeshStandardMaterial({ color: lin('#cfcdc8'), roughness: 0.32, metalness: 0.6 });
  const windows = [];
  let doorLamp = null;
  for (const run of RUNS) {
    for (const o of run.ops) {
      const w = o.w, h = o.h - o.s, g = new THREE.Group();
      const [x, z] = runXZ(run, o.c, 0.14);
      g.position.set(x, FY + (o.s + o.h) / 2, z); g.rotation.y = runYaw(run);
      const F = G0(false), fw = 0.07, fd = 0.075;
      const frame = (fx0, fy0, fx1, fy1, d0, d1, f = fw) => {
        pushBox(F, fx0, fy0, d0, fx1, fy0 + f, d1); pushBox(F, fx0, fy1 - f, d0, fx1, fy1, d1);
        pushBox(F, fx0, fy0, d0, fx0 + f, fy1, d1); pushBox(F, fx1 - f, fy0, d0, fx1, fy1, d1);
      };
      const glass = new THREE.MeshStandardMaterial({ color: lin('#1c2429'), roughness: 0.04, metalness: 0.92, envMapIntensity: 1.5, emissive: lin('#ffb36e'), emissiveIntensity: 0 });
      let lightK = 0.65 + 0.45 * ((windows.length * 0.618) % 1);
      if (o.kind === 'win') {
        frame(-w / 2, -h / 2, w / 2, h / 2, -fd / 2, fd / 2);
        const nm = w > 2.2 ? 2 : w > 1.3 ? 1 : 0;
        const paneW = (w - 2 * fw - nm * fw) / (nm + 1);
        for (let i = 0; i <= nm; i++) {
          const px0 = -w / 2 + fw + i * (paneW + fw);
          if (i > 0) pushBox(F, px0 - fw, -h / 2 + fw, -fd * 0.45, px0, h / 2 - fw, fd * 0.45);
          frame(px0 + 0.005, -h / 2 + fw + 0.005, px0 + paneW - 0.005, h / 2 - fw - 0.005, -fd * 0.35, fd * 0.3, 0.055);   // створка
          const gl = new THREE.Mesh(new THREE.PlaneGeometry(paneW - 0.12, h - 2 * fw - 0.12), glass);
          gl.position.set(px0 + paneW / 2, 0, -0.005); g.add(gl);
        }
        const Sg = G0(false);
        pushBox(Sg, -w / 2 - 0.05, -h / 2 - 0.03, -0.02, w / 2 + 0.05, -h / 2 - 0.006, 0.24);
        pushBox(Sg, -w / 2 - 0.05, -h / 2 - 0.06, 0.215, w / 2 + 0.05, -h / 2 - 0.006, 0.24);
        const sill = new THREE.Mesh(geoFrom(Sg), sillMat); sill.castShadow = true; g.add(sill);
      } else {
        frame(-w / 2, -h / 2, w / 2, h / 2, -0.05, 0.05, 0.06);
        pushBox(F, -w / 2 + 0.06, -h / 2 + 0.01, -0.03, w / 2 - 0.06, h / 2 - 0.06, 0.03);
        for (const yy of [-0.55, 0.0, 0.55]) pushBox(F, -w / 2 + 0.08, yy - 0.006, 0.03, w / 2 - 0.3, yy + 0.006, 0.036);
        const gl = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 1.3), glass); gl.position.set(w / 2 - 0.2, 0.12, 0.034); g.add(gl);
        const Hg = G0(false);
        pushBox(Hg, w / 2 - 0.12, -0.35, 0.05, w / 2 - 0.1, 0.55, 0.07);
        pushBox(Hg, w / 2 - 0.12, -0.33, 0.03, w / 2 - 0.1, -0.31, 0.05); pushBox(Hg, w / 2 - 0.12, 0.51, 0.03, w / 2 - 0.1, 0.53, 0.05);
        g.add(new THREE.Mesh(geoFrom(Hg), sillMat));
        const lampMat = new THREE.MeshStandardMaterial({ color: lin('#f3eee4'), emissive: lin('#ffc27d'), emissiveIntensity: 0, roughness: 0.4 });
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.08), lampMat); lamp.position.set(-w / 2 - 0.32, 0.45, 0.2); g.add(lamp);
        const lampBox = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.26, 0.1), anth); lampBox.position.set(-w / 2 - 0.32, 0.45, 0.16); g.add(lampBox);
        doorLamp = { g, lampMat, local: new V3(-w / 2 - 0.32, 0.4, 0.7) };
        lightK = 1.0;
      }
      const frameMesh = new THREE.Mesh(geoFrom(F), frameMat); frameMesh.castShadow = true; g.add(frameMesh);
      g.scale.y = 1e-3; g.visible = false;
      scene.add(g);
      windows.push({ g, glass, ang: Math.atan2(g.position.z, g.position.x), lightK });
    }
  }
  windows.sort((a, b) => a.ang - b.ang);
  windows.forEach((wn, i) => { wn.d = (i / windows.length) * 0.6; });
  const porchLight = new THREE.PointLight(lin('#ffb46b'), 0, 7, 2);
  if (doorLamp) { doorLamp.g.updateMatrixWorld(true); porchLight.position.copy(doorLamp.g.localToWorld(doorLamp.local.clone())); }
  scene.add(porchLight);

  // ============================================================
  //  УЧАСТОК: отмостка, дорожка из брусчатки, бордюр, фонарики
  // ============================================================
  const site = new THREE.Group();
  {
    const AG = G0();
    for (const run of RUNS) {
      if (run.notch) continue;
      const ext = run.ax === 'x';
      let a0 = run.a0 - (ext && run.eA === 'cv' && !run.nA ? 0.8 : 0), a1 = run.a1 + (ext && run.eB === 'cv' && !run.nB ? 0.8 : 0);
      for (let s = a0; s < a1 - 0.05; s += 1.5) {
        const sEnd = Math.min(a1, s + 1.5) - 0.012;
        const [xa, za] = runXZ(run, s, 0), [xb, zb] = runXZ(run, sEnd, -0.8);
        pushBox(AG, Math.min(xa, xb), 0, Math.min(za, zb), Math.max(xa, xb), 0.06, Math.max(za, zb), 0.8);
      }
    }
    const apron = new THREE.Mesh(geoFrom(AG), pbr(TX.concrete, '#c3c0b9'));
    apron.receiveShadow = true; site.add(apron);
    const KG = G0(), cx = wx(6.05), z0 = wz(D + 0.7), z1 = wz(D + 5.6);
    for (const sx of [-1, 1]) pushBox(KG, cx + sx * 0.8 - (sx > 0 ? 0 : 0.08), 0, z0, cx + sx * 0.8 + (sx > 0 ? 0.08 : 0), 0.09, z1, 0.8);
    const kerb = new THREE.Mesh(geoFrom(KG), pbr(TX.concrete, '#9e9a93')); kerb.castShadow = true; kerb.receiveShadow = true; site.add(kerb);
  }
  scene.add(site);
  const pavers = [];
  {
    const cx = wx(6.05), z0 = wz(D + 0.7), z1 = wz(D + 5.6), pw = 0.2, pd = 0.1, j = 0.004;
    const tone = [lin('#9a958d'), lin('#8a857e'), lin('#6e6a65'), lin('#a6a198')];
    let row = 0;
    for (let z = z0; z < z1 - pd; z += pd + j, row++) {
      const off = (row % 2) * (pw + j) / 2;
      for (let x = cx - 0.8 - off; x < cx + 0.8; x += pw + j) {
        const a = Math.max(x, cx - 0.8), b = Math.min(x + pw, cx + 0.8);
        if (b - a < 0.04) continue;
        pavers.push({ x: (a + b) / 2, y: 0.03, z: z + pd / 2, yaw: (rnd() - 0.5) * 0.01, sx: (b - a) / pw, t: row * 0.9 + rnd() * 0.6, uv: [rnd() * 4, rnd() * 4], col: tone[Math.floor(rnd() * tone.length)].clone() });
      }
    }
  }
  const paverMats = masonryMat(TX.concrete, '#ffffff', U.pC, 'paver', 0.4, { noAO: true });
  const paverMesh = instanced(chamferBox(0.2, 0.06, 0.1, 0.006, 2), paverMats, pavers, false);
  const PAVER_ROWS = Math.ceil(4.9 / 0.104);
  const bollards = [], LAMPS101 = [];
  {
    const cx = wx(6.05), zs = [wz(D + 1.9), wz(D + 4.4)];
    const capMat = new THREE.MeshStandardMaterial({ color: lin('#f6efe2'), emissive: lin('#ffbe78'), emissiveIntensity: 0, roughness: 0.35 });
    let i = 0;
    for (const z of zs) for (const sx of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(cx + sx * 1.15, 0, z);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.55, 16), anth); post.position.y = 0.275; post.castShadow = true; g.add(post);
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 16), capMat); head.position.y = 0.5; g.add(head);
      g.scale.setScalar(1e-3); g.visible = false; scene.add(g);
      U.lamps.value[i++].set(g.position.x, 0, g.position.z); LAMPS101.push(new V3(g.position.x, 0, g.position.z));
      bollards.push({ g, capMat });
    }
  }

  // ============================================================
  //  ТРАВА: пучки травинок на газоне — растут вместе с ним от дома к краю и колышутся
  // ============================================================
  const grassTuft = (() => {
    const P = [], N = [], Hh = [], idx = [], R = mulberry(31);
    let v = 0;
    for (let b = 0; b < 7; b++) {
      const a = R() * Math.PI * 2, r = Math.sqrt(R()) * 0.075;
      const bx = Math.cos(a) * r, bz = Math.sin(a) * r;
      const h = 0.065 + R() * 0.07, w = 0.011 + R() * 0.006;
      const yaw = R() * Math.PI, dx = Math.cos(yaw), dz = Math.sin(yaw);
      const lean = 0.02 + R() * 0.05, lx = Math.cos(a) * lean, lz = Math.sin(a) * lean;
      const pts = [
        [bx - dx * w, 0, bz - dz * w, 0], [bx + dx * w, 0, bz + dz * w, 0],
        [bx - dx * w * 0.6 + lx * 0.4, h * 0.55, bz - dz * w * 0.6 + lz * 0.4, 0.55],
        [bx + dx * w * 0.6 + lx * 0.4, h * 0.55, bz + dz * w * 0.6 + lz * 0.4, 0.55],
        [bx + lx, h, bz + lz, 1],
      ];
      for (const p of pts) { P.push(p[0], p[1], p[2]); N.push(0, 1, 0); Hh.push(p[3]); }
      idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2, v + 2, v + 3, v + 4);
      v += 5;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute('aH', new THREE.Float32BufferAttribute(Hh, 1));
    g.setIndex(idx);
    return g;
  })();
  const grass = (() => {
    const count = innerWidth < 760 ? 7000 : 24000, R = mulberry(77);
    const hx = W / 2, hz = D / 2, pathX = wx(6.05), pz0 = wz(D) - 0.1, pz1 = wz(D + 5.75);
    const sdBox = (x, z) => { const dx = Math.abs(x) - hx, dz = Math.abs(z) - hz; return Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dz), 0); };
    const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
    const GR = ['#4d6c30', '#587937', '#486630', '#61813e', '#6a8a44'].map(lin), DRY = lin('#7f8448');
    const mesh = new THREE.InstancedMesh(grassTuft, null, count);
    const aD = new Float32Array(count), aK = new Float32Array(count);
    // 118: цоколь 15,98 × 9,09 м, крыльцо и дорожка к калитке (x = −0,94)
    const sd118 = (x, z) => { const dx = Math.abs(x) - 8.03, dz = Math.abs(z) - 4.585; return Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dz), 0); };
    const m = new M4(), q = new Q(), sc = new V3(), pos = new V3(), up = new V3(0, 1, 0);
    let n = 0, tries = 0;
    while (n < count && tries < count * 8) {
      tries++;
      const x = (R() * 2 - 1) * (hx + 7.4), z = (R() * 2 - 1) * (hz + 7.4);
      const dH = sdBox(x, z);
      const in101 = dH < 0.9 || (Math.abs(x - pathX) < 0.97 && z > pz0 && z < pz1);   // дом 101, отмостка, дорожка
      const in118 = sd118(x, z) < 0.9 || (Math.abs(x + 0.94) < 0.97 && z > 4.5 && z < 10.5);
      if (in101 && in118) continue;
      if (R() > 1 - ss(4.5, 6.4, dH + (R() - 0.5) * 0.9)) continue;               // пушистый край газона
      const s = 0.75 + R() * 0.6;
      q.setFromAxisAngle(up, R() * Math.PI * 2);
      mesh.setMatrixAt(n, m.compose(pos.set(x, 0, z), q, sc.set(s, s * (0.85 + R() * 0.4), s)));
      const stripe = Math.floor((x + 100) / 2.6) % 2 === 0 ? 1.12 : 0.84;           // полосы после стрижки
      const c = (R() < 0.04 ? DRY : GR[Math.floor(R() * GR.length)]).clone().multiplyScalar(stripe * (0.85 + R() * 0.3));
      mesh.setColorAt(n, c);
      aD[n] = dH + R() * 0.7;
      aK[n] = in101 ? 1 : in118 ? 2 : 0;
      n++;
    }
    mesh.count = n;
    grassTuft.setAttribute('aD', new THREE.InstancedBufferAttribute(aD, 1));
    grassTuft.setAttribute('aK', new THREE.InstancedBufferAttribute(aK, 1));
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.2 });
    patch(mat, 'bd-grass', {
      uniforms: { uLawn: U.lawn, uTime: U.time, uK1: U.gK1, uK2: U.gK2 },
      vHead: 'attribute float aH;\nattribute float aD;\nattribute float aK;\nuniform float uLawn;\nuniform float uTime;\nuniform float uK1, uK2;\nvarying float vH;',
      vNormal: 'objectNormal = vec3(0.0, 1.0, 0.0);',
      vBegin: `
  float gk = smoothstep(aD - 1.4, aD + 0.6, uLawn * 9.0) * (aK < 0.5 ? 1.0 : (aK < 1.5 ? uK1 : uK2));
  transformed.y *= gk;
  transformed.xz *= mix(0.3, 1.0, gk);
  vec3 gp = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float sway = sin(uTime * 1.5 + gp.x * 0.6 + gp.z * 0.45) * 0.6 + sin(uTime * 2.6 + gp.x * 1.7 - gp.z) * 0.3;
  transformed.x += sway * 0.04 * aH * aH * gk;
  transformed.z += sway * 0.025 * aH * aH * gk;
  vH = aH;`,
      fHead: 'varying float vH;',
      fColor: 'diffuseColor.rgb *= mix(0.34, 0.84, vH);',
      fNormal: 'normal = normalize(vNormal);',
    });
    mesh.material = mat;
    mesh.receiveShadow = true; mesh.castShadow = false; mesh.frustumCulled = false;
    mesh.visible = false;
    scene.add(mesh);
    return mesh;
  })();

  // ============================================================
  //  ДЕРЕВЬЯ: крона из листовых карточек, ели из лап, берёза
  // ============================================================
  const LEAF_VERT = {
    vHead: 'attribute vec3 aN;\nattribute float aPh;\nuniform float uTime;',
    vNormal: 'objectNormal = transpose(mat3(instanceMatrix)) * aN;',
    vBegin: 'transformed.xy += vec2(sin(uTime * 1.3 + aPh), cos(uTime * 1.1 + aPh * 1.7)) * 0.025;',
  };
  function leafMat(tex, key) {
    const m = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.78, metalness: 0, envMapIntensity: 0.5 });
    patch(m, 'bd-leaf-' + key, Object.assign({ uniforms: { uTime: U.time } }, LEAF_VERT, {
      fNormal: 'normal = normalize(vNormal);',
      fEmis: 'totalEmissiveRadiance += diffuseColor.rgb * 0.09;',
    }));
    const dm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
    return { m, dm };
  }
  const MATS = { leaf: leafMat(LEAF_TEX, 'oak'), birch: leafMat(BIRCH_LEAF, 'birch'), bush: leafMat(BUSH_LEAF, 'bush'), spruce: leafMat(spruceTex, 'spruce') };
  const barkMat = new THREE.MeshStandardMaterial({ map: barkTex, roughness: 0.9 });
  const birchBarkMat = new THREE.MeshStandardMaterial({ map: birchTex, roughness: 0.75 });
  function cards(geo, mats, list) {
    const mesh = new THREE.InstancedMesh(geo, mats.m, list.length);
    const aN = new Float32Array(list.length * 3), aPh = new Float32Array(list.length);
    list.forEach((c, i) => { mesh.setMatrixAt(i, c.m); mesh.setColorAt(i, c.col); aN.set([c.n.x, c.n.y, c.n.z], i * 3); aPh[i] = c.ph; });
    geo.setAttribute('aN', new THREE.InstancedBufferAttribute(aN, 3));
    geo.setAttribute('aPh', new THREE.InstancedBufferAttribute(aPh, 1));
    mesh.customDepthMaterial = mats.dm; mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    return mesh;
  }
  function limb(grp, A, B, r0, r1, mat) {
    const a = new V3(...A), b = new V3(...B), len = a.distanceTo(b);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, 8, 1), mat);
    m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new V3(0, 1, 0), b.clone().sub(a).normalize());
    m.castShadow = true; grp.add(m);
  }
  function leafTree({ h, r, ry, seed, mats, bark, n, size, light, dark, trunkR, lean = 0 }) {
    const g = new THREE.Group(), R = mulberry(seed), crownY = h - ry;
    const top = [lean, h * 0.62, 0];
    limb(g, [0, 0, 0], top, trunkR, trunkR * 0.55, bark);
    const clusters = [{ c: new V3(lean, crownY, 0), r: Math.min(r, ry) * 0.75 }];
    for (let i = 0; i < 6; i++) {
      const a = R() * Math.PI * 2, rr = r * (0.35 + R() * 0.35), yy = crownY + (R() - 0.4) * ry * 0.9;
      const c = new V3(lean + Math.cos(a) * rr, yy, Math.sin(a) * rr);
      clusters.push({ c, r: r * (0.38 + R() * 0.22) });
      limb(g, [lean * 0.7, h * 0.45 + R() * h * 0.15, 0], [c.x * 0.8, c.y - 0.2, c.z * 0.8], trunkR * 0.45, trunkR * 0.12, bark);
    }
    const list = [], up = new V3(0, 1, 0), L = new V3(0.35, 0.85, 0.4).normalize(), cc = new V3(lean, crownY, 0);
    for (let i = 0; i < n; i++) {
      const cl = clusters[Math.floor(R() * clusters.length)];
      const dir = new V3(R() * 2 - 1, R() * 2 - 1, R() * 2 - 1).normalize();
      const pos = cl.c.clone().addScaledVector(dir, cl.r * (0.55 + 0.45 * Math.sqrt(R())));
      pos.y = crownY + (pos.y - crownY) * (ry / r);
      const nrm = pos.clone().sub(cc).normalize().multiplyScalar(0.75).addScaledVector(up, 0.35).normalize();
      const lit = clamp(0.5 + 0.5 * nrm.dot(L)), out = clamp(pos.distanceTo(cc) / (r * 1.1));
      const col = dark.clone().lerp(light, lit * 0.7 + out * 0.3).multiplyScalar(0.85 + R() * 0.25);
      const q = new Q().setFromEuler(new THREE.Euler(R() * 6.28, R() * 6.28, R() * 6.28));
      const s = size * (0.75 + R() * 0.5);
      list.push({ m: new M4().compose(pos, q, new V3(s, s, s)), n: nrm, col, ph: R() * 6.28 });
    }
    g.add(cards(new THREE.PlaneGeometry(1, 1), mats, list));
    return g;
  }
  function spruce({ h, r, seed }) {
    const g = new THREE.Group(), R = mulberry(seed), mats = MATS.spruce;
    limb(g, [0, 0, 0], [0, h, 0], h * 0.022, h * 0.004, barkMat);
    const list = [], up = new V3(0, 1, 0);
    const dark = lin('#2c4232'), light = lin('#5d7d58');
    for (let y = 0.45; y < h - 0.2; y += 0.24 + R() * 0.08) {
      const t = (y - 0.45) / (h - 0.65), len = r * Math.pow(1 - t, 0.9) + 0.18, n = 6 + Math.floor(R() * 3);
      for (let i = 0; i < n; i++) {
        const yaw = (i / n) * Math.PI * 2 + R() * 0.6, droop = -0.18 - R() * 0.2 - (1 - t) * 0.12;
        for (let c = 0; c < 2; c++) {
          const q = new Q().setFromEuler(new THREE.Euler(c === 0 ? -Math.PI / 2 + (R() - 0.5) * 0.4 : (R() - 0.5) * 0.5, yaw, droop, 'YZX'));
          const dir = new V3(Math.cos(-yaw), 0, Math.sin(-yaw));
          const nrm = dir.clone().multiplyScalar(0.7).addScaledVector(up, 0.55).normalize();
          const col = dark.clone().lerp(light, 0.25 + t * 0.45 + R() * 0.2).multiplyScalar(0.85 + R() * 0.25);
          list.push({ m: new M4().compose(new V3(0, y, 0), q, new V3(len, len * 0.5, 1)), n: nrm, col, ph: R() * 6.28 });
        }
      }
    }
    g.add(cards(new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0), mats, list));
    return g;
  }
  const flora = [];
  const plant = (g, x, z, rot) => { g.position.set(x, 0, z); g.rotation.y = rot; g.scale.setScalar(1e-3); g.visible = false; scene.add(g); flora.push({ g, d: flora.length / 11 }); };
  const OAK_L = lin('#89a85c'), OAK_D = lin('#3d5a2e'), BIR_L = lin('#a9c069'), BIR_D = lin('#5b7a36'), BUSH_L = lin('#7d9d55'), BUSH_D = lin('#36502a');
  plant(leafTree({ h: 7.2, r: 2.6, ry: 2.4, seed: 21, mats: MATS.leaf, bark: barkMat, n: 950, size: 0.85, light: OAK_L, dark: OAK_D, trunkR: 0.17 }), -10.2, -6.8, 0.4);
  plant(leafTree({ h: 8.4, r: 1.7, ry: 2.8, seed: 34, mats: MATS.birch, bark: birchBarkMat, n: 800, size: 0.62, light: BIR_L, dark: BIR_D, trunkR: 0.12, lean: 0.3 }), -11.4, 1.6, 1.2);
  plant(leafTree({ h: 6.2, r: 2.2, ry: 2.0, seed: 55, mats: MATS.leaf, bark: barkMat, n: 800, size: 0.8, light: OAK_L, dark: OAK_D, trunkR: 0.15 }), 1.2, -12.4, 2.1);
  plant(spruce({ h: 7.6, r: 1.8, seed: 61 }), -2.2, -13.0, 0);
  plant(spruce({ h: 6.0, r: 1.5, seed: 72 }), -6.8, -10.6, 0);
  [[-4.7, 7.25, 0.62], [-3.5, 7.4, 0.5], [3.4, 7.35, 0.55], [4.8, 7.2, 0.65], [7.3, 2.2, 0.55], [7.25, 0.9, 0.45]].forEach(([x, z, s], i) => {
    plant(leafTree({ h: s * 1.6, r: s, ry: s * 0.75, seed: 90 + i, mats: MATS.bush, bark: barkMat, n: 170, size: 0.36, light: BUSH_L, dark: BUSH_D, trunkR: 0.02 }), x, z, i);
  });
  flora.slice(-6).forEach((f) => { f.side = true; });

  // ============================================================
  //  СВЕТ И НЕБО ДЛЯ ОТРАЖЕНИЙ
  // ============================================================
  const hemi = new THREE.HemisphereLight(lin('#eef2f6'), lin('#a08b72'), 0.3);
  const sun = new THREE.DirectionalLight(lin('#fff0da'), 1.8);
  const SUN_DAY = lin('#fff0da'), SUN_EVE = lin('#ffcf9a');
  sun.position.set(-15, 21, 13);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 70 });
  sun.shadow.mapSize.setScalar(innerWidth < 760 ? 1024 : 2048);
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02;
  scene.add(hemi, sun, sun.target);
  {
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 48, 24), new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `varying vec3 vD;
float h1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h1(i), h1(i + vec2(1, 0)), f.x), mix(h1(i + vec2(0, 1)), h1(i + vec2(1, 1)), f.x), f.y); }
float fb(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * vn(p); p *= 2.03; a *= 0.5; } return s; }
void main(){
  vec3 d = normalize(vD); float y = d.y;
  vec3 sky = mix(vec3(0.84, 0.86, 0.88), vec3(0.36, 0.49, 0.68), pow(clamp(y, 0.0, 1.0), 0.6));
  vec2 cp = d.xz / max(y, 0.06) * 1.4;
  sky = mix(sky, vec3(0.97), smoothstep(0.48, 0.78, fb(cp)) * smoothstep(0.02, 0.3, y) * 0.85);
  float az = atan(d.z, d.x);
  float tl = 0.03 + 0.05 * fb(vec2(az * 9.0, 1.0));
  float trees = step(0.0, y) * (1.0 - smoothstep(tl - 0.01, tl, y));
  vec3 gnd = mix(vec3(0.5, 0.52, 0.42), vec3(0.28, 0.27, 0.22), clamp(-y * 3.0, 0.0, 1.0));
  vec3 c = y > 0.0 ? sky : gnd;
  c = mix(c, vec3(0.16, 0.22, 0.16), trees * 0.9);
  c += vec3(1.0, 0.92, 0.8) * pow(max(dot(d, normalize(vec3(-0.5, 0.65, 0.45))), 0.0), 300.0) * 18.0;
  gl_FragColor = vec4(c, 1.0);
}`,
    })));
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(envScene, 0.015).texture;
    pm.dispose();
  }

  // ============================================================
  //  КАМЕРА: общий план → крупно угол с кладкой → вдоль фасада → крыша → окно → финал
  // ============================================================
  const KF = [
    { p: 0.00, az: 10, el: 66, d: 47, tx: 0, ty: 0, tz: 0 },
    { p: 0.10, az: 14, el: 60, d: 46, tx: 0, ty: 0, tz: 0 },
    { p: 0.24, az: 26, el: 40, d: 40, tx: 0, ty: 0.4, tz: 0 },
    { p: 0.31, az: 40, el: 16, d: 10.5, tx: 4.4, ty: 1.0, tz: 4.2 },
    { p: 0.42, az: 14, el: 11, d: 11.5, tx: 0.6, ty: 1.7, tz: 5.4 },
    { p: 0.505, az: 34, el: 30, d: 38, tx: 0, ty: 1.4, tz: 0 },
    { p: 0.6, az: 42, el: 38, d: 40, tx: 0, ty: 2.2, tz: 0 },
    { p: 0.71, az: 46, el: 30, d: 42, tx: 0, ty: 2.0, tz: 0 },
    { p: 0.775, az: 8, el: 8, d: 12.5, tx: -2.0, ty: 1.7, tz: 5.7 },
    { p: 0.85, az: 30, el: 15, d: 38, tx: 0, ty: 2.0, tz: 0 },
    { p: 0.96, az: 33, el: 13, d: 39, tx: 0, ty: 2.2, tz: 0 },
    { p: 1.00, az: 34, el: 13, d: 39, tx: 0, ty: 2.2, tz: 0 },
  ];
  const KEYS = ['az', 'el', 'd', 'tx', 'ty', 'tz'];
  function camAt(p) {
    let i = 0;
    while (i < KF.length - 2 && p > KF[i + 1].p) i++;
    const k0 = KF[Math.max(0, i - 1)], k1 = KF[i], k2 = KF[i + 1], k3 = KF[Math.min(KF.length - 1, i + 2)];
    const t = clamp((p - k1.p) / (k2.p - k1.p)), o = {};
    for (const key of KEYS) {
      const a = k0[key], b = k1[key], c = k2[key], d = k3[key];
      o[key] = 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
    }
    o.d = Math.max(o.d, 8.5);
    return o;
  }

  const CAM_TOP = { az: 14, el: 58, d: 46, tx: 0, ty: 0, tz: 0 }, CAM_END = camAt(0.99);
  function camMix() {
    const k = easeIO(camDemoK), s = camAt(camScrollP), o = {};
    for (const key of KEYS) o[key] = lerp(lerp(CAM_TOP[key], CAM_END[key], k), s[key], camBlend);
    return o;
  }

  let VW = 1, VH = 1, distK = 1, dpr = 2, wide = true, baseOX = 0, baseOY = 0, viewOff = '';
  // hk — «первый экран» (0…1): дом правее текста (на телефоне — выше текста), камера чуть дальше
  // полоса между шапкой и текстом первого экрана; дом на телефоне вписывается в неё по высоте и ширине
  let bandC = 0, zoomFit = 1, bandCX = 0, zoomFitW = 1.28;
  function measureBand() {
    if (wide) {                                            // компьютер: дом — в полосе справа от текста (ноутбуки ~1000–1280 px тоже)
      const sr = stageEl.getBoundingClientRect(), hr = heroEl.getBoundingClientRect();
      const left = hr.right - sr.left + 48, right = VW - 70;
      bandCX = (left + right) / 2;
      zoomFitW = Math.max(1.12 * VH / (0.95 * Math.max(200, right - left)), 1.05);
      viewOff = ''; return;
    }
    const sr = stageEl.getBoundingClientRect(), hr = heroEl.getBoundingClientRect();
    const topH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--top-h')) || 68;
    const top = topH + 30, bot = Math.max(top + 90, hr.top - sr.top - 2);
    bandC = (top + bot) / 2;
    zoomFit = Math.max(0.74 * VH / (0.98 * VW), 0.5 * VH / (bot - top), 0.85);
    viewOff = '';
  }
  function setView(hk) {
    const ox = wide ? lerp(baseOX, VW / 2 - bandCX, hk) : baseOX, oy = wide ? baseOY : lerp(baseOY, VH / 2 - bandC, hk);
    const key = ox.toFixed(1) + ',' + oy.toFixed(1);
    if (key === viewOff) return;
    viewOff = key;
    camera.setViewOffset(VW, VH, ox, oy, VW, VH);
    camera.updateProjectionMatrix();
  }
  function resize() {
    VW = stageEl.clientWidth; VH = stageEl.clientHeight;
    dpr = Math.min(dpr, devicePixelRatio || 1, VW < 760 ? 1.6 : 2);
    renderer.setPixelRatio(dpr); renderer.setSize(VW, VH, false);
    camera.aspect = VW / VH;
    const asp = VW / VH;
    wide = asp >= 1.15 && VW > 760;
    baseOX = wide ? -VW * (qs.has('vx') ? parseFloat(qs.get('vx')) : 0.13) : 0;   // ?vx= — только для отладки кадра
    baseOY = wide ? 0 : VH * (asp < 0.8 ? 0.1 : 0.15);
    viewOff = '';                                      // пересчитать сдвиг кадра в следующем кадре
    measureBand();
    setView(0);
    distK = asp < 0.6 ? 1.85 : asp < 0.8 ? 1.6 : asp < 1.15 ? 1.3 : asp < 1.5 ? 1.12 : 1.0;
  }
  resize();
  new ResizeObserver(resize).observe(stageEl);
  new ResizeObserver(() => measureBand()).observe(heroEl);
  let mx = 0, my = 0, tmx = 0, tmy = 0;
  addEventListener('pointermove', (e) => { tmx = e.clientX / innerWidth * 2 - 1; tmy = e.clientY / innerHeight * 2 - 1; }, { passive: true });
  let onScreen = true;
  new IntersectionObserver((en) => { onScreen = en[0].isIntersecting; }).observe(build);

  // ============================================================
  //  ЭТАПЫ
  // ============================================================
  const tmp = new V3();
  let scrim = -1;
  function apply(p, draw, now, ps = p) {
    U.time.value = now / 1000;
    U.draw.value = draw * 1.02;
    const q = Math.max(p, ps);                               // участок: газон, отмостка, деревья, вечер
    const planA = (1 - sg(p, 'planOut')) * (1 - hide101eff);          // чертёж 101 не показываем, пока стоит 118
    const kS = easeIO(sg(p, 'slab'));
    U.planA.value = planA;
    U.fillA.value = seg(draw, 0.55, 0.85) * 0.42 * planA * (1 - kS);
    U.soil.value = sg(q, 'soil'); U.found.value = sg(p, 'found'); U.lawn.value = sg(q, 'lawn');
    grass.visible = U.lawn.value > 0;

    const kO = easeOut(sg(p, 'found')), kI = easeOut(sg(p, 'inner'));
    stripsOut.visible = kO > 0; stripsOut.position.y = -(1.4 + FY + 0.05) * (1 - kO);
    stripsIn.visible = kI > 0; stripsIn.position.y = -(1.4 + FY + 0.05) * (1 - kI);
    slab.visible = kS > 0; slab.scale.x = Math.max(1e-3, kS);
    U.slabX.value = kS > 0 ? OX + W * kS : -1e3;

    // кладка: фронт в рядах кирпича
    const kW = sg(p, 'walls'), front = kW * 45 - 0.5;
    U.bC.value = front; U.kC.value = front + 6; U.wC.value = front + 3;
    U.mY.value = FY + clamp((front - 2.5) * CP, -0.1, WH);
    U.lY.value = FY + clamp((front + 4) * CP, -0.1, WH);
    U.aC.value = sg(p, 'parts') * 45 - 0.5;
    brickMesh.visible = blockMesh.visible = woolMesh.visible = mortarMesh.visible = lintelMesh.visible = kW > 0;
    band101.visible = kW > 0.995;
    aacMesh.visible = U.aC.value > -0.4;

    // кровля
    const kR = sg(p, 'raf'), kRoof = easeIO(sg(p, 'roof'));
    rafters.mesh.visible = kR > 0 && kRoof < 1;
    if (rafters.mesh.visible) rafters.set(kR);
    const kB = sg(p, 'bat');
    battens.mesh.visible = kB > 0 && kRoof < 1;
    if (battens.mesh.visible) battens.set(kB, 0.25, 1.3);
    const kM = easeIO(sg(p, 'memb'));
    U.membY.value = kM > 0 ? lerp(yE - 0.3, yR + 0.4, kM) : -10;
    membrane.visible = kM > 0 && kRoof < 1;
    U.roofY.value = kRoof > 0 ? lerp(yE - 0.3, yR + 0.45, kRoof) : -10;
    roof.visible = kRoof > 0;
    U.eave.value = kRoof;
    trim.visible = sg(p, 'trim') > 0;
    const kC = easeOut(sg(p, 'caps'));
    caps.visible = kC > 0;
    caps.children.forEach((m) => { if (m.userData.pipe) m.scale.setScalar(Math.max(1e-3, kC)); else m.scale.set(1, 1, Math.max(1e-3, kC * m.userData.len)); });
    const kG = easeOut(sg(p, 'gut'));
    gutters.visible = kG > 0; gutters.position.y = (1 - kG) * 0.6;

    // окна, участок, деревья, вечер
    const kWn = sg(p, 'win'), L = sg(q, 'lights');
    U.lights.value = L;
    for (const wn of windows) {
      const k = clamp((kWn - wn.d) / 0.4);
      wn.g.visible = k > 0; wn.g.scale.y = Math.max(1e-3, backOut(k));
      wn.glass.emissiveIntensity = L * wn.lightK * 0.2;
    }
    if (doorLamp) doorLamp.lampMat.emissiveIntensity = L * 3;
    porchLight.intensity = L * 2.6 * (1 - hide101eff);
    const kF = sg(p, 'fin');                                          // отмостка, дорожка, фонарики — у каждого дома свои
    site.visible = kF > 0; site.position.y = -0.12 * (1 - easeOut(kF));
    U.pC.value = kF * (PAVER_ROWS + 4) - 1;
    paverMesh.visible = kF > 0;
    bollards.forEach((b, i) => { const k = clamp((kF - 0.4 - i * 0.1) / 0.3); b.g.visible = k > 0; b.g.scale.setScalar(Math.max(1e-3, backOut(k))); b.capMat.emissiveIntensity = L * 2.5; });
    const kT = sg(q, 'trees');
    U.gK1.value = hide101eff;                                          // трава на месте участка 101
    U.gK2.value = 1 - clamp(r118eff / 0.12);                           // трава под участком 118
    for (const f of flora) {
      const k = clamp((kT - f.d * 0.6) / 0.4), hide = f.side ? 1 - hide101eff : 1;   // кусты 101 — только при доме 101
      f.g.visible = k > 0 && hide > 0.01; f.g.scale.setScalar(Math.max(1e-3, backOut(k) * hide));
    }
    sun.intensity = lerp(1.8, 1.3, L);
    sun.color.copy(SUN_DAY).lerp(SUN_EVE, L);
    hemi.intensity = lerp(0.3, 0.22, L);
    renderer.toneMappingExposure = lerp(1.0, 0.95, L);

    // камера
    const c = camMix();
    stepVariant(now);
    const idle = REDUCED ? 0 : Math.sin(now * 0.00012) * 1.4;
    const intro = 1 - easeOut(draw);
    const az = THREE.MathUtils.degToRad(c.az + mx * 3.0 + idle - intro * 6);
    const el = THREE.MathUtils.degToRad(c.el - my * 1.8 + intro * 6);
    const hk = 1 - camBlend;
    setView(hk);
    const dd = (c.d + intro * 6) * distK * lerp(1, wide ? zoomFitW : zoomFit, hk) * lerp(1, 1.12, r118eff);
    camera.position.set(c.tx + Math.sin(az) * Math.cos(el) * dd, c.ty + Math.sin(el) * dd, c.tz + Math.cos(az) * Math.cos(el) * dd);
    camera.lookAt(c.tx, c.ty, c.tz);
    camera.updateMatrixWorld();
    U.lineK.value = dd / 45;
    const sc = wide ? clamp((24 - c.d) / 10) : 0;
    if (Math.abs(sc - scrim) > 0.004) { stageEl.style.setProperty('--scrim', sc.toFixed(3)); scrim = sc; }

    // подписи чертежа
    const lo = seg(draw, 0.58, 0.92) * planA;
    for (const L2 of LBL) {
      if (lo < 0.01) { if (L2.o !== 0) { L2.el.style.opacity = '0'; L2.o = 0; } continue; }
      tmp.copy(L2.p); if (L2.room) tmp.y = lerp(0.02, FY + 0.01, kS);
      tmp.project(camera);
      if (tmp.z > 1) { L2.el.style.opacity = '0'; L2.o = 0; continue; }
      L2.el.style.transform = `translate(${((tmp.x * 0.5 + 0.5) * VW).toFixed(1)}px, ${((-tmp.y * 0.5 + 0.5) * VH).toFixed(1)}px) translate(-50%, -50%)`;
      if (Math.abs(lo - L2.o) > 0.01) { L2.el.style.opacity = lo.toFixed(2); L2.o = lo; }
    }
  }

  // ============================================================
  //  ДОМ 101: ВАРИАНТЫ ФАСАДА. По умолчанию — красный кирпич с тёмной кровлей.
  //  «Как в проекте» — светлый кирпич, белый пояс над окнами и белые свесы, кровля тёмная.
  //  Смена — волной снизу вверх (~1,8 с): кирпич и пояс по шейдеру, швы/свесы/рамы/кровля догоняют.
  // ============================================================
  const P101 = [
    { name: 'Красный кирпич', brick: null, band: 0, mortar: '#5a5550', roof: '#34383c', trim: '#2a2e32', frame: '#2a2e32' },
    { name: 'Как в проекте', brick: '#d9c6a6', band: 1, mortar: '#e4ded2', roof: '#33373c', trim: '#f0ede7', frame: '#2a2e32' },
    { name: 'Графит', brick: '#3c3e42', band: 0, mortar: '#bdb7ad', roof: '#1f2225', trim: '#141517', frame: '#141517' },
    { name: 'Терракота', brick: '#b2603a', band: 1, mortar: '#d2c8b9', roof: '#4b2a20', trim: '#efe9e0', frame: '#3a2a22' },
  ];
  const VC = P101.map((v) => ({
    tint: v.brick ? (() => { const c = lin(v.brick); return new V3(c.r, c.g, c.b); })() : new V3(1, 1, 1), use: v.brick ? 1 : 0, band: v.band,
    mortar: lin(v.mortar), roof: lin(v.roof), trim: lin(v.trim), frame: lin(v.frame),
  }));
  // белый оштукатуренный пояс над окнами: тонкий слой поверх кладки, виден только у вариантов с поясом
  const bandMat = patch(new THREE.MeshStandardMaterial({ color: lin('#efebe3'), roughness: 0.93, envMapIntensity: 0.4 }), 'bd-band', {
    defines: SHARED, uniforms: { uVarT: U.varT, uBandA: U.bandA, uBandB: U.bandB },
    vHead: 'varying vec3 vWP;', vEnd: WP_END,
    fHead: 'varying vec3 vWP;\nuniform float uVarT, uBandA, uBandB;\nfloat bFront(){ return uVarT * 1.3 - 0.15; }',
    fStart: 'float bY = (vWP.y - FLOOR_Y) / WALL_H;\nif (mix(uBandA, uBandB, 1.0 - smoothstep(bFront() - 0.08, bFront() + 0.01, bY)) < 0.5) discard;',
  });
  const band101 = (() => {
    const G = G0(false);
    for (const r of RUNS) {
      const lo = Math.min(r.a0, r.a1) - 0.03, hi = Math.max(r.a0, r.a1) + 0.03;
      const a = Math.min(r.f + r.o * 0.004, r.f + r.o * 0.03), b = Math.max(r.f + r.o * 0.004, r.f + r.o * 0.03);
      if (r.ax === 'x') pushBox(G, wx(lo), FY + 2.25, wz(a), wx(hi), FY + WH, wz(b));
      else pushBox(G, wx(a), FY + 2.25, wz(lo), wx(b), FY + WH, wz(hi));
    }
    const m = new THREE.Mesh(geoFrom(G), bandMat); m.receiveShadow = true; m.visible = false; scene.add(m);
    return m;
  })();
  let varCur = 0, varNext = 0, varT0 = -1;
  const VAR_DUR = 1800;
  function setBandUniforms() { U.bandA.value = VC[varCur].band; U.bandB.value = VC[varNext].band; }
  function applyVarColors(k) {
    const a = VC[varCur], b = VC[varNext];
    mortarMesh.material.color.copy(a.mortar).lerp(b.mortar, sstep(seg(k, 0.05, 0.8)));
    frameMat.color.copy(a.frame).lerp(b.frame, sstep(seg(k, 0.2, 0.75)));
    anth.color.copy(a.trim).lerp(b.trim, sstep(seg(k, 0.5, 0.9)));
    roofMat.color.copy(a.roof).lerp(b.roof, sstep(seg(k, 0.6, 1)));
  }
  function setVariant101(i) {
    i = ((i % P101.length) + P101.length) % P101.length;
    if (varT0 >= 0) { varCur = varNext; applyVarColors(0); }
    if (i === varCur && varT0 === -1) return;
    U.varA.value.copy(VC[varCur].tint); U.tintA.value = VC[varCur].use;
    U.varB.value.copy(VC[i].tint); U.tintB.value = VC[i].use;
    varNext = i; varT0 = -2; setBandUniforms();
  }
  function stepVariant(now) {
    if (varT0 === -1) return;
    if (varT0 === -2) varT0 = now;
    const k = clamp((now - varT0) / VAR_DUR);
    U.varT.value = easeIO(k);
    applyVarColors(k);
    if (k >= 1) {
      varCur = varNext; varT0 = -1; U.varT.value = 0;
      U.varA.value.copy(VC[varCur].tint); U.tintA.value = VC[varCur].use; setBandUniforms();
    }
  }
  // старт — красный кирпич, без волны
  varCur = varNext = 0;
  U.varA.value.copy(VC[0].tint); U.tintA.value = VC[0].use; U.varB.value.copy(VC[0].tint); U.tintB.value = VC[0].use; setBandUniforms();
  applyVarColors(1);

  // ============================================================
  //  ДОМ 118 м² — по рабочему проекту (план 15,98 × 9,09 м) и рендеру заказчика:
  //  графитовый кирпич, панели планкена, полоса красного кирпича над цоколем, панорамные окна,
  //  терраса в правом переднем углу с кирпичной колонной, двускатная кровля с фальцами и снегозадержателями.
  //  Появляется «снизу вверх» со светящейся линией (uClip), стоит на том же газоне, что и 101.
  // ============================================================
  const H118 = (() => {
    const g = new THREE.Group(); g.visible = false; scene.add(g);
    const HX = 7.99, HZ = 4.545, T2 = 0.4, Y0 = FY, Y1 = FY + WH;
    const NXa = 4.41, NZa = 2.835;                     // угол террасы (план: x 12,40 / z 7,38)
    const OV = 0.55, OG = 0.6, PIT = 24 * Math.PI / 180;

    // --- текстуры с канвы: цвет нейтральный (красим цветом материала), рельеф — карта нормалей ---
    function normalFrom(hgt, S, k) {
      const cv = document.createElement('canvas'); cv.width = cv.height = S;
      const cx = cv.getContext('2d'), img = cx.createImageData(S, S), d = img.data;
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const dx = hgt[y * S + (x + 1) % S] - hgt[y * S + (x - 1 + S) % S], dy = hgt[((y + 1) % S) * S + x] - hgt[((y - 1 + S) % S) * S + x];
        let nx = -dx * k, ny = dy * k, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
        const i = (y * S + x) * 4; d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
      }
      cx.putImageData(img, 0, 0);
      const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
      return t;
    }
    function canvasTex(S, draw, hk) {
      const cv = document.createElement('canvas'); cv.width = cv.height = S;
      const cx = cv.getContext('2d'); const hgt = new Float32Array(S * S);
      draw(cx, S, hgt);
      const map = new THREE.CanvasTexture(cv); map.encoding = THREE.sRGBEncoding; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 8;
      return { map, normal: normalFrom(hgt, S, hk) };
    }
    const rnd = mulberry(1180);
    // кирпич: тайл 0,75 × 0,75 м — 10 рядов по 75 мм, 3 кирпича по 250 мм
    const brickT = canvasTex(512, (cx, S, h) => {
      const rowH = S / 10, bw = S / 3, j = 5;
      cx.fillStyle = '#8a8884'; cx.fillRect(0, 0, S, S);
      for (let r = 0; r < 10; r++) for (let c = -1; c < 4; c++) {
        const x = c * bw + (r % 2) * bw / 2, y = r * rowH, v = 180 + rnd() * 40;
        cx.fillStyle = `rgb(${v},${v - 2},${v - 5})`; cx.fillRect(x + j / 2, y + j / 2, bw - j, rowH - j);
        for (let k = 0; k < 18; k++) { cx.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${0.05 + rnd() * 0.07})`; cx.fillRect(x + j + rnd() * (bw - 2 * j), y + j + rnd() * (rowH - 2 * j), 2, 2); }
      }
      const px = cx.getImageData(0, 0, S, S).data;
      for (let i = 0; i < S * S; i++) h[i] = px[i * 4] > 160 ? 1 : 0;
    }, 3.2);
    // планкен: тайл 0,6 м — 6 досок со щелями, продольные волокна
    const woodT = canvasTex(512, (cx, S, h) => {
      const bw = S / 6, gap = 6;
      cx.fillStyle = '#2e2622'; cx.fillRect(0, 0, S, S);
      for (let b = 0; b < 6; b++) {
        const x0 = b * bw + gap / 2, v = 190 + rnd() * 35;
        cx.fillStyle = `rgb(${v},${v * 0.95 | 0},${v * 0.9 | 0})`; cx.fillRect(x0, 0, bw - gap, S);   // почти нейтральная: тон даёт цвет материала
        for (let k = 0; k < 26; k++) {
          const gx = x0 + rnd() * (bw - gap), a = 0.06 + rnd() * 0.1;
          cx.strokeStyle = `rgba(60,48,40,${a})`; cx.lineWidth = 1 + rnd() * 1.4; cx.beginPath();
          for (let y = 0; y <= S; y += 16) cx.lineTo(gx + Math.sin(y * 0.02 + k) * 2.5, y);
          cx.stroke();
        }
        for (let y = 0; y < S; y++) for (let x = Math.ceil(x0); x < x0 + bw - gap; x++) h[y * S + x] = 1;
      }
    }, 2.4);
    // фальцевая кровля: тайл 0,5 м — фальц и два ребра жёсткости
    const roofT = canvasTex(256, (cx, S, h) => {
      cx.fillStyle = '#7d7f82'; cx.fillRect(0, 0, S, S);
      cx.fillStyle = '#9a9c9f'; cx.fillRect(0, 0, 9, S);
      cx.fillStyle = 'rgba(0,0,0,.08)'; cx.fillRect(S * 0.33, 0, 3, S); cx.fillRect(S * 0.66, 0, 3, S);
      for (let y = 0; y < S; y++) { for (let x = 0; x < 9; x++) h[y * S + x] = 1 - Math.abs(x - 4) / 5; h[y * S + Math.round(S * 0.33)] = 0.25; h[y * S + Math.round(S * 0.66)] = 0.25; }
    }, 2.0);

    // --- материалы ---
    const PAL = [
      { name: 'Как в проекте', brick: '#3d4249', wood: '#b88c5c', band: '#a8442a', roof: '#2d3034', frame: '#17181a' },
      { name: 'Светлый кирпич', brick: '#cdb898', wood: '#a98058', band: '#a8442a', roof: '#30333a', frame: '#1d1e20' },
      { name: 'Красный кирпич', brick: '#8a4634', wood: '#c4a070', band: '#5c2a1c', roof: '#2a2c2f', frame: '#1d1e20' },
    ];
    const lift = (hex, k) => lin(hex).multiplyScalar(k);   // текстуры светлые — цвет материала чуть приподнимаем
    const clipUni = { uClip: U.clip118 };
    const clipPatch = (m, key, glow = true) => patch(m, 'bd-118-' + key, {
      defines: SHARED, uniforms: clipUni, vHead: 'varying vec3 vWP;', vEnd: WP_END,
      fHead: 'varying vec3 vWP;\nuniform float uClip;', fStart: 'if (vWP.y > uClip) discard;',
      fEmis: glow ? 'totalEmissiveRadiance += ACCENT_LIN * (1.0 - smoothstep(0.0, 0.1, uClip - vWP.y)) * step(uClip, 50.0) * 1.3;' : '',
    });
    const depthMat = patch(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), 'bd-118-depth', {
      uniforms: clipUni, vHead: 'varying vec3 vWP;', vEnd: WP_END, fHead: 'varying vec3 vWP;\nuniform float uClip;', fStart: 'if (vWP.y > uClip) discard;',
    });
    const M = {
      brick: clipPatch(new THREE.MeshStandardMaterial({ map: brickT.map, normalMap: brickT.normal, normalScale: new THREE.Vector2(0.85, 0.85), roughness: 0.86, envMapIntensity: 0.4 }), 'brick'),
      wood: clipPatch(new THREE.MeshStandardMaterial({ map: woodT.map, normalMap: woodT.normal, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.62, envMapIntensity: 0.5 }), 'wood'),
      band: clipPatch(new THREE.MeshStandardMaterial({ map: brickT.map, normalMap: brickT.normal, roughness: 0.85, envMapIntensity: 0.35 }), 'band'),
      plinth: clipPatch(pbr(TX.concrete, '#9b968f'), 'plinth', false),   // у цоколя верх — большая плоскость, без подсветки края
      roof: clipPatch(new THREE.MeshStandardMaterial({ map: roofT.map, normalMap: roofT.normal, normalScale: new THREE.Vector2(1.1, 1.1), roughness: 0.42, metalness: 0.55, envMapIntensity: 1.0, side: THREE.DoubleSide }), 'roof'),
      trim: clipPatch(new THREE.MeshStandardMaterial({ color: lin('#1a1b1d'), roughness: 0.45, metalness: 0.4, envMapIntensity: 0.9 }), 'trim'),
      frame: clipPatch(new THREE.MeshStandardMaterial({ color: lin('#17181a'), roughness: 0.4, metalness: 0.3, envMapIntensity: 0.9 }), 'frame'),
      glass: clipPatch(new THREE.MeshStandardMaterial({ color: lin('#1a2228'), roughness: 0.04, metalness: 0.92, envMapIntensity: 1.5, emissive: lin('#ffb36e'), emissiveIntensity: 0 }), 'glass'),
      door: clipPatch(new THREE.MeshStandardMaterial({ color: lin('#2c3035'), roughness: 0.5, metalness: 0.25 }), 'door'),
      steel: clipPatch(new THREE.MeshStandardMaterial({ color: lin('#c9cdd2'), roughness: 0.3, metalness: 0.9 }), 'steel'),
      soffit: clipPatch(new THREE.MeshStandardMaterial({ color: lin('#2e3033'), roughness: 0.8, side: THREE.DoubleSide }), 'soffit'),
    };
    const US = 1 / 0.75, UW = 1 / 0.6;
    const GB = G0(), GW = G0(), GR = G0(), GP = G0(), GF = G0(false), GT = G0(false), GD = G0(false), GS = G0(false);
    const box = (G, x0, y0, z0, x1, y1, z1, us) => { if (x1 - x0 > 1e-3 && y1 - y0 > 1e-3 && z1 - z0 > 1e-3) pushBox(G, x0, y0, z0, x1, y1, z1, us); };
    const glassPanes = [];
    let nWin = 0;

    // окно или дверь в стене: рама из брусков, импосты, стекло; дверь — полотно с ручкой-скобой и стеклянной вставкой
    function opening(ax, face, out, o) {
      const d0 = face - out * 0.17, d1 = face - out * 0.07;                 // рама утоплена в проём
      const z0 = Math.min(d0, d1), z1 = Math.max(d0, d1);
      const u0 = o.c - o.w / 2, u1 = o.c + o.w / 2, y0 = Y0 + o.s, y1 = Y0 + o.h, f = 0.06;
      const B = (G, a, b, c0, c1, ya, yb) => (ax === 'x' ? box(G, a, ya, c0, b, yb, c1) : box(G, c0, ya, a, c1, yb, b));
      B(GF, u0, u1, z0, z1, y1 - f, y1); B(GF, u0, u0 + f, z0, z1, y0, y1); B(GF, u1 - f, u1, z0, z1, y0, y1);
      if (o.kind === 'door') {
        B(GD, u0 + f, u1 - f, z0 + 0.02, z1 - 0.02, y0, y1 - f);
        const hp = out > 0 ? z1 : z0, hu = u1 - f - 0.14;
        B(GT, hu, hu + 0.03, Math.min(hp, hp + out * 0.06), Math.max(hp, hp + out * 0.06), y0 + 0.5, y0 + 1.8);
        const gl = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 1.3), M.glass);
        placePane(gl, ax, out, u0 + f + 0.22, y0 + 1.15, face - out * 0.045 + out * 0.0);
        return;
      }
      nWin++;
      B(GF, u0, u1, z0, z1, y0, y0 + f);
      const tall = o.h - o.s > 2.0, panes = tall ? Math.max(1, Math.round(o.w / 0.5)) : (o.w > 1.0 ? 2 : 1);
      const pw = (o.w - 2 * f) / panes;
      for (let i = 1; i < panes; i++) { const x = u0 + f + i * pw; B(GF, x - 0.025, x + 0.025, z0 + 0.01, z1 - 0.01, y0, y1); }
      if (tall && o.h - o.s > 2.3) B(GF, u0, u1, z0 + 0.01, z1 - 0.01, y1 - 0.62, y1 - 0.57);   // фрамуга
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(o.w - 2 * f, o.h - o.s - 2 * f), M.glass);
      placePane(gl, ax, out, o.c, (y0 + y1) / 2, face - out * 0.12);
    }
    function placePane(m, ax, out, u, y, d) {
      if (ax === 'x') { m.position.set(u, y, d); if (out < 0) m.rotation.y = Math.PI; }
      else { m.position.set(d, y, u); m.rotation.y = out > 0 ? Math.PI / 2 : -Math.PI / 2; }
      g.add(m); glassPanes.push(m);
    }
    // стена: ax — вдоль какой оси, face — наружная плоскость, out — куда «наружу»; spans — где планкен
    function wall(ax, face, out, a, b, spans, ops, bandA = a, bandB = b) {
      const p0 = out > 0 ? face - T2 : face, p1 = out > 0 ? face : face + T2;
      const W_ = (G, u0, u1, y0, y1, us) => (ax === 'x' ? box(G, u0, y0, p0, u1, y1, p1, us) : box(G, p0, y0, u0, p1, y1, u1, us));
      const q0 = out > 0 ? face : face - 0.025, q1 = out > 0 ? face + 0.025 : face;
      const bandBox = (u0, u1) => (ax === 'x' ? box(GR, u0, Y0, q0, u1, Y0 + 0.22, q1, US) : box(GR, q0, Y0, u0, q1, Y0 + 0.22, u1, US));
      const isWood = (u) => spans.some(([s0, s1]) => u > s0 && u < s1);
      const cuts = new Set([a, b]);
      for (const [s0, s1] of spans) for (const s of [s0, s1]) if (s > a && s < b) cuts.add(s);
      for (const o of ops) { cuts.add(o.c - o.w / 2); cuts.add(o.c + o.w / 2); }
      const xs = [...cuts].sort((m, n) => m - n);
      for (let i = 0; i < xs.length - 1; i++) {
        const u0 = xs[i], u1 = xs[i + 1], um = (u0 + u1) / 2;
        const op = ops.find((o) => um > o.c - o.w / 2 && um < o.c + o.w / 2);
        const wood = isWood(um), G = wood ? GW : GB, us = wood ? UW : US;
        if (!op) { W_(G, u0, u1, Y0, Y1, us); if (!wood) bandBox(u0, u1); }
        else { W_(G, u0, u1, Y0, Y0 + op.s, us); W_(G, u0, u1, Y0 + op.h, Y1, us); if (op.s > 0.2 && !wood) bandBox(u0, u1); }
      }
      if (bandA < a) bandBox(bandA, a); if (bandB > b) bandBox(b, bandB);
      for (const o of ops) opening(ax, face, out, o);
    }
    const w = (c, ww, s = 0.9, h = 2.45) => ({ c, w: ww, s, h, kind: 'win' });
    const dr = (c, ww) => ({ c, w: ww, s: 0, h: 2.3, kind: 'door' });
    const m2x = (m) => m - HX;                                           // метры плана → координаты дома
    // фасад с входом (z = +HZ): планкен слева, кирпич с двумя окнами санузлов, планкен с дверью тамбура и окном
    wall('x', HZ, 1, -HX, NXa, [[m2x(0), m2x(2.2)], [m2x(5.84), NXa]],
      [w(m2x(1.25), 1.05, 0.25, 2.7), w(m2x(2.83), 0.5, 1.55), w(m2x(4.53), 0.7, 1.4), dr(m2x(7.05), 1.05), w(m2x(8.93), 0.75, 1.45)]);
    wall('z', NXa, 1, NZa, HZ - T2, [[NZa, HZ]], []);                   // боковина террасы — планкен
    wall('x', NZa, 1, NXa - T2, HX, [], [w(5.75, 2.2, 0.05, 2.7)]);      // стена террасы — панорамное окно кухни-гостиной
    wall('z', HX, 1, -HZ + T2, NZa - T2, [[-2.6, NZa]], [w(-1.25, 1.3, 0.05, 2.7), w(1.2, 1.2, 0.05, 2.7)], -HZ - 0.025, NZa - T2);
    wall('x', -HZ, -1, -HX, HX, [], [w(m2x(1.0), 0.6, 1.5), w(m2x(3.7), 1.2), w(m2x(7.2), 1.2), w(m2x(9.8), 1.4), w(m2x(11.9), 1.4)]);
    wall('z', -HX, -1, -HZ + T2, HZ - T2, [], [w(1.8, 1.4)], -HZ - 0.025, HZ + 0.025);
    box(GB, 7.0, Y0, 3.3, HX, Y1, HZ, US);                              // кирпичная колонна на углу террасы
    box(GR, 6.975, Y0, 3.275, HX + 0.025, Y0 + 0.22, HZ + 0.025, US);
    box(GB, NXa - T2, Y1 - 0.32, HZ - T2, 7.0, Y1, HZ, US);              // перемычка над террасой
    box(GP, -HX - 0.04, 0, -HZ - 0.04, HX + 0.04, Y0, HZ + 0.04);        // цоколь (и пол террасы)
    for (const [z1, h] of [[HZ + 0.95, 0.17], [HZ + 0.65, 0.34], [HZ + 0.35, 0.5]]) box(GP, m2x(7.05) - 0.8, 0, HZ, m2x(7.05) + 0.8, h, z1);   // крыльцо

    // --- кровля ---
    const tanP = Math.tan(PIT), zE = HZ + OV, yE = Y1 - OV * tanP + 0.06, yR = Y1 + HZ * tanP + 0.06, xA = -HX - OG, xB = HX + OG;
    const slopeLen = Math.hypot(zE, yR - yE);
    const roofGeo = (() => {
      const P = [], UVv = [];
      for (const s of [1, -1]) {
        const a = [xA, yE, s * zE], b = [xB, yE, s * zE], c = [xB, yR, 0], d = [xA, yR, 0];
        const uv = (p, v) => [p[0] / 0.5, v];
        const tris = s > 0 ? [[a, 0], [b, 0], [c, slopeLen], [a, 0], [c, slopeLen], [d, slopeLen]] : [[b, 0], [a, 0], [d, slopeLen], [b, 0], [d, slopeLen], [c, slopeLen]];
        for (const [p, v] of tris) { P.push(...p); UVv.push(...uv(p, v)); }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(UVv, 2));
      geo.computeVertexNormals();
      return geo;
    })();
    const roof = new THREE.Mesh(roofGeo, M.roof); roof.castShadow = true; roof.receiveShadow = true; g.add(roof);
    // фронтоны — треугольники кладки над стенами торцов
    const gable = (x, flip) => {
      const P = [x, Y1, -HZ, x, Y1, HZ, x, yR - 0.06, 0], UVv = [-HZ * US, Y1 * US, HZ * US, Y1 * US, 0, (yR - 0.06) * US];
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(flip ? [P[3], P[4], P[5], P[0], P[1], P[2], P[6], P[7], P[8]] : P, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(flip ? [UVv[2], UVv[3], UVv[0], UVv[1], UVv[4], UVv[5]] : UVv, 2));
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, M.brick); m.castShadow = true; m.receiveShadow = true; g.add(m);
    };
    gable(HX, true); gable(-HX, false);
    // лобовые доски, ветровые доски по фронтонам, конёк, подшивка, водостоки, снегозадержатели
    box(GT, xA, yE - 0.2, zE - 0.03, xB, yE + 0.02, zE + 0.01); box(GT, xA, yE - 0.2, -zE - 0.01, xB, yE + 0.02, -zE + 0.03);
    box(GT, xA - 0.01, yR - 0.02, -0.12, xB + 0.01, yR + 0.07, 0.12);
    box(GS, xA, yE - 0.2, HZ, xB, yE - 0.18, zE - 0.03); box(GS, xA, yE - 0.2, -zE + 0.03, xB, yE - 0.18, -HZ);
    box(GS, NXa, Y1 - 0.02, NZa, HX, Y1, HZ);                           // потолок террасы
    const extra = [];
    const beam = (a, b, r, mat) => {
      const A = new V3(...a), Bv = new V3(...b), len = A.distanceTo(Bv);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10).rotateX(Math.PI / 2), mat);
      m.position.copy(A).add(Bv).multiplyScalar(0.5); m.lookAt(Bv); m.castShadow = true; g.add(m); extra.push(m);
    };
    for (const sx of [xA, xB]) for (const s of [1, -1]) {                  // ветровые доски
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.26, slopeLen + 0.08), M.trim);
      m.position.set(sx, (yE + yR) / 2 - 0.06, s * zE / 2); m.rotation.x = s * PIT; m.castShadow = true; g.add(m); extra.push(m);
    }
    for (const s of [1, -1]) beam([xA, yE - 0.12, s * (zE + 0.07)], [xB, yE - 0.12, s * (zE + 0.07)], 0.07, M.trim);   // водостоки
    for (const [x, z] of [[-HX + 0.22, HZ + 0.12], [6.9, HZ + 0.12], [-HX + 0.22, -HZ - 0.12], [HX - 0.22, -HZ - 0.12]]) beam([x, yE - 0.15, z], [x, 0.18, z], 0.045, M.trim);
    for (const off of [0, 0.09]) {                                         // снегозадержатель — две трубки на кронштейнах
      const dd = 1.1 + off, z = zE - dd * Math.cos(PIT), y = yE + dd * Math.sin(PIT) + 0.06;
      beam([xA + 0.4, y, z], [xB - 0.4, y, z], 0.016, M.trim);
    }
    for (let x = xA + 0.6; x < xB - 0.4; x += 1.1) { const z = zE - 1.13 * Math.cos(PIT), y = yE + 1.13 * Math.sin(PIT) + 0.03; box(GT, x - 0.02, y - 0.04, z - 0.03, x + 0.02, y + 0.08, z + 0.03); }

    // --- сборка мешей ---
    const add = (G, mat, shadow = true) => { const m = new THREE.Mesh(geoFrom(G), mat); m.castShadow = shadow; m.receiveShadow = true; g.add(m); return m; };
    add(GB, M.brick); add(GW, M.wood); add(GR, M.band); add(GP, M.plinth); add(GF, M.frame); add(GT, M.trim); add(GD, M.door); add(GS, M.soffit, false);
    g.traverse((o) => { if (o.isMesh) o.customDepthMaterial = depthMat; });

    // --- чертёж 118: наружный и внутренний контур стен, колонна, размерные линии; рисуется линия за линией ---
    const planMat = new THREE.MeshBasicMaterial({ color: lin('#1b1c1e'), transparent: true, opacity: 0, depthWrite: false });
    const planG = new THREE.Group(); planG.visible = false; scene.add(planG);
    const plan = [];
    const pline = (x0, z0, x1, z1, wd) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 0.004, wd).translate(0.5, 0, 0), planMat);
      m.position.set(x0, 0.012, z0); m.rotation.y = -Math.atan2(z1 - z0, x1 - x0); m.scale.x = 1e-3; m.renderOrder = 2;
      planG.add(m); plan.push({ m, len });
    };
    const poly = (pts, wd) => pts.forEach((a, i) => { const b = pts[(i + 1) % pts.length]; pline(a[0], a[1], b[0], b[1], wd); });
    poly([[-HX, HZ], [NXa, HZ], [NXa, NZa], [HX, NZa], [HX, -HZ], [-HX, -HZ]], 0.11);
    poly([[-HX + T2, HZ - T2], [NXa - T2, HZ - T2], [NXa - T2, NZa - T2], [HX - T2, NZa - T2], [HX - T2, -HZ + T2], [-HX + T2, -HZ + T2]], 0.06);
    poly([[7.0, 3.3], [HX, 3.3], [HX, HZ], [7.0, HZ]], 0.06);
    pline(-HX, HZ + 1.5, HX, HZ + 1.5, 0.04); pline(-HX - 1.5, -HZ, -HX - 1.5, HZ, 0.04);
    for (const x of [-HX, HX]) pline(x, HZ + 1.15, x, HZ + 1.85, 0.04);
    for (const z of [-HZ, HZ]) pline(-HX - 1.15, z, -HX - 1.85, z, 0.04);
    const fillMat = new THREE.MeshBasicMaterial({ color: lin('#1b1c1e'), transparent: true, opacity: 0, depthWrite: false });
    for (const [x0, z0, x1, z1] of [[-HX, -HZ, HX, NZa], [-HX, NZa, NXa, HZ]]) {   // заливка пятна дома
      const f = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), fillMat);
      f.position.set((x0 + x1) / 2, 0.008, (z0 + z1) / 2); f.renderOrder = 1; planG.add(f);
    }

    // --- участок 118: отмостка, дорожка к крыльцу с бордюром, фонарики, кусты ---
    const DX = m2x(7.05), pz0 = HZ + 0.95, pz1 = 10.4;
    const site118 = new THREE.Group(); site118.visible = false; scene.add(site118);
    {
      const AG = G0();
      const strip = (x0, z0, x1, z1) => {                                // отмостка плитами по 1,5 м
        const alongX = x1 - x0 > z1 - z0, a0 = alongX ? x0 : z0, a1 = alongX ? x1 : z1;
        for (let s = a0; s < a1 - 0.05; s += 1.5) {
          const e = Math.min(a1, s + 1.5) - 0.012;
          if (alongX) pushBox(AG, s, 0, z0, e, 0.06, z1, 0.8); else pushBox(AG, x0, 0, s, x1, 0.06, e, 0.8);
        }
      };
      strip(-HX - 0.84, HZ + 0.04, HX + 0.84, HZ + 0.84); strip(-HX - 0.84, -HZ - 0.84, HX + 0.84, -HZ - 0.04);
      strip(-HX - 0.84, -HZ - 0.04, -HX - 0.04, HZ + 0.04); strip(HX + 0.04, -HZ - 0.04, HX + 0.84, HZ + 0.04);
      const apron = new THREE.Mesh(geoFrom(AG), pbr(TX.concrete, '#c3c0b9')); apron.receiveShadow = true; site118.add(apron);
      const KG = G0();
      for (const sx of [-1, 1]) pushBox(KG, DX + sx * 0.8 - (sx > 0 ? 0 : 0.08), 0, pz0, DX + sx * 0.8 + (sx > 0 ? 0.08 : 0), 0.09, pz1, 0.8);
      const kerb = new THREE.Mesh(geoFrom(KG), pbr(TX.concrete, '#9e9a93')); kerb.castShadow = true; kerb.receiveShadow = true; site118.add(kerb);
    }
    const pv118 = [], rr = mulberry(118);
    {
      const pw = 0.2, pd = 0.1, j = 0.004, tone = [lin('#9a958d'), lin('#8a857e'), lin('#6e6a65'), lin('#a6a198')];
      let row = 0;
      for (let z = pz0; z < pz1 - pd; z += pd + j, row++) {
        const off = (row % 2) * (pw + j) / 2;
        for (let x = DX - 0.8 - off; x < DX + 0.8; x += pw + j) {
          const a = Math.max(x, DX - 0.8), b = Math.min(x + pw, DX + 0.8);
          if (b - a < 0.04) continue;
          pv118.push({ x: (a + b) / 2, y: 0.03, z: z + pd / 2, yaw: (rr() - 0.5) * 0.01, sx: (b - a) / pw, t: row * 0.9 + rr() * 0.6, uv: [rr() * 4, rr() * 4], col: tone[Math.floor(rr() * tone.length)].clone() });
        }
      }
    }
    const pc118 = u(-1), PV_ROWS = Math.ceil((pz1 - pz0) / 0.104);
    const paver118 = instanced(chamferBox(0.2, 0.06, 0.1, 0.006, 2), masonryMat(TX.concrete, '#ffffff', pc118, 'paver118', 0.4, { noAO: true }), pv118, false);
    paver118.visible = false;
    const bol118 = [];
    {
      const capMat = new THREE.MeshStandardMaterial({ color: lin('#f6efe2'), emissive: lin('#ffbe78'), emissiveIntensity: 0, roughness: 0.35 });
      const postMat = new THREE.MeshStandardMaterial({ color: lin('#2a2e32'), roughness: 0.42, metalness: 0.35, envMapIntensity: 0.9 });
      for (const z of [pz0 + 1.2, pz0 + 3.7]) for (const sx of [-1, 1]) {
        const b = new THREE.Group(); b.position.set(DX + sx * 1.15, 0, z);
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.55, 16), postMat); post.position.y = 0.275; post.castShadow = true; b.add(post);
        const head = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 16), capMat); head.position.y = 0.5; b.add(head);
        b.scale.setScalar(1e-3); b.visible = false; scene.add(b);
        bol118.push({ g: b, capMat });
      }
    }
    const bush118 = [[-6.3, 5.75, 0.6], [-4.8, 5.95, 0.5], [1.9, 5.7, 0.55], [3.3, 5.9, 0.45], [9.55, 1.9, 0.55], [9.45, 0.55, 0.45]].map(([x, z, s], i) => {
      const b = leafTree({ h: s * 1.6, r: s, ry: s * 0.75, seed: 180 + i, mats: MATS.bush, bark: barkMat, n: 170, size: 0.36, light: BUSH_L, dark: BUSH_D, trunkR: 0.02 });
      b.position.set(x, 0, z); b.rotation.y = i * 1.3; b.scale.setScalar(1e-3); b.visible = false; scene.add(b);
      return b;
    });

    // --- палитры и появление ---
    const COLS = ['brick', 'wood', 'band', 'roof', 'frame'];
    const cur = {}, tgt = {};
    const palColors = (p) => ({ brick: lift(p.brick, 1.3), wood: lift(p.wood, 1.25), band: lift(p.band, 1.3), roof: lift(p.roof, 1.6), frame: lin(p.frame) });
    let pal = 0;
    Object.assign(tgt, palColors(PAL[0])); for (const k of COLS) cur[k] = tgt[k].clone();
    const syncCols = () => { M.brick.color.copy(cur.brick); M.wood.color.copy(cur.wood); M.band.color.copy(cur.band); M.roof.color.copy(cur.roof); M.frame.color.copy(cur.frame); };
    syncCols();
    const ROOF_A = (xB - xA) * 2 * slopeLen;
    return {
      group: g, PAL, top: yR + 0.3,
      get pal() { return pal; },
      stats: { area: '118,10 м²', bricks: Math.round(((2 * (2 * HX + 2 * HZ)) * WH * 0.55 + HZ * HZ * tanP * 2) * 51.3), roof: Math.round(ROOF_A), wins: nWin },
      bounds: { x0: xA - 1.5, x1: xB + 1.5, z0: -zE - 1.5, z1: zE + 2.2, y1: yR + 1.5 },
      setPalette(i) { pal = ((i % PAL.length) + PAL.length) % PAL.length; Object.assign(tgt, palColors(PAL[pal])); },
      lamps: bol118.map((b) => b.g.position),
      // r: 0…0,25 чертёж · 0,3…0,45 фундамент · 0,45…0,85 стены и кровля · 0,82…1 участок; чертёж гаснет к 0,6
      update(dt, L, r) {
        const k = 1 - Math.exp(-dt * 3.2);
        for (const c of COLS) cur[c].lerp(tgt[c], k);
        syncCols();
        M.glass.emissiveIntensity = L * 0.18;
        const kd = clamp(r / 0.25), pa = clamp(r / 0.04) * (1 - seg(r, 0.45, 0.6));
        planG.visible = pa > 0.003; planMat.opacity = pa * 0.85; fillMat.opacity = pa * seg(r, 0.12, 0.3) * 0.16;
        if (planG.visible) plan.forEach((l, i) => { const t = clamp((kd - 0.7 * i / plan.length) / 0.3); l.m.scale.x = Math.max(1e-3, l.len * easeOut(t)); });
        const kf = seg(r, 0.3, 0.45), kw = seg(r, 0.45, 0.85);
        g.visible = kf > 0;                                                 // фундамент дорастает чуть выше пола — светится только край
        U.clip118.value = r >= 0.999 ? 99 : kw > 0 ? lerp(Y0 + 0.13, yR + 0.4, easeIO(kw)) : lerp(-0.05, Y0 + 0.13, easeOut(kf));
        const ks = seg(r, 0.82, 1);
        site118.visible = ks > 0; site118.position.y = -0.12 * (1 - easeOut(ks));
        paver118.visible = ks > 0; pc118.value = ks * (PV_ROWS + 4) - 1;
        bol118.forEach((b, i) => { const q = clamp((ks - 0.4 - i * 0.1) / 0.3); b.g.visible = q > 0; b.g.scale.setScalar(Math.max(1e-3, backOut(q))); b.capMat.emissiveIntensity = L * 2.5; });
        bush118.forEach((b, i) => { const q = clamp((ks - 0.15 - i * 0.08) / 0.4); b.visible = q > 0; b.scale.setScalar(Math.max(1e-3, backOut(q))); });
        return ks;
      },
    };
  })();

  // снимок кадра для окна «Хочу такой дом» (сразу после отрисовки — без preserveDrawingBuffer)
  let snapReq = null;
  const _pv = new V3();
  function houseRect() {                                   // где на кадре текущий дом с деревьями (доли ширины/высоты)
    const b = r118eff > 0.5 ? H118.bounds : { x0: OX - 2.5, x1: OX + W + 2.5, z0: OZ - 2.5, z1: OZ + D + 2.5, y1: 7.5 };
    let x0 = 1, x1 = 0, y0 = 1, y1 = 0;
    for (const x of [b.x0, b.x1]) for (const y of [0, b.y1]) for (const z of [b.z0, b.z1]) {
      _pv.set(x, y, z).project(camera);
      const px = (_pv.x + 1) / 2, py = (1 - _pv.y) / 2;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    return { x0: clamp(x0), x1: clamp(x1), y0: clamp(y0), y1: clamp(y1) };
  }
  window.BD3D = {
    houses: [
      { id: '101', name: 'Дом 101 м²', palettes: P101.map((v) => ({ name: v.name, b: v.brick || '#6b3b29', r: v.roof })) },
      { id: '118', name: 'Дом 118 м²', palettes: H118.PAL.map((v) => ({ name: v.name, b: v.brick, r: v.wood })) },
    ],
    get house() { return houseTo; },
    get busy() { return hsT0 !== -1; },
    get current() { return houseTo === 1 ? H118.pal : (varT0 === -1 ? varCur : varNext); },
    setHouse,
    setVariant(i) { if (houseTo === 1) H118.setPalette(i); else setVariant101(i); document.dispatchEvent(new CustomEvent('bd:variant', { detail: i })); },
    snapshot: () => new Promise((r) => { snapReq = r; }),
  };
  H118stats = H118.stats;

  // прогрев: всё видно и «построено», чтобы скомпилировать шейдеры до первого кадра
  U.bC.value = U.kC.value = U.wC.value = U.aC.value = U.pC.value = 99; U.roofY.value = U.membY.value = 99; U.mY.value = U.lY.value = 99;
  scene.traverse((o) => { o.visible = true; });
  camera.position.set(20, 20, 20); camera.lookAt(0, 0, 0);
  renderer.compile(scene, camera);

  // ---------- цикл ----------
  let t0 = -1, shadowP = -1, ftAvg = 16, ftN = 0;
  renderer.shadowMap.autoUpdate = false;   // свет неподвижен: тени пересчитываем, только когда стройка сдвинулась
  canvas.classList.add('on');
  const HTML = document.documentElement;
  return function frame(p, now, rawDt, ps = p) {
    if (!onScreen || HTML.classList.contains('pz-open')) return;   // под презентацией не рисуем
    const dt = Math.min(0.2, rawDt);
    mx = lerp(mx, tmx, 1 - Math.exp(-dt * 3)); my = lerp(my, tmy, 1 - Math.exp(-dt * 3));
    if (t0 < 0) t0 = now;
    const draw = (REDUCED || forcedP !== null) ? 1 : clamp((now - t0 - 250) / 2900);
    apply(p, draw, now, ps);
    const ks118 = H118.update(dt, U.lights.value, r118eff);
    const kF101 = sg(p, 'fin');
    if (ks118 > 0.5) { H118.lamps.forEach((v, i) => U.lamps.value[i].set(v.x, 0, v.z)); U.lampK.value = ks118; }
    else { LAMPS101.forEach((v, i) => U.lamps.value[i].copy(v)); U.lampK.value = kF101; }
    const sk = p + r118eff * 3.1 + ps * 0.37;
    if (sk !== shadowP) { renderer.shadowMap.needsUpdate = true; shadowP = sk; }
    renderer.render(scene, camera);
    if (snapReq) { try { snapReq({ url: canvas.toDataURL('image/jpeg', 0.9), rect: houseRect() }); } catch (e) { snapReq(null); } snapReq = null; }
    ftN++;
    if (rawDt < 0.5) {
      ftAvg = lerp(ftAvg, rawDt * 1000, 0.08);
      if (ftN > 60 && ftAvg > 30 && dpr > 0.75) { dpr = Math.max(0.75, dpr - 0.25); renderer.setPixelRatio(dpr); renderer.setSize(VW, VH, false); ftN = 0; }
    }
  };
}
})();
