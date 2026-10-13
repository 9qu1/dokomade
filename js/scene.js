// 横スクロールの戦闘シーン（canvas）。線路を走る魔法の列車と、線路をふさぐ魔物
// 世界の高さは 180 ドット。横が狭い画面（スマホの縦）は、上に空を足して引きで映す（列車が数両見えるように）
import { img, variant, META } from "./assets.js";
import { fmt } from "./big.js";
import { COMPANIONS, FLYING } from "./data.js";
import * as B from "./balance.js";

const WORLD_H = 180;
const GROUND = 141;      // レールの上面（車輪と敵の足もと）
const MIN_GW = 310;      // これより横が狭いときは引きで映す
const CAR_SCALE = 0.86;  // 車両は機関車より少し小さく
const JOINT = 26;        // レールのつなぎ目の間隔（ガタンゴトン）
const FLY_CREW = new Set(["k12_dragon"]);
const FX_COLORS = {
  magic: "#c77dff", arrow: "#e9f5db", holy: "#ffe066", shuriken: "#cfd8dc", slash: "#ffffff", punch: "#ffb703",
  potion: "#80ed99", note: "#72ddf7", lance: "#4cc9f0", rock: "#b08968", beam: "#ff4d6d", fire: "#ff7b00", lamp: "#9ff3ff",
};

export class Scene {
  constructor(canvas, game) {
    this.cv = canvas;
    this.g = canvas.getContext("2d", { alpha: false });
    this.game = game;
    this.parts = [];
    this.nums = [];
    this.projs = [];
    this.rings = [];
    this.shake = 0;
    this.flash = 0;
    this.t = 0;
    this.heroLunge = 0;      // 機関車の主砲（ライト）の反動
    this.enemyHitT = 0;
    this.dying = null;       // 倒れた敵の見た目
    this.bgPrev = null;      // 背景の切り替え用
    this.bgFade = 0;
    this.lastBiome = null;
    this.compTimers = {};
    this.off = 0;            // 見た目の走行距離（ドット）。減速・加速をなめらかにするため game とは別に持つ
    this.speed = 0;
    this.smokeT = 0;
    this.recoil = 0;
    this.locoBump = 0;
    this.dpr = 1;
    this.oy = 0;
    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    game.on("hit", (e) => this.onHit(e));
    game.on("kill", (e) => this.onKill(e));
    game.on("spawn", () => { this.enemyHitT = 0; });
    game.on("bossIntro", () => { this.shake = Math.max(this.shake, 4); });
    game.on("tapMiss", (e) => this.onTapMiss(e));
  }

  resize() {
    const r = this.cv.parentElement.getBoundingClientRect();
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    this.dpr = dpr;
    const W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
    if (this.cv.width !== W || this.cv.height !== H) { this.cv.width = W; this.cv.height = H; }
    const VH = Math.max(WORLD_H, (MIN_GW * H) / W); // 見えている高さ（ドット）
    this.S = H / VH;                // 1ドットの大きさ（デバイスpx）
    this.GW = W / this.S;           // 世界の幅（ドット）
    this.oy = VH - WORLD_H;         // 世界の上に足した空の高さ（ドット）
    this.cssW = r.width; this.cssH = r.height;
    this.g.imageSmoothingEnabled = false;
  }
  // 画面(CSS px) → 世界(ドット)
  toWorld(cx, cy) {
    const r = this.cv.getBoundingClientRect();
    return { x: ((cx - r.left) * this.dpr) / this.S, y: ((cy - r.top) * this.dpr) / this.S - this.oy };
  }
  get top() { return -this.oy; } // 画面のいちばん上（ドット）
  get enemyX() {
    const e = this.game.combat.enemy;
    return this.GW - (e && e.boss ? 54 : Math.max(40, Math.min(58, this.GW * 0.14)));
  }
  get locoX() { return this.GW - 142; } // 機関車の中心
  get heroX() { return this.locoX; }
  lampPos() {
    const m = META.t_loco || { w: 75, h: 46 };
    return { x: this.locoX - m.w / 2 + m.w * 0.9 + this.recoil, y: GROUND + this.locoBump - m.h * 0.53 };
  }

  // ---------- イベントからの演出 ----------
  onHit(e) {
    const en = this.game.combat.enemy;
    const ex = this.enemyX, ey = this.enemyCenterY(en);
    if (e.tap) {
      const p = e.x != null ? this.toWorld(e.x, e.y) : { x: ex + (Math.random() - 0.5) * 26, y: ey - 6 - Math.random() * 16 };
      const combo = e.combo || 0;
      this.addNum(e.dmg, p.x, p.y - 6, e.crit ? "crit" : e.echo ? "echo" : "tap", combo);
      // コンボが増えるほど斬撃が大きく・色が変わる
      const col = combo >= 300 ? "rainbow" : combo >= 100 ? "#ff5bd0" : combo >= 50 ? "#ffb703" : combo >= 10 ? "#ffe066" : "#ffffff";
      this.slash(ex, ey, e.crit || combo >= 50, col, Math.min(3, 1 + combo / 100));
      if (combo >= 100 && !e.auto) this.shake = Math.max(this.shake, 1.2);
      if (e.crit) { this.shake = Math.max(this.shake, 3); this.flash = 0.25; }
    } else {
      // 機関車の攻撃：水晶のライトから光線
      this.heroLunge = 1;
      const l = this.lampPos();
      this.projs.push({ kind: "lamp", x: l.x, y: l.y, x0: l.x, y0: l.y, x1: ex - 6, y1: ey + (Math.random() - 0.5) * 8, t: 0, dur: 0.12, c: FX_COLORS.lamp });
      this.rings.push({ x: l.x + 2, y: l.y, r: 1, vr: 60, t: 0, life: 0.14, c: "#dffcff" });
      this.addNum(e.dmg, ex + (Math.random() - 0.5) * 22, ey - 14 - Math.random() * 10, "dps");
      this.sparks(ex - 6, ey, 5, "#dffcff");
    }
    this.enemyHitT = Math.max(this.enemyHitT, e.tap ? 1 : 0.45);
  }
  onTapMiss(e) {
    if (e.x == null) return;
    const p = this.toWorld(e.x, e.y);
    this.sparks(p.x, p.y, 4, "#ffffff");
  }
  onKill(ev) {
    const e = ev.enemy;
    const ex = this.enemyX, ey = this.enemyCenterY(e);
    const sp = variant("sprite", e.sprite, e.hue);
    this.dying = { e, t: 0, x: ex, sp };
    // 爆発
    const n = e.boss ? 90 : 34;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 30 + Math.random() * (e.boss ? 150 : 90);
      this.parts.push({ x: ex, y: ey, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, g: 160, life: 0.5 + Math.random() * 0.6, t: 0, s: 1 + Math.random() * 2.5, c: pick(["#ffffff", "#ffe066", "#ff9f1c", "#ff595e", e.elite ? "#c77dff" : "#ffd6a5"]) });
    }
    this.rings.push({ x: ex, y: ey, r: 4, vr: e.boss ? 260 : 150, t: 0, life: 0.35, c: "#ffffff" });
    // コイン
    const coins = e.boss ? 24 : 7;
    for (let i = 0; i < coins; i++) {
      this.parts.push({ x: ex, y: ey, vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 90, g: 260, life: 0.9 + Math.random() * 0.4, t: 0, s: 2, c: "#ffd60a", coin: true, home: 0.45 + Math.random() * 0.25 });
    }
    if (e.boss) { this.shake = 7; this.flash = 0.6; }
  }
  slash(x, y, big, col = null, k = 1) {
    const c = col === "rainbow" ? pick(["#ff4d6d", "#ffb703", "#ffe066", "#80ed99", "#48cae4", "#9d4edd"]) : col || (big ? "#ffe066" : "#ffffff");
    this.rings.push({ x, y, r: 2, vr: (big ? 190 : 110) * k, t: 0, life: big ? 0.28 : 0.18, c, slash: true, a: Math.random() * Math.PI });
    this.sparks(x, y, Math.round((big ? 16 : 7) * k), c);
  }
  // 必殺技：流星群
  meteor() {
    const ex = this.enemyX, ey = this.enemyCenterY(this.game.combat.enemy);
    for (let i = 0; i < 14; i++) {
      const delay = i * 0.05;
      const sx = ex + 60 + Math.random() * 90, sy = this.top - 20 - Math.random() * 40;
      this.projs.push({ kind: "fire", x: sx, y: sy, x0: sx, y0: sy, x1: ex + (Math.random() - 0.5) * 30, y1: ey + (Math.random() - 0.5) * 20, t: -delay, dur: 0.45, c: pick(["#ffb703", "#ff7b00", "#ffe066"]) });
    }
    setTimeout(() => { this.shake = 10; this.flash = 0.8; this.rings.push({ x: ex, y: ey, r: 6, vr: 320, t: 0, life: 0.5, c: "#ffe066" }); this.sparks(ex, ey, 80, "#ffb703"); }, 650);
  }
  goldSpark(cx, cy) {
    const p = cx == null ? { x: this.enemyX, y: this.enemyCenterY(this.game.combat.enemy) } : this.toWorld(cx, cy);
    this.parts.push({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 60, vy: -50 - Math.random() * 40, g: 200, life: 0.9, t: 0, s: 2, c: "#ffd60a", coin: true, home: 0.3 });
  }
  sparks(x, y, n, c) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 110;
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 60, life: 0.2 + Math.random() * 0.25, t: 0, s: 1 + Math.random() * 1.5, c });
    }
  }
  addNum(d, x, y, kind, combo = 0) {
    if (this.nums.length > 50) this.nums.shift();
    this.nums.push({ text: fmt(d), x, y, t: 0, life: kind === "crit" ? 1.1 : 0.8, kind, combo });
  }
  enemyCenterY(e) {
    if (!e) return GROUND - 20;
    const m = META[e.sprite] || { h: 32 };
    return (FLYING.has(e.sprite) ? GROUND - 22 : GROUND) - m.h / 2;
  }

  // ---------- 描画 ----------
  draw(dt) {
    this.t += dt;
    const g = this.g, S = this.S;
    const game = this.game, c = game.combat;
    const W = this.cv.width, H = this.cv.height;
    // 走る速さ：敵がいない間は全速、戦っている間は押し合いでゆっくり（なめらかに加速・減速）
    const cruise = 40 * Math.max(1, c.rush) * (game.speed ? Math.min(2, game.speed()) : 1);
    const target = c.phase === "walk" ? cruise : 7;
    this.speed += (target - this.speed) * Math.min(1, dt * (target > this.speed ? 3 : 6));
    this.off += this.speed * dt;
    // 揺れ
    this.shake = Math.max(0, this.shake - dt * 18);
    const sx = (Math.random() - 0.5) * this.shake * S, sy = (Math.random() - 0.5) * this.shake * S;
    g.setTransform(1, 0, 0, 1, 0, 0);
    const biome = game.biome();
    if (this.lastBiome !== biome.id) {
      if (this.lastBiome) { this.bgPrev = this.lastBiome; this.bgFade = 1; }
      this.lastBiome = biome.id;
    }
    // 空
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, biome.sky); sky.addColorStop(1, "#10131f");
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    g.setTransform(1, 0, 0, 1, sx, sy + this.oy * S);
    this.drawBg(biome.id, this.off, 1);
    if (this.bgPrev && this.bgFade > 0) { this.bgFade -= dt * 0.8; this.drawBg(this.bgPrev, this.off, Math.max(0, this.bgFade)); }
    // 周回の色味
    const loop = B.loopIndex(game.s.stage);
    if (loop > 0) this.cover(`hsla(${(loop * 67) % 360},70%,25%,0.22)`);
    // 線路
    this.drawRails();
    // 突進中の流線
    if (c.rush >= 2 && c.phase === "walk") this.speedLines(dt);
    // 列車
    this.drawTrain(dt);
    // 敵
    this.drawEnemy(dt);
    // 黄金スライム
    this.drawLucky();
    // 弾・輪・粒・数字
    this.drawProjectiles(dt);
    this.drawRings(dt);
    this.drawParts(dt);
    this.drawNums(dt);
    // フラッシュ・フィーバー
    const fx = game.effects();
    if (fx.gaugeFever) this.cover(`hsla(${(this.t * 240) % 360},100%,60%,0.10)`);
    if (fx.freeze) this.cover("rgba(120,200,255,0.18)");
    if (fx.midas && Math.random() < 0.4) this.parts.push({ x: Math.random() * this.GW, y: this.top - 4, vx: 0, vy: 40 + Math.random() * 40, g: 30, life: 2.5, t: 0, s: 1.6, c: "#ffd60a" });
    if (fx.fever) this.cover(`rgba(255,80,40,${0.10 + 0.06 * Math.sin(this.t * 10)})`);
    if (this.flash > 0) { this.cover(`rgba(255,255,255,${Math.min(0.7, this.flash)})`); this.flash -= dt * 2.5; }
  }
  // 画面全体に色をかぶせる（揺れ・引きの位置に関係なく）
  cover(style) {
    const g = this.g;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = style; g.fillRect(0, 0, this.cv.width, this.cv.height);
    g.restore();
  }

  drawBg(id, off, alpha) {
    const g = this.g, S = this.S;
    const im = img("bg", id);
    if (!im) {
      // まだ画像がないとき：地面だけ
      g.globalAlpha = alpha;
      g.fillStyle = "#3a5a40"; g.fillRect(-S, GROUND * S, this.cv.width + 2 * S, (WORLD_H - GROUND) * S);
      g.globalAlpha = 1;
      return;
    }
    const bw = im.naturalWidth, bh = im.naturalHeight;
    const sc = WORLD_H / bh;
    const tw = bw * sc; // ドット
    const o = ((off % (tw * 2)) + tw * 2) % (tw * 2);
    g.globalAlpha = alpha;
    // 引きで映すとき：絵の上端を上下反転して上に足す（つなぎ目が目立たない）
    const ext = this.oy > 0 ? Math.min(bh, Math.ceil((this.oy + 2) / sc)) : 0;
    let i = Math.floor(o / tw) - 1;
    for (let x = -((o % tw)) - tw; x < this.GW + tw; x += tw, i++) {
      const mirror = ((i % 2) + 2) % 2 === 1;
      const dx = Math.floor(x * S), dw = Math.ceil(tw * S) + 1;
      g.save();
      if (mirror) { g.translate(dx + dw, 0); g.scale(-1, 1); } else g.translate(dx, 0);
      g.drawImage(im, 0, 0, dw, WORLD_H * S);
      if (ext) { g.scale(1, -1); g.drawImage(im, 0, 0, bw, ext, 0, 0, dw, ext * sc * S); }
      g.restore();
    }
    // 上へ行くほど空の色に溶かす（反転した絵の違和感を消す）
    if (this.oy > 0) {
      const gr = g.createLinearGradient(0, this.top * S, 0, 0);
      gr.addColorStop(0, topColor(im)); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.fillRect(-2 * S, (this.top - 2) * S, this.cv.width + 4 * S, (this.oy + 2) * S);
    }
    g.globalAlpha = 1;
  }

  // 線路（砂利・まくら木・レール）。背景と同じ速さで流れる
  drawRails() {
    const g = this.g, S = this.S, GW = this.GW;
    const X0 = -4 * S, XW = (GW + 8) * S;
    g.fillStyle = "rgba(30,22,34,0.55)"; g.fillRect(X0, Math.round((GROUND + 1) * S), XW, Math.round(6 * S));
    g.fillStyle = "rgba(150,140,130,0.35)"; g.fillRect(X0, Math.round((GROUND + 6) * S), XW, Math.max(1, Math.round(0.8 * S)));
    const step = 9, o = ((this.off % step) + step) % step;
    for (let x = -o - step; x < GW + step; x += step) {
      g.fillStyle = "#4a2f1c"; g.fillRect(Math.round(x * S), Math.round((GROUND + 1.5) * S), Math.round(6 * S), Math.round(3 * S));
      g.fillStyle = "#7a5230"; g.fillRect(Math.round(x * S), Math.round((GROUND + 1.5) * S), Math.round(6 * S), Math.max(1, Math.round(0.8 * S)));
    }
    g.fillStyle = "#2b2f3a"; g.fillRect(X0, Math.round((GROUND - 0.2) * S), XW, Math.round(2 * S));
    g.fillStyle = "#d9e2ec"; g.fillRect(X0, Math.round((GROUND - 0.2) * S), XW, Math.max(1, Math.round(0.7 * S)));
    // つなぎ目
    const oj = ((this.off % JOINT) + JOINT) % JOINT;
    g.fillStyle = "#1b1e26";
    for (let x = -oj; x < GW + JOINT; x += JOINT) g.fillRect(Math.round(x * S), Math.round((GROUND - 0.2) * S), Math.max(1, Math.round(0.8 * S)), Math.round(2 * S));
  }

  speedLines(dt) {
    const g = this.g, S = this.S;
    g.fillStyle = "rgba(255,255,255,0.35)";
    for (let i = 0; i < 7; i++) {
      const y = ((i * 37 + this.t * 97) % 120) + 10;
      const x = ((this.GW + 60) - ((this.t * 900 + i * 131) % (this.GW + 120)));
      g.fillRect(Math.floor(x * S), Math.floor(y * S), Math.floor((20 + (i % 3) * 14) * S), Math.max(1, Math.floor(S * 0.8)));
    }
  }

  sprite(id, x, yFeet, { flip = false, hue = 0, alpha = 1, scale = 1, white = 0, sq = 0 } = {}) {
    // x: 中心, yFeet: 足もと
    const g = this.g, S = this.S;
    const im = variant("sprite", id, hue);
    if (!im) return this.placeholder(id, x, yFeet, scale);
    const w = im.width * scale, h = im.height * scale;
    const hw = w * (1 + sq), hh = h * (1 - sq);
    const dx = Math.round((x - hw / 2) * S), dy = Math.round((yFeet - hh) * S);
    g.globalAlpha = alpha;
    if (flip) { g.save(); g.translate(dx + Math.round(hw * S), dy); g.scale(-1, 1); g.drawImage(im, 0, 0, Math.round(hw * S), Math.round(hh * S)); g.restore(); }
    else g.drawImage(im, dx, dy, Math.round(hw * S), Math.round(hh * S));
    if (white > 0) {
      const wim = variant("sprite", id, 0, "white");
      if (wim) {
        g.globalAlpha = alpha * white;
        if (flip) { g.save(); g.translate(dx + Math.round(hw * S), dy); g.scale(-1, 1); g.drawImage(wim, 0, 0, Math.round(hw * S), Math.round(hh * S)); g.restore(); }
        else g.drawImage(wim, dx, dy, Math.round(hw * S), Math.round(hh * S));
      }
    }
    g.globalAlpha = 1;
    return { w, h };
  }
  placeholder(id, x, yFeet, scale) {
    const g = this.g, S = this.S;
    const m = META[id] || { w: 28, h: 30 };
    const w = m.w * scale, h = m.h * scale;
    g.fillStyle = id.startsWith("b") ? "#7b2cbf" : id.startsWith("t_") ? "#c1121f" : id.startsWith("k") ? "#4895ef" : "#52b788";
    g.fillRect(Math.round((x - w / 2) * S), Math.round((yFeet - h) * S), Math.round(w * S), Math.round(h * S));
    g.fillStyle = "#fff";
    g.fillRect(Math.round((x - w / 6) * S), Math.round((yFeet - h * 0.7) * S), Math.round(3 * S), Math.round(3 * S));
    return { w, h };
  }
  shadow(x, w) {
    const g = this.g, S = this.S;
    g.fillStyle = "rgba(0,0,0,0.28)";
    g.beginPath();
    g.ellipse(x * S, (GROUND + 1) * S, (w * 0.4) * S, 2.2 * S, 0, 0, Math.PI * 2);
    g.fill();
  }
  // レールのつなぎ目を越えるときに 1 ドット跳ねる（前の車両から順に）
  bump(x) {
    if (this.speed < 3) return 0;
    const p = (((x + this.off) % JOINT) + JOINT) % JOINT;
    return p < Math.min(3, this.speed * 0.06) ? -1 : 0;
  }

  // 機関車と車両。新しく連結した（強い）車両ほど機関車の近くに並ぶ
  drawTrain(dt) {
    const game = this.game, c = game.combat, S = this.S;
    const fighting = c.phase === "fight" && c.enemy;
    this.heroLunge = Math.max(0, this.heroLunge - dt * 7);
    this.recoil = -Math.sin(this.heroLunge * Math.PI) * 1.5;
    const lx = this.locoX;
    const lm = META.t_loco || { w: 75, h: 46 };
    this.locoBump = this.bump(lx + lm.w * 0.3);
    // 車両の並び
    const ks = [];
    for (let k = COMPANIONS.length - 1; k >= 0; k--) if (game.s.comp[k] > 0) ks.push(k);
    let right = lx - lm.w / 2 + 5;
    const cars = [];
    let hidden = 0;
    for (const k of ks) {
      const cm = META[COMPANIONS[k].car] || { w: 62, h: 34 };
      const w = cm.w * CAR_SCALE, h = cm.h * CAR_SCALE;
      if (right <= 0) { hidden++; continue; }
      cars.push({ k, x: right - w / 2, w, h });
      right -= w - 3;
    }
    // うしろ（左）から描く
    for (let i = cars.length - 1; i >= 0; i--) {
      const car = cars[i], cp = COMPANIONS[car.k];
      const yb = GROUND + this.bump(car.x);
      this.sprite(cp.car, car.x, yb, { scale: CAR_SCALE });
      // 屋根の乗務員
      const fly = FLY_CREW.has(cp.crew);
      const cy = yb - car.h + 5 - (fly ? 7 + Math.sin(this.t * 3 + i) * 2 : 0) + (fighting ? 0 : Math.sin(this.t * 6 + i) * 0.4);
      this.sprite(cp.crew, car.x - 1, cy, { scale: CAR_SCALE });
      // 攻撃の弾（見た目）
      if (fighting) {
        this.compTimers[car.k] = (this.compTimers[car.k] ?? Math.random()) - dt * (0.7 + game.speed() * 0.3);
        if (this.compTimers[car.k] <= 0) {
          this.compTimers[car.k] = 1.1 + Math.random() * 0.9;
          this.fire(cp.fx, car.x + 5, cy - 12);
        }
      }
    }
    // 画面の外に続く車両の数
    const total = ks.length;
    if (total >= 2 && (hidden > 0 || right < 20)) this.label(`◀ ${total}両編成`, 4, GROUND + 15);
    // 機関車
    const ly = GROUND + this.locoBump;
    this.sprite("t_loco", lx + this.recoil, ly, { sq: fighting ? Math.sin(this.t * 14) * 0.006 : 0 });
    // 煙突の煙（走っている間はうしろへ流れる）
    this.smokeT -= dt;
    if (this.smokeT <= 0) {
      const run = Math.min(1, this.speed / 40);
      this.smokeT = 0.26 - run * 0.16;
      const chx = lx - lm.w / 2 + lm.w * 0.74 + this.recoil, chy = ly - lm.h + 1;
      this.parts.push({ x: chx, y: chy, vx: -8 - run * 55 + (Math.random() - 0.5) * 6, vy: -14 - Math.random() * 8, g: -4, life: 1.1 + Math.random() * 0.4, t: 0, s: 3, grow: 5, c: pick(["#f1f3f7", "#dde2ea", "#c9ced8"]), smoke: true });
    }
    // 車輪の火花（突進中）
    if (c.rush >= 2 && this.speed > 30 && Math.random() < 0.6) {
      const wx = lx - lm.w * 0.2 + (Math.random() - 0.5) * lm.w * 0.6;
      this.parts.push({ x: wx, y: GROUND - 1, vx: -40 - Math.random() * 60, vy: -20 - Math.random() * 30, g: 160, life: 0.3, t: 0, s: 1, c: pick(["#ffd166", "#fff3b0", "#ff9f1c"]) });
    }
    // 水晶のライトの光
    const l = this.lampPos();
    const g = this.g;
    const pulse = 0.55 + 0.15 * Math.sin(this.t * 4) + this.heroLunge * 0.4;
    g.globalCompositeOperation = "lighter";
    const grd = g.createRadialGradient(l.x * S, l.y * S, 0.5 * S, l.x * S, l.y * S, 11 * S);
    grd.addColorStop(0, `rgba(170,245,255,${pulse})`); grd.addColorStop(1, "rgba(80,180,255,0)");
    g.fillStyle = grd; g.fillRect((l.x - 11) * S, (l.y - 11) * S, 22 * S, 22 * S);
    g.fillStyle = `rgba(160,235,255,${0.06 + this.heroLunge * 0.08})`;
    g.beginPath(); g.moveTo(l.x * S, (l.y - 2) * S); g.lineTo((l.x + 70) * S, (l.y - 12) * S); g.lineTo((l.x + 70) * S, (l.y + 10) * S); g.lineTo(l.x * S, (l.y + 2) * S); g.fill();
    g.globalCompositeOperation = "source-over";
  }
  label(text, x, y) {
    const g = this.g, S = this.S;
    g.font = `${Math.round(7 * S)}px "DotGothic16", monospace`;
    g.textAlign = "left"; g.textBaseline = "middle";
    g.lineWidth = Math.max(2, 1.6 * S); g.strokeStyle = "#1a1030";
    g.strokeText(text, x * S, y * S);
    g.fillStyle = "#ffe8a3"; g.fillText(text, x * S, y * S);
  }

  fire(kind, x, y) {
    const ex = this.enemyX, ey = this.enemyCenterY(this.game.combat.enemy);
    this.projs.push({ kind, x, y, x0: x, y0: y, x1: ex - 4, y1: ey + (Math.random() - 0.5) * 10, t: 0, dur: 0.28 + Math.random() * 0.1, c: FX_COLORS[kind] || "#fff" });
  }
  drawProjectiles(dt) {
    const g = this.g, S = this.S;
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const p = this.projs[i];
      p.t += dt;
      if (p.t < 0) continue; // 遅れて出る弾（流星群）
      const k = Math.min(1, p.t / p.dur);
      const arc = p.kind === "potion" || p.kind === "rock" ? -Math.sin(k * Math.PI) * 18 : 0;
      p.x = p.x0 + (p.x1 - p.x0) * k; p.y = p.y0 + (p.y1 - p.y0) * k + arc;
      g.fillStyle = p.c;
      if (p.kind === "lamp") {
        // 光線：ライトから敵まで一瞬のびる
        g.globalCompositeOperation = "lighter";
        g.strokeStyle = p.c; g.globalAlpha = 1 - k * 0.5;
        g.lineWidth = Math.max(1, 2.2 * S * (1 - k * 0.6));
        g.beginPath(); g.moveTo(p.x0 * S, p.y0 * S); g.lineTo(p.x * S, p.y * S); g.stroke();
        g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
      } else if (p.kind === "arrow" || p.kind === "beam" || p.kind === "lance") {
        g.fillRect(Math.round((p.x - 6) * S), Math.round(p.y * S), Math.round(8 * S), Math.max(1, Math.round((p.kind === "beam" ? 1.6 : 1) * S)));
      } else {
        const r = p.kind === "fire" || p.kind === "magic" ? 3 : 2;
        g.globalCompositeOperation = "lighter";
        g.globalAlpha = 0.5;
        g.fillRect(Math.round((p.x - r - 1) * S), Math.round((p.y - r - 1) * S), Math.round((r * 2 + 2) * S), Math.round((r * 2 + 2) * S));
        g.globalAlpha = 1;
        g.fillRect(Math.round((p.x - r) * S), Math.round((p.y - r) * S), Math.round(r * 2 * S), Math.round(r * 2 * S));
        g.globalCompositeOperation = "source-over";
      }
      if (k >= 1) { this.sparks(p.x, p.y, 3, p.c); this.projs.splice(i, 1); }
    }
  }

  drawEnemy(dt) {
    const game = this.game, c = game.combat, e = c.enemy;
    const x0 = this.enemyX;
    // 倒れた敵
    if (this.dying) {
      const d = this.dying;
      d.t += dt;
      const k = d.t / 0.35;
      if (k >= 1) this.dying = null;
      else this.sprite(d.e.sprite, d.x + k * 8, (d.e.flying ? GROUND - 22 : GROUND), { hue: d.e.hue, alpha: 1 - k, white: 1 - k, scale: 1 + k * 0.2 });
    }
    if (!e || c.phase === "dead") return;
    this.enemyHitT = Math.max(0, this.enemyHitT - dt * 11);
    const age = (performance.now() - e.born) / 1000;
    const enter = e.boss ? 1.2 : 0.22;
    const k = Math.min(1, age / enter);
    const x = x0 + (1 - k) * (1 - k) * (this.GW - x0 + 40) + this.enemyHitT * 3;
    const flying = e.flying;
    const y = (flying ? GROUND - 22 + Math.sin(this.t * 3) * 3 : GROUND);
    const m = META[e.sprite] || { w: 30, h: 30 };
    // ボスのオーラ
    if (e.boss || e.elite) {
      const g = this.g, S = this.S;
      const cy = y - m.h / 2;
      const rad = (Math.max(m.w, m.h) * 0.62 + Math.sin(this.t * 5) * 3);
      const grd = g.createRadialGradient(x * S, cy * S, 2, x * S, cy * S, rad * S);
      const col = e.mega ? "255,215,0" : e.boss ? "255,40,60" : "170,90,255";
      grd.addColorStop(0, `rgba(${col},0.35)`); grd.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = grd; g.fillRect((x - rad) * S, (cy - rad) * S, rad * 2 * S, rad * 2 * S);
      // オーラの粒は体の外側（左右のふち）から立ちのぼらせる
      if (Math.random() < (e.boss ? 0.35 : 0.2)) { const side = Math.random() < 0.5 ? -1 : 1; this.parts.push({ x: x + side * (m.w * 0.42 + Math.random() * 6), y: y - Math.random() * m.h * 0.6, vx: side * 6, vy: -18 - Math.random() * 26, g: 0, life: 0.7, t: 0, s: 1.4, c: e.mega ? "#ffd60a" : e.boss ? "#ff4d6d" : "#c77dff" }); }
    }
    if (!flying) this.shadow(x, m.w);
    this.sprite(e.sprite, x, y, { hue: e.hue, white: this.enemyHitT * 0.8, sq: Math.sin(this.t * 3) * 0.02 });
  }

  drawLucky() {
    const game = this.game;
    const p = game.luckyPos();
    if (!p) return;
    const g = this.g, S = this.S;
    const x = p.x * this.GW, y = p.y * WORLD_H + 12;
    const im = variant("sprite", "m01_slime", 0, "gold");
    // 光
    const grd = g.createRadialGradient(x * S, (y - 8) * S, 1, x * S, (y - 8) * S, 22 * S);
    grd.addColorStop(0, "rgba(255,230,120,0.7)"); grd.addColorStop(1, "rgba(255,200,0,0)");
    g.fillStyle = grd; g.fillRect((x - 22) * S, (y - 30) * S, 44 * S, 44 * S);
    if (im) {
      const w = im.width, h = im.height;
      g.drawImage(im, Math.round((x - w / 2) * S), Math.round((y - h) * S), Math.round(w * S), Math.round(h * S));
    } else { g.fillStyle = "#ffd60a"; g.fillRect((x - 10) * S, (y - 16) * S, 20 * S, 16 * S); }
    if (Math.random() < 0.5) this.parts.push({ x: x + (Math.random() - 0.5) * 20, y: y - Math.random() * 18, vx: (Math.random() - 0.5) * 20, vy: -15, g: 0, life: 0.5, t: 0, s: 1.2, c: pick(["#fff3b0", "#ffd60a", "#ffffff"]) });
    this.luckyBox = { x, y: y - 10, r: 20 };
  }
  hitLucky(cx, cy) {
    if (!this.game.lucky || !this.luckyBox) return false;
    const p = this.toWorld(cx, cy);
    const b = this.luckyBox;
    return Math.hypot(p.x - b.x, p.y - b.y) < b.r + 6;
  }
  luckyBurst() {
    const b = this.luckyBox; if (!b) return;
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 160;
      this.parts.push({ x: b.x, y: b.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 80, life: 0.7 + Math.random() * 0.5, t: 0, s: 1.5 + Math.random() * 2, c: pick(["#ffd60a", "#fff3b0", "#ffffff", "#ffb703"]) });
    }
    this.rings.push({ x: b.x, y: b.y, r: 4, vr: 220, t: 0, life: 0.4, c: "#ffd60a" });
    this.flash = 0.35;
  }

  drawRings(dt) {
    const g = this.g, S = this.S;
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt; r.r += r.vr * dt;
      const a = 1 - r.t / r.life;
      if (a <= 0) { this.rings.splice(i, 1); continue; }
      g.strokeStyle = r.c; g.globalAlpha = a; g.lineWidth = Math.max(1, (r.slash ? 2.5 : 1.5) * S);
      g.beginPath();
      if (r.slash) g.arc(r.x * S, r.y * S, r.r * S, r.a, r.a + Math.PI * 0.9);
      else g.arc(r.x * S, r.y * S, r.r * S, 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
    }
  }
  drawParts(dt) {
    const g = this.g, S = this.S;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.t += dt;
      if (p.t >= p.life) { this.parts.splice(i, 1); continue; }
      if (p.coin && p.t > p.home) {
        // 左上（ゴールド表示）へ吸い込まれる
        const k = (p.t - p.home) / (p.life - p.home);
        p.x += (6 - p.x) * Math.min(1, k * 0.35); p.y += (this.top - 4 - p.y) * Math.min(1, k * 0.35);
      } else {
        p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.coin && p.y > GROUND) { p.y = GROUND; p.vy *= -0.4; }
      }
      const a = p.coin ? 1 : p.smoke ? 0.75 * (1 - p.t / p.life) : 1 - p.t / p.life;
      g.globalAlpha = a;
      g.fillStyle = p.c;
      const s = p.s + (p.grow || 0) * p.t;
      g.fillRect(Math.round((p.x - s / 2) * S), Math.round((p.y - s / 2) * S), Math.max(1, Math.round(s * S)), Math.max(1, Math.round(s * S)));
    }
    g.globalAlpha = 1;
    if (this.parts.length > 600) this.parts.splice(0, this.parts.length - 600);
  }
  drawNums(dt) {
    const g = this.g, S = this.S;
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (let i = this.nums.length - 1; i >= 0; i--) {
      const n = this.nums[i];
      n.t += dt;
      if (n.t >= n.life) { this.nums.splice(i, 1); continue; }
      const k = n.t / n.life;
      const pop = n.kind === "crit" ? 1 + Math.max(0, 0.6 - n.t * 4) : 1 + Math.max(0, 0.3 - n.t * 3);
      const size = (n.kind === "crit" ? 13 : n.kind === "tap" ? 10 + Math.min(6, (n.combo || 0) / 60) : n.kind === "echo" ? 8 : 8) * pop;
      const y = n.y - k * (n.kind === "crit" ? 18 : 14);
      g.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      g.font = `${Math.round(size * S)}px "DotGothic16", monospace`;
      g.lineWidth = Math.max(2, 2.2 * S);
      g.strokeStyle = "#1a1030";
      const cb = n.combo || 0;
      const col = n.kind === "crit" ? "#ffd60a" : n.kind === "echo" ? "#b5f0ff" : n.kind === "tap" ? (cb >= 300 ? `hsl(${(this.t * 600) % 360},100%,70%)` : cb >= 100 ? "#ff9be4" : cb >= 50 ? "#ffcf6e" : cb >= 10 ? "#fff3b0" : "#ffffff") : "#ffe8c2";
      if (n.kind === "crit") {
        g.font = `${Math.round(7 * S)}px "DotGothic16", monospace`;
        g.strokeText("会心!", n.x * S, (y - 11) * S); g.fillStyle = "#ff595e"; g.fillText("会心!", n.x * S, (y - 11) * S);
        g.font = `${Math.round(size * S)}px "DotGothic16", monospace`;
      }
      g.strokeText(n.text, n.x * S, y * S);
      g.fillStyle = col;
      g.fillText(n.text, n.x * S, y * S);
    }
    g.globalAlpha = 1;
  }
}

// 背景の絵のいちばん上の色（引きで映すときに上へ足す空の色）
function topColor(im) {
  if (im._top) return im._top;
  try {
    const c = document.createElement("canvas"); c.width = 16; c.height = 1;
    const x = c.getContext("2d");
    x.drawImage(im, 0, 0, im.naturalWidth, Math.max(1, Math.round(im.naturalHeight * 0.02)), 0, 0, 16, 1);
    const d = x.getImageData(0, 0, 16, 1).data;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < 64; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
    im._top = `rgb(${Math.round(r / 16)},${Math.round(g / 16)},${Math.round(b / 16)})`;
  } catch { im._top = "#10131f"; }
  return im._top;
}
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
export { WORLD_H, GROUND };
