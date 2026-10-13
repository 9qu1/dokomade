// 画面の下の広告枠（1画面に1つ・タブのパネルの外＝描き直しで消えない）
//   忍者AdMax（config.js の banner.admaxShare＝9割）と、くぁくぁのほかのサイトの紹介（残りの1割）
//   ・タブを切りかえたときに選び直す。ただし前に選んでから30秒たっていなければそのまま（広告を続けて読みこまない）
//   ・忍者AdMax は非同期タグ（SPA で表示できる形）。スマホの UA には SP 枠、それ以外には PC 枠（SP 枠はスマホにしか配信されない）
//   ・忍者AdMax の規約（第10条）に合わせて、ボタンから離して置く・報酬と引きかえに見せない（「広告を見る」の画面は紹介だけ）
import { CONFIG } from "./config.js";
import { prBannerHtml } from "./pr.js";

const box = typeof document !== "undefined" ? document.getElementById("panel-ad") : null;
const HOLD_MS = 30e3;
let lastRoll = 0;
let kind = "";

const isPhone = () => /iPhone|iPod|Android.+Mobile|Mobile.+Firefox/i.test(navigator.userAgent);

function showAdmax() {
  const sp = isPhone();
  const id = sp ? CONFIG.banner.admax.sp : CONFIG.banner.admax.pc;
  const [w, h] = sp ? [320, 100] : [300, 250];
  box.innerHTML = `<div class="pa-label">広告</div><div class="pa-admax" style="width:${w}px;height:${h}px"><div class="admax-ads" data-admax-id="${id}" style="display:inline-block;width:${w}px;height:${h}px;"></div></div>`;
  (window.admaxads = window.admaxads || []).push({ admax_id: id, type: "banner" });
  if (!document.querySelector('script[src="https://adm.shinobi.jp/st/t.js"]')) {
    const s = document.createElement("script");
    s.src = "https://adm.shinobi.jp/st/t.js";
    s.async = true;
    s.charset = "utf-8";
    document.body.appendChild(s);
  }
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
