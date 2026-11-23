/* БАЙДОМ — блок «Ипотека».
   Телефон с калькулятором в стиле Liquid Glass (HTML: стекло с преломлением через SVG-фильтр в Chromium)
   и 3D-натюрморт: кирпичный домик на листе с планировкой, связка ключей, карандаш.
   Калькулятор работает и без 3D; сцена собирается, когда блок подходит к экрану. */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const sec = $('#ipoteka');
if (!sec) return;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
// «Уменьшить движение» не учитываем: в Windows оно включается вместе с отключёнными анимациями системы,
// и посетитель видел бы сайт без интро и плавности. Сайт держится на анимации.
const REDUCED = false;
const DBG = /[?&]ipdbg/.test(location.search);
const rng = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// ============================================================
//  КАЛЬКУЛЯТОР
// ============================================================
// Цена за м² под ключ с коммуникациями. Черновая — «от 30 тыс. за кв. м» из ролика компании,
// предчистовая и чистовая — из карточки на Яндекс Картах. Перед запуском сайта уточнить у заказчика.
const PRICE = [30000, 45000, 57000];
const FIN = ['черновая', 'предчистовая', 'чистовая'];
const st = { area: 101, fin: 2, down: 0, years: 20, rate: 6 };
const tgt = { price: 0, month: 0 }, shown = { price: 0, month: 0 };
const yearsWord = (n) => { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? 'год' : (a >= 2 && a <= 4 && (b < 12 || b > 14) ? 'года' : 'лет'); };
const pct = (v) => `${String(v).replace('.', ',')} %`;
const LABEL = { area: (v) => `${v} м²`, down: (v) => `${v} %`, years: (v) => `${v} ${yearsWord(v)}`, rate: pct };
const chips = { term: $('#c-term'), rate: $('#c-rate'), fin: $('#c-fin') };
function compute() {
  tgt.price = st.area * PRICE[st.fin];
  const credit = tgt.price * (1 - st.down / 100), r = st.rate / 1200, n = st.years * 12;
  tgt.month = r > 0 ? credit * r / (1 - Math.pow(1 + r, -n)) : credit / n;
  chips.term.textContent = LABEL.years(st.years);
  chips.rate.textContent = pct(st.rate);
  chips.fin.textContent = FIN[st.fin];
}
let api = null;
for (const k of ['area', 'down', 'years', 'rate']) {
  const inp = $('#i-' + k), out = $('#o-' + k);
  const upd = (ev) => {
    st[k] = parseFloat(inp.value);
    out.textContent = LABEL[k](st[k]);
    inp.style.setProperty('--fill', ((inp.value - inp.min) / (inp.max - inp.min) * 100).toFixed(1) + '%');
    compute();
    if (api && ev) api.changed(k);
  };
  inp.addEventListener('input', upd);
  upd();
}
const seg = $('.lg-seg'), finBtns = $$('[data-fin]', sec);
finBtns.forEach((b) => b.addEventListener('click', () => {
  st.fin = +b.dataset.fin;
  finBtns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  seg.style.setProperty('--i', st.fin);
  compute();
  if (api) api.changed('fin');
}));
compute();

// Liquid Glass (js/glass.js): у каждой стеклянной панели своя карта смещения — края работают как линза
if (window.BDGlass) BDGlass.watch([[$('.ph-display'), 46], [$('.ph-controls'), 40], [$('.ph-cta'), 30], [seg, 24]]);

// часы в статус-баре показывают текущее время посетителя
const clock = $('#ph-time');
const tick = () => { const d = new Date(); clock.textContent = d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'); };
tick(); setInterval(tick, 5000);

// телефон чуть поворачивается за курсором
const stage = $('.ip-stage'), phone = $('#phone');
stage.addEventListener('pointermove', (e) => {
  if (innerWidth <= 900) return;
  const r = stage.getBoundingClientRect();
  const px = ((e.clientX - r.left) / r.width - 0.5) * 2, py = ((e.clientY - r.top) / r.height - 0.5) * 2;
  phone.style.setProperty('--ry', (-10 + px * 7).toFixed(2) + 'deg');
  phone.style.setProperty('--rx', (3 - py * 5).toFixed(2) + 'deg');
});
stage.addEventListener('pointerleave', () => { phone.style.removeProperty('--ry'); phone.style.removeProperty('--rx'); });

// ---------- числа плавно докручиваются ----------
const rPrice = $('#r-price'), rMonth = $('#r-month');
let visible = false, raf = 0, last = performance.now(), lp = -1, lm = -1;
function loop(now) {
  raf = visible ? requestAnimationFrame(loop) : 0;
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (document.documentElement.classList.contains('pz-open')) return;   // под презентацией не рисуем
  const k = REDUCED ? 1 : 1 - Math.exp(-dt * 5);
  shown.price = lerp(shown.price, tgt.price, k); shown.month = lerp(shown.month, tgt.month, k);
  if (Math.abs(shown.price - tgt.price) < 5) shown.price = tgt.price;
  if (Math.abs(shown.month - tgt.month) < 1) shown.month = tgt.month;
  const P = Math.round(shown.price / 100) * 100, M = Math.round(shown.month);
  if (P !== lp) { rPrice.textContent = fmt(P) + ' ₽'; lp = P; }
  if (M !== lm) { rMonth.textContent = fmt(M) + ' ₽'; lm = M; }
  if (api) api.frame(now, dt);
}
new IntersectionObserver(([e]) => {
  visible = e.isIntersecting;
  if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
  if (visible && !api && window.THREE) {
    try { api = build(window.THREE); } catch (err) { console.error('[БАЙДОМ] 3D ипотеки не запустилось:', err); sec.classList.add('no3d'); }
  }
}, { rootMargin: '250px 0px' }).observe(sec);
if (DBG) window.__ipBuild = () => { if (!api) api = build(window.THREE); return !!api; };

// ============================================================
//  3D-НАТЮРМОРТ
// ============================================================
function build(THREE) {
  const canvas = $('#ip-gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;      // фильтрация своя — PCSS, см. ниже
  renderer.setClearColor(0x000000, 0);
  const V3 = THREE.Vector3;
  const lin = (h) => new THREE.Color(h).convertSRGBToLinear();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.05, 80);
  const ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const R = rng(2026);

  // ---------- свет и окружение (для отражений металла) ----------
  const hemi = new THREE.HemisphereLight(lin('#f5f2ec'), lin('#a8988a'), 0.75);   // заливка от «неба» — тени светлые, как в студии
  scene.add(hemi);
  // Ключевой свет высоко слева-спереди (~60°): тени короткие, как от большого окна/софтбокса над столом.
  const sun = new THREE.DirectionalLight(lin('#fff2e0'), 1.4);
  sun.position.set(-2.2, 6.2, 2.8); sun.castShadow = true;
  const SHC = { half: 2.5, near: 3, far: 11, tanA: 0.34 };   // рамка теневой камеры и угловой размер источника (большой софтбокс)
  Object.assign(sun.shadow.camera, { left: -SHC.half, right: SHC.half, top: SHC.half, bottom: -SHC.half, near: SHC.near, far: SHC.far });
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.00025; sun.shadow.normalBias = 0.004;
  scene.add(sun);

  // ---------- мягкие тени PCSS (percentage-closer soft shadows) ----------
  // Как у настоящего протяжённого источника: у самого основания тень резкая, чем дальше заслонитель
  // от поверхности — тем шире полутень (у поднятой крыши — широкая и прозрачная).
  // 1) ищем заслонители вокруг точки и их среднюю глубину; 2) ширина полутени ∝ разнице глубин;
  // 3) фильтруем карту теней диском такого радиуса. Диск Фогеля, поворот — шум по пикселю (без полос).
  const PCSS_U = {
    uPcssSearch: { value: 0.055 },                                              // радиус поиска, доля карты
    uPcssScale: { value: (SHC.far - SHC.near) * SHC.tanA / (2 * SHC.half) },   // разница глубин → полутень
  };
  const PCSS_GLSL = `
    #define PCSS_BLOCKERS 20
    #define PCSS_TAPS 36
    uniform float uPcssSearch;
    uniform float uPcssScale;
    float pcssNoise( vec2 p ) { return fract( 52.9829189 * fract( dot( p, vec2( 0.06711056, 0.00583715 ) ) ) ); }
    vec2 pcssDisk( int i, int n, float rot ) {
      float r = sqrt( ( float( i ) + 0.5 ) / float( n ) ), a = float( i ) * 2.39996323 + rot;
      return vec2( cos( a ), sin( a ) ) * r;
    }
    float pcssShadow( sampler2D sm, vec4 c ) {
      float rot = pcssNoise( gl_FragCoord.xy ) * 6.2831853, zR = c.z, sum = 0.0, cnt = 0.0;
      for ( int i = 0; i < PCSS_BLOCKERS; i ++ ) {
        float d = unpackRGBAToDepth( texture2D( sm, c.xy + pcssDisk( i, PCSS_BLOCKERS, rot ) * uPcssSearch ) );
        if ( d < zR ) { sum += d; cnt += 1.0; }
      }
      if ( cnt < 0.5 ) return 1.0;
      float r = clamp( ( zR - sum / cnt ) * uPcssScale, 0.0005, uPcssSearch ), lit = 0.0;
      for ( int i = 0; i < PCSS_TAPS; i ++ ) {
        lit += step( zR, unpackRGBAToDepth( texture2D( sm, c.xy + pcssDisk( i, PCSS_TAPS, rot + 1.7 ) * r ) ) );
      }
      return lit / float( PCSS_TAPS );
    }`;
  const PCSS_CHUNK = (() => {
    const src = THREE.ShaderChunk.shadowmap_pars_fragment, a = '#ifdef USE_SHADOWMAP', b = '#if defined( SHADOWMAP_TYPE_PCF )';
    if (!src.includes(a) || !src.includes(b)) return null;              // другая версия three — останутся обычные тени
    return src.replace(a, a + '\n' + PCSS_GLSL).replace(b, 'return pcssShadow( shadowMap, shadowCoord );\n\t\t' + b);
  })();
  const pcssDone = new Set();
  function pcss(mat) {                                                  // только материалы этой сцены, первый экран не трогаем
    if (!PCSS_CHUNK || !mat || pcssDone.has(mat)) return;
    pcssDone.add(mat);
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, PCSS_U);
      sh.fragmentShader = sh.fragmentShader.replace('#include <shadowmap_pars_fragment>', PCSS_CHUNK);
    };
    mat.customProgramCacheKey = () => 'bd-pcss';
    mat.needsUpdate = true;
  }
  {
    const es = new THREE.Scene();
    es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `varying vec3 vD; void main(){
        float y = vD.y;
        vec3 c = y > 0.0 ? mix(vec3(0.86, 0.85, 0.83), vec3(0.5, 0.56, 0.64), pow(y, 0.7)) : mix(vec3(0.74, 0.7, 0.64), vec3(0.24, 0.21, 0.18), -y);
        float win = smoothstep(0.02, 0.0, abs(vD.x + 0.55) - 0.18) * smoothstep(0.02, 0.0, abs(vD.y - 0.42) - 0.22) * step(0.0, -vD.z);
        c += vec3(1.6, 1.5, 1.35) * win;
        c += vec3(1.0, 0.93, 0.82) * pow(max(dot(vD, normalize(vec3(-0.5, 0.8, 0.45))), 0.0), 80.0) * 5.0;
        gl_FragColor = vec4(c, 1.0); }`,
    })));
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(es, 0.02).texture;
    pm.dispose();
  }
  const table = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ color: 0x2a1c10, opacity: 0.22 }));
  table.rotation.x = -Math.PI / 2; table.receiveShadow = true;
  scene.add(table);

  // ---------- процедурные PBR-текстуры ----------
  const ctex = (w, h, draw, rep) => {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    draw(cv.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.anisotropy = ANISO;
    if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  };
  const dataTex = (size, fill) => {
    const a = new Uint8Array(size * size * 4);
    fill(a);
    const t = new THREE.DataTexture(a, size, size, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true; t.anisotropy = ANISO; t.needsUpdate = true;
    return t;
  };
  const normalFromHeight = (hgt, size, str) => dataTex(size, (a) => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const dx = hgt[y * size + (x + 1) % size] - hgt[y * size + (x - 1 + size) % size];
      const dy = hgt[((y + 1) % size) * size + x] - hgt[((y - 1 + size) % size) * size + x];
      let nx = -dx * str, ny = dy * str, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      a[i * 4] = (nx * 0.5 + 0.5) * 255; a[i * 4 + 1] = (ny * 0.5 + 0.5) * 255; a[i * 4 + 2] = (nz * 0.5 + 0.5) * 255; a[i * 4 + 3] = 255;
    }
  });
  // шлифованный металл: продольные риски, царапины, затёртые пятна
  function brushed(size, seed) {
    const r = rng(seed), hgt = new Float32Array(size * size), rough = new Float32Array(size * size);
    const row = Array.from({ length: size }, () => r());
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) hgt[y * size + x] = row[y] * 0.55 + row[(y + 3) % size] * 0.25 + r() * 0.12;
    for (let k = 0; k < 70; k++) {
      let x = r() * size, y = r() * size; const a = (r() - 0.5) * 0.9, len = 10 + r() * 60;
      for (let s = 0; s < len; s++) { const xi = ((Math.floor(x) % size) + size) % size, yi = ((Math.floor(y) % size) + size) % size; hgt[yi * size + xi] -= 0.5; x += Math.cos(a); y += Math.sin(a); }
    }
    const blobs = Array.from({ length: 9 }, () => [r() * size, r() * size, 20 + r() * 50]);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let b = 0; for (const [bx, by, br] of blobs) b += Math.max(0, 1 - Math.hypot(x - bx, y - by) / br);
      rough[y * size + x] = clamp(0.24 + 0.1 * row[y] + 0.18 * Math.min(1, b));
    }
    return {
      normal: normalFromHeight(hgt, size, 1.6),
      rough: dataTex(size, (a) => { for (let i = 0; i < size * size; i++) { const v = rough[i] * 255; a[i * 4] = v; a[i * 4 + 1] = v; a[i * 4 + 2] = v; a[i * 4 + 3] = 255; } }),
    };
  }
  // кирпичная кладка: цвет и рельеф швов
  const BS = 256, brickH = new Float32Array(BS * BS);
  const brickTex = ctex(BS, BS, (g, S) => {
    const cols = ['#4a2c21', '#56331f', '#5f3a26', '#43281d', '#3e251b', '#74402a'];
    g.fillStyle = '#2b2420'; g.fillRect(0, 0, S, S);
    const rows = 13, bw = S / 4, bh = S / rows;
    for (let r0 = 0; r0 < rows; r0++) for (let c = -1; c < 5; c++) {
      const x = c * bw + (r0 % 2) * bw / 2;
      g.fillStyle = cols[Math.floor(R() * (R() < 0.08 ? 6 : 5))];
      g.fillRect(x + 1.6, r0 * bh + 1.6, bw - 3.2, bh - 3.2);
      g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(x + 1.6, r0 * bh + 1.6, bw - 3.2, 1.2);
      for (let k = 0; k < 10; k++) { g.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,220,190'},${0.08 + R() * 0.1})`; g.fillRect(x + 2 + R() * (bw - 5), r0 * bh + 2 + R() * (bh - 5), 1.4, 1.4); }
    }
    const d = g.getImageData(0, 0, S, S).data;
    for (let i = 0; i < S * S; i++) brickH[i] = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) > 160 ? 1 : 0.2;
  }, true);
  const brickN = normalFromHeight(brickH, BS, 2.2);
  const roofH = new Float32Array(128 * 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const v = (y % 32) / 32, saw = v < 0.15 ? v / 0.15 : 1 - (v - 0.15) / 0.85;
    roofH[y * 128 + x] = saw * 0.55 + 0.22 * Math.cos(x / 128 * Math.PI * 2 * 4) * (0.5 + 0.5 * Math.sin(v * Math.PI));
  }
  const roofN = normalFromHeight(roofH, 128, 0.9);
  const roofMap = ctex(128, 128, (g, S) => { g.fillStyle = '#30343a'; g.fillRect(0, 0, S, S); for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(255,255,255,${R() * 0.04})`; g.fillRect(R() * S, R() * S, 2, 2); } }, true);
  const blockTex = ctex(256, 256, (g, S) => {
    g.fillStyle = '#b9b5ad'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(80,74,66,${R() * 0.18})`; g.fillRect(R() * S, R() * S, 2, 2); }
    g.strokeStyle = 'rgba(70,64,58,.35)'; g.lineWidth = 2;
    for (let r0 = 0; r0 < 4; r0++) { g.beginPath(); g.moveTo(0, r0 * S / 4); g.lineTo(S, r0 * S / 4); g.stroke(); for (let c = 0; c < 2; c++) { const x = c * S / 2 + (r0 % 2) * S / 4; g.beginPath(); g.moveTo(x, r0 * S / 4); g.lineTo(x, (r0 + 1) * S / 4); g.stroke(); } }
  }, true);
  const woodTex = ctex(256, 256, (g, S) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = ['#b07f55', '#a67650', '#ba8a5f', '#9f714b'][i % 4]; g.fillRect(i * S / 8, 0, S / 8, S);
      g.fillStyle = 'rgba(60,35,15,.25)'; g.fillRect(i * S / 8, 0, 1.5, S); g.fillRect(i * S / 8, R() * S, S / 8, 1.5);
      for (let k = 0; k < 7; k++) { g.fillStyle = 'rgba(80,45,20,.12)'; g.fillRect(i * S / 8 + R() * S / 8, R() * S, 1, 20 + R() * 40); }
    }
  }, true);
  const concTex = ctex(128, 128, (g, S) => {
    g.fillStyle = '#8f8b84'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 600; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '40,38,35' : '230,225,215'},${0.05 + R() * 0.1})`; g.fillRect(R() * S, R() * S, 2, 2); }
  }, true);
  const brassM = brushed(256, 11), steelM = brushed(256, 23);
  const metal = (color, maps, rough = 1) => new THREE.MeshPhysicalMaterial({ color: lin(color), metalness: 1, roughness: rough, roughnessMap: maps.rough, normalMap: maps.normal, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.35 });

  // ---------- дом (тот же план, что на первом экране) ----------
  const W = 12.08, D = 11.56, NX0 = 4.8, NX1 = 7.3, NZ0 = 10.0, TW = 0.45, FY = 0.4, WH = 2.9;
  const isOut = (x, z) => x < 0 || x > W || z < 0 || z > D || (x > NX0 && x < NX1 && z > NZ0);
  const OUTER = [[0, W, 0, TW], [0, TW, 0, D], [W - TW, W, 0, D], [0, NX0, D - TW, D], [NX1, W, D - TW, D],
    [NX0 - TW, NX0, NZ0, D], [NX1, NX1 + TW, NZ0, D], [NX0 - TW, NX1 + TW, NZ0 - TW, NZ0]];
  const INNER = [[4.3, 4.55, TW, 4.6], [4.3, 4.55, 6.8, NZ0 - TW], [TW, 4.3, 4.3, 4.42], [3.1, 3.22, 4.42, 7.0], [TW, 4.3, 7.0, 7.12],
    [6.28, 7.92, 4.6, 4.72], [6.28, 6.4, 4.72, 5.82], [6.28, 7.92, 5.7, 5.82], [7.8, 7.92, 4.72, 5.7], [7.8, W - TW, 6.18, 6.3], [7.8, 7.92, 6.3, NZ0 - TW]];
  // для мешей торцы стен подрезаны, чтобы коробки не перекрывались и грани не мерцали
  const OUTER_M = [[0, W, 0, TW], [0, TW, TW, D - TW], [W - TW, W, TW, D - TW], [0, NX0, D - TW, D], [NX1, W, D - TW, D],
    [NX0 - TW, NX0, NZ0, D - TW], [NX1, NX1 + TW, NZ0, D - TW], [NX0 - TW, NX1 + TW, NZ0 - TW, NZ0]];
  const M = {
    cap: new THREE.MeshStandardMaterial({ color: lin('#9c948a'), roughness: 0.9 }),
    brick: new THREE.MeshStandardMaterial({ map: brickTex, normalMap: brickN, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.92, envMapIntensity: 0.35 }),
    plinth: new THREE.MeshStandardMaterial({ color: lin('#bdb8af'), roughness: 0.95 }),
    anth: new THREE.MeshStandardMaterial({ color: lin('#2a2e32'), roughness: 0.42, metalness: 0.35 }),
    roof: new THREE.MeshStandardMaterial({ map: roofMap, normalMap: roofN, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.4, metalness: 0.5, envMapIntensity: 1.0, side: THREE.DoubleSide }),
    soffit: new THREE.MeshStandardMaterial({ color: lin('#e2ddd4'), roughness: 0.8, side: THREE.DoubleSide }),
    door: new THREE.MeshStandardMaterial({ color: lin('#33373c'), roughness: 0.5, metalness: 0.2 }),
    glass: new THREE.MeshStandardMaterial({ color: lin('#1d252a'), roughness: 0.05, metalness: 0.9, envMapIntensity: 1.4, emissive: lin('#ffb46e'), emissiveIntensity: 0 }),
  };
  const FLOOR = [
    new THREE.MeshStandardMaterial({ map: concTex, roughness: 0.95 }),
    new THREE.MeshStandardMaterial({ color: lin('#cbc5b8'), roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.55, envMapIntensity: 0.5 }),
  ];
  const WALLIN = [
    new THREE.MeshStandardMaterial({ map: blockTex, roughness: 0.95 }),
    new THREE.MeshStandardMaterial({ color: lin('#e4dfd5'), roughness: 0.92 }),
    new THREE.MeshStandardMaterial({ color: lin('#efe9df'), roughness: 0.85 }),
  ];
  function boxM(x0, x1, y0, y1, z0, z1) {
    const w = x1 - x0, h = y1 - y0, d = z1 - z0, g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]); }
    g.translate((x0 + x1) / 2 - W / 2, (y0 + y1) / 2, (z0 + z1) / 2 - D / 2);
    return g;
  }
  const house = new THREE.Group(), walls = [], innerMeshes = [];
  for (const [x0, x1, z0, z1] of OUTER_M) {
    const alongX = x1 - x0 >= z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const outerIdx = alongX ? (isOut(cx, z0 - 0.1) ? 5 : 4) : (isOut(x0 - 0.1, cz) ? 1 : 0);
    const innerIdx = outerIdx % 2 === 0 ? outerIdx + 1 : outerIdx - 1;
    const mats = Array(6).fill(M.brick); mats[innerIdx] = WALLIN[st.fin]; mats[2] = M.cap;
    const m = new THREE.Mesh(boxM(x0, x1, FY, FY + WH, z0, z1), mats);
    m.castShadow = true; m.receiveShadow = true; m.userData.innerIdx = innerIdx;
    house.add(m); walls.push(m);
  }
  for (const [x0, x1, z0, z1] of INNER) {
    const m = new THREE.Mesh(boxM(x0, x1, FY, FY + WH - 0.15, z0, z1), WALLIN[st.fin]);
    m.castShadow = true; m.receiveShadow = true; house.add(m); innerMeshes.push(m);
  }
  const FT = 0.025, floors = [];
  for (const [x0, x1, z0, z1] of [[TW, W - TW, TW, NZ0 - TW], [TW, NX0 - TW, NZ0 - TW, D - TW], [NX1 + TW, W - TW, NZ0 - TW, D - TW]]) {
    const f = new THREE.Mesh(boxM(x0, x1, FY + 0.002, FY + FT, z0, z1), FLOOR[st.fin]); f.receiveShadow = true; house.add(f); floors.push(f);
  }
  for (const g of [boxM(-0.05, W + 0.05, 0, FY, -0.05, D + 0.05), boxM(NX0 + 0.1, NX1 - 0.1, 0, FY - 0.13, D, D + 0.38), boxM(NX0 + 0.25, NX1 - 0.25, 0, FY - 0.27, D + 0.38, D + 0.7)]) {
    const m = new THREE.Mesh(g, M.plinth); m.castShadow = true; m.receiveShadow = true; house.add(m);
  }
  const WIN = [['z0', 2.4, 1.5, 0.9, 2.25], ['z0', 6.3, 1.5, 0.9, 2.25], ['z0', 9.6, 2.6, 0.6, 2.25], ['x0', 5.7, 0.6, 1.5, 2.25], ['x0', 8.9, 1.2, 0.9, 2.25],
    ['x1', 3.0, 1.8, 0.9, 2.25], ['x1', 8.6, 1.5, 0.9, 2.25], ['z1', 2.4, 1.5, 0.9, 2.25], ['z1', 9.7, 1.8, 0.9, 2.25], ['zn', 6.05, 1.0, 0, 2.1]];
  for (const [face, c, w, s, h] of WIN) {
    const g = new THREE.Group(), hh = h - s, door = face === 'zn';
    const ft = 0.075;
    for (const [bw, bh, bx, by] of [[w, ft, 0, hh / 2 - ft / 2], [w, ft, 0, -hh / 2 + ft / 2], [ft, hh - 2 * ft, -w / 2 + ft / 2, 0], [ft, hh - 2 * ft, w / 2 - ft / 2, 0]]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.1), M.anth); b.position.set(bx, by, 0.01); b.castShadow = true; g.add(b);
    }
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(w - 2 * ft + 0.01, hh - 2 * ft + 0.01), door ? M.door : M.glass); gl.position.z = -0.002; g.add(gl);
    if (!door) {
      if (w > 1.2) { const mu = new THREE.Mesh(new THREE.BoxGeometry(0.06, hh - 2 * ft, 0.06), M.anth); mu.position.z = 0.01; g.add(mu); }
      const sl = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.04, 0.22), M.plinth); sl.position.set(0, -hh / 2 - 0.02, 0.09); sl.castShadow = true; g.add(sl);
    } else {
      const hd = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.6, 0.04), metal('#c9cdd2', steelM, 0.8)); hd.position.set(w / 2 - 0.14, 0.05, 0.07); g.add(hd);
    }
    const y = FY + (s + h) / 2;
    if (face === 'z0') { g.position.set(c - W / 2, y, -D / 2 - 0.01); g.rotation.y = Math.PI; }
    else if (face === 'z1') g.position.set(c - W / 2, y, D / 2 + 0.01);
    else if (face === 'zn') g.position.set(c - W / 2, y, NZ0 - D / 2 + 0.01);
    else if (face === 'x0') { g.position.set(-W / 2 - 0.01, y, c - D / 2); g.rotation.y = -Math.PI / 2; }
    else { g.position.set(W / 2 + 0.01, y, c - D / 2); g.rotation.y = Math.PI / 2; }
    house.add(g);
  }
  const roof = new THREE.Group();
  {
    const O = 0.55, P = 22 * Math.PI / 180, yE = FY + WH + 0.05, ex0 = -W / 2 - O, ex1 = W / 2 + O, ez0 = -D / 2 - O, ez1 = D / 2 + O;
    const ha = (ez1 - ez0) / 2, yR = yE + ha * Math.tan(P);
    const C00 = [ex0, yE, ez0], C10 = [ex1, yE, ez0], C01 = [ex0, yE, ez1], C11 = [ex1, yE, ez1], R0 = [ex0 + ha, yR, 0], R1 = [ex1 - ha, yR, 0];
    const pos = [], uvs = [];
    const tri = (a, b, c, ax) => { for (const p of [a, b, c]) { pos.push(...p); uvs.push((ax ? p[0] : p[2]) / 1.5, (p[1] - yE) / Math.sin(P) / 1.4); } };
    tri(C01, C11, R1, 1); tri(C01, R1, R0, 1); tri(C10, C00, R0, 1); tri(C10, R0, R1, 1); tri(C00, C01, R0, 0); tri(C11, C10, R1, 0);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.computeVertexNormals();
    const rm = new THREE.Mesh(g, M.roof); rm.castShadow = true; rm.receiveShadow = true; roof.add(rm);
    const so = new THREE.Mesh(new THREE.PlaneGeometry(ex1 - ex0, ez1 - ez0), M.soffit); so.rotation.x = Math.PI / 2; so.position.y = yE - 0.12; roof.add(so);
    for (const [bw, bd, bx, bz] of [[ex1 - ex0 + 0.06, 0.04, 0, ez1 + 0.01], [ex1 - ex0 + 0.06, 0.04, 0, ez0 - 0.01], [0.04, ez1 - ez0, ex1 + 0.01, 0], [0.04, ez1 - ez0, ex0 - 0.01, 0]]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.2, bd), M.anth); b.position.set(bx, yE - 0.1, bz); b.castShadow = true; roof.add(b);
    }
    const capM = new THREE.MeshStandardMaterial({ color: lin('#3a3f45'), roughness: 0.38, metalness: 0.55 });
    const beam = (a, b, rad, mat, grp, box) => {
      const A = new V3(...a), B = new V3(...b), len = A.distanceTo(B);
      const m = new THREE.Mesh(box ? new THREE.BoxGeometry(0.2, 0.09, len) : new THREE.CylinderGeometry(rad, rad, len, 12).rotateX(Math.PI / 2), mat);
      m.position.copy(A).add(B).multiplyScalar(0.5); m.lookAt(B); m.castShadow = true; grp.add(m); return m;
    };
    for (const [a, b] of [[C00, R0], [C01, R0], [C10, R1], [C11, R1], [R0, R1]]) beam([a[0], a[1] + 0.04, a[2]], [b[0], b[1] + 0.04, b[2]], 0, capM, roof, true);
    const gy = yE - 0.14, o = 0.1;
    for (const [a, b] of [[[ex0 - o, gy, ez1 + o], [ex1 + o, gy, ez1 + o]], [[ex0 - o, gy, ez0 - o], [ex1 + o, gy, ez0 - o]], [[ex0 - o, gy, ez0 - o], [ex0 - o, gy, ez1 + o]], [[ex1 + o, gy, ez0 - o], [ex1 + o, gy, ez1 + o]]]) beam(a, b, 0.07, M.anth, roof);
  }
  house.add(roof);
  const pipes = new THREE.Group();
  for (const [px, pz] of [[-W / 2 - 0.1, D / 2 + 0.1], [W / 2 + 0.1, D / 2 + 0.1], [-W / 2 - 0.1, -D / 2 - 0.1], [W / 2 + 0.1, -D / 2 - 0.1]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, FY + WH - 0.1, 12), M.anth); p.position.set(px, (FY + WH - 0.1) / 2, pz); p.castShadow = true; pipes.add(p);
  }
  house.add(pipes);
  const furn = new THREE.Group();
  {
    const white = new THREE.MeshStandardMaterial({ color: lin('#f3f0ea'), roughness: 0.7 });
    const textile = new THREE.MeshStandardMaterial({ color: lin('#8d9196'), roughness: 0.95 });
    const wood = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.6 });
    const accent = new THREE.MeshStandardMaterial({ color: lin('#c4561d'), roughness: 0.9 });
    const sage = new THREE.MeshStandardMaterial({ color: lin('#7f8f6c'), roughness: 0.95 });
    const add = (mat, x0, x1, y0, y1, z0, z1) => { const m = new THREE.Mesh(boxM(x0, x1, FY + FT + y0, FY + FT + y1, z0, z1), mat); m.castShadow = true; m.receiveShadow = true; furn.add(m); };
    const bed = (x, z, w, l) => {
      add(wood, x - w / 2, x + w / 2, 0, 0.3, z - l / 2, z + l / 2);
      add(white, x - w / 2 + 0.05, x + w / 2 - 0.05, 0.3, 0.5, z - l / 2 + 0.05, z + l / 2 - 0.05);
      add(white, x - w / 2 + 0.15, x + w / 2 - 0.15, 0.5, 0.62, z - l / 2 + 0.1, z - l / 2 + 0.5);
      add(sage, x - w / 2 + 0.05, x + w / 2 - 0.05, 0.5, 0.56, z + 0.1, z + l / 2 - 0.05);
      add(wood, x - w / 2, x + w / 2, 0, 1.0, z - l / 2 - 0.06, z - l / 2);
    };
    bed(2.4, 2.2, 1.6, 2.0); bed(2.4, 8.9, 1.6, 2.0); bed(9.8, 8.0, 1.6, 2.0);
    add(textile, 5.4, 8.2, 0, 0.42, 1.0, 1.9); add(textile, 5.4, 8.2, 0.42, 0.85, 0.85, 1.1); add(textile, 5.4, 5.75, 0.42, 0.62, 1.0, 1.9);
    add(accent, 5.6, 8.0, 0, 0.012, 2.2, 3.8); add(wood, 6.2, 7.4, 0.2, 0.4, 2.6, 3.4);
    add(white, 9.0, 11.55, 0, 0.88, 0.5, 1.1); add(wood, 9.0, 11.55, 0.88, 0.92, 0.48, 1.12);
    add(wood, 9.4, 11.0, 0.72, 0.76, 2.6, 3.6); for (const [cx, cz] of [[9.7, 2.35], [10.7, 2.35], [9.7, 3.85], [10.7, 3.85]]) add(textile, cx - 0.2, cx + 0.2, 0, 0.45, cz - 0.2, cz + 0.2);
    add(white, 0.6, 2.3, 0, 0.55, 4.55, 5.3); add(white, 3.3, 3.95, 0, 0.8, 4.55, 5.05);
  }
  house.add(furn);
  const roomLight = new THREE.PointLight(lin('#ffbf80'), 0, 9, 2);
  roomLight.position.set(1.2, FY + 2.2, -0.6); house.add(roomLight);
  house.position.set(-0.3, 0, -0.12); house.rotation.y = 0.32;
  scene.add(house);

  // ---------- лист с чертежом: план в масштабе дома, оси, размерные цепочки, штамп ----------
  // Лист живёт в координатах дома (метры плана) и растёт вместе с ним; дом стоит ровно на своём плане.
  const SW = 19, SH = 14.25, SCX = 0.25, SCZ = 0.7;          // размер листа и его центр относительно центра дома
  const sheetGrp = new THREE.Group();
  {
    const PX = 1536 / SW;                                       // пикселей на метр
    const X = (x) => (x - W / 2 - SCX + SW / 2) * PX, Z = (z) => (z - D / 2 - SCZ + SH / 2) * PX;
    const planTex = ctex(1536, 1152, (g, Wd, Ht) => {
      g.fillStyle = '#f7f5f0'; g.fillRect(0, 0, Wd, Ht);
      for (let i = 0; i < 2200; i++) { g.fillStyle = `rgba(120,110,95,${R() * 0.035})`; g.fillRect(R() * Wd, R() * Ht, 2, 2); }
      g.strokeStyle = 'rgba(27,28,30,.8)'; g.lineWidth = 2; g.strokeRect(46, 30, Wd - 76, Ht - 60);   // рамка листа
      const ink = '#1b1c1e', mono = (px, w = 500) => `${w} ${px}px "JetBrains Mono", monospace`;
      // оси
      const AX = [0, 4.42, 7.86, W], AZ = [0, 4.36, 7.06, D];
      g.setLineDash([22, 6, 4, 6]); g.strokeStyle = 'rgba(27,28,30,.45)'; g.lineWidth = 1.4;
      for (const a of AX) { g.beginPath(); g.moveTo(X(a), Z(-2.2)); g.lineTo(X(a), Z(D + 1.6)); g.stroke(); }
      for (const a of AZ) { g.beginPath(); g.moveTo(X(-2.2), Z(a)); g.lineTo(X(W + 2.3), Z(a)); g.stroke(); }
      g.setLineDash([]);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      const bubble = (x, y, t) => { g.beginPath(); g.arc(x, y, 21, 0, Math.PI * 2); g.fillStyle = '#f7f5f0'; g.fill(); g.strokeStyle = ink; g.lineWidth = 2; g.stroke(); g.fillStyle = ink; g.font = mono(20, 600); g.fillText(t, x, y + 1); };
      AX.forEach((a, i) => bubble(X(a), Z(-2.2) - 22, String(i + 1)));
      'АБВГ'.split('').forEach((t, i) => bubble(X(-2.2) - 22, Z(AZ[i]), t));
      // стены — ровно под кирпичными стенами модели
      g.fillStyle = ink;
      for (const [x0, x1, z0, z1] of OUTER.concat(INNER)) g.fillRect(X(x0), Z(z0), (x1 - x0) * PX, (z1 - z0) * PX);
      g.strokeStyle = ink; g.lineWidth = 1.6; g.strokeRect(X(NX0 + 0.1), Z(D), (NX1 - NX0 - 0.2) * PX, 0.7 * PX);
      // размерные цепочки: по фасаду и по правой стороне
      const chain = (pts, fixed, horiz, lab) => {
        g.strokeStyle = ink; g.lineWidth = 1.5; g.fillStyle = ink; g.font = mono(19);
        const line = (x0, y0, x1, y1) => { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
        for (let i = 0; i < pts.length; i++) {
          const p = horiz ? X(pts[i]) : Z(pts[i]);
          if (horiz) { line(p, fixed - 16, p, fixed + 16); line(p - 9, fixed + 9, p + 9, fixed - 9); } else { line(fixed - 16, p, fixed + 16, p); line(fixed - 9, p + 9, fixed + 9, p - 9); }
          if (i) {
            const q = horiz ? X(pts[i - 1]) : Z(pts[i - 1]), t = lab ? lab(i) : String(Math.round((pts[i] - pts[i - 1]) * 1000)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
            if (horiz) { line(q, fixed, p, fixed); g.fillText(t, (p + q) / 2, fixed - 18); }
            else { line(fixed, q, fixed, p); g.save(); g.translate(fixed + 20, (p + q) / 2); g.rotate(-Math.PI / 2); g.fillText(t, 0, 0); g.restore(); }
          }
        }
      };
      chain(AX, Z(D + 1.55), true);
      chain([0, W], Z(D + 2.45), true);
      chain(AZ, X(W + 1.4), false);
      chain([0, D], X(W + 2.3), false);
      // экспликация и штамп — в ближнем к камере углу
      const bx = Wd - 30 - 560, by = Ht - 30 - 190;
      g.lineWidth = 2; g.strokeStyle = ink; g.strokeRect(bx, by, 560, 190);
      for (const yy of [60, 110, 150]) { g.beginPath(); g.moveTo(bx, by + yy); g.lineTo(bx + 560, by + yy); g.stroke(); }
      g.beginPath(); g.moveTo(bx + 360, by + 110); g.lineTo(bx + 360, by + 190); g.stroke();
      g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      g.font = '600 34px Unbounded, sans-serif'; g.fillText('БАЙДОМ', bx + 22, by + 44);
      g.font = mono(17); g.fillStyle = 'rgba(27,28,30,.6)'; g.fillText('КАЗАНЬ · КИРПИЧНЫЕ ДОМА', bx + 250, by + 40);
      g.fillStyle = ink; g.font = mono(22, 600); g.fillText('ПЛАН 1-ГО ЭТАЖА', bx + 22, by + 94);
      g.fillStyle = '#c4561d'; g.fillText('S = 101,01 м²', bx + 330, by + 94);
      g.fillStyle = ink; g.font = mono(18); g.fillText('Проект «Тёплый 101»', bx + 22, by + 138); g.fillText('М 1:100', bx + 380, by + 138);
      g.fillText('Стадия П', bx + 22, by + 177); g.fillText('Лист 1 из 6', bx + 380, by + 177);
      // отметка севера
      g.save(); g.translate(X(-1.3), Z(D + 2.0)); g.strokeStyle = ink; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 30, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(0, -30); g.lineTo(10, 12); g.lineTo(0, 4); g.lineTo(-10, 12); g.closePath(); g.fillStyle = ink; g.fill(); g.font = mono(18, 600); g.textAlign = 'center'; g.fillText('С', 0, -40); g.restore();
    });
    const paper = (map, color) => new THREE.MeshStandardMaterial({ map, color: color ? lin(color) : 0xffffff, roughness: 0.92, envMapIntensity: 0.6 });
    const plan = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), paper(planTex));
    plan.rotation.x = -Math.PI / 2; plan.position.set(SCX, 0.012, SCZ); plan.receiveShadow = true; sheetGrp.add(plan);
    const under = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), paper(null, '#ece8df'));
    under.rotation.x = -Math.PI / 2; under.rotation.z = -0.1; under.position.set(SCX - 0.9, 0.006, SCZ - 0.7); under.receiveShadow = true; sheetGrp.add(under);
    sheetGrp.userData.sheets = [plan, under];
  }
  house.add(sheetGrp);

  // ---------- контактная тень: мягкое затемнение вокруг основания (как ambient occlusion на столе) ----------
  // Свет от неба и стен почти не попадает в щель между домом и листом — там всегда темнее, с любой стороны.
  {
    const F = 1.0, hx = W / 2 + 0.05, z0 = -D / 2 - 0.05, z1 = D / 2 + 0.75;   // пятно дома с крыльцом, метры плана
    const PW = 2 * (hx + 2.6 * F), PD = (z1 - z0) + 5.2 * F, cz = (z0 + z1) / 2;
    const S = 256, cv = document.createElement('canvas'); cv.width = S; cv.height = Math.round(S * PD / PW);
    const g = cv.getContext('2d'), img = g.createImageData(cv.width, cv.height), dd = img.data;
    const hz = (z1 - z0) / 2;
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
      const px = ((x + 0.5) / cv.width - 0.5) * PW, pz = ((y + 0.5) / cv.height - 0.5) * PD;
      const qx = Math.abs(px) - hx, qz = Math.abs(pz) - hz;
      const out = Math.hypot(Math.max(qx, 0), Math.max(qz, 0));            // расстояние до пятна снаружи
      const a = Math.exp(-out / F * 2.6), i = (y * cv.width + x) * 4;
      dd[i] = dd[i + 1] = dd[i + 2] = 255; dd[i + 3] = Math.round(a * 255);
    }
    g.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(cv);
    const ao = new THREE.Mesh(new THREE.PlaneGeometry(PW, PD), new THREE.MeshBasicMaterial({
      map: tex, color: lin('#2a1c10'), transparent: true, opacity: 0.42, depthWrite: false, toneMapped: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }));
    ao.rotation.x = -Math.PI / 2; ao.position.set(0, 0.02, cz); ao.renderOrder = 1;
    house.add(ao);
  }

  // ---------- карандаш на чертеже ----------
  const pencil = new THREE.Group();
  {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.0078, 0.0078, 0.17, 6), new THREE.MeshStandardMaterial({ color: lin('#2b2f34'), roughness: 0.35, metalness: 0.1, envMapIntensity: 0.8 }));
    body.castShadow = true; pencil.add(body);
    const wd = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0078, 0.026, 6), new THREE.MeshStandardMaterial({ color: lin('#d8b386'), roughness: 0.8 }));
    wd.position.y = 0.098; wd.castShadow = true; pencil.add(wd);
    const lead = new THREE.Mesh(new THREE.CylinderGeometry(0.0002, 0.0022, 0.008, 12), new THREE.MeshStandardMaterial({ color: lin('#2a2a2c'), roughness: 0.3, metalness: 0.6 }));
    lead.position.y = 0.115; pencil.add(lead);
    const ferr = new THREE.Mesh(new THREE.CylinderGeometry(0.0082, 0.0082, 0.016, 24), metal('#d6d8db', steelM, 0.9));
    ferr.position.y = -0.093; ferr.castShadow = true; pencil.add(ferr);
    for (const yy of [-0.088, -0.098]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.0083, 0.0007, 6, 24), metal('#bfc2c6', steelM)); r.rotation.x = Math.PI / 2; r.position.y = yy; pencil.add(r); }
    const er = new THREE.Mesh(new THREE.CylinderGeometry(0.0076, 0.0076, 0.012, 24), new THREE.MeshStandardMaterial({ color: lin('#c97a5c'), roughness: 0.9 }));
    er.position.y = -0.107; pencil.add(er);
    const print = ctex(256, 32, (g) => { g.fillStyle = '#d9b46a'; g.font = '600 20px Unbounded, sans-serif'; g.fillText('БАЙДОМ · HB', 8, 24); });
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.0062, 0.09), new THREE.MeshBasicMaterial({ map: print, transparent: true, toneMapped: false }));
    pl.position.set(0, -0.02, 0.0068); pencil.add(pl);
    print.center.set(0.5, 0.5); print.rotation = Math.PI / 2;
  }
  const pencilG = new THREE.Group();
  pencil.rotation.z = Math.PI / 2;
  pencilG.add(pencil);
  pencilG.rotation.y = -0.5; pencilG.position.set(0.62, 0.0083, 0.42);
  scene.add(pencilG);

  // ---------- связка ключей: шлифованная латунь и сталь, разрезное кольцо, кожаный брелок ----------
  const keyring = new THREE.Group();
  const brassMat = metal('#d2ad66', brassM), steelMat = metal('#c3c7cc', steelM);
  const scaleUV = (g, k) => { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * k, uv.getY(i) * k); return g; };
  const ext = (shape, depth, bevel = 0.0015) => scaleUV(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 32 }), 18);
  function makeKey(mat, len, round) {
    const g = new THREE.Group();
    const head = new THREE.Shape();
    if (round) head.absarc(0, 0, 0.05, 0, Math.PI * 2, false);
    else {
      const w = 0.095, h = 0.072, r = 0.022;
      head.moveTo(-w / 2 + r, -h / 2); head.lineTo(w / 2 - r, -h / 2); head.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); head.lineTo(w / 2, h / 2 - r);
      head.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); head.lineTo(-w / 2 + r, h / 2); head.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); head.lineTo(-w / 2, -h / 2 + r); head.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    }
    const hole = new THREE.Path(); hole.absarc(-0.02, 0, 0.014, 0, Math.PI * 2, true); head.holes.push(hole);
    g.add(new THREE.Mesh(ext(head, 0.006), mat));
    const rim = new THREE.Shape(); rim.absarc(0.01, 0, round ? 0.03 : 0.026, 0, Math.PI * 2, false);
    const rh = new THREE.Path(); rh.absarc(0.01, 0, round ? 0.022 : 0.019, 0, Math.PI * 2, true); rim.holes.push(rh);
    const rm = new THREE.Mesh(ext(rim, 0.0015, 0.0008), mat); rm.position.z = 0.0065; g.add(rm);
    const stop = new THREE.Shape(); stop.moveTo(0.042, -0.019); stop.lineTo(0.06, -0.019); stop.lineTo(0.06, 0.019); stop.lineTo(0.042, 0.019);
    g.add(new THREE.Mesh(ext(stop, 0.007), mat));
    const blade = new THREE.Shape();
    const pts = [[0.06, 0.012], [len, 0.012], [len + 0.008, 0.004], [len, -0.004], [len - 0.02, -0.004], [len - 0.03, -0.015], [len - 0.045, -0.006], [len - 0.06, -0.016],
      [len - 0.075, -0.007], [len - 0.09, -0.017], [len - 0.105, -0.008], [len - 0.12, -0.014], [len - 0.13, -0.012], [0.06, -0.012]];
    blade.moveTo(...pts[0]); for (const p of pts.slice(1)) blade.lineTo(...p);
    g.add(new THREE.Mesh(ext(blade, 0.0035, 0.0008), mat));
    const step = new THREE.Shape(); step.moveTo(0.064, 0.012); step.lineTo(len - 0.004, 0.012); step.lineTo(len - 0.004, 0.0035); step.lineTo(0.064, 0.0035);
    const sm = new THREE.Mesh(ext(step, 0.0022, 0.0006), mat); sm.position.z = 0.0036; g.add(sm);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.rotation.x = -Math.PI / 2;
    return g;
  }
  for (const yy of [0.006, 0.0115]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.0034, 12, 64), steelMat);
    ring.rotation.x = Math.PI / 2; ring.rotation.z = yy * 9; ring.position.y = yy; ring.castShadow = true; keyring.add(ring);
  }
  const k1 = makeKey(brassMat, 0.25, true); k1.position.set(0.09, 0.012, 0.0); k1.rotation.z = -0.18; keyring.add(k1);
  const k2 = makeKey(steelMat, 0.22, false); k2.position.set(0.075, 0.02, -0.03); k2.rotation.z = 0.62; keyring.add(k2);
  {
    const leather = ctex(256, 128, (g, Wd, Ht) => {
      g.fillStyle = '#b5521f'; g.fillRect(0, 0, Wd, Ht);
      for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '60,20,5' : '255,190,150'},${R() * 0.09})`; g.fillRect(R() * Wd, R() * Ht, 1.5, 1.5); }
      g.strokeStyle = 'rgba(255,225,200,.75)'; g.lineWidth = 2.2; g.setLineDash([7, 5]); g.strokeRect(10, 10, Wd - 20, Ht - 20);
      g.setLineDash([]); g.fillStyle = 'rgba(70,25,8,.65)'; g.font = '600 34px Unbounded, sans-serif'; g.textAlign = 'center'; g.fillText('БАЙДОМ', Wd / 2 + 14, 76);
      g.fillStyle = 'rgba(255,200,160,.18)'; g.fillText('БАЙДОМ', Wd / 2 + 14, 74);
    });
    const tw = 0.17, th = 0.08, tr = 0.022, tagShape = new THREE.Shape();
    tagShape.moveTo(-tw / 2 + tr, -th / 2); tagShape.lineTo(tw / 2 - tr, -th / 2); tagShape.quadraticCurveTo(tw / 2, -th / 2, tw / 2, -th / 2 + tr); tagShape.lineTo(tw / 2, th / 2 - tr); tagShape.quadraticCurveTo(tw / 2, th / 2, tw / 2 - tr, th / 2);
    tagShape.lineTo(-tw / 2 + tr, th / 2); tagShape.quadraticCurveTo(-tw / 2, th / 2, -tw / 2, th / 2 - tr); tagShape.lineTo(-tw / 2, -th / 2 + tr); tagShape.quadraticCurveTo(-tw / 2, -th / 2, -tw / 2 + tr, -th / 2);
    const eh = new THREE.Path(); eh.absarc(-tw / 2 + 0.022, 0, 0.009, 0, Math.PI * 2, true); tagShape.holes.push(eh);
    const tg = new THREE.ExtrudeGeometry(tagShape, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 3, curveSegments: 24 });
    const pos = tg.attributes.position, uv = tg.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + tw / 2) / tw, (pos.getY(i) + th / 2) / th);
    const tag = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ map: leather, roughness: 0.72 }));
    tag.rotation.x = -Math.PI / 2; tag.castShadow = true; tag.receiveShadow = true;
    const ey = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.0025, 10, 32), brassMat); ey.rotation.x = Math.PI / 2; ey.position.set(-tw / 2 + 0.022, 0.0075, 0);
    const tagG = new THREE.Group(); tagG.add(tag, ey);
    tagG.position.set(-0.155, 0.002, 0.045); tagG.rotation.y = 0.5; keyring.add(tagG);
  }
  scene.add(keyring);
  const KEY_S = 1.45, PEN_S = 1.7;
  // габариты ключей и карандаша в их собственных координатах — для расчёта кадра
  pencilG.position.set(0, 0, 0); pencilG.rotation.set(0, 0, 0); pencilG.updateMatrixWorld(true); keyring.updateMatrixWorld(true);
  const corners = (b) => Array.from({ length: 8 }, (_, i) => new V3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z));
  const keyC = corners(new THREE.Box3().setFromObject(keyring)), penC = corners(new THREE.Box3().setFromObject(pencilG));
  keyring.scale.setScalar(KEY_S); pencilG.scale.setScalar(PEN_S);

  // ---------- точки кадра: корпус, крыша в покое и поднятая, листы, ключи, карандаш ----------
  const LIFT = { pos: new V3(0, 2.8, -3.4), rx: -0.18 };
  const liftM = new THREE.Matrix4().compose(LIFT.pos, new THREE.Quaternion().setFromEuler(new THREE.Euler(LIFT.rx, 0, 0)), new V3(1, 1, 1));
  const housePts = [], roofPts = [];
  {
    const hx = W / 2 + 0.05, hz = D / 2 + 0.05;
    for (const [x, z] of [[-hx, -hz], [hx, -hz], [-hx, hz], [hx, hz], [NX0 - W / 2, D / 2 + 0.7], [NX1 - W / 2, D / 2 + 0.7]]) housePts.push(new V3(x, 0, z));
    const O = 0.55 + 0.2, yE = FY + WH + 0.05, ha = D / 2 + 0.55, yR = yE + ha * Math.tan(22 * Math.PI / 180);
    for (const [x, z] of [[-W / 2 - O, -D / 2 - O], [W / 2 + O, -D / 2 - O], [-W / 2 - O, D / 2 + O], [W / 2 + O, D / 2 + O]]) roofPts.push(new V3(x, yE - 0.25, z));
    roofPts.push(new V3(-(W - D) / 2, yR + 0.15, 0), new V3((W - D) / 2, yR + 0.15, 0));
  }
  const sheetC = [[-SW / 2, -SH / 2], [SW / 2, -SH / 2], [-SW / 2, SH / 2], [SW / 2, SH / 2]].map(([x, y]) => new V3(x, y, 0));
  const POOL = [], _v = new V3();
  function gather() {
    scene.updateMatrixWorld();
    let n = 0;
    const push = (p, m) => { (POOL[n] || (POOL[n] = new V3())).copy(p).applyMatrix4(m); n++; };
    for (const p of housePts) push(p, house.matrixWorld);
    for (const p of roofPts) { push(p, house.matrixWorld); _v.copy(p).applyMatrix4(liftM); push(_v, house.matrixWorld); }
    for (const s of sheetGrp.userData.sheets) for (const p of sheetC) push(p, s.matrixWorld);
    for (const p of keyC) push(p, keyring.matrixWorld);
    for (const p of penC) push(p, pencilG.matrixWorld);
    return n;
  }
  // ключи лежат перед крыльцом, карандаш — на листе справа; точки привязки в метрах плана, сами предметы не масштабируются
  const KEY_A = new V3(-2.6, 0, D / 2 + 3.1), PEN_A = new V3(W / 2 + 1.9, 0, 0.9);
  function placeProps() {
    house.updateMatrixWorld();
    _v.copy(KEY_A).applyMatrix4(house.matrixWorld); keyring.position.set(_v.x, 0.0014, _v.z);
    _v.copy(PEN_A).applyMatrix4(house.matrixWorld); pencilG.position.set(_v.x, 0.0083 * PEN_S + 0.0014, _v.z);
    pencilG.rotation.y = house.rotation.y + Math.PI / 2 + 0.28;
  }

  // ---------- состояние, анимации ----------
  let scale = Math.sqrt(st.area / 101) * 0.1, scaleT = scale, fin = st.fin, lift = 0, liftUntil = 0, furnK = st.fin === 2 ? 1 : 0;
  let jingle = 0, jingleV = 0, mx = 0, my = 0, tmx = 0, tmy = 0, hover = false, dist = 5, W0 = 1, H0 = 1, wide = true, az = 0.7, el = 0.66;
  function setFinish(f) {
    fin = f;
    for (const fl of floors) fl.material = FLOOR[f];
    for (const m of innerMeshes) m.material = WALLIN[f];
    for (const w of walls) w.material[w.userData.innerIdx] = WALLIN[f];
  }
  // мышь: наклон за курсором и крыша поднята, пока курсор над сценой; палец: касание поднимает/опускает крышу
  let tapLift = false;
  const touchUI = matchMedia('(hover: none)'), tapHint = $('.ip-tap');
  canvas.addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse') return; const r = canvas.getBoundingClientRect(); tmx = (e.clientX - r.left) / r.width * 2 - 1; tmy = (e.clientY - r.top) / r.height * 2 - 1; hover = true; });
  canvas.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'mouse') return; tmx = 0; tmy = 0; hover = false; });
  canvas.addEventListener('pointerdown', () => { jingleV += 6; });
  canvas.addEventListener('click', () => { if (!touchUI.matches) return; tapLift = !tapLift; if (tapHint) tapHint.classList.add('off'); });

  // ---------- кадр без обрезки ----------
  // Свободная зона холста — слева от телефона (на узком экране — над ним). Каждый кадр все точки композиции
  // проецируются на экран; расстояние камеры и сдвиг кадра подстраиваются так, чтобы их рамка заполняла зону с полями.
  const T = new V3(0, 0.1, 0.25);
  let FL = 0, FR = 1, FTp = 0, FB = 1, offX = 0, offY = 0;
  function region() {
    const cr = canvas.getBoundingClientRect(), pr = phone.getBoundingClientRect(), m = Math.max(18, Math.min(34, W0 * 0.035));
    FL = m; FR = W0 - m; FTp = m; FB = H0 - m;
    if (wide) FR = Math.min(FR, pr.left - cr.left - 30);
    else if (pr.top < cr.bottom) FB = Math.min(FB, pr.top - cr.top - 10);
    if (FR - FL < 160) { FL = m; FR = W0 - m; }
    if (FB - FTp < 160) { FTp = m; FB = H0 - m; }
  }
  function place() {
    camera.position.set(T.x + Math.sin(az) * Math.cos(el) * dist, T.y + Math.sin(el) * dist, T.z + Math.cos(az) * Math.cos(el) * dist);
    camera.lookAt(T); camera.updateMatrixWorld();
  }
  function solve(k) {
    const n = gather();
    place();
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (let i = 0; i < n; i++) {
      _v.copy(POOL[i]).project(camera);
      const px = (_v.x + 1) * 0.5 * W0, py = (1 - _v.y) * 0.5 * H0;
      if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
    }
    const ratio = Math.max((x1 - x0) / (FR - FL), (y1 - y0) / (FB - FTp));
    if (!(ratio > 0) || !isFinite(ratio)) return;
    dist *= Math.pow(ratio, k);
    offX += ((x0 + x1) / 2 - (FL + FR) / 2) * k;
    offY += ((y0 + y1) / 2 - (FTp + FB) / 2) * k;
    camera.setViewOffset(W0, H0, offX, offY, W0, H0);
    camera.updateProjectionMatrix();
  }
  function resize() {
    W0 = canvas.clientWidth; H0 = canvas.clientHeight;
    if (!W0 || !H0) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(W0, H0, false);
    camera.aspect = W0 / H0;
    wide = innerWidth > 900;
    region();
    for (let i = 0; i < 40; i++) solve(1);
    lastSig = '';                                     // холст очистился — перерисовать
  }
  let lastSig = '';
  // мягкие тени — всем материалам сцены, включая отделки, которые сейчас не надеты
  scene.traverse((o) => { if (o.isMesh) [].concat(o.material).forEach(pcss); });
  FLOOR.forEach(pcss); WALLIN.forEach(pcss);

  house.scale.setScalar(scale);
  placeProps();
  setFinish(st.fin);
  resize();
  new ResizeObserver(resize).observe(canvas);
  canvas.parentElement.classList.add('on');
  const API = {
    changed(kind) {
      if (kind === 'area') scaleT = Math.sqrt(st.area / 101) * 0.1;
      if (kind === 'fin') { setFinish(st.fin); liftUntil = performance.now() + 3200; }
      jingleV += kind === 'fin' ? 4 : 1.2;
    },
    frame(now, dt) {
      scale = lerp(scale, scaleT, 1 - Math.exp(-dt * 6));
      house.scale.setScalar(scale);
      placeProps();
      const liftT = hover || tapLift || now < liftUntil ? 1 : 0;      // крыша открыта, пока курсор над сценой или сразу после смены отделки
      lift = lerp(lift, liftT, 1 - Math.exp(-dt * (liftT ? 4.5 : 3)));
      const le = lift * lift * (3 - 2 * lift);
      roof.position.copy(LIFT.pos).multiplyScalar(le); roof.rotation.set(LIFT.rx * le, 0, 0);
      pipes.visible = le < 0.01;
      furnK = lerp(furnK, fin === 2 ? 1 : 0, 1 - Math.exp(-dt * 6));
      furn.visible = furnK > 0.02; furn.scale.set(1, Math.max(0.001, furnK), 1);
      M.glass.emissiveIntensity = lerp(M.glass.emissiveIntensity, fin === 2 ? 0.35 : 0, 1 - Math.exp(-dt * 4));
      roomLight.intensity = (fin === 2 ? 1.6 : 0.5) * lift;
      jingleV += (-jingle * 60 - jingleV * 7) * dt; jingle += jingleV * dt;
      keyring.rotation.y = house.rotation.y + 0.25 + jingle * 0.05;
      k1.rotation.z = -0.18 + jingle * 0.05; k2.rotation.z = 0.62 - jingle * 0.04;
      mx = lerp(mx, tmx, 1 - Math.exp(-dt * 3)); my = lerp(my, tmy, 1 - Math.exp(-dt * 3));
      az = 0.7 + mx * 0.08; el = 0.66 - my * 0.04;
      solve(1 - Math.exp(-dt * 5));
      // перерисовка только когда в кадре что-то сдвинулось: мягкие тени не бесплатны, а в покое сцена неподвижна
      const sig = [camera.position.x, camera.position.y, camera.position.z, offX, offY, house.scale.x, roof.position.y,
        furn.scale.y, keyring.rotation.y, k1.rotation.z, M.glass.emissiveIntensity, roomLight.intensity, fin, W0, H0]
        .map((v) => Math.round(v * 1e4)).join(',');
      if (sig !== lastSig) { lastSig = sig; renderer.render(scene, camera); }
    },
  };
  // отладка: ?ipdbg — состояние кадра, ручной шаг анимации (если вкладка в фоне и rAF стоит)
  if (DBG) window.__ip = {
    state: () => ({ dist, offX, offY, FL, FR, FTp, FB, W0, H0, scale, lift, roofY: roof.position.y }),
    lift: (v) => { liftUntil = v ? 1e15 : 0; },
    tick: (n = 60) => { for (let i = 0; i < n; i++) API.frame(performance.now() + i * 33, 1 / 30); },
    tune: (o) => {
      if (o.tanA != null) PCSS_U.uPcssScale.value = (SHC.far - SHC.near) * o.tanA / (2 * SHC.half);
      if (o.search != null) PCSS_U.uPcssSearch.value = o.search;
      if (o.sun != null) sun.intensity = o.sun;
      if (o.hemi != null) hemi.intensity = o.hemi;
      if (o.table != null) table.material.opacity = o.table;
      if (o.ao != null) house.children.forEach((c) => { if (c.renderOrder === 1) c.material.opacity = o.ao; });
      lastSig = ''; API.frame(performance.now(), 1 / 30);
    },
  };
  return API;
}
})();
