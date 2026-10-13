// ド派手なガチャ演出。
// 流れ：暗転 → 魔法陣 → 光の柱（青→紫→金→虹と昇格） → 予告カットイン → 大爆発 → カードが飛び散る → 1枚ずつめくる
//       SSR以上は1枚ずつ全画面で大きく見せる。LR は暗転→心音→ひび割れ→宇宙→「伝説確定」
import { img, src } from "./assets.js";
import { sfx } from "./sfx.js";
import { RARITIES } from "./data.js";
import { statText, itemStats } from "./items.js";

const COL = ["#aab4c3", "#4db4ff", "#c07cff", "#ffd23f", "rainbow", "cosmic"];
const RAINBOW = ["#ff4d6d", "#ffb703", "#ffe066", "#80ed99", "#48cae4", "#9d4edd", "#ff5bd0"];
const lvColor = (lv, t = 0) => (lv <= 1 ? "#4db4ff" : lv === 2 ? "#c07cff" : lv === 3 ? "#ffd23f" : RAINBOW[Math.floor(t * 12) % RAINBOW.length]);
const vib = (p) => { try { navigator.vibrate?.(p); } catch {} };

export class GachaFX {
  constructor() {
    this.el = null;
    this.running = false;
  }

  build() {
    const el = document.createElement("div");
    el.className = "gx";
    el.innerHTML = `
      <div class="gx-shake">
        <div class="gx-bg"></div>
        <canvas class="gx-cv"></canvas>
        <div class="gx-cut"></div>
        <div class="gx-cards"></div>
        <div class="gx-big"></div>
        <div class="gx-slams"></div>
        <div class="gx-cracks"></div>
        <div class="gx-flash"></div>
        <div class="gx-bars"><i></i><i></i></div>
      </div>
      <div class="gx-ui">
        <button class="gx-skip btn ghost small">スキップ ▶▶</button>
        <div class="gx-hint">タップで進む</div>
        <div class="gx-result"></div>
      </div>`;
    document.body.appendChild(el);
    this.el = el;
    this.cv = el.querySelector(".gx-cv");
    this.g = this.cv.getContext("2d");
    this.shakeEl = el.querySelector(".gx-shake");
    this.flashEl = el.querySelector(".gx-flash");
    this.cardsEl = el.querySelector(".gx-cards");
    this.bigEl = el.querySelector(".gx-big");
    this.slamsEl = el.querySelector(".gx-slams");
    this.cutEl = el.querySelector(".gx-cut");
    this.cracksEl = el.querySelector(".gx-cracks");
    this.resultEl = el.querySelector(".gx-result");
    el.querySelector(".gx-skip").onclick = (e) => { e.stopPropagation(); this.skip = true; this.fast = true; this.resolveWait(); };
    el.addEventListener("pointerdown", () => { this.fast = true; this.resolveWait(); });
    window.addEventListener("resize", () => this.resize());
  }
  resize() {
    if (!this.el) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = dpr;
    // 演出の箱の大きさ（スマホで下に固定の広告が出ているときは、その分だけ低い）
    this.W = this.el?.clientWidth || window.innerWidth; this.H = this.el?.clientHeight || window.innerHeight;
    this.cv.width = Math.round(this.W * dpr); this.cv.height = Math.round(this.H * dpr);
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---------- 待ち（タップで早送り・スキップで即） ----------
  wait(ms) {
    if (this.skip) return Promise.resolve();
    const k = this.fast ? 0.35 : 1;
    return new Promise((res) => { this._wres = res; this._wt = setTimeout(res, ms * k); });
  }
  resolveWait() { if (this._wres) { clearTimeout(this._wt); const r = this._wres; this._wres = null; r(); } }
  waitTap(maxMs = 60000) {
    if (this.skip) return Promise.resolve();
    return new Promise((res) => {
      const el = this.el;
      const done = () => { el.removeEventListener("pointerdown", onTap); clearTimeout(to); res(); };
      const onTap = () => setTimeout(done, 30);
      setTimeout(() => el.addEventListener("pointerdown", onTap), 350);
      const to = setTimeout(done, maxMs);
    });
  }

  // ---------- 描画ループ（粒・光線・魔法陣） ----------
  startLoop() {
    this.parts = []; this.rings = []; this.bolts = [];
    this.state = { circle: 0, circleSpin: 0, pillar: 0, level: 1, rays: 0, raysLv: 1, vortex: 0, tint: 0, t: 0, shake: 0, cosmic: 0 };
    let last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      this.frame(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  frame(dt) {
    const g = this.g, W = this.W, H = this.H, s = this.state;
    s.t += dt;
    g.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H * (H > W ? 0.7 : 0.64); // 召喚の広間の祭壇の上
    // 宇宙
    if (s.cosmic > 0) {
      g.globalAlpha = s.cosmic;
      for (let i = 0; i < 90; i++) {
        const x = (Math.sin(i * 12.9898) * 43758.5453 % 1 + 1) % 1 * W, y = (Math.sin(i * 78.233) * 12345.678 % 1 + 1) % 1 * H;
        const tw = 0.5 + 0.5 * Math.sin(s.t * 3 + i);
        g.fillStyle = `rgba(255,255,255,${tw})`; g.fillRect(x, y, 2, 2);
      }
      g.globalAlpha = 1;
    }
    // 光線（回転）
    if (s.rays > 0) {
      g.save(); g.translate(cx, H * 0.45); g.rotate(s.t * 0.35);
      const n = 16;
      g.globalCompositeOperation = "lighter";
      for (let i = 0; i < n; i++) {
        g.rotate((Math.PI * 2) / n);
        const col = s.raysLv >= 4 ? RAINBOW[i % RAINBOW.length] : lvColor(s.raysLv);
        const grd = g.createLinearGradient(0, 0, 0, -Math.max(W, H));
        grd.addColorStop(0, hexA(col, 0.55 * s.rays)); grd.addColorStop(1, hexA(col, 0));
        g.fillStyle = grd;
        g.beginPath(); g.moveTo(0, 0); g.lineTo(-Math.max(W, H) * 0.09, -Math.max(W, H)); g.lineTo(Math.max(W, H) * 0.09, -Math.max(W, H)); g.closePath(); g.fill();
      }
      g.restore();
      g.globalCompositeOperation = "source-over";
    }
    // 魔法陣
    if (s.circle > 0) {
      const im = img("fx", "fx_circle");
      const R = Math.min(W, H) * 0.42;
      g.save(); g.translate(cx, cy); g.scale(1, 0.38); g.rotate(s.circleSpin += dt * (0.4 + s.level * 0.5));
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = Math.min(1, s.circle);
      if (im) {
        // 色をつけるため2回重ねる（元の白＋色の輪）
        g.drawImage(im, -R, -R, R * 2, R * 2);
      }
      g.strokeStyle = lvColor(s.level, s.t); g.lineWidth = 6; g.globalAlpha = 0.8 * Math.min(1, s.circle);
      g.beginPath(); g.arc(0, 0, R * 0.98 * Math.min(1, s.circle), 0, Math.PI * 2 * Math.min(1, s.circle)); g.stroke();
      g.beginPath(); g.arc(0, 0, R * 0.7, 0, Math.PI * 2 * Math.min(1, s.circle * 1.2)); g.stroke();
      g.restore();
      g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
      // 立ちのぼる粒
      if (Math.random() < 0.9 * s.circle) for (let i = 0; i < 1 + s.level; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * R;
        this.parts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.38, vx: 0, vy: -40 - Math.random() * 120, life: 1 + Math.random(), t: 0, s: 2 + Math.random() * 2, c: lvColor(s.level, Math.random()), glow: true });
      }
    }
    // 渦（中心へ吸い込まれる粒）
    if (s.vortex > 0 && this.parts.length < 900) {
      for (let i = 0; i < 6 * s.vortex; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.max(W, H) * (0.5 + Math.random() * 0.3);
        this.parts.push({ x: cx + Math.cos(a) * r, y: H * 0.45 + Math.sin(a) * r, vx: 0, vy: 0, life: 0.9, t: 0, s: 2 + Math.random() * 2, c: lvColor(s.level, Math.random()), glow: true, sink: { x: cx, y: H * 0.45, a, r } });
      }
    }
    // 光の柱
    if (s.pillar > 0) {
      const w = (40 + s.level * 26) * (0.8 + 0.2 * Math.sin(s.t * 30)) * s.pillar;
      g.globalCompositeOperation = "lighter";
      const col = lvColor(s.level, s.t);
      const grd = g.createLinearGradient(cx - w, 0, cx + w, 0);
      grd.addColorStop(0, hexA(col, 0)); grd.addColorStop(0.35, hexA(col, 0.55)); grd.addColorStop(0.5, "rgba(255,255,255,0.95)"); grd.addColorStop(0.65, hexA(col, 0.55)); grd.addColorStop(1, hexA(col, 0));
      g.fillStyle = grd; g.fillRect(cx - w, 0, w * 2, cy);
      // 根元の光
      const rg = g.createRadialGradient(cx, cy, 0, cx, cy, w * 3);
      rg.addColorStop(0, "rgba(255,255,255,0.9)"); rg.addColorStop(0.3, hexA(col, 0.6)); rg.addColorStop(1, hexA(col, 0));
      g.fillStyle = rg; g.fillRect(cx - w * 3, cy - w * 3, w * 6, w * 6);
      g.globalCompositeOperation = "source-over";
    }
    // 稲妻
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]; b.t += dt;
      if (b.t > b.life) { this.bolts.splice(i, 1); continue; }
      g.globalCompositeOperation = "lighter";
      g.strokeStyle = hexA(b.c, 1 - b.t / b.life); g.lineWidth = 3;
      g.beginPath(); g.moveTo(b.pts[0][0], b.pts[0][1]); for (const p of b.pts) g.lineTo(p[0], p[1]); g.stroke();
      g.strokeStyle = `rgba(255,255,255,${1 - b.t / b.life})`; g.lineWidth = 1.2; g.stroke();
      g.globalCompositeOperation = "source-over";
    }
    // 輪
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]; r.t += dt; r.r += r.vr * dt;
      const a = 1 - r.t / r.life;
      if (a <= 0) { this.rings.splice(i, 1); continue; }
      g.globalCompositeOperation = "lighter";
      g.strokeStyle = hexA(r.c === "rainbow" ? RAINBOW[Math.floor(r.t * 20) % 7] : r.c, a); g.lineWidth = r.w * a + 1;
      g.beginPath(); g.ellipse(r.x, r.y, r.r, r.r * (r.flat || 1), 0, 0, Math.PI * 2); g.stroke();
      g.globalCompositeOperation = "source-over";
    }
    // 粒
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]; p.t += dt;
      if (p.t >= p.life) { this.parts.splice(i, 1); continue; }
      if (p.sink) {
        const k = p.t / p.life;
        const r = p.sink.r * (1 - k * k); const a = p.sink.a + k * 3;
        p.x = p.sink.x + Math.cos(a) * r; p.y = p.sink.y + Math.sin(a) * r;
      } else {
        p.vy += (p.g || 0) * dt; p.vx *= p.drag || 1; p.vy *= p.drag || 1;
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      const a = 1 - p.t / p.life;
      if (p.confetti) {
        g.save(); g.translate(p.x, p.y); g.rotate(p.t * p.spin); g.globalAlpha = Math.min(1, a * 2);
        g.fillStyle = p.c; g.fillRect(-p.s, -p.s * 0.5 * Math.abs(Math.cos(p.t * 8)), p.s * 2, p.s * Math.abs(Math.cos(p.t * 8)) + 1);
        g.restore();
      } else if (p.glow) {
        g.globalCompositeOperation = "lighter"; g.globalAlpha = a;
        g.fillStyle = p.c; g.fillRect(p.x - p.s, p.y - p.s, p.s * 2, p.s * 2);
        g.globalAlpha = a * 0.35; g.fillRect(p.x - p.s * 2.5, p.y - p.s * 2.5, p.s * 5, p.s * 5);
        g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
      } else if (p.star) {
        g.globalCompositeOperation = "lighter"; g.globalAlpha = a; g.fillStyle = p.c;
        g.fillRect(p.x - p.s * 2, p.y - 1, p.s * 4, 2); g.fillRect(p.x - 1, p.y - p.s * 2, 2, p.s * 4);
        g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
      } else {
        g.globalAlpha = a; g.fillStyle = p.c; g.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); g.globalAlpha = 1;
      }
    }
    if (this.parts.length > 1400) this.parts.splice(0, this.parts.length - 1400);
    // 揺れ
    s.shake = Math.max(0, s.shake - dt * 22);
    if (s.shake > 0.1) this.shakeEl.style.transform = `translate(${(Math.random() - 0.5) * s.shake * 2}px,${(Math.random() - 0.5) * s.shake * 2}px) rotate(${(Math.random() - 0.5) * s.shake * 0.08}deg)`;
    else this.shakeEl.style.transform = "";
  }

  // ---------- 小道具 ----------
  flash(color = "#fff", ms = 380, peak = 1) {
    const f = this.flashEl;
    f.style.transition = "none"; f.style.background = color; f.style.opacity = String(peak);
    requestAnimationFrame(() => { f.style.transition = `opacity ${ms}ms ease-out`; f.style.opacity = "0"; });
  }
  burst(x, y, n, colors, { speed = 520, glow = true, confetti = false, grav = 0 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.2 + Math.random());
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 0.97, g: grav, life: 0.6 + Math.random() * 1.1, t: 0, s: confetti ? 4 + Math.random() * 4 : 1.5 + Math.random() * 3, c: colors[i % colors.length], glow: glow && !confetti, confetti, spin: (Math.random() - 0.5) * 20, star: !confetti && Math.random() < 0.15 });
    }
  }
  confettiRain(n, colors) {
    for (let i = 0; i < n; i++) this.parts.push({ x: Math.random() * this.W, y: -20 - Math.random() * this.H * 0.5, vx: (Math.random() - 0.5) * 60, vy: 80 + Math.random() * 160, g: 40, drag: 1, life: 3 + Math.random() * 2, t: 0, s: 4 + Math.random() * 4, c: colors[i % colors.length], confetti: true, spin: (Math.random() - 0.5) * 16 });
  }
  ring(c, vr = 900, w = 14, flat = 1, x = this.W / 2, y = this.H * 0.45) { this.rings.push({ x, y, r: 10, vr, t: 0, life: 0.7, c, w, flat }); }
  bolt(c = "#ffffff") {
    const x0 = Math.random() * this.W, pts = [[x0, -10]];
    let x = x0, y = -10;
    while (y < this.H * 0.7) { x += (Math.random() - 0.5) * 80; y += 30 + Math.random() * 40; pts.push([x, y]); }
    this.bolts.push({ pts, t: 0, life: 0.35, c });
  }
  slam(text, kind = "gold", ms = 900) {
    this.slamsEl.innerHTML = ""; // 前の文字は消す（「激アツ!!」と「虹だ!!!」が重ならないように）
    const d = document.createElement("div");
    d.className = `gx-slam ${kind}`;
    d.textContent = text;
    this.slamsEl.appendChild(d);
    setTimeout(() => d.remove(), ms + 600);
    return d;
  }
  cutin(id, text, kind) {
    const url = src("fx", id);
    const d = document.createElement("div");
    d.className = `gx-cutin ${kind || ""}`;
    d.innerHTML = `<div class="gx-cutin-band"><img alt="" src="${url}"><b>${text}</b></div>`;
    this.cutEl.appendChild(d);
    setTimeout(() => d.remove(), 1700);
  }
  cracks() {
    const d = this.cracksEl;
    d.innerHTML = "";
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 100 100"); svg.setAttribute("preserveAspectRatio", "none");
    for (let i = 0; i < 14; i++) {
      const p = document.createElementNS(svgNS, "polyline");
      let x = 50, y = 50; const a = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
      const pts = [[x, y]];
      for (let k = 0; k < 6; k++) { x += Math.cos(a + (Math.random() - 0.5) * 0.8) * 9; y += Math.sin(a + (Math.random() - 0.5) * 0.8) * 9; pts.push([x, y]); }
      p.setAttribute("points", pts.map((q) => q.join(",")).join(" "));
      p.style.animationDelay = `${i * 25}ms`;
      svg.appendChild(p);
    }
    d.appendChild(svg);
    d.classList.add("on");
  }

  // ---------- 本番 ----------
  // result: game.pull() の戻り値。handlers: { onEquip, onShare, onAgain, onClose, againLabel }
  async play(result, handlers = {}) {
    if (this.running) return;
    if (!this.el) this.build();
    this.running = true; this.skip = false; this.fast = false;
    this.level = handlers.level || 1;
    const el = this.el;
    el.className = "gx on";
    this.resize(); // 見えるようにしてから測る（下に固定の広告のぶん低くなっている）
    this.cardsEl.innerHTML = ""; this.bigEl.innerHTML = ""; this.slamsEl.innerHTML = ""; this.cutEl.innerHTML = ""; this.resultEl.innerHTML = ""; this.cracksEl.className = "gx-cracks"; this.cracksEl.innerHTML = "";
    el.querySelector(".gx-hint").style.display = "";
    el.querySelector(".gx-skip").style.display = "";
    this.startLoop();
    const s = this.state;
    const items = result.items;
    const maxR = result.maxR;
    const targetLv = Math.min(4, Math.max(1, maxR - 0)); // 1:青 2:紫 3:金 4:虹
    try {
      // 1) 暗転と魔法陣
      el.classList.add("dim");
      sfx.rumble(2.6);
      await this.wait(350);
      el.classList.add("bars");
      for (let k = 0; k <= 10; k++) { s.circle = k / 10; await this.wait(45); }
      s.vortex = 1;
      await this.wait(500);
      // 予告カットイン（高レアほど出やすい・たまにガセ）
      const cutChance = [0, 0.02, 0.05, 0.35, 0.8, 1][maxR];
      if (!this.skip && Math.random() < cutChance) {
        sfx.whoosh();
        this.cutin("cut_dragon", maxR >= 4 ? "運命が、動く" : "…!?", maxR >= 3 ? "gold" : "");
        s.shake = 6; vib(60);
        await this.wait(1300);
      }
      // 2) 光の柱。青から始めて、本当のレアまで昇格していく
      s.pillar = 0.4; s.level = 1;
      sfx.riser(1.2, 1800);
      for (let k = 0; k < 8; k++) { s.pillar = 0.4 + k * 0.08; s.shake = 1 + k * 0.3; await this.wait(90); }
      for (let lv = 2; lv <= targetLv; lv++) {
        await this.wait(lv === 4 ? 520 : 360);
        s.level = lv; s.rays = Math.min(1, 0.3 + lv * 0.18); s.raysLv = lv;
        sfx.promote(lv);
        vib(lv >= 3 ? [60, 40, 120] : 40);
        s.shake = 6 + lv * 4;
        this.flash(lv === 4 ? "#fff" : lvColor(lv), 420, 0.85);
        this.ring(lv === 4 ? "rainbow" : lvColor(lv), 1100, 18);
        this.burst(this.W / 2, this.H * 0.45, 90 + lv * 60, lv === 4 ? RAINBOW : [lvColor(lv), "#ffffff"]);
        if (lv === 3) this.slam("激アツ!!", "gold");
        if (lv === 4) {
          this.slam("虹だ!!!", "rainbow", 1200);
          for (let i = 0; i < 5; i++) setTimeout(() => this.bolt(RAINBOW[i]), i * 90);
          if (!this.skip && Math.random() < 0.6) { await this.wait(500); sfx.whoosh(); this.cutin("cut_phoenix", "虹色の奇跡", "rainbow"); await this.wait(1000); }
        }
      }
      // LR：暗転からの確定演出
      if (maxR >= 5 && !this.skip) {
        await this.wait(600);
        s.pillar = 0; s.rays = 0; s.circle = 0; s.vortex = 0; this.parts.length = 0;
        el.classList.add("black");
        await this.wait(900);
        sfx.heartbeat(); vib([80, 160, 80]);
        await this.wait(800);
        sfx.heartbeat(); vib([80, 160, 80]);
        await this.wait(700);
        this.cracks(); sfx.glass(); s.shake = 14;
        await this.wait(700);
        el.classList.remove("black"); el.classList.add("cosmic");
        s.cosmic = 1; s.rays = 1; s.raysLv = 5; s.level = 4;
        this.flash("#ffffff", 900, 1);
        sfx.boom(2); vib([200, 60, 200]);
        this.cracksEl.classList.remove("on"); this.cracksEl.innerHTML = "";
        this.cutin("cut_goddess", "伝説、降臨。", "cosmic");
        this.confettiRain(160, RAINBOW);
        await this.wait(1500);
        this.slam("伝説確定", "legend", 1600);
        for (let i = 0; i < 8; i++) setTimeout(() => this.bolt(RAINBOW[i % 7]), i * 70);
        await this.wait(1300);
      }
      // 3) 大爆発
      await this.wait(420);
      s.vortex = 0;
      sfx.riser(0.6, 4000);
      for (let k = 0; k < 6; k++) { s.pillar = 1 + k * 0.25; s.shake = 8 + k * 2; await this.wait(70); }
      sfx.boom(1 + targetLv * 0.25);
      vib(targetLv >= 3 ? [120, 50, 200] : 80);
      this.flash("#ffffff", 700, 1);
      this.ring(targetLv >= 4 ? "rainbow" : lvColor(targetLv), 1500, 26);
      this.ring("#ffffff", 900, 10);
      this.burst(this.W / 2, this.H * 0.45, 300 + targetLv * 120, targetLv >= 4 ? RAINBOW : [lvColor(targetLv), "#ffffff", "#fff3b0"], { speed: 900 });
      if (targetLv >= 3) this.confettiRain(targetLv >= 4 ? 140 : 70, targetLv >= 4 ? RAINBOW : ["#ffd23f", "#fff3b0", "#ffffff", "#ffb703"]);
      s.pillar = 0; s.circle = 0;
      s.rays = targetLv >= 3 ? 0.6 : 0.25; s.raysLv = maxR >= 5 ? 5 : targetLv;
      el.classList.remove("bars");
      // 4) カード
      if (items.length === 1) {
        await this.wait(300);
        await this.bigReveal(items[0], true);
      } else {
        await this.dealCards(items);
      }
      // 5) 結果
      this.showResult(result, handlers);
    } catch (e) {
      console.error(e);
      this.showResult(result, handlers);
    }
  }

  async dealCards(items) {
    const box = this.cardsEl;
    box.innerHTML = "";
    const cards = items.map((it, i) => {
      const c = document.createElement("div");
      c.className = `gx-card r${it.r}`;
      c.style.setProperty("--i", i);
      c.innerHTML = `
        <div class="gx-card-in">
          <div class="gx-card-back"><img alt="" src="${src("ui", "card_back")}"></div>
          <div class="gx-card-front"><div class="gx-card-art"><img class="px" alt="" src="${src("icon", it.icon)}"></div><b class="rt">${RARITIES[it.r].name}</b><span>${it.name}</span></div>
        </div>`;
      box.appendChild(c);
      return c;
    });
    box.classList.add("deal");
    sfx.whoosh();
    await this.wait(900);
    // めくる（低いレアから先に・高レアは最後に溜める）
    const order = items.map((it, i) => i).sort((a, b) => items[a].r - items[b].r || a - b);
    for (const i of order) {
      const it = items[i], c = cards[i];
      if (it.r >= 3) {
        // 溜め
        c.classList.add("charge");
        this.state.shake = 3;
        await this.wait(this.skip ? 0 : 450);
        c.classList.remove("charge");
        c.classList.add("open");
        sfx.flip(it.r);
        this.burstAtEl(c, it.r);
        await this.wait(250);
        if (!this.skip) await this.bigReveal(it, false);
      } else {
        c.classList.add("open");
        sfx.flip(it.r);
        if (it.r >= 2) this.burstAtEl(c, it.r);
        await this.wait(it.r >= 2 ? 260 : 150);
      }
    }
    await this.wait(200);
  }
  burstAtEl(c, r) {
    const b = c.getBoundingClientRect();
    const colors = r >= 4 ? RAINBOW : r === 3 ? ["#ffd23f", "#fff3b0", "#ffffff"] : ["#c07cff", "#ffffff"];
    this.burst(b.left + b.width / 2, b.top + b.height / 2, r >= 3 ? 70 : 30, colors, { speed: 380 });
    if (r >= 3) this.ring(r >= 4 ? "rainbow" : "#ffd23f", 500, 8, 1, b.left + b.width / 2, b.top + b.height / 2);
  }

  // 1枚を全画面で大きく見せる
  async bigReveal(it, single) {
    const r = it.r;
    const big = this.bigEl;
    const s = this.state;
    big.className = `gx-big on r${r}`;
    big.innerHTML = `
      <div class="gx-big-rays"></div>
      <div class="gx-big-item"><div class="gx-big-halo"></div><img class="px" alt="" src="${src("icon", it.icon)}"></div>
      <div class="gx-big-rar"><span>${RARITIES[r].name}</span></div>
      <div class="gx-big-name">${it.name}</div>
      <div class="gx-big-stats">${itemStats(it, this.level || 1).map((x) => `<div>${statText(x.t, x.v)}</div>`).join("")}</div>
      <div class="gx-big-new">NEW!</div>
      <div class="gx-big-tap">タップで次へ</div>`;
    s.rays = r >= 3 ? 1 : 0.4; s.raysLv = r >= 5 ? 5 : Math.min(4, r);
    sfx.reveal(r);
    vib(r >= 4 ? [100, 40, 100, 40, 300] : r >= 3 ? [80, 40, 160] : 30);
    this.flash(r >= 4 ? "#ffffff" : RARITIES[r].color, 500, 0.9);
    s.shake = r >= 5 ? 18 : r >= 4 ? 14 : r >= 3 ? 9 : 3;
    this.burst(this.W / 2, this.H * 0.42, r >= 5 ? 520 : r >= 4 ? 380 : r >= 3 ? 240 : 80, r >= 4 ? RAINBOW : [RARITIES[r].color, "#ffffff"], { speed: 760 });
    if (r >= 3) { this.ring(r >= 4 ? "rainbow" : "#ffd23f", 1300, 20); this.confettiRain(r >= 4 ? 120 : 60, r >= 4 ? RAINBOW : ["#ffd23f", "#fff3b0", "#ffb703", "#ffffff"]); }
    if (r >= 4) for (let i = 0; i < 6; i++) setTimeout(() => this.bolt(RAINBOW[i]), 150 + i * 110);
    // 高レアはキラキラを出し続ける
    const iv = setInterval(() => {
      if (!this.running) return clearInterval(iv);
      this.burst(this.W / 2 + (Math.random() - 0.5) * 240, this.H * 0.42 + (Math.random() - 0.5) * 200, r >= 4 ? 8 : 4, r >= 4 ? RAINBOW : [RARITIES[r].color, "#ffffff"], { speed: 120 });
    }, 90);
    await this.wait(700);
    await this.waitTap(single ? 60000 : 8000);
    clearInterval(iv);
    big.className = "gx-big";
    big.innerHTML = "";
    s.rays = Math.min(s.rays, 0.35);
  }

  showResult(result, h) {
    const el = this.el;
    el.querySelector(".gx-hint").style.display = "none";
    el.querySelector(".gx-skip").style.display = "none";
    this.bigEl.className = "gx-big"; this.bigEl.innerHTML = "";
    el.classList.remove("black", "bars");
    // スキップしたときもカードは全部開いた状態に
    if (result.items.length > 1) {
      if (!this.cardsEl.children.length) { this.skip = true; this.dealCardsInstant(result.items); }
      for (const c of this.cardsEl.children) { c.classList.remove("charge"); c.classList.add("open"); }
      this.cardsEl.classList.add("done");
    } else {
      this.dealCardsInstant(result.items);
      this.cardsEl.classList.add("done", "single");
    }
    const best = Math.max(...result.items.map((x) => x.r));
    const cnt = {};
    for (const it of result.items) cnt[it.r] = (cnt[it.r] || 0) + 1;
    const summary = Object.entries(cnt).sort((a, b) => b[0] - a[0]).map(([r, n]) => `<span class="rt r${r}">${RARITIES[r].name}×${n}</span>`).join("");
    this.resultEl.innerHTML = `
      <div class="gx-sum">${summary}</div>
      <div class="gx-actions">
        <button class="btn gold gx-equip">いちばん強い部品を付ける</button>
        <button class="btn pink gx-share">${best >= 3 ? "この引きを自慢する" : "結果をシェア"}</button>
        ${h.againLabel ? `<button class="btn blue gx-again">${h.againLabel}</button>` : ""}
        <button class="btn ghost gx-close">とじる</button>
      </div>`;
    const close = () => { this.stop(); h.onClose?.(); };
    this.resultEl.querySelector(".gx-close").onclick = close;
    this.resultEl.querySelector(".gx-equip").onclick = (e) => { e.stopPropagation(); const n = h.onEquip?.() || 0; e.target.textContent = n ? `${n}か所を付け替えました` : "今の部品がいちばん強い"; e.target.disabled = true; };
    this.resultEl.querySelector(".gx-share").onclick = (e) => { e.stopPropagation(); h.onShare?.(result); };
    const again = this.resultEl.querySelector(".gx-again");
    if (again) again.onclick = (e) => { e.stopPropagation(); this.stop(); h.onAgain?.(); };
  }
  dealCardsInstant(items) {
    if (this.cardsEl.children.length) return;
    this.cardsEl.innerHTML = items.map((it, i) => `
      <div class="gx-card r${it.r} open" style="--i:${i}"><div class="gx-card-in">
        <div class="gx-card-back"><img alt="" src="${src("ui", "card_back")}"></div>
        <div class="gx-card-front"><div class="gx-card-art"><img class="px" alt="" src="${src("icon", it.icon)}"></div><b class="rt">${RARITIES[it.r].name}</b><span>${it.name}</span></div>
      </div></div>`).join("");
    this.cardsEl.classList.add("deal");
  }
  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    if (this.el) { this.el.className = "gx"; this.shakeEl.style.transform = ""; }
  }
}

function hexA(hex, a) {
  if (hex === "rainbow" || hex === "cosmic") hex = "#ffffff";
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
}
