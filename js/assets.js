// 画像の読み込み。まだ生成されていない画像は null（描画側で代わりの絵を出す）
const DIRS = { sprite: "sprites", icon: "icons", bg: "bg", fx: "fx", ui: "ui" };
const cache = new Map();
const hueCache = new Map();
export let META = {};

export async function loadMeta() {
  try { META = await (await fetch("assets/meta.json", { cache: "no-cache" })).json(); } catch { META = {}; }
  return META;
}

// まだ無い絵は同じ種類の別の絵で代用する（META は生成済みの一覧）
const SUBST = { i_w_: "i_w_sword", i_h_: "i_h_helm", i_b_: "i_b_leather", i_a_: "i_a_ring", i_l_: "i_w_sword", i_: "i_coin", c: "c01_mage", m: "m01_slime", b: "b01_kingslime" };
export function resolve(id) {
  if (!Object.keys(META).length || META[id]) return id;
  for (const [p, alt] of Object.entries(SUBST)) if (id.startsWith(p) && META[alt]) return alt;
  return id;
}
export function img(kind, id) {
  id = resolve(id);
  const key = `${kind}/${id}`;
  let e = cache.get(key);
  if (!e) {
    e = { img: new Image(), ok: false, failed: false };
    e.img.decoding = "async";
    e.img.onload = () => { e.ok = true; };
    e.img.onerror = () => { e.failed = true; };
    e.img.src = `assets/${DIRS[kind]}/${id}.png`;
    cache.set(key, e);
  }
  return e.ok ? e.img : null;
}
export const src = (kind, id) => `assets/${DIRS[kind]}/${resolve(id)}.png`;

export function preload(list) {
  return Promise.all(list.map(([kind, id0]) => new Promise((res) => {
    const id = resolve(id0);
    img(kind, id);
    const e = cache.get(`${kind}/${id}`);
    if (e.ok || e.failed) return res();
    const done = () => res();
    e.img.addEventListener("load", done, { once: true });
    e.img.addEventListener("error", done, { once: true });
    setTimeout(done, 8000);
  })));
}

// 色相をずらした版（周回ごとの色違い・黄金スライム）。mode: "hue" | "gold" | "white"
export function variant(kind, id, hue, mode = "hue") {
  const base = img(kind, id);
  if (!base) return null;
  if (mode === "hue" && !hue) return base;
  const key = `${kind}/${id}/${mode}/${hue}`;
  let c = hueCache.get(key);
  if (c) return c;
  c = document.createElement("canvas");
  c.width = base.naturalWidth; c.height = base.naturalHeight;
  const g = c.getContext("2d");
  g.drawImage(base, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  const p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    if (!p[i + 3]) continue;
    if (mode === "white") { p[i] = p[i + 1] = p[i + 2] = 255; continue; }
    let [h, s, l] = rgb2hsl(p[i], p[i + 1], p[i + 2]);
    if (mode === "gold") { h = 44 / 360 + (h - 0.3) * 0.05; s = Math.min(1, s * 0.6 + 0.45); l = Math.min(0.92, l * 1.08 + 0.04); }
    else h = (h + hue / 360) % 1;
    const [r, gg, b] = hsl2rgb(h, s, l);
    p[i] = r; p[i + 1] = gg; p[i + 2] = b;
  }
  g.putImageData(d, 0, 0);
  hueCache.set(key, c);
  return c;
}

function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
function hsl2rgb(h, s, l) {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
  return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
}
