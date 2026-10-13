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

// ---------- 画面に固定する広告（忍者AdMax の固定表示） ----------
//   スマホ: いちばん下にオーバーレイ 320×50（2026-10-13 ユーザー「小さめの追従型も」）
//   PC:     右に固定 160×600 と、下に固定 300×250（同日ユーザー「PC 型の追従2個とも出していい」）
// ゲームを始めてから1回だけ読みこむ（タイトルのスタートボタンの近くには出さない）。
// 出た広告の場所を測って、CSS の --ad-bottom（下の広告の高さ＋閉じるボタン＋すき間）と --ad-right（右の広告の幅＋すき間）に入れる
// → 下のタブ・PC の画面全体・召喚の演出・ダイアログ・通知・「広告を見る」の画面を、広告と重ならない場所へ寄せる
//   （ボタンや「タップで進む」の場所と広告を重ねない＝規約 第10条の誤クリックの誘導に当たらないように）。
// 閉じられたり出なかったりしたら 0 に戻る。広告そのものの位置や見た目には手を入れない。
//   ※右に固定の広告は、忍者AdMax が自分でページの幅を縮めて場所を作る（2026-10-13 確認）。こちらは固定表示の層だけ寄せる
let fixedStarted = false;
function measureFixedAds() {
  const app = document.getElementById("app");
  let bottom = 0, right = 0;
  const bottomBoxes = [];
  for (const f of document.querySelectorAll("iframe")) {
    if (app && app.contains(f)) continue; // 画面の中の広告枠（#panel-ad）は別
    // いちばん外側の「固定表示」の箱を探す
    let box = null;
    for (let el = f; el && el !== document.body; el = el.parentElement) if (getComputedStyle(el).position === "fixed") box = el;
    if (!box) continue;
    const cs = getComputedStyle(box);
    if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
    const r = box.getBoundingClientRect();
    if (r.width < 20 || r.height < 20) continue;
    if (r.height >= 300 && r.width <= 340 && r.right >= innerWidth - 4) {
      right = Math.max(right, Math.ceil(innerWidth - r.left) + 8); // 右に固定（縦長）
    } else if (r.height <= 300 && r.bottom >= innerHeight - 4) {
      // 下に固定。PC の 300×250 は閉じるボタン（30px）が箱の上に出るので、その分もあける
      const extra = isPhone() ? 6 : 38;
      bottom = Math.max(bottom, Math.ceil(innerHeight - r.top) + extra);
      bottomBoxes.push(r);
    }
  }
  // PC の2段組み: 下の広告と横の位置が重なる列だけ、下を縮める（重ならない列は縦いっぱいのまま）
  const cols = {};
  for (const [key, sel] of [["l", ".stage-col"], ["r", ".panel-col"]]) {
    const el = document.querySelector(sel);
    const c = el?.getBoundingClientRect();
    cols[key] = c && innerWidth >= 960 && bottomBoxes.some((b) => c.left < b.right + 8 && c.right > b.left - 8) ? bottom : 0;
  }
  // 右の広告: 忍者AdMax はページの中身を自分の箱で包み、右に余白をつけて場所を作る（2026-10-13 確認）。
  // こちらの余白を除いた #app の右端が、まだ広告の左端より右にあるときだけ、こちらで右をあける
  // （こちらの余白を足して比べるので、「あける→足りた→戻す」をくり返さない）
  const ar = app?.getBoundingClientRect();
  const mine = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ad-app-r")) || 0;
  const sideLeft = innerWidth - (right - 8);
  const appRight = right && ar && ar.right + mine > sideLeft + 2 ? right : 0;
  return { bottom, right, colL: cols.l, colR: cols.r, appRight };
}
export function startFixedAds() {
  const ad = CONFIG.banner?.admax || {};
  // PC の下 300×250 は、縦が短い画面（880px 未満）では出さない（ゲームの画面が狭くなりすぎる）
  const ids = isPhone() ? [[ad.overlay, "overlay"]] : [[ad.pcSide, "action"], innerHeight >= 880 ? [ad.pcBottom, "action"] : [null]];
  const want = ids.filter(([id]) => id);
  if (fixedStarted || !want.length) return;
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).get("ov") === "0") return; // 確認用: ?ov=0 で出さない
  fixedStarted = true;
  for (const [id, type] of want) requestAdmax({ admax_id: id, type });
  const root = document.documentElement.style;
  let last = "", n = 0;
  const measure = () => {
    const m = measureFixedAds();
    const key = JSON.stringify(m);
    if (key === last) return;
    last = key;
    root.setProperty("--ad-bottom", `${m.bottom}px`);
    root.setProperty("--ad-right", `${m.right}px`);
    root.setProperty("--ad-col-l", `${m.colL}px`);
    root.setProperty("--ad-col-r", `${m.colR}px`);
    root.setProperty("--ad-app-r", `${m.appRight}px`);
    dispatchEvent(new Event("resize")); // 召喚の演出などが大きさを測り直す
  };
  const tick = () => { measure(); n++; setTimeout(tick, n < 40 ? 500 : 2000); };
  setTimeout(tick, 500);
  addEventListener("resize", () => setTimeout(measure, 50));
}
