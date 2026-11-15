/* БАЙДОМ — Liquid Glass. Для каждой стеклянной панели строится карта смещения по форме скруглённого
   прямоугольника: у краёв фон «затекает» внутрь, как в толстой линзе. Работает в Chromium через
   backdrop-filter: url(#filter); в остальных браузерах остаётся обычное матовое стекло из CSS. */
(() => {
'use strict';
const NS = 'http://www.w3.org/2000/svg';
const CHROMIUM = !!window.chrome && /Chrome\//.test(navigator.userAgent);
let defs = document.getElementById('lg-defs');
function ensureDefs() {
  if (defs) return defs;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  defs = document.createElementNS(NS, 'defs'); defs.id = 'lg-defs';
  svg.appendChild(defs); document.body.prepend(svg);
  return defs;
}
function lensMap(w, h, r, bevel) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d'), img = g.createImageData(w, h), d = img.data;
  const hw = w / 2, hh = h / 2;
  const sd = (x, y) => { const qx = Math.abs(x) - hw + r, qy = Math.abs(y) - hh + r; return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const px = x + 0.5 - hw, py = y + 0.5 - hh, s = sd(px, py), i = (y * w + x) * 4;
    let ox = 0, oy = 0;
    if (s < 0 && -s < bevel) {
      const t = 1 - (-s) / bevel, m = t * t * (3 - 2 * t);
      let nx = sd(px + 1, py) - sd(px - 1, py), ny = sd(px, py + 1) - sd(px, py - 1);
      const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      ox = -nx * m; oy = -ny * m;
    }
    d[i] = 128 + ox * 127; d[i + 1] = 128 + oy * 127; d[i + 2] = 128; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return cv.toDataURL();
}
let n = 0;
// el — панель, scale — сила преломления в px, post — что добавить после линзы (матовость, насыщенность)
function apply(el, scale, post = 'blur(3px) saturate(1.9) brightness(1.04)') {
  if (!CHROMIUM || !el) return;
  const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
  if (!w || !h) return;
  const key = `${w}x${h}`;
  if (el.dataset.lgKey === key) return;            // размер не менялся — карта та же
  el.dataset.lgKey = key;
  const id = el.dataset.lg || ('lg' + (++n));
  el.dataset.lg = id;
  const r = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 20, h / 2, w / 2);
  const root = ensureDefs();
  let f = root.querySelector('#' + id);
  if (!f) { f = document.createElementNS(NS, 'filter'); f.id = id; root.appendChild(f); }
  f.setAttribute('x', '0'); f.setAttribute('y', '0'); f.setAttribute('width', '100%'); f.setAttribute('height', '100%');
  f.setAttribute('color-interpolation-filters', 'sRGB');
  f.innerHTML = `<feImage href="${lensMap(w, h, r, Math.min(22, h / 2.4))}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="m"/>`
    + `<feDisplacementMap in="SourceGraphic" in2="m" scale="${scale}" xChannelSelector="R" yChannelSelector="G"/>`;
  const v = `url(#${id}) ${post}`;
  el.style.backdropFilter = v; el.style.webkitBackdropFilter = v;
}
// список [элемент, сила, post?] — применить после загрузки шрифтов и обновлять при смене размера
function watch(list) {
  list = list.filter((x) => x[0]);
  const run = () => list.forEach(([el, s, p]) => apply(el, s, p));
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(run);
  if (window.ResizeObserver) { const ro = new ResizeObserver(run); list.forEach(([el]) => ro.observe(el)); }
  else addEventListener('resize', run);
}
window.BDGlass = { apply, watch, supported: CHROMIUM };
})();
