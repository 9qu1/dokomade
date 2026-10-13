// リワード広告の窓口。ゲーム側は showRewarded() だけを呼ぶ（中身は設定で差し替え）
import { CONFIG } from "./config.js";
import { pickPr, prHref, PR_MORE } from "./pr.js";

let busy = false;

// 戻り値: { rewarded: boolean, reason?: string }
export async function showRewarded(placement, { title = "広告を見る", reward = "" } = {}) {
  if (busy) return { rewarded: false, reason: "busy" };
  busy = true;
  try {
    const p = CONFIG.ads.provider;
    if (p === "free") return { rewarded: true, reason: "free" };
    if (p === "gpt") return await gptRewarded(placement);
    if (p === "h5") return await h5Rewarded(placement);
    if (p === "pr") return await prRewarded(reward, placement);
    return await mockRewarded(title, reward);
  } finally {
    busy = false;
  }
}

// ---- テスト表示（本物の広告の代わりに、数秒の画面を出す） ----
function mockRewarded(title, reward) {
  return countdownDialog(CONFIG.ads.mockSeconds, "mock", (secs) => `
      <div class="ad-mock-box" role="dialog" aria-label="広告">
        <div class="ad-mock-tag">広告（テスト表示）</div>
        <div class="ad-mock-video"><div class="ad-mock-wave"></div><div class="ad-mock-text">ここに動画広告が流れます</div></div>
        <div class="ad-mock-reward">見終わると：<b>${reward}</b></div>
        <div class="ad-mock-bar"><i></i></div>
        <div class="ad-mock-row">
          <button class="btn ghost ad-mock-close">閉じる（報酬なし）</button>
          <button class="btn gold ad-mock-ok" disabled>あと <span>${secs}</span> 秒</button>
        </div>
      </div>`);
}

// ---- デモ版：作者のほかのサイトの紹介を数秒見せる（広告会社の広告は使わない） ----
function prRewarded(reward, placement) {
  const s = pickPr();
  return countdownDialog(CONFIG.ads.prSeconds ?? 5, "pr", (secs) => `
      <div class="ad-mock-box pr-box" role="dialog" aria-label="おすすめ">
        <div class="ad-mock-tag">PR：${PR_MORE.name}</div>
        <a class="pr-full" href="${prHref(s, `reward_${placement}`)}" target="_blank" rel="noopener">
          <span class="pr-full-shot" style="background-image:url('assets/pr/${s.id}.webp')"></span>
          <span class="pr-full-head"><img src="assets/pr/${s.id}-icon.webp" alt=""><span><b>${s.name}</b><small>${s.catch}</small></span></span>
          <span class="pr-full-desc">${s.desc}</span>
          <span class="pr-full-go">${s.cta} ›</span>
        </a>
        <div class="ad-mock-reward">見終わると：<b>${reward}</b></div>
        <div class="ad-mock-bar"><i></i></div>
        <div class="ad-mock-row">
          <button class="btn ghost ad-mock-close">閉じる（報酬なし）</button>
          <button class="btn gold ad-mock-ok" disabled>あと <span>${secs}</span> 秒</button>
        </div>
      </div>`);
}

// 数秒数えてから「報酬を受け取る」が押せるようになる画面（テスト表示・デモ版の紹介で共通）
function countdownDialog(secs, reason, html) {
  return new Promise((resolve) => {
    const el = document.createElement("div");
    el.className = "ad-mock";
    el.innerHTML = html(secs);
    document.body.appendChild(el);
    const bar = el.querySelector(".ad-mock-bar i");
    const ok = el.querySelector(".ad-mock-ok");
    const span = ok.querySelector("span");
    const t0 = performance.now();
    const iv = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / (secs * 1000));
      bar.style.width = `${k * 100}%`;
      const left = Math.ceil(secs * (1 - k));
      if (k >= 1) { clearInterval(iv); ok.disabled = false; ok.textContent = "報酬を受け取る"; }
      else span.textContent = left;
    }, 100);
    const done = (rewarded) => { clearInterval(iv); el.remove(); resolve({ rewarded, reason: rewarded ? reason : "closed" }); };
    el.querySelector(".ad-mock-close").onclick = () => done(false);
    ok.onclick = () => done(true);
  });
}

// ---- Google アド マネージャー（GPT）のウェブ用リワード広告 ----
function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement("script"); s.async = true; s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}
async function gptRewarded() {
  const path = CONFIG.ads.gptAdUnitPath;
  if (!path) return noFill("no-unit");
  try { await loadScript("https://securepubads.g.doubleclick.net/tag/js/gpt.js"); } catch { return noFill("load"); }
  const googletag = (window.googletag = window.googletag || { cmd: [] });
  return new Promise((resolve) => {
    let rewarded = false, slot = null, settled = false;
    const finish = (r) => { if (settled) return; settled = true; try { if (slot) googletag.destroySlots([slot]); } catch {} resolve(r); };
    const timer = setTimeout(() => finish(CONFIG.ads.grantOnNoFill ? { rewarded: true, reason: "timeout" } : { rewarded: false, reason: "timeout" }), 12000);
    googletag.cmd.push(() => {
      slot = googletag.defineOutOfPageSlot(path, googletag.enums.OutOfPageFormat.REWARDED);
      if (!slot) { clearTimeout(timer); return finish(noFillSync("unsupported")); }
      slot.addService(googletag.pubads());
      const pa = googletag.pubads();
      pa.addEventListener("rewardedSlotReady", (e) => { if (e.slot === slot) { clearTimeout(timer); e.makeRewardedVisible(); } });
      pa.addEventListener("rewardedSlotGranted", (e) => { if (e.slot === slot) rewarded = true; });
      pa.addEventListener("rewardedSlotClosed", (e) => { if (e.slot === slot) finish({ rewarded, reason: rewarded ? "gpt" : "closed" }); });
      pa.addEventListener("slotRenderEnded", (e) => { if (e.slot === slot && e.isEmpty) { clearTimeout(timer); finish(noFillSync("empty")); } });
      googletag.enableServices();
      googletag.display(slot);
    });
  });
}

// ---- AdSense H5 Games Ads（Ad Placement API） ----
async function h5Rewarded(placement) {
  const client = CONFIG.ads.h5ClientId;
  if (!client) return noFill("no-client");
  if (!window.adBreak) {
    try {
      const s = document.createElement("script");
      s.async = true;
      s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
      s.setAttribute("data-ad-client", client);
      s.crossOrigin = "anonymous";
      document.head.appendChild(s);
      window.adsbygoogle = window.adsbygoogle || [];
      window.adBreak = window.adConfig = function (o) { window.adsbygoogle.push(o); };
      window.adConfig({ preloadAdBreaks: "on", sound: "on" });
    } catch { return noFill("load"); }
  }
  return new Promise((resolve) => {
    let rewarded = false, shown = false;
    window.adBreak({
      type: "reward",
      name: placement,
      beforeReward: (showAdFn) => { shown = true; showAdFn(); },
      adDismissed: () => {},
      adViewed: () => { rewarded = true; },
      adBreakDone: () => resolve(shown ? { rewarded, reason: rewarded ? "h5" : "closed" } : noFillSync("nofill")),
    });
  });
}

function noFillSync(reason) { return CONFIG.ads.grantOnNoFill ? { rewarded: true, reason: `nofill:${reason}` } : { rewarded: false, reason }; }
async function noFill(reason) { return noFillSync(reason); }
