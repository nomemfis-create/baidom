/* БАЙДОМ — 3D-презентации условий (trade-in, земля, референсы, ипотека) и появление пунктов «Свой дом или квартира».
   Нажали на карточку условия → полноэкранная презентация. Колесо мыши, свайп, стрелки или точки справа листают слайды,
   а 3D-сцена из «кирпичиков» перестраивается: квартира превращается в дом, участок — в стройку, фото — в проект.
   Сцена — один InstancedMesh из кубиков с фаской; каждый кубик летит из старого места в новое по дуге,
   снизу вверх, как кладка. Без three.js презентация работает как обычные слайды с текстом. */
(() => {
'use strict';
const html = document.documentElement;

// ---------- «Свой дом или квартира»: пункты появляются, боль зачёркивается ----------
(() => {
  const grid = document.querySelector('.plusy-grid');
  if (!grid || !('IntersectionObserver' in window)) return;
  grid.classList.add('anim');
  const io = new IntersectionObserver((es) => {
    let k = 0;
    for (const e of es) {
      if (!e.isIntersecting) continue;
      e.target.style.setProperty('--d', (k++ * 0.09).toFixed(2) + 's');
      e.target.classList.add('in'); io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -10% 0px' });
  Array.from(grid.children).forEach((li) => io.observe(li));
})();

// ============================================================
//  ВОКСЕЛЬНЫЕ СЦЕНЫ
// ============================================================
const PAL = {
  grass: '#86a65a', grass2: '#7b9b51', grass3: '#94b366', soil: '#7d5b3d', soil2: '#6c4e34',
  conc: '#cbc5ba', conc2: '#bdb6aa', asph: '#9a9893', asph2: '#8d8b86',
  brick: '#b0532f', brick2: '#9d4829', brick3: '#bf6239',
  sand: '#d9c096', sand2: '#cdb385', roof: '#4d5158', roof2: '#43474e',
  trim: '#f1ede6', glass: '#a8c6d6', glass2: '#8db0c4', door: '#5b3b27', wood: '#b88a58',
  panel: '#d9d4ca', panel2: '#c8c2b7', pwin: '#8098a7',
  acc: '#c4561d', acc2: '#e5824f', ghost: '#e0dbd2',
  bp: '#4f7ec4', bp2: '#2f5fa6', bpl: '#c3d4ee', bpw: '#e6edf7',
  gold: '#dcaa45', gold2: '#c79434',
  leaf: '#6e994a', leaf2: '#5f8a3f', leaf3: '#82ad59', pine: '#456f4a', pine2: '#3a6040', bark: '#6b4b33',
  pole: '#857462', wire: '#3c3c3c', gas: '#e3b83c', phone: '#26282c', sky: '#c4dbe9', white: '#f4f1eb',
};
const GR = ['grass', 'grass2', 'grass3'], SOIL = ['soil', 'soil2'], BR = ['brick', 'brick2', 'brick3'], SA = ['sand', 'sand2'];
const ROOF = ['roof', 'roof2'], LEAF = ['leaf', 'leaf2', 'leaf3'], PINE = ['pine', 'pine2'], ASPH = ['asph', 'asph2'];
const hash = (x, y, z) => { let h = (x * 374761393 + y * 668265263 + z * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

class Vox {
  constructor() { this.m = new Map(); this.tags = []; }
  set(x, y, z, c, id) { this.m.set(x + ',' + y + ',' + z, { x, y, z, c, id }); return this; }
  get(x, y, z) { return this.m.get(x + ',' + y + ',' + z); }
  has(x, y, z) { return this.m.has(x + ',' + y + ',' + z); }
  del(x, y, z) { this.m.delete(x + ',' + y + ',' + z); return this; }
  box(x0, y0, z0, x1, y1, z1, c) { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) this.set(x, y, z, c); return this; }
  ring(x0, z0, x1, z1, y, c) { for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) if (x === x0 || x === x1 || z === z0 || z === z1) this.set(x, y, z, c); return this; }
  tag(x, y, z, t) { this.tags.push({ x, y, z, t }); return this; }
  each(fn) { for (const v of this.m.values()) fn(v); return this; }
}

function ground(V, x0, z0, x1, z1, top = GR) {
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) V.set(x, -1, z, top);
  V.ring(x0, z0, x1, z1, -2, SOIL);
  return V;
}
// одноэтажный кирпичный дом: плита, стены с окнами и дверью, белый пояс, вальмовая или двускатная кровля
function house(V, o = {}) {
  const W = o.W || 14, D = o.D || 10, H = o.H || 5;
  const x0 = o.x0 != null ? o.x0 : -Math.floor(W / 2), z0 = o.z0 != null ? o.z0 : -Math.floor(D / 2);
  const x1 = x0 + W - 1, z1 = z0 + D - 1;
  const rows = o.rows != null ? o.rows : H, dS = o.dS || 0, dW = o.dW || 0, dR = o.dR || 0;
  const wall = o.wall || SA, win = o.win || 'glass', trim = o.trim || 'trim', door = o.door || 'door';
  if (o.slab !== false) V.box(x0, dS, z0, x1, dS, z1, o.base || 'conc');
  const isWin = (u, n, y) => u >= 2 && u <= n - 3 && (u - 2) % 4 < 2 && y >= 2 && y <= H - 1;
  const doorU = 2 + 4 * Math.floor((W - 4) / 8);
  for (let y = 1; y <= Math.min(rows, H); y++) for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
    const sideX = x === x0 || x === x1, sideZ = z === z0 || z === z1;
    if (!sideX && !sideZ) continue;
    let c = y === H ? trim : wall;
    if (sideZ && !sideX) {
      const u = x - x0;
      if (z === z1 && (u === doorU || u === doorU + 1) && y <= H - 2) c = door;
      else if (isWin(u, W, y)) c = win;
    } else if (sideX && !sideZ && isWin(z - z0, D, y)) c = win;
    V.set(x, y + dW, z, c);
  }
  if (o.roof !== false && rows >= H) {
    const yb = H + 1 + dR;
    if (o.gable) {                                  // конёк вдоль X
      for (let k = 0; ; k++) {
        const za = z0 - 1 + 2 * k, zb = z1 + 1 - 2 * k;
        if (za > zb) break;
        const y = yb + k;
        for (let x = x0 - 1; x <= x1 + 1; x++) for (let z = za; z <= zb; z++) {
          const edge = z <= za + 1 || z >= zb - 1;
          if (edge) V.set(x, y, z, o.roofC || ROOF);
          else if (x === x0 || x === x1) V.set(x, y, z, wall);
        }
      }
    } else {                                        // вальма: каждый ряд на 2 кубика уже
      for (let k = 0; ; k++) {
        const xa = x0 - 1 + 2 * k, xb = x1 + 1 - 2 * k, za = z0 - 1 + 2 * k, zb = z1 + 1 - 2 * k;
        if (xa > xb || za > zb) break;
        const y = yb + k;
        for (let x = xa; x <= xb; x++) for (let z = za; z <= zb; z++)
          if (x <= xa + 1 || x >= xb - 1 || z <= za + 1 || z >= zb - 1) V.set(x, y, z, o.roofC || ROOF);
      }
    }
  }
  return { x0, z0, x1, z1, H };
}
function tree(V, x, z, h = 3, r = 2) {
  V.box(x, 0, z, x, h - 1, z, 'bark');
  const cy = h + r - 1;
  for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) {
    const d = dx * dx + dy * dy * 1.25 + dz * dz;
    if (d > r * r + 0.7 || (r >= 2 && d < (r - 1.1) * (r - 1.1))) continue;
    V.set(x + dx, cy + dy, z + dz, LEAF);
  }
}
function pine(V, x, z, h = 7) {
  V.set(x, 0, z, 'bark');
  for (let i = 1; i <= h; i++) {
    const r = Math.floor((h - i) / 2.3);
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (Math.abs(dx) + Math.abs(dz) <= r) V.set(x + dx, i, z + dz, PINE);
  }
  V.set(x, h + 1, z, 'pine');
}
function fence(V, x0, z0, x1, z1, gate) {
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
    if (!(x === x0 || x === x1 || z === z0 || z === z1)) continue;
    if (gate && z === z1 && x >= gate[0] && x <= gate[1]) continue;
    const corner = (x === x0 || x === x1) && (z === z0 || z === z1), post = gate && z === z1 && (x === gate[0] - 1 || x === gate[1] + 1);
    if (corner || post) V.box(x, 0, z, x, 1, z, 'wood'); else V.set(x, 0, z, LEAF);   // живая изгородь, столбики по углам и у калитки
  }
}
function path(V, x, z0, z1) { for (let z = z0; z <= z1; z++) { V.set(x, -1, z, 'conc'); V.set(x + 1, -1, z, 'conc2'); } }
function yard(V, o = {}) {                             // дом на участке: забор, дорожка, деревья
  const hb = house(V, o);
  path(V, hb.x0 + 2 + 4 * Math.floor(((o.W || 14) - 4) / 8), hb.z1 + 1, 7);
  fence(V, -10, -8, 10, 7, [hb.x0 + 1 + 4 * Math.floor(((o.W || 14) - 4) / 8), hb.x0 + 4 + 4 * Math.floor(((o.W || 14) - 4) / 8)]);
  tree(V, -8, -6, 3, 2); tree(V, 8, 5, 2, 1); pine(V, 8, -6, 8); tree(V, -9, 5, 2, 1);
  return hb;
}
// многоэтажка с подсвеченной квартирой
const BLK = { W: 8, D: 6, F: 15, x0: -4, z0: -3, fy: 8, fu: 2 };
function flatCells(fn) {                                // 16 кубиков квартиры: 4 × 2 этажа × 2 в глубину
  let n = 0;
  const { x0, z0, D, fy, fu } = BLK, z1 = z0 + D - 1;
  for (let dz = 0; dz < 2; dz++) for (let y = fy; y < fy + 2; y++) for (let x = x0 + fu; x < x0 + fu + 4; x++) fn(x, y, z1 - dz, n++, dz === 0 && (x - x0) % 2 === 1);
}
function block(V, ghost) {
  const { W, D, F, x0, z0 } = BLK, x1 = x0 + W - 1, z1 = z0 + D - 1;
  for (let y = 0; y < F; y++) for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
    const sx = x === x0 || x === x1, sz = z === z0 || z === z1;
    if (!sx && !sz) continue;
    let c = y % 3 === 0 ? 'panel2' : 'panel';
    const u = sz && !sx ? x - x0 : z - z0, n = sz && !sx ? W : D;
    if (!(sx && sz) && u % 2 === 1 && u < n - 1 && y >= 1) c = 'pwin';
    if (z === z1 && !sx && y === 0 && (u === 3 || u === 4)) c = 'door';
    V.set(x, y, z, ghost ? 'ghost' : c);
  }
  V.box(x0, F, z0, x1, F, z1, ghost ? 'ghost' : 'panel2');
}
function asphaltYard(V) {
  ground(V, -12, -9, 13, 9, ASPH);
  for (let x = -12; x <= 13; x++) for (let z = -9; z <= 9; z++) if (x < -7 || z > 5 || x > 9) V.set(x, -1, z, GR);
  tree(V, -10, -6, 3, 2); tree(V, -10, 6, 2, 2); tree(V, 11, 7, 2, 1);
}
function coins(V, x0, z0, h, c) { for (let y = 0; y < h; y++) V.box(x0, y, z0, x0 + 2, y, z0 + 2, c || (y % 2 ? 'gold2' : 'gold')); }
function glyph(V, rows, x0, y0, z0, c, s = 2, t = 2) {   // пиксельный знак стоймя (s — размер пикселя, t — толщина)
  rows.forEach((r, i) => { for (let j = 0; j < r.length; j++) if (r[j] === '#')
    V.box(x0 + j * s, y0 + (rows.length - 1 - i) * s, z0, x0 + j * s + s - 1, y0 + (rows.length - i) * s - 1, z0 + t - 1, c); });
}
const plotGround = (V) => { ground(V, -11, -9, 11, 9); for (let x = -11; x <= 11; x++) { V.set(x, -1, 9, ASPH); V.set(x, -1, 8, ASPH); } return V; };
const utilities = (V) => {                           // столб со светом у дороги и газовая труба вдоль участка
  V.box(-11, 0, 9, -11, 9, 9, 'pole'); V.box(-12, 9, 9, -10, 9, 9, 'wire');
  for (let z = -8; z <= 7; z++) V.set(11, 1, z, 'gas'); for (let z = -8; z <= 7; z += 4) V.set(11, 0, z, 'gas');
};
const blueprint = (V) => V.each((v) => {
  if (v.y < 0) { v.c = (v.x % 4 === 0 || v.z % 4 === 0) ? 'bpl' : 'bpw'; return; }
  const k = Array.isArray(v.c) ? v.c[0] : v.c;
  v.c = k === 'glass' || k === 'door' ? 'bp' : k === 'trim' || k === 'conc' || k.startsWith('roof') ? 'bp2' : 'bpl';
});

const SHAPES = {
  // ---------- trade-in ----------
  t1() { const V = new Vox(); asphaltYard(V); block(V); flatCells((x, y, z, n, w) => V.set(x, y, z, w ? 'acc2' : 'acc', 'f' + n));
    return V.tag(BLK.x0 + BLK.fu + 2, BLK.fy + 2, BLK.z0 + BLK.D - 1, 'Ваша квартира'); },
  t2() { const V = new Vox(); asphaltYard(V); block(V, true);
    V.box(6, 0, -3, 11, 0, 2, 'conc');
    flatCells((x, y, z, n, w) => { const i = n % 4, j = Math.floor(n / 4) % 2, k = Math.floor(n / 8); V.set(7 + i, 1 + j, -1 + k, w ? 'acc2' : 'acc', 'f' + n); });
    return V.tag(9, 3, 0, 'Оценка квартиры'); },
  t3() { const V = new Vox(); plotGround(V); house(V, { rows: 2, roof: false });
    flatCells((x, y, z, n) => V.set(-5 + (n % 8), 1 + Math.floor(n / 8) % 2, 4, 'acc', 'f' + n));
    return V.tag(-1, 3, 4, 'Зачёт квартиры'); },
  t4() { const V = new Vox(); plotGround(V); house(V);
    flatCells((x, y, z, n) => V.set(-5 + (n % 8), 1 + Math.floor(n / 8) % 2, 4, 'acc', 'f' + n));
    return V.tag(0, 9, 0, 'Дом под ключ'); },
  t5() { const V = new Vox(); plotGround(V); yard(V);
    flatCells((x, y, z, n) => V.set(-5 + (n % 8), 1 + Math.floor(n / 8) % 2, 4, SA, 'f' + n));
    return V.tag(0, 9, 0, 'Ваш дом'); },
  // ---------- земля ----------
  l1() { const V = new Vox(); ground(V, -12, -9, 12, 9);
    glyph(V, ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'], -5, 0, -1, 'acc');
    tree(V, -9, -6, 3, 2); pine(V, 9, -6, 7);
    return V; },
  l2() { const V = new Vox(); ground(V, -14, -10, 13, 9);
    const xs = [[-14, -6], [-4, 3], [5, 13]], zs = [[-10, -2], [0, 9]];
    for (let x = -14; x <= 13; x++) for (let z = -10; z <= 9; z++) if (x === -5 || x === 4 || z === -1) V.set(x, -1, z, ASPH);
    xs.forEach((xr, i) => zs.forEach((zr, j) => {
      const mine = i === 2 && j === 1, cx = (xr[0] + xr[1]) >> 1, cz = (zr[0] + zr[1]) >> 1;
      if (mine) { V.ring(xr[0], zr[0], xr[1], zr[1], -1, 'acc'); return; }
      if ((i + j) % 2 === 0) { V.box(cx - 1, 0, cz - 1, cx + 1, 2, cz + 1, SA); V.box(cx - 1, 3, cz - 1, cx + 1, 3, cz + 1, ROOF); }
      else tree(V, cx, cz, 2, 2);
    }));
    V.box(9, 0, 4, 9, 2, 4, 'acc'); V.box(8, 3, 3, 10, 5, 5, 'acc'); V.set(9, 4, 6, 'white');
    return V.tag(9, 6, 4, 'Ваш участок'); },
  l3() { const V = new Vox(); plotGround(V); fence(V, -10, -8, 10, 7, [-2, 1]); utilities(V);
    tree(V, -8, -6, 3, 2); pine(V, 8, -6, 8);
    return V.tag(-11, 10, 9, 'Свет').tag(11, 2, -1, 'Газ').tag(3, 0, 9, 'Подъезд'); },
  l4() { const V = new Vox(); plotGround(V); fence(V, -10, -8, 10, 7, [-2, 1]); utilities(V);
    tree(V, -8, -6, 3, 2); pine(V, 8, -6, 8);
    V.box(-7, 0, -5, 6, 0, 4, 'bpl'); V.ring(-7, -5, 6, 4, 0, 'bp');
    for (const [x, z] of [[-7, -5], [6, -5], [-7, 4], [6, 4]]) V.box(x, 1, z, x, 2, z, 'acc');
    return V.tag(0, 2, 4, 'Пятно дома'); },
  l5() { const V = new Vox(); plotGround(V); utilities(V);
    yard(V);
    return V.tag(0, 9, 0, 'Ваш дом на вашей земле'); },
  // ---------- референсы ----------
  r1() { const V = new Vox(); ground(V, -9, -5, 9, 5, ['conc', 'conc2']);
    V.box(-5, 0, 0, 5, 19, 0, 'phone');
    for (let u = 0; u < 9; u++) for (let v = 0; v < 16; v++) {
      let c = 'sky';
      if (v <= 2) c = GR;
      else if (v <= 8 && u >= 1 && u <= 7) c = (u === 4 && v <= 5) ? 'door' : ((u === 2 || u === 3 || u === 5 || u === 6) && (v === 5 || v === 6)) ? 'glass2' : SA;
      else if (v >= 9 && v <= 12 && Math.abs(u - 4) <= 12 - v) c = ROOF;
      else if (u === 7 && v === 14) c = 'gold';
      V.set(-4 + u, 2 + v, 0, c);
    }
    V.box(-1, 18, 0, 1, 18, 0, 'wire');
    return V.tag(0, 20, 0, 'Фото, которое нравится'); },
  r2() { const V = new Vox(); ground(V, -12, -9, 12, 9); house(V); blueprint(V); return V.tag(0, 9, 0, 'Проект по вашему фото'); },
  r3() { const V = new Vox(); ground(V, -12, -9, 12, 9); house(V, { dW: 2, dR: 5 });
    return V.tag(7, 1, 4, 'Фундамент').tag(7, 8, 4, 'Стены').tag(0, 14, 0, 'Кровля'); },
  r4() { const V = new Vox(); plotGround(V); yard(V); return V.tag(0, 9, 0, 'Как на картинке'); },
  // ---------- ипотека ----------
  i1() { const V = new Vox(); ground(V, -11, -7, 11, 7, ['conc', 'conc2']); coins(V, -7, -1, 2); coins(V, 2, -1, 12, 'ghost');
    for (let y = 0; y < 12; y += 3) V.box(2, y, -1, 4, y, 1, 'acc2');
    return V.tag(-6, 2, 0, 'Накопления').tag(3, 12, 0, 'Первый взнос'); },
  i2() { const V = new Vox(); plotGround(V); house(V, { rows: 2, roof: false }); coins(V, 9, 5, 2);
    return V.tag(0, 3, 0, 'Стройка без взноса'); },
  i3() { const V = new Vox(); plotGround(V); house(V, { roof: false });
    for (let k = 0; k < 12; k++) V.box(-11 + k * 2, 0, 7, -11 + k * 2, 2, 7, k % 2 ? 'gold2' : 'gold');
    return V.tag(0, 3, 7, 'Платёж каждый месяц'); },
  i4() { const V = new Vox(); plotGround(V); yard(V); return V.tag(0, 9, 0, 'Ваш дом'); },
};

// ============================================================
//  ТЕКСТЫ ПРЕЗЕНТАЦИЙ: боль → решение → итог с действием
// ============================================================
const TEL = '<a class="btn" href="tel:+79872779952">Позвонить: +7 987 277-99-52</a>';
const ARROW = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
const PRES = {
  tradein: { title: 'Trade-in · квартира в зачёт дома', slides: [
    { s: 't1', k: 'Знакомо?', h: 'Квартира стала тесной, а&nbsp;продавать её&nbsp;— долго и&nbsp;нервно', p: 'Показы, торг, покупатели, которые пропадают в&nbsp;последний момент. А&nbsp;пока квартира не&nbsp;продана, дом не&nbsp;начать.' },
    { s: 't2', k: 'Шаг 1', h: 'Оцениваем вашу квартиру', p: 'Смотрим квартиру и&nbsp;цены вокруг&nbsp;— и&nbsp;называем сумму, которую засчитаем в&nbsp;стоимость дома.' },
    { s: 't3', k: 'Шаг 2', h: 'Квартира идёт в&nbsp;зачёт дома', p: 'Не&nbsp;нужно сначала продавать, а&nbsp;потом строить: стоимость квартиры становится частью оплаты. Остаток&nbsp;— ипотекой без первоначального взноса.' },
    { s: 't4', k: 'Шаг 3', h: 'Строим кирпичный дом под&nbsp;ключ', p: 'По&nbsp;нашему проекту или по&nbsp;вашим фото: фундамент, стены, кровля, окна.' },
    { s: 't5', k: 'Итог', h: 'Переезжаете в&nbsp;свой дом', p: 'Без поиска покупателя, показов и&nbsp;двух сделок подряд. Позвоните&nbsp;— скажем, сколько стоит ваша квартира в&nbsp;зачёт.',
      cta: TEL + `<a class="link" href="#ipoteka">Рассчитать платёж ${ARROW}</a>` },
  ] },
  land: { title: 'Земля · поможем с участком', slides: [
    { s: 'l1', k: 'Знакомо?', h: 'Хотите свой дом, но&nbsp;нет участка?', p: 'Объявления, межевание, документы, свет и&nbsp;газ&nbsp;— искать землю самому долго, и&nbsp;страшно ошибиться.' },
    { s: 'l2', k: 'Шаг 1', h: 'Подбираем землю под ваш бюджет и&nbsp;проект', p: 'Чтобы дом встал на&nbsp;участок без компромиссов, а&nbsp;до&nbsp;работы и&nbsp;школы было удобно ездить.' },
    { s: 'l3', k: 'Шаг 2', h: 'Помогаем проверить свет, газ и&nbsp;документы', p: 'Смотрим, что можно подключить, как подъедет техника и&nbsp;всё&nbsp;ли в&nbsp;порядке с&nbsp;бумагами&nbsp;— до&nbsp;того, как вы заплатите.' },
    { s: 'l4', k: 'Шаг 3', h: 'Ставим проект на&nbsp;участок', p: 'Разворачиваем дом к&nbsp;солнцу и&nbsp;виду, оставляем место под двор, парковку и&nbsp;баню.' },
    { s: 'l5', k: 'Итог', h: 'Ваш дом&nbsp;— на&nbsp;вашей земле', p: 'Участок, проект и&nbsp;стройка&nbsp;— в&nbsp;одних руках. Позвоните&nbsp;— расскажем, с&nbsp;чего начать.',
      cta: TEL + `<a class="link" href="#proekty">Посмотреть проекты ${ARROW}</a>` },
  ] },
  refs: { title: 'Референсы · дом по вашим фото', slides: [
    { s: 'r1', k: 'Знакомо?', h: 'Нашли дом мечты на&nbsp;фото, но&nbsp;не&nbsp;знаете, кто так построит?', p: 'Картинка из&nbsp;интернета, дом друзей, кадр из&nbsp;фильма&nbsp;— обычно на&nbsp;этом мечта и&nbsp;заканчивается.' },
    { s: 'r2', k: 'Шаг 1', h: 'Пришлите фото&nbsp;— сделаем проект', p: 'Переносим дом с&nbsp;картинки в&nbsp;чертежи под ваш участок, семью и&nbsp;бюджет.' },
    { s: 'r3', k: 'Шаг 2', h: 'Считаем всё до&nbsp;кирпича', p: 'Фундамент, стены, кровля&nbsp;— вы заранее знаете, из&nbsp;чего состоит дом и&nbsp;сколько он стоит.' },
    { s: 'r4', k: 'Итог', h: 'Строим&nbsp;— как на&nbsp;картинке', p: 'Из&nbsp;кирпича и&nbsp;блоков, под ключ. Пришлите фото&nbsp;— обсудим ваш дом.',
      cta: TEL + `<a class="link" href="#proekty">Наши проекты ${ARROW}</a>` },
  ] },
  ipoteka: { title: 'Ипотека · без первоначального взноса', slides: [
    { s: 'i1', k: 'Знакомо?', h: 'Копите на&nbsp;первый взнос, а&nbsp;цены растут быстрее?', p: 'Пока откладываете, дом дорожает, а&nbsp;аренда или тесная квартира съедают годы.' },
    { s: 'i2', k: 'Решение', h: 'Ипотека без первоначального взноса', p: 'Подбираем программу, где первый взнос не&nbsp;нужен, и&nbsp;помогаем пройти одобрение. Поручитель на&nbsp;время стройки не&nbsp;нужен.' },
    { s: 'i3', k: 'Платёж', h: 'Платёж понятен заранее', p: 'Цена дома и&nbsp;срок&nbsp;— и&nbsp;сразу видно, сколько платить в&nbsp;месяц. Посчитать можно прямо на&nbsp;сайте.' },
    { s: 'i4', k: 'Итог', h: 'Живёте в&nbsp;своём доме, а&nbsp;не&nbsp;копите на&nbsp;него', p: 'Рассчитайте платёж или позвоните&nbsp;— подберём программу под вас.',
      cta: `<a class="btn" href="#ipoteka">Рассчитать платёж</a><a class="link" href="tel:+79872779952">+7 987 277-99-52 ${ARROW}</a>` },
  ] },
};

// ============================================================
//  3D: кубики с фаской, перелёт по дуге, кадр под свободную часть экрана
// ============================================================
function chamferBox(THREE, c) {
  const h = 0.5, i = h - c, polys = [];
  for (let a = 0; a < 3; a++) for (const s of [-1, 1]) {
    const b = (a + 1) % 3, d = (a + 2) % 3, n = [0, 0, 0]; n[a] = s;
    polys.push([[[-i, -i], [i, -i], [i, i], [-i, i]].map(([u, v]) => { const p = [0, 0, 0]; p[a] = s * h; p[b] = u; p[d] = v; return p; }), n]);
  }
  for (let a = 0; a < 3; a++) {
    const b = (a + 1) % 3, d = (a + 2) % 3;
    for (const sa of [-1, 1]) for (const sb of [-1, 1]) {
      const n = [0, 0, 0]; n[a] = sa; n[b] = sb; const pts = [];
      for (const [pa, pb] of [[h, i], [i, h]]) for (const sd of [-1, 1]) { const p = [0, 0, 0]; p[a] = sa * pa; p[b] = sb * pb; p[d] = sd * i; pts.push(p); }
      polys.push([pts, n]);
    }
  }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const s = [sx, sy, sz], pts = [];
    for (let a = 0; a < 3; a++) { const p = [s[0] * i, s[1] * i, s[2] * i]; p[a] = s[a] * h; pts.push(p); }
    polys.push([pts, s]);
  }
  const pos = [], nor = [];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  for (const [pts, n0] of polys) {
    const l = Math.hypot(...n0), n = n0.map((v) => v / l);
    const cen = [0, 1, 2].map((k) => pts.reduce((s, p) => s + p[k], 0) / pts.length);
    const t = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], nt = dot(n, t);
    let u = [t[0] - n[0] * nt, t[1] - n[1] * nt, t[2] - n[2] * nt]; const ul = Math.hypot(...u); u = u.map((v) => v / ul);
    const w = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
    const ang = (p) => { const q = [p[0] - cen[0], p[1] - cen[1], p[2] - cen[2]]; return Math.atan2(dot(q, w), dot(q, u)); };
    pts.sort((a, b) => ang(a) - ang(b));
    for (let k = 1; k < pts.length - 1; k++) for (const p of [pts[0], pts[k], pts[k + 1]]) { pos.push(...p); nor.push(...n); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

function makeEngine(THREE, canvas) {
  const N = 2600;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(24, 1, 1, 500);
  scene.add(new THREE.HemisphereLight(0xfffaf1, 0xcbc2b4, 1.25));
  const sun = new THREE.DirectionalLight(0xfff0dc, 1.75);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 120 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.radius = 7; sun.shadow.blurSamples = 16; sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ color: 0x3b3227, opacity: 0.2 }));
  floor.position.y = -2; floor.receiveShadow = true; scene.add(floor);

  const mesh = new THREE.InstancedMesh(chamferBox(THREE, 0.1), new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0 }), N);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false;
  scene.add(mesh);
  const MA = mesh.instanceMatrix.array, CA = mesh.instanceColor.array;

  const COL = {};
  for (const k in PAL) { const c = new THREE.Color(PAL[k]).convertSRGBToLinear(); COL[k] = [c.r, c.g, c.b]; }

  // состояние кубиков: F — откуда, T — куда, C — сейчас (x, y, z, масштаб, r, g, b)
  const F = new Float32Array(N * 7), T = new Float32Array(N * 7), C = new Float32Array(N * 7);
  const DEL = new Float32Array(N), DUR = new Float32Array(N).fill(1), ARC = new Float32Array(N), SPN = new Float32Array(N), KIND = new Uint8Array(N);
  const IDS = new Array(N).fill(null);
  let t0 = 0, tEnd = -1, dirty = true;
  const clock = () => performance.now() / 1000;
  const eio = (e) => (e < 0.5 ? 4 * e * e * e : 1 - Math.pow(-2 * e + 2, 3) / 2);

  function evalAt(i, now) {
    const o = i * 7, e = Math.min(1, Math.max(0, (now - t0 - DEL[i]) / DUR[i])), k = KIND[i];
    const ep = k === 1 ? e * e : eio(e);
    for (let j = 0; j < 7; j++) C[o + j] = F[o + j] + (T[o + j] - F[o + j]) * ep;
    if (k === 1) C[o + 3] = T[o + 3] * Math.min(1, e * 3);
    else if (k === 2) C[o + 3] = F[o + 3] * (1 - e * e);
    C[o + 1] += ARC[i] * Math.sin(Math.PI * ep);
    return SPN[i] * (1 - ep);
  }
  function write(i, a) {
    const o = i * 7, m = i * 16, s = C[o + 3], c = Math.cos(a) * s, sn = Math.sin(a) * s;
    MA[m] = c; MA[m + 1] = 0; MA[m + 2] = -sn; MA[m + 3] = 0;
    MA[m + 4] = 0; MA[m + 5] = s; MA[m + 6] = 0; MA[m + 7] = 0;
    MA[m + 8] = sn; MA[m + 9] = 0; MA[m + 10] = c; MA[m + 11] = 0;
    MA[m + 12] = C[o]; MA[m + 13] = C[o + 1]; MA[m + 14] = C[o + 2]; MA[m + 15] = 1;
    CA[i * 3] = C[o + 4]; CA[i * 3 + 1] = C[o + 5]; CA[i * 3 + 2] = C[o + 6];
  }

  function resolve(V) {
    const out = [];
    V.each((v) => {
      const key = Array.isArray(v.c) ? v.c[Math.floor(hash(v.x, v.y, v.z) * v.c.length)] : v.c;
      const base = COL[key] || COL.conc;
      let ao = 1;
      if (v.y >= 0) {
        const up = (V.has(v.x, v.y + 1, v.z) ? 2 : 0) + (V.has(v.x + 1, v.y + 1, v.z) ? 1 : 0) + (V.has(v.x - 1, v.y + 1, v.z) ? 1 : 0) + (V.has(v.x, v.y + 1, v.z + 1) ? 1 : 0) + (V.has(v.x, v.y + 1, v.z - 1) ? 1 : 0);
        ao = Math.max(0.62, 1 - 0.06 * up);
      }
      const j = (0.93 + 0.12 * hash(v.x + 11, v.y - 7, v.z + 3)) * ao;
      out.push({ x: v.x, y: v.y + 0.5, z: v.z, r: base[0] * j, g: base[1] * j, b: base[2] * j, id: v.id || null });
    });
    out.sort((a, b) => a.y - b.y || a.x - b.x || a.z - b.z);
    if (out.length > N) { console.warn('[БАЙДОМ] презентация: кубиков больше, чем', N); out.length = N; }
    return out;
  }

  const view = { cx: 0, cy: 3, cz: 0, R: 18 }, aim = { cx: 0, cy: 3, cz: 0, R: 18 };
  let fresh = true;
  function goTo(V) {
    const now = clock();
    for (let i = 0; i < N; i++) { evalAt(i, now); }
    F.set(C);
    const L = resolve(V), used = new Uint8Array(N), asg = new Int32Array(L.length).fill(-1);
    const byId = new Map();
    for (let i = 0; i < N; i++) if (IDS[i] && C[i * 7 + 3] > 0.01) byId.set(IDS[i], i);
    L.forEach((v, k) => { if (v.id && byId.has(v.id)) { const i = byId.get(v.id); asg[k] = i; used[i] = 1; } });
    const act = [];
    for (let i = 0; i < N; i++) if (!used[i] && C[i * 7 + 3] > 0.01) act.push(i);
    act.sort((a, b) => Math.round(C[a * 7 + 1] * 2) - Math.round(C[b * 7 + 1] * 2) || C[a * 7] - C[b * 7] || C[a * 7 + 2] - C[b * 7 + 2]);
    let ai = 0;
    const free = [];
    for (let i = 0; i < N; i++) if (!used[i] && C[i * 7 + 3] <= 0.01) free.push(i);
    let fi = 0;
    let ymin = Infinity, ymax = -Infinity, x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const v of L) { ymin = Math.min(ymin, v.y); ymax = Math.max(ymax, v.y); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z); }
    const span = Math.max(1, ymax - ymin);
    tEnd = now;
    L.forEach((v, k) => {
      let i = asg[k], spawn = false;
      if (i < 0) { if (ai < act.length) i = act[ai++]; else { i = free[fi++]; spawn = true; } }
      if (i == null) return;
      used[i] = 2; IDS[i] = v.id;
      const o = i * 7;
      T[o] = v.x; T[o + 1] = v.y; T[o + 2] = v.z; T[o + 3] = 1; T[o + 4] = v.r; T[o + 5] = v.g; T[o + 6] = v.b;
      if (spawn) {
        F[o] = v.x; F[o + 1] = v.y + (fresh ? 9 : 14) + Math.random() * 8; F[o + 2] = v.z; F[o + 3] = 0; F[o + 4] = v.r; F[o + 5] = v.g; F[o + 6] = v.b;
        KIND[i] = 1; ARC[i] = 0; SPN[i] = 0; DUR[i] = 0.75 + Math.random() * 0.25;
      } else {
        KIND[i] = 0;
        const d = Math.hypot(T[o] - F[o], T[o + 1] - F[o + 1], T[o + 2] - F[o + 2]);
        ARC[i] = d < 0.05 ? 0 : Math.min(6, 0.8 + d * 0.22);
        SPN[i] = d < 0.05 ? 0 : (Math.random() < 0.5 ? -1 : 1) * Math.PI / 2;
        DUR[i] = 0.95 + Math.random() * 0.35;
      }
      DEL[i] = 0.8 * (v.y - ymin) / span + 0.22 * Math.random();
      tEnd = Math.max(tEnd, now + DEL[i] + DUR[i]);
    });
    for (let i = 0; i < N; i++) {
      if (used[i] === 2) continue;
      const o = i * 7;
      if (F[o + 3] <= 0.01) { T.set(F.subarray(o, o + 7), o); T[o + 3] = 0; KIND[i] = 0; ARC[i] = 0; SPN[i] = 0; DEL[i] = 0; continue; }
      T.set(F.subarray(o, o + 7), o); T[o + 1] -= 0.4; T[o + 3] = 0; IDS[i] = null;
      KIND[i] = 2; ARC[i] = 0; SPN[i] = 0; DEL[i] = 0.3 * Math.random(); DUR[i] = 0.55;
      tEnd = Math.max(tEnd, now + DEL[i] + DUR[i]);
    }
    t0 = now; dirty = true; fresh = false;
    aim.cx = (x0 + x1) / 2; aim.cz = (z0 + z1) / 2; aim.cy = (ymin + ymax) / 2 - 0.5;
    aim.R = 0.5 * Math.hypot(x1 - x0 + 1, ymax - ymin + 1, z1 - z0 + 1);
    return tEnd - now;
  }
  function reset() {
    for (let i = 0; i < N; i++) { const o = i * 7; C[o + 3] = F[o + 3] = T[o + 3] = 0; IDS[i] = null; KIND[i] = 0; ARC[i] = SPN[i] = DEL[i] = 0; }
    t0 = clock(); tEnd = t0; dirty = true; fresh = true;
  }
  reset();

  let W = 1, H = 1, reg = { cx: 0.6, cy: 0.5, size: 0.7 }, mx = 0, my = 0, tmx = 0, tmy = 0, last = 0, snapView = true;
  function resize(w, h, r) {
    W = w; H = h; reg = r;
    renderer.setSize(W, H, false);
    cam.aspect = W / H; cam.updateProjectionMatrix();
  }
  function pointer(x, y) { tmx = x; tmy = y; }
  const v3 = new THREE.Vector3();
  function project(x, y, z) { v3.set(x, y, z).project(cam); return [(v3.x + 1) / 2 * W, (1 - v3.y) / 2 * H, v3.z < 1]; }
  function frame() {
    const now = clock(), dt = Math.min(0.1, last ? now - last : 0.016); last = now;
    if (dirty || now <= tEnd + 0.05) {
      for (let i = 0; i < N; i++) write(i, evalAt(i, now));
      mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
      dirty = now <= tEnd + 0.05;
    }
    const k = snapView ? 1 : 1 - Math.exp(-dt * 2.2);
    snapView = false;
    for (const key of ['cx', 'cy', 'cz', 'R']) view[key] += (aim[key] - view[key]) * k;
    mx += (tmx - mx) * (1 - Math.exp(-dt * 3)); my += (tmy - my) * (1 - Math.exp(-dt * 3));
    const az = THREE.MathUtils.degToRad(38 + Math.sin(now * 0.22) * 5 + mx * 5), el = THREE.MathUtils.degToRad(27 - my * 3);
    const fov = THREE.MathUtils.degToRad(cam.fov), half = Math.atan(Math.tan(fov / 2) * reg.size);
    const d = view.R * 0.8 / Math.sin(half);
    cam.position.set(view.cx + d * Math.cos(el) * Math.sin(az), view.cy + d * Math.sin(el), view.cz + d * Math.cos(el) * Math.cos(az));
    cam.lookAt(view.cx, view.cy, view.cz);
    cam.setViewOffset(W, H, W / 2 - reg.cx * W, H / 2 - reg.cy * H, W, H);
    sun.position.set(view.cx - 12, view.cy + 30, view.cz + 17); sun.target.position.set(view.cx, view.cy, view.cz);
    renderer.render(scene, cam);
  }
  return { goTo, reset, resize, frame, pointer, project, snap() { snapView = true; }, dispose() { renderer.dispose(); } };
}

// ============================================================
//  ОКНО ПРЕЗЕНТАЦИИ
// ============================================================
let el = null, eng = null, cur = null, idx = 0, raf = 0, opened = false, lastFocus = null, tags = [], tagsAt = 0;
const SHAPE_CACHE = {};
const shape = (k) => SHAPE_CACHE[k] || (SHAPE_CACHE[k] = SHAPES[k]());

function buildDOM() {
  el = document.createElement('div');
  el.className = 'pz'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<canvas class="pz-gl" aria-hidden="true"></canvas>
  <div class="pz-tags" aria-hidden="true"></div>
  <i class="pz-bar" aria-hidden="true"><b></b></i>
  <header class="pz-top"><p class="mono pz-title"></p>
    <button class="pz-x" type="button" aria-label="Закрыть презентацию"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3 3 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button></header>
  <div class="pz-text" aria-live="polite"></div>
  <nav class="pz-nav" aria-label="Слайды">
    <button class="pz-arr pz-prev" type="button" aria-label="Предыдущий слайд"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13V3M4 7l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button>
    <ol class="pz-dots"></ol>
    <button class="pz-arr pz-next" type="button" aria-label="Следующий слайд"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M4 9l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button>
  </nav>
  <p class="pz-hint mono"><i aria-hidden="true"></i><span>Крутите колесо мыши</span></p>`;
  document.body.appendChild(el);
  el.querySelector('.pz-x').addEventListener('click', close);
  el.querySelector('.pz-prev').addEventListener('click', () => go(idx - 1));
  el.querySelector('.pz-next').addEventListener('click', () => go(idx + 1));
  el.querySelector('.pz-dots').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) go(+b.dataset.i); });
  el.addEventListener('click', (e) => { const a = e.target.closest('a[href^="#"]'); if (a) close(); });
  if (matchMedia('(pointer:coarse)').matches) el.querySelector('.pz-hint span').textContent = 'Листайте вверх';

  // колесо: один жест — один слайд (инерция тачпада не перелистывает дальше)
  let acc = 0, lockUntil = 0, lastW = 0;
  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    const now = performance.now(), dy = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaMode === 2 ? e.deltaY * 600 : e.deltaY;
    if (now < lockUntil) { if (lockUntil - now < 160) lockUntil = now + 160; return; }
    if (now - lastW > 260) acc = 0;
    lastW = now; acc += dy;
    if (Math.abs(acc) >= 36) { go(idx + Math.sign(acc)); acc = 0; lockUntil = now + 850; }
  }, { passive: false });
  let ty = null, tx = null;
  el.addEventListener('touchstart', (e) => { if (e.touches.length === 1) { ty = e.touches[0].clientY; tx = e.touches[0].clientX; } }, { passive: true });
  el.addEventListener('touchmove', (e) => { if (!e.target.closest('a,button')) e.preventDefault(); }, { passive: false });
  el.addEventListener('touchend', (e) => {
    if (ty == null) return;
    const t = e.changedTouches[0], dy = ty - t.clientY, dx = tx - t.clientX; ty = null;
    if (Math.abs(dy) > 44 && Math.abs(dy) > Math.abs(dx)) go(idx + Math.sign(dy));
    else if (Math.abs(dx) > 60) go(idx + Math.sign(dx));
  });
  el.addEventListener('pointermove', (e) => { if (eng) eng.pointer(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1); });
  addEventListener('resize', () => { if (opened) layout(); });
  addEventListener('keydown', (e) => {
    if (!opened) return;
    if (e.key === 'Escape') { close(); return; }
    if (['ArrowDown', 'PageDown', 'ArrowRight', ' '].includes(e.key) && !e.target.closest('a,button')) { e.preventDefault(); go(idx + 1); }
    else if (['ArrowDown', 'PageDown'].includes(e.key)) { e.preventDefault(); go(idx + 1); }
    else if (['ArrowUp', 'PageUp', 'ArrowLeft'].includes(e.key)) { e.preventDefault(); go(idx - 1); }
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(cur.slides.length - 1);
    else if (e.key === 'Tab') {                         // фокус не уходит из окна
      const f = Array.from(el.querySelectorAll('button:not(:disabled),a[href]')).filter((n) => n.offsetParent && !n.closest('.pz-s:not(.on)'));
      if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });
}

// свободная от текста часть экрана — туда вписываем 3D
function layout() {
  const W = innerWidth, H = innerHeight, mob = W <= 760;
  let r;
  if (mob) {
    const on = el.querySelector('.pz-s.on'), top = on ? on.getBoundingClientRect().top : H * 0.55;
    const y0 = 64, y1 = Math.max(y0 + 160, top - 8);
    r = { cx: 0.5, cy: (y0 + y1) / 2 / H, size: Math.min((y1 - y0) / H, 0.92 * W / H) };
  } else {
    const tx = el.querySelector('.pz-text').getBoundingClientRect(), nav = el.querySelector('.pz-nav').getBoundingClientRect();
    const x0 = tx.right + 24, x1 = nav.left - 16, y0 = 70, y1 = H - 40;
    r = { cx: (x0 + x1) / 2 / W, cy: (y0 + y1) / 2 / H, size: Math.min((y1 - y0) / H, (x1 - x0) / H) * 0.98 };
  }
  if (eng) eng.resize(W, H, r);
}

function renderTags(now) {
  const show = now > tagsAt;
  for (const t of tags) {
    const [x, y, ok] = eng.project(t.x, t.y + 0.9, t.z);
    t.el.style.transform = `translate(${x.toFixed(1)}px,${(y - 18).toFixed(1)}px) translate(-50%,-100%)`;
    t.el.classList.toggle('on', show && ok);
  }
}
function loop() {
  raf = requestAnimationFrame(loop);
  if (!eng) return;
  eng.frame();
  renderTags(performance.now());
}

function go(i) {
  if (!cur) return;
  i = Math.max(0, Math.min(cur.slides.length - 1, i));
  if (i === idx && el.querySelector('.pz-s.on')) return;
  if (i !== idx) el.classList.add('moved');
  idx = i;
  el.querySelectorAll('.pz-s').forEach((s, k) => { s.classList.toggle('on', k === i); s.classList.toggle('up', k < i); s.setAttribute('aria-hidden', String(k !== i)); });
  el.querySelectorAll('.pz-dots button').forEach((b, k) => { b.classList.toggle('on', k === i); b.setAttribute('aria-current', k === i ? 'step' : 'false'); });
  el.querySelector('.pz-prev').disabled = i === 0;
  el.querySelector('.pz-next').disabled = i === cur.slides.length - 1;
  el.querySelector('.pz-bar b').style.setProperty('--p', ((i + 1) / cur.slides.length).toFixed(3));
  if (innerWidth <= 760) layout();
  const layer = el.querySelector('.pz-tags');
  tags.forEach((t) => { t.el.classList.remove('on'); setTimeout(() => t.el.remove(), 500); });
  tags = [];
  if (eng) {
    const V = shape(cur.slides[i].s), dur = eng.goTo(V);
    tagsAt = performance.now() + Math.max(600, dur * 1000 - 250);
    tags = V.tags.map((t) => { const s = document.createElement('span'); s.className = 'pz-tag'; s.textContent = t.t; layer.appendChild(s); return { ...t, el: s }; });
  }
}

function open(key, ox, oy) {
  const P = PRES[key];
  if (!P) return;
  if (!el) buildDOM();
  cur = P; idx = 0;
  if (!eng && window.THREE) {
    try { eng = makeEngine(window.THREE, el.querySelector('.pz-gl')); }
    catch (err) { console.error('[БАЙДОМ] 3D презентации не запустилось:', err); eng = null; }
  }
  el.classList.toggle('no3d', !eng);
  el.querySelector('.pz-title').textContent = P.title;
  el.setAttribute('aria-label', P.title);
  el.querySelector('.pz-text').innerHTML = P.slides.map((s, k) => `<div class="pz-s" aria-hidden="true">
      <p class="mono pz-k">${String(k + 1).padStart(2, '0')} / ${String(P.slides.length).padStart(2, '0')} · ${s.k}</p>
      <h2>${s.h}</h2><p class="pz-p">${s.p}</p>${s.cta ? `<div class="pz-cta">${s.cta}</div>` : ''}</div>`).join('');
  el.querySelector('.pz-dots').innerHTML = P.slides.map((s, k) => `<li><button type="button" data-i="${k}" aria-label="Слайд ${k + 1}"></button></li>`).join('');
  el.classList.remove('moved');
  el.style.setProperty('--ox', (ox != null ? ox : innerWidth / 2) + 'px');
  el.style.setProperty('--oy', (oy != null ? oy : innerHeight / 2) + 'px');
  lastFocus = document.activeElement;
  opened = true;
  html.classList.add('pz-open');
  el.setAttribute('aria-hidden', 'false');
  void el.offsetWidth;
  el.classList.add('open');
  if (eng) { eng.reset(); eng.snap(); }
  layout();
  if (!raf) raf = requestAnimationFrame(loop);
  setTimeout(() => { if (opened && cur === P) { el.querySelectorAll('.pz-s').forEach((s) => s.classList.remove('on')); idx = 0; go(0); if (eng) eng.snap(); } }, 260);
  el.querySelector('.pz-x').focus({ preventScroll: true });
}
function close() {
  if (!opened) return;
  opened = false;
  el.classList.remove('open');
  el.setAttribute('aria-hidden', 'true');
  html.classList.remove('pz-open');
  setTimeout(() => { if (!opened && raf) { cancelAnimationFrame(raf); raf = 0; } }, 900);
  if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
}

// карточки условий и кнопки с data-pres
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-pres]');
  if (!t || e.target.closest('a') || (el && el.contains(t))) return;
  e.preventDefault();
  open(t.dataset.pres, e.clientX || innerWidth / 2, e.clientY || innerHeight / 2);
});
document.addEventListener('keydown', (e) => {
  const t = e.target.closest && e.target.closest('.perk[data-pres]');
  if (t && e.target === t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); const r = t.getBoundingClientRect(); open(t.dataset.pres, r.left + r.width / 2, r.top + r.height / 2); }
});
window.BDPres = { open, close, go: (i) => go(i) };
})();
