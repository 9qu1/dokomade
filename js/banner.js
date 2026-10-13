// 画面の下の広告枠（1画面に1つ・タブのパネルの外＝描き直しで消えない）
//   忍者AdMax（config.js の banner.admaxShare＝9割）と、くぁくぁのほかのサイトの紹介（残りの1割）
//   ・タブを切りかえたときに選び直す。ただし前に選んでから30秒たっていなければそのまま（広告を続けて読みこまない）
//   ・忍者AdMax は非同期タグ。出すたびに t.js を動かし直す（requestAdmax）。スマホの UA には SP 枠、それ以外には PC 枠（SP 枠はスマホにしか配信されない）
//   ・忍者AdMax の規約（第10条）に合わせて、ボタンから離して置く・報酬と引きかえに見せない（「広告を見る」の画面は紹介だけ）
import { CONFIG } from "./config.js";
import { prBannerHtml } from "./pr.js";

const box = typeof document !== "undefined" ? document.getElementById("panel-ad") : null;
const HOLD_MS = 30e3;
let lastRoll = 0;
let kind = "";

const isPhone = () => /iPhone|iPod|Android.+Mobile|Mobile.+Firefox/i.test(navigator.userAgent);

// 忍者AdMax の非同期タグの読みこみ（t.js）は、動いたときの window.admaxads を1回だけ読む（あとから push した分は読まない。
// 2026-10-13 に t.js を読んで確認: window.__admax_tag__ が無いときだけ一覧を読む）。
// → 出したい分を少しためて、window.admaxads を「新しい分だけ」にし、「もう読んだ」の印を外して t.js をもう一度動かす
let pending = [];
let flushTimer = 0;
function requestAdmax(entry) {
  pending.push(entry);
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    window.admaxads = pending;
    pending = [];
    window.__admax_tag__ = undefined;
    document.querySelectorAll("script[data-admax-loader]").forEach((x) => x.remove());
    const s = document.createElement("script");
    s.src = "https://adm.shinobi.jp/st/t.js";
    s.async = true;
    s.charset = "utf-8";
    s.dataset.admaxLoader = "1";
    document.body.appendChild(s);
  }, 50);
}

function showAdmax() {
  const sp = isPhone();
  const id = sp ? CONFIG.banner.admax.sp : CONFIG.banner.admax.pc;
  const [w, h] = sp ? [320, 100] : [300, 250];
  box.innerHTML = `<div class="pa-label">広告</div><div class="pa-admax" style="width:${w}px;height:${h}px"><div class="admax-ads" data-admax-id="${id}" style="display:inline-block;width:${w}px;height:${h}px;"></div></div>`;
  requestAdmax({ admax_id: id, type: "banner" });
  // 広告が来ると枠の中に iframe が入る。5秒たっても空なら（審査中・在庫切れ）空の箱を残さず紹介にする
  const slot = box.querySelector(".admax-ads");
  setTimeout(() => {
    if (box.dataset.kind !== "admax" || !slot.isConnected || slot.children.length) return;
    box.innerHTML = prBannerHtml("nofill");
    box.dataset.kind = "house";
    box.dataset.nofill = "1";
  }, 5000);
}

// where: いまのタブ（紹介のリンクの印に使う）
export function rollPanelAd(where = "") {
  if (!box || !CONFIG.banner) return;
  const now = Date.now();
  if (kind && now - lastRoll < HOLD_MS) return;
  lastRoll = now;
  const admaxReady = CONFIG.banner.admax && CONFIG.banner.admax.sp && CONFIG.banner.admax.pc;
  // 確認用（localhost だけ）: ?pa=admax / ?pa=house で固定
  const force = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? new URLSearchParams(location.search).get("pa") : null;
  const next = force === "admax" || force === "house" ? force : admaxReady && Math.random() < CONFIG.banner.admaxShare ? "admax" : "house";
  kind = next;
  if (next === "admax") showAdmax();
  else box.innerHTML = prBannerHtml(where || "panel");
  box.dataset.kind = next;
}

// ---------- 画面のいちばん下に固定する小さい広告（スマホだけ・忍者AdMax のオーバーレイ 320×50） ----------
// ゲームを始めてから1回だけ読みこむ（タイトルのスタートボタンの近くには出さない）。
// 広告が出たら、その高さ＋6px を CSS の --ad-ov に入れる → 下のタブ・召喚の演出・ダイアログ・通知・「広告を見る」の画面を
// その分だけ上へずらす（ボタンや「タップで進む」の場所と広告を重ねない＝規約 第10条の誤クリックの誘導に当たらないように）。
// 閉じられたり出なかったりしたら 0 に戻る。広告そのものの位置や見た目には手を入れない。
let ovStarted = false;
function overlayHeight() {
  const app = document.getElementById("app");
  let top = innerHeight;
  for (const f of document.querySelectorAll("iframe")) {
    if (app && app.contains(f)) continue; // 画面の中の広告枠（#panel-ad）は別
    // いちばん外側の「固定表示」の箱を探す（閉じるボタンも同じ箱に入っている）
    let box = null;
    for (let el = f; el && el !== document.body; el = el.parentElement) if (getComputedStyle(el).position === "fixed") box = el;
    if (!box) continue;
    const cs = getComputedStyle(box);
    if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
    const r = box.getBoundingClientRect();
    if (r.height < 20 || r.height > 180 || r.bottom < innerHeight - 4) continue; // 下に固定された小さい箱だけ
    top = Math.min(top, r.top);
  }
  return top < innerHeight ? Math.ceil(innerHeight - top) + 6 : 0;
}
export function startOverlayAd() {
  const id = CONFIG.banner?.admax?.overlay;
  if (ovStarted || !id || !isPhone()) return;
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).get("ov") === "0") return; // 確認用: ?ov=0 で出さない
  ovStarted = true;
  requestAdmax({ admax_id: id, type: "overlay" });
  let last = -1, n = 0;
  const measure = () => {
    const h = overlayHeight();
    if (h !== last) { last = h; document.documentElement.style.setProperty("--ad-ov", `${h}px`); }
  };
  const tick = () => { measure(); n++; setTimeout(tick, n < 40 ? 500 : 2000); };
  setTimeout(tick, 500);
  addEventListener("resize", measure);
}
