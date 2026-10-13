// シェア：記録カードの画像を作り、端末の共有・X・LINE・コピーへ渡す
import { CONFIG } from "./config.js";
import { img, variant, preload } from "./assets.js";
import { fmt } from "./big.js";
import { RARITIES, titleFor, HASHTAG, GAME_TITLE, COMPANIONS, kmText, markFor, isDefaultName } from "./data.js";

export function siteUrl() {
  if (CONFIG.siteUrl) return CONFIG.siteUrl;
  return location.origin + location.pathname.replace(/index\.html$/, "");
}
export function challengeUrl(st, utm = "share") {
  const u = new URL(siteUrl());
  u.searchParams.set("vs", String(st.bestStage));
  if (!isDefaultName(st.name)) u.searchParams.set("n", st.name.slice(0, 12));
  u.searchParams.set("utm_source", utm);
  u.searchParams.set("utm_medium", "share");
  return u.toString();
}

// ---------- 画像カード ----------
const FONT = `"DotGothic16", monospace`;
function px(g, im, x, y, scale, flip = false) {
  if (!im) return;
  const w = (im.naturalWidth || im.width) * scale, h = (im.naturalHeight || im.height) * scale;
  g.imageSmoothingEnabled = false;
  if (flip) { g.save(); g.translate(x + w, y); g.scale(-1, 1); g.drawImage(im, 0, 0, w, h); g.restore(); }
  else g.drawImage(im, x, y, w, h);
}
function outlineText(g, text, x, y, size, fill, stroke = "#140c28", lw = 8) {
  g.font = `${size}px ${FONT}`;
  g.lineJoin = "round";
  g.lineWidth = lw; g.strokeStyle = stroke; g.strokeText(text, x, y);
  g.fillStyle = fill; g.fillText(text, x, y);
}
function rarityFill(g, r, x, y, w, h) {
  if (r >= 4) {
    const gr = g.createLinearGradient(x, y, x + w, y + h);
    ["#ff5bd0", "#ffd23f", "#5bffb0", "#5bc8ff", "#b45bff"].forEach((c, i, a) => gr.addColorStop(i / (a.length - 1), c));
    return gr;
  }
  return RARITIES[r].color;
}

export async function recordCard(st, game, rk = null) {
  await document.fonts?.load?.(`40px ${FONT}`).catch(() => {});
  await preload([["bg", game.biome(st.bestStage).id], ["sprite", "t_loco"], ["ui", "logo_train"], ...COMPANIONS.flatMap((c) => [["sprite", c.car], ["sprite", c.crew]])]);
  const W = 1200, H = 630;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  // 背景：最高到達の地方の景色
  const bgId = game.biome(st.bestStage).id;
  const bg = img("bg", bgId);
  g.fillStyle = "#101828"; g.fillRect(0, 0, W, H);
  if (bg) { g.imageSmoothingEnabled = false; const sc = H / bg.naturalHeight; for (let x = 0; x < W; x += bg.naturalWidth * sc) g.drawImage(bg, x, 0, bg.naturalWidth * sc, H); }
  const shade = g.createLinearGradient(0, 0, W, 0);
  shade.addColorStop(0, "rgba(10,8,30,0.35)"); shade.addColorStop(0.45, "rgba(10,8,30,0.55)"); shade.addColorStop(1, "rgba(10,8,30,0.88)");
  g.fillStyle = shade; g.fillRect(0, 0, W, H);
  // 列車（機関車＋強い車両から2〜3両）
  drawTrain(g, st, 620, Math.round(H * (141 / 180)), 4);
  // ロゴ
  const logo = img("ui", "logo_train");
  if (logo) { g.imageSmoothingEnabled = true; const lw = 360, lh = logo.naturalHeight * (lw / logo.naturalWidth); g.drawImage(logo, W - lw - 40, 16, lw, lh); }
  else outlineText(g, GAME_TITLE, W - 470, 90, 64, "#ffd23f");
  // 文字
  g.textAlign = "left"; g.textBaseline = "alphabetic";
  const X = 640;
  outlineText(g, "最高到達", X, 222, 36, "#ffe8a3");
  outlineText(g, kmText(st.bestStage), X - 6, 306, 88, "#ffffff", "#140c28", 12);
  const mk = markFor(st.bestStage);
  if (mk) outlineText(g, `${mk.name}より遠く！`, X, 352, 30, "#ffd23f", "#140c28", 7);
  outlineText(g, `称号「${titleFor(st.bestStage)}」`, X, 404, 34, "#9ee7ff");
  if (rk) {
    // ランキングの順位（シェアしたくなる一番の数字）を右上に大きく
    const pct = rk.pct < 1 ? Math.max(0.01, Math.round(rk.pct * 100) / 100) : rk.pct < 10 ? Math.round(rk.pct * 10) / 10 : Math.round(rk.pct);
    g.textAlign = "right";
    outlineText(g, `全国 ${rk.rank.toLocaleString("ja-JP")}位`, W - 40, 196, 44, "#ffe066", "#140c28", 10);
    outlineText(g, `上位${pct}%`, W - 40, 234, 28, "#ffffff", "#140c28", 6);
    g.textAlign = "left";
  }
  outlineText(g, `最強の一撃 ${fmt(st.stats.maxHit)}`, X, 452, 32, "#ffffff");
  if (st.stats.bestPull) {
    const b = st.stats.bestPull;
    g.font = `32px ${FONT}`;
    outlineText(g, "最高レア", X, 500, 30, "#ffffff");
    const tag = RARITIES[b.r].name;
    g.font = `34px ${FONT}`;
    const tw = g.measureText(tag).width;
    g.fillStyle = rarityFill(g, b.r, X + 150, 470, tw + 20, 40);
    g.fillRect(X + 146, 470, tw + 24, 40);
    outlineText(g, tag, X + 158, 502, 34, "#140c28", "#ffffff", 0.01);
    outlineText(g, b.name.length > 12 ? b.name.slice(0, 12) + "…" : b.name, X + 150 + tw + 40, 502, 30, "#ffffff");
  }
  // 下の帯
  g.fillStyle = "rgba(10,8,30,0.85)"; g.fillRect(0, H - 70, W, 70);
  outlineText(g, `#${HASHTAG}  あなたの列車はドコマデ行ける？`, 40, H - 24, 34, "#ffd23f", "#140c28", 6);
  if (st.stats.prestiges > 0) { g.textAlign = "right"; outlineText(g, `再出発${st.stats.prestiges}回`, W - 40, H - 24, 30, "#c9b6ff", "#140c28", 6); }
  return cv;
}

// 記録カードの列車：右端 right・レールの高さ ground に、機関車と（強い順に）車両をつなげて描く
function drawTrain(g, st, right, ground, k) {
  // レール
  const RW = g.canvas.width;
  g.fillStyle = "rgba(30,22,34,0.6)"; g.fillRect(0, ground + k, RW, 6 * k);
  for (let x = 0; x < RW; x += 9 * k) { g.fillStyle = "#4a2f1c"; g.fillRect(x, ground + 1.5 * k, 6 * k, 3 * k); }
  g.fillStyle = "#2b2f3a"; g.fillRect(0, ground, RW, 2 * k);
  g.fillStyle = "#d9e2ec"; g.fillRect(0, ground, RW, Math.max(1, 0.7 * k));
  const loco = img("sprite", "t_loco");
  const lw = loco ? loco.naturalWidth * k : 300;
  let r = right - lw + 5 * k;
  const ck = k * 0.86;
  const ks = [];
  for (let i = COMPANIONS.length - 1; i >= 0; i--) if (st.comp[i] > 0) ks.push(i);
  const cars = [];
  for (const i of ks) {
    const im = img("sprite", COMPANIONS[i].car);
    if (!im || r <= 0) continue;
    const w = im.naturalWidth * ck, h = im.naturalHeight * ck;
    cars.push({ i, im, x: r - w, w, h });
    r -= w - 3 * ck;
  }
  for (let j = cars.length - 1; j >= 0; j--) {
    const c = cars[j];
    px(g, c.im, c.x, ground - c.h, ck);
    const crew = img("sprite", COMPANIONS[c.i].crew);
    if (crew) px(g, crew, c.x + c.w / 2 - (crew.naturalWidth * ck) / 2 - ck, ground - c.h + 5 * ck - crew.naturalHeight * ck, ck);
  }
  if (loco) px(g, loco, right - lw, ground - loco.naturalHeight * k, k);
}

export async function gachaCard(result) {
  await document.fonts?.load?.(`40px ${FONT}`).catch(() => {});
  await preload([["ui", "gacha_hall"], ...result.items.map((it) => ["icon", it.icon])]);
  const W = 1200, H = 630;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  const hall = img("ui", "gacha_hall");
  g.fillStyle = "#0d0b24"; g.fillRect(0, 0, W, H);
  if (hall) { g.imageSmoothingEnabled = false; g.globalAlpha = 0.55; g.drawImage(hall, 0, -H * 0.4, W, W * (hall.naturalHeight / hall.naturalWidth)); g.globalAlpha = 1; }
  const items = [...result.items].sort((a, b) => b.r - a.r);
  const best = items[0];
  g.textAlign = "center";
  outlineText(g, `${RARITIES[best.r].name}「${best.name}」`, W / 2, 96, 56, best.r >= 4 ? "#ffe8ff" : RARITIES[best.r].color, "#140c28", 10);
  const n = items.length;
  const cols = n > 5 ? 5 : n, rows = Math.ceil(n / cols);
  const cw = 170, ch = 190, gx = (W - cols * cw) / 2, gy = 150 + (rows === 1 ? 70 : 0);
  items.forEach((it, i) => {
    const cx = gx + (i % cols) * cw, cy = gy + Math.floor(i / cols) * ch;
    g.fillStyle = rarityFill(g, it.r, cx + 10, cy, cw - 20, ch - 20);
    g.fillRect(cx + 10, cy, cw - 20, ch - 20);
    g.fillStyle = "#16112e"; g.fillRect(cx + 16, cy + 6, cw - 32, ch - 32);
    const ic = img("icon", it.icon);
    // 絵は縦長・横長がまざる（長い辺が40ドット）→ 40×40 の枠の真ん中に置く
    if (ic) px(g, ic, cx + cw / 2 - ic.naturalWidth * 1.6, cy + 24 + (40 - ic.naturalHeight) * 1.6, 3.2);
    outlineText(g, RARITIES[it.r].name, cx + cw / 2, cy + ch - 34, 30, it.r >= 3 ? "#ffe066" : "#ffffff", "#140c28", 6);
  });
  g.fillStyle = "rgba(10,8,30,0.85)"; g.fillRect(0, H - 70, W, 70);
  g.textAlign = "left";
  outlineText(g, `#${HASHTAG}  ド派手な召喚、あなたも引いてみて`, 40, H - 24, 34, "#ffd23f", "#140c28", 6);
  return cv;
}

const toBlob = (cv) => new Promise((r) => cv.toBlob(r, "image/png"));

// ---------- 共有の実行 ----------
// 戻り値: "shared" | "cancel" | "fallback"（自前の画面を出した）
export async function shareNative({ text, url, canvas, filename = "dokomade.png" }) {
  try {
    if (canvas && navigator.canShare) {
      const blob = await toBlob(canvas);
      const file = new File([blob], filename, { type: "image/png" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: `${text}\n${url}` });
        return "shared";
      }
    }
    if (navigator.share && isMobile()) { await navigator.share({ text, url }); return "shared"; }
  } catch (e) {
    if (e && e.name === "AbortError") return "cancel";
  }
  return "fallback";
}
export const isMobile = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));

export function xIntent(text, url) {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}
export function lineIntent(text, url) {
  return `https://line.me/R/share?text=${encodeURIComponent(`${text}\n${url}`)}`;
}
export async function saveImage(canvas, filename = "dokomade.png") {
  const blob = await toBlob(canvas);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
export async function copyImage(canvas) {
  try {
    const blob = await toBlob(canvas);
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return true;
  } catch { return false; }
}

// 外のタブ（X など）に出て戻ってきたら「シェアした」とみなす
export function waitReturn(minMs = 2500) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    let left = false;
    const onVis = () => {
      if (document.visibilityState === "hidden") left = true;
      else if (left || Date.now() - t0 > minMs) finish();
    };
    const onFocus = () => { if (Date.now() - t0 > minMs) finish(); };
    const finish = () => { document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", onFocus); clearTimeout(to); resolve(true); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);
    const to = setTimeout(finish, 15000);
  });
}

const markNote = (stage) => { const m = markFor(stage); return m ? `（${m.name}より遠く）` : ""; };
export function recordText(st) {
  return `【${GAME_TITLE}】${kmText(st.bestStage)}走った！${markNote(st.bestStage)} 称号「${titleFor(st.bestStage)}」\n最強の一撃は ${fmt(st.stats.maxHit)}。\nあなたの列車はドコマデ行ける？\n#${HASHTAG}`;
}
export function rankText(st, v) {
  const pct = v.pct < 1 ? Math.max(0.01, Math.round(v.pct * 100) / 100) : v.pct < 10 ? Math.round(v.pct * 10) / 10 : Math.round(v.pct);
  return `【${GAME_TITLE}】全国${v.rank.toLocaleString("ja-JP")}位（${v.total.toLocaleString("ja-JP")}人中・上位${pct}%）！\n${kmText(st.bestStage)}走った。あなたの列車はドコマデ行ける？\n#${HASHTAG}`;
}
export function milestoneText(st, m) {
  return `【${GAME_TITLE}】ついに${kmText(m)}突破！${markNote(m)}\n称号「${titleFor(m)}」になりました。\nあなたの列車はドコマデ行ける？\n#${HASHTAG}`;
}
export function gachaText(result) {
  const best = [...result.items].sort((a, b) => b.r - a.r)[0];
  const cnt = {};
  for (const it of result.items) cnt[it.r] = (cnt[it.r] || 0) + 1;
  const tail = Object.entries(cnt).sort((a, b) => b[0] - a[0]).filter(([r]) => r >= 3).map(([r, n]) => `${RARITIES[r].name}×${n}`).join(" ");
  return `【${GAME_TITLE}】召喚で ${RARITIES[best.r].name}「${best.name}」が出た！${tail ? `（${tail}）` : ""}\n#${HASHTAG}`;
}
export function vsText(st, vs) {
  return `【${GAME_TITLE}】${vs.name ? `${vs.name}さん` : "友だち"}の${kmText(vs.stage)}を超えた！ いま${kmText(st.bestStage)}。\n次はあなたの番。\n#${HASHTAG}`;
}
