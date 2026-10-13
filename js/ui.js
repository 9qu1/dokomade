// 画面まわりの部品（通知・ダイアログ・各パネル）
import { fmt, fmtPct, fmtTime, trimNum, D } from "./big.js";
import * as B from "./balance.js";
import {
  COMPANIONS, HERO_SKILLS, RARITIES, SLOTS, STATS, GACHA, BOOSTS, AD_LIMITS, ACHIEVEMENTS, titleFor, MILESTONES, TAP_UPS, SKILLS,
  kmOf, kmText, isDefaultName,
} from "./data.js";
import { src } from "./assets.js";
import { CONFIG } from "./config.js";
import { itemScore, itemStats, statText } from "./items.js";

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- 通知 ----------
export function toast(html, { icon = null, cls = "", life = 2.6 } = {}) {
  const box = $("#toasts");
  const d = document.createElement("div");
  d.className = `toast ${cls}`;
  d.style.setProperty("--life", `${life}s`);
  d.innerHTML = `${icon ? `<img src="${icon}" alt="">` : ""}<div>${html}</div>`;
  box.appendChild(d);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => d.remove(), (life + 0.4) * 1000);
}

// ---------- ダイアログ ----------
let modalClose = null;
export function modal(html, { onOpen, closable = true } = {}) {
  const m = $("#modal"), box = $("#modal-box");
  box.innerHTML = (closable ? `<button class="modal-x" aria-label="閉じる">×</button>` : "") + html;
  m.hidden = false;
  const close = () => { m.hidden = true; box.innerHTML = ""; modalClose = null; };
  modalClose = close;
  if (closable) { $(".modal-x", box).onclick = close; m.onclick = (e) => { if (e.target === m) close(); }; }
  else m.onclick = null;
  onOpen?.(box, close);
  return close;
}
export const closeModal = () => modalClose?.();
export const modalOpen = () => !$("#modal").hidden;

export function banner(html, ms = 2200) {
  const b = $("#banner");
  b.hidden = false;
  b.innerHTML = html;
  b.style.animation = "none"; void b.offsetWidth; b.style.animation = "";
  clearTimeout(banner._t);
  banner._t = setTimeout(() => { b.hidden = true; }, ms);
}

const coinImg = `<img class="px" src="${src("icon", "i_coin")}" alt="">`;
const gemImg = `<img class="px" src="${src("icon", "i_gem")}" alt="">`;
export { coinImg, gemImg };

// ================= 強化パネル =================
export function renderUp(game, el) {
  const s = game.s;
  const mode = s.settings.buyMode;
  const modes = [[1, "×1"], [10, "×10"], [100, "×100"], ["max", "MAX"]];
  const showPrestige = s.bestStage >= B.PRESTIGE_MIN - 10 || s.stats.prestiges > 0;
  el.innerHTML = `
    <div class="buy-mode">${modes.map(([v, l]) => `<button data-mode="${v}" class="${String(v) === String(mode) ? "on" : ""}">${l}</button>`).join("")}</div>
    <div class="card">
      <h3>機関車 <small>タップと水晶ライトの攻撃が強くなる</small></h3>
      <div class="row" id="hero-row">
        <div class="pic wide"><img src="${src("sprite", "t_loco")}" alt=""></div>
        <div class="info">
          <div class="nm">ドコマデ号${!isDefaultName(s.name) ? `<small class="who">車掌 ${esc(s.name)}</small>` : ""}<span class="lv" data-k="hlv"></span></div>
          <div class="ds" data-k="hds"></div>
          <div class="ms" data-k="hms"></div>
        </div>
        <div class="buy"><button class="btn gold" data-buy="hero"><span class="cost" data-k="hcost"></span><span class="sub" data-k="hn"></span></button></div>
      </div>
      <div class="skills" title="機関車の改造（レベルで解放）">${HERO_SKILLS.map((k) => `<span data-skill="${k.lv}" title="${esc(k.desc)}">Lv${k.lv} ${esc(k.name)}</span>`).join("")}</div>
    </div>
    <div class="card tap-card">
      <h3>👆 タップ強化 <small>連打するほど強くなる</small></h3>
      <div id="tap-list">${TAP_UPS.map((u) => `
        <div class="row" data-tapup="${u.id}">
          <div class="pic emoji">${u.icon}</div>
          <div class="info">
            <div class="nm">${esc(u.name)}<span class="lv" data-k="tlv"></span></div>
            <div class="ds" data-k="tds"></div>
          </div>
          <div class="buy"><button class="btn" data-buytap="${u.id}"><span class="cost" data-k="tcost"></span><span class="sub" data-k="tn"></span></button></div>
        </div>`).join("")}
      </div>
    </div>
    <div class="card skill-card">
      <h3>✨ 必殺技 <small>戦闘画面の下のボタンで使う</small></h3>
      <div id="skill-list">${SKILLS.map((k) => `
        <div class="row" data-skillrow="${k.id}">
          <div class="pic emoji">${k.icon}</div>
          <div class="info">
            <div class="nm">${esc(k.name)}<span class="lv" data-k="klv"></span></div>
            <div class="ds" data-k="kds"></div>
          </div>
          <div class="buy"><button class="btn" data-buyskill="${k.id}"><span class="cost" data-k="kcost"></span><span class="sub" data-k="kn"></span></button></div>
        </div>`).join("")}
      </div>
    </div>
    ${showPrestige ? `<div class="card prestige-card" id="prestige-card"></div>` : ""}
    <div class="card">
      <h3>車両 <small>連結すると屋根の乗務員が自動で戦う</small></h3>
      <div id="comp-list">${COMPANIONS.map((c, k) => `
        <div class="row" data-comp="${k}">
          <div class="pic wide car"><img class="car" src="${src("sprite", c.car)}" alt=""><img class="crew" src="${src("sprite", c.crew)}" alt=""></div>
          <div class="info">
            <div class="nm"><span data-k="cname"></span><span class="lv" data-k="clv"></span></div>
            <div class="ds" data-k="cds"></div>
            <div class="ms" data-k="cms"></div>
          </div>
          <div class="buy"><button class="btn" data-buy="${k}"><span class="cost" data-k="ccost"></span><span class="sub" data-k="cn"></span></button></div>
        </div>`).join("")}
      </div>
    </div>`;
  updateUp(game, el);
}

export function updateUp(game, el) {
  const s = game.s;
  const st = game.stats();
  const mode = s.settings.buyMode;
  // 機関車
  const hi = game.heroBuyInfo(mode);
  const set = (root, k, v) => { const e = root.querySelector(`[data-k="${k}"]`); if (e && e.innerHTML !== v) e.innerHTML = v; };
  const hero = el.querySelector("#hero-row");
  if (hero) {
    set(hero, "hlv", `Lv${s.heroLv}`);
    set(hero, "hds", `タップ <b>${fmt(st.tapDmg)}</b>・会心 <b>${Math.round(st.critRate * 100)}%</b>`);
    const next = HERO_SKILLS.find((k) => k.lv > s.heroLv);
    set(hero, "hms", next ? `Lv${next.lv}で「${next.name}」${next.desc}` : "Lv400から100ごとに全ダメージ×2");
    set(hero, "hcost", `${coinImg}${fmt(hi.cost)}`);
    set(hero, "hn", `+${hi.n}レベル`);
    const b = hero.querySelector("[data-buy]"); b.disabled = s.gold.lt(hi.cost);
    el.querySelectorAll("[data-skill]").forEach((x) => x.classList.toggle("on", s.heroLv >= Number(x.dataset.skill)));
  }
  // タップ強化
  el.querySelectorAll("[data-tapup]").forEach((row) => {
    const id = row.dataset.tapup;
    const lv = B.tapLv(s, id);
    const info = game.tapUpInfo(id, mode);
    set(row, "tlv", lv > 0 ? `Lv${lv}` : "");
    set(row, "tds", tapUpText(id, lv, st));
    set(row, "tcost", info.maxed ? "最大" : `${coinImg}${fmt(info.cost)}`);
    set(row, "tn", info.maxed ? "" : `+${info.n}レベル`);
    const b = row.querySelector("button");
    b.disabled = info.maxed || s.gold.lt(info.cost);
    b.classList.toggle("gold", !b.disabled);
  });
  // 必殺技
  el.querySelectorAll("[data-skillrow]").forEach((row) => {
    const id = row.dataset.skillrow;
    const k = SKILLS.find((x) => x.id === id);
    const sk = s.skills[id] || { lv: 0 };
    const open = game.skillUnlocked(id);
    row.classList.toggle("locked", !open);
    set(row, "klv", open ? `Lv${sk.lv + 1}` : "");
    set(row, "kds", open ? `${skillText(id, sk.lv)}・待ち${Math.round(B.skillCd(id, sk.lv))}秒` : `機関車Lv${k.unlock}で使えるようになる`);
    const cost = B.skillCost(id, sk.lv);
    set(row, "kcost", `${coinImg}${fmt(cost)}`);
    set(row, "kn", "強くする");
    const b = row.querySelector("button");
    b.disabled = !open || s.gold.lt(cost);
    b.classList.toggle("gold", !b.disabled);
  });
  // 再出発（転生）
  const pc = el.querySelector("#prestige-card");
  if (pc) {
    const can = game.canPrestige();
    const gain = game.prestigeGain();
    const html = `
      <h3><img class="px h3-ic" src="${src("icon", "i_soul")}" alt="">再出発 <small>魔法の炎をためて始発から</small></h3>
      <div class="ds" style="font-size:13px">いまの魔法の炎 <b>${fmt(s.souls)}</b>（全ダメージ ${trimNumBig(st.soulMul)}倍）</div>
      <div class="ds" style="font-size:13px;margin:4px 0 8px">${can ? `いま再出発すると 魔法の炎 <b style="color:#e0b0ff">+${fmt(gain)}</b>` : `この旅で${kmText(B.PRESTIGE_MIN)}まで行くと再出発できます（いま最高${kmText(s.runMax)}）`}</div>
      <button class="btn pink wide" id="btn-prestige" ${can && gain.gt(0) ? "" : "disabled"}>再出発する（始発から・ジェム+100）</button>
      <p class="note">ゴールド・機関車と車両のレベルは0に戻ります。部品・ジェム・記録は残ります。</p>`;
    if (pc.dataset.h !== html) { pc.innerHTML = html; pc.dataset.h = html; }
  }
  // 車両
  el.querySelectorAll("[data-comp]").forEach((row) => {
    const k = Number(row.dataset.comp);
    const c = COMPANIONS[k];
    const lv = s.comp[k];
    const unlocked = game.compUnlocked(k);
    row.classList.toggle("locked", !unlocked);
    set(row, "cname", unlocked ? esc(c.name) : "？？？");
    row.title = unlocked ? `${c.name}（乗務員：${c.who}）「${c.line}」` : "";
    set(row, "clv", lv > 0 ? `Lv${lv}` : "");
    if (!unlocked) {
      set(row, "cds", "ひとつ前の車両を連結すると出てくる");
      set(row, "cms", "");
    } else {
      const dps = st.compEach[k].mul(st.compMul).mul(st.allMul);
      set(row, "cds", lv > 0 ? `DPS <b>${fmt(dps)}</b>・${esc(c.who)}` : `乗務員：${esc(c.who)}「${esc(c.line)}」`);
      const nm = B.nextCompMilestone(lv);
      set(row, "cms", lv > 0 ? `Lv${nm}で ×2` : `DPS ${fmt(D(B.compBaseDps(k)).mul(st.compMul).mul(st.allMul))} から`);
    }
    const info = game.compBuyInfo(k, mode);
    set(row, "ccost", `${coinImg}${fmt(info.cost)}`);
    set(row, "cn", lv === 0 ? "連結する" : `+${info.n}レベル`);
    const b = row.querySelector("[data-buy]");
    b.disabled = !unlocked || s.gold.lt(info.cost);
    b.classList.toggle("gold", unlocked && !s.gold.lt(info.cost));
  });
}
function trimNumBig(d) { return d.lt(10000) ? trimNum(d.toNumber()) : fmt(d); }

// タップ強化の「いま → 次」
export function tapUpText(id, lv, st) {
  const nx = lv + 1;
  switch (id) {
    case "power": return `タップの基本 ×${trimNum(B.tapPowerMul(lv))} → ×${trimNum(B.tapPowerMul(nx))}（25ごとに×2）`;
    case "link": return `DPSの ${Math.round((B.TAP_DPS_RATIO + 0.01 * lv) * 100)}% → ${Math.round((B.TAP_DPS_RATIO + 0.01 * nx) * 100)}% を上乗せ`;
    case "crit": return `タップの会心率 ${Math.round(st.tapCritRate * 100)}% → ${Math.round(Math.min(1, st.tapCritRate + 0.01) * 100)}%`;
    case "critDmg": return `タップの会心 ×${trimNum(st.tapCritMult)} → ×${trimNum(st.tapCritMult + 0.3)}`;
    case "combo": return `上限 ${B.comboCap(lv)} → ${B.comboCap(nx)}コンボ・最大 ×${trimNum(B.comboMul(9e9, lv))} → ×${trimNum(B.comboMul(9e9, nx))}`;
    case "echo": return `分身の確率 ${Math.round(B.echoChance(lv) * 100)}% → ${Math.round(B.echoChance(nx) * 100)}%`;
    case "gold": return `1タップで敵${Math.round(B.TAP_GOLD_RATE * lv * 100)}% → ${Math.round(B.TAP_GOLD_RATE * nx * 100)}%分のゴールド`;
    case "auto": return `1秒に ${B.autoTapRate(lv)} → ${B.autoTapRate(nx)}回（コンボは増えない）`;
  }
  return "";
}
export function skillText(id, lv) {
  switch (id) {
    case "meteor": return `DPSの${Math.round(B.meteorSecs(lv))}秒分を一気に`;
    case "rush": return `${B.rushSecs(lv)}秒間 1秒に15回の自動タップ`;
    case "midas": return `${B.midasSecs(lv)}秒間 タップのゴールド×10`;
    case "freeze": return `${B.freezeSecs(lv)}秒間 ボスの時間が止まる`;
  }
  return "";
}

// ================= 装備パネル =================
const stars = (n) => (n > 0 ? `★${n}` : "");
export function renderGear(game, el, filter = "all") {
  const s = game.s;
  const L = s.bestStage;
  const eqIds = new Set(Object.values(s.equip));
  const st = game.stats();
  const items = s.items.filter((x) => filter === "all" || x.slot === filter).sort((a, b) => (eqIds.has(b.id) - eqIds.has(a.id)) || b.r - a.r || (b.star || 0) - (a.star || 0) || itemScore(b, L) - itemScore(a, L));
  const sum = Object.entries(st.gear).filter(([, v]) => v > 0).map(([t, v]) => `<div><span>${STATS[t].name}</span><b>${STATS[t].fmt === "pt" ? `+${trimNum(v)}%` : fmtPct(v)}</b></div>`).join("");
  el.innerHTML = `
    <div class="card">
      <h3>取り付け中の部品 <small>最高到達（${kmText(L)}）に合わせて育つ</small></h3>
      <div class="slots">${SLOTS.map((sl) => {
        const it = s.items.find((x) => x.id === s.equip[sl.key]);
        return `<div class="slot ${it ? `it r${it.r}` : ""}" data-item="${it ? it.id : ""}"><span class="sl">${sl.name}</span>${it ? `<img src="${src("icon", it.icon)}" alt=""><span class="lv">${RARITIES[it.r].name}${it.star ? ` ${stars(it.star)}` : ""}</span>` : ""}</div>`;
      }).join("")}</div>
      <div class="gear-sum">${sum || `<div><span>まだ部品がありません</span></div>`}</div>
    </div>
    <div class="card">
      <h3>もちもの <small>${s.items.length}/120</small></h3>
      <div class="kakera-line"><span>✦ 星のかけら <b>${(s.kakera || 0).toLocaleString("ja-JP")}</b></span><small>分解で増える・覚醒（★）に使う</small></div>
      <div class="inv-tools">
        <div class="seg">${[["all", "全部"], ...SLOTS.map((x) => [x.key, x.name])].map(([k, l]) => `<button data-filter="${k}" class="${filter === k ? "on" : ""}">${l}</button>`).join("")}</div>
      </div>
      <div class="inv-tools">
        <button class="btn small green" id="btn-autoequip" style="flex:1">いちばん強くする</button>
        <button class="btn small" id="btn-sellnr" style="flex:1">N・Rをまとめて分解</button>
      </div>
      <div class="inv">${items.map((it) => `
        <div class="it r${it.r}" data-item="${it.id}">
          <img src="${src("icon", it.icon)}" alt="">
          ${eqIds.has(it.id) ? `<span class="eq">使用中</span>` : it.isNew ? `<span class="nw">NEW</span>` : ""}
          ${it.lock ? `<span class="lk">🔒</span>` : ""}
          <span class="lvl">${RARITIES[it.r].name}</span>
          ${it.star ? `<span class="st">${stars(it.star)}</span>` : ""}
        </div>`).join("") || `<p class="note">敵を倒すと部品を拾います。召喚でも手に入ります。</p>`}</div>
      <p class="note">部品の強さはレアリティと★で決まり、レベルは最高到達距離に合わせて自動で上がります。ガチャで当てた部品は、先へ進んでも弱くなりません。</p>
    </div>`;
}

export function itemDetailHtml(game, it) {
  const s = game.s;
  const L = s.bestStage;
  const cur = s.items.find((x) => x.id === s.equip[it.slot]);
  const isEq = cur && cur.id === it.id;
  const diff = cur && !isEq ? itemScore(it, L) - itemScore(cur, L) : 0;
  const cmp = cur && !isEq ? `<div class="${diff >= 0 ? "cmp-up" : "cmp-down"}" style="font-size:13px">いまの${SLOTS.find((x) => x.key === it.slot).name}（${esc(cur.name)}）より ${diff >= 0 ? "強い ▲" : "弱い ▼"}</div>` : "";
  const now = itemStats(it, L);
  const next = itemStats({ ...it, star: (it.star || 0) + 1 }, L);
  const cost = game.awakenCost(it);
  const canAw = (s.kakera || 0) >= cost;
  return `
    <div class="item-detail">
      <div class="big-ic it r${it.r}"><img src="${src("icon", it.icon)}" alt=""></div>
      <span class="rt r${it.r}">${RARITIES[it.r].name}</span> ${it.star ? `<b class="star-badge">${stars(it.star)}</b>` : ""} <small style="color:var(--muted)">Lv${L}・${SLOTS.find((x) => x.key === it.slot).name}</small>
      <div class="nm">${esc(it.name)}</div>
      ${cmp}
      <div class="stat-list">
        ${now.map((x, i) => `<div class="${x.main ? "main" : ""}"><span>${statText(x.t, x.v)}</span><span>${x.main ? "メイン" : ""}${x.v !== next[i].v ? ` <small class="cmp-up">→ ${statText(x.t, next[i].v).replace(/^.*? /, "")}</small>` : ""}</span></div>`).join("")}
      </div>
      <div class="awaken">
        <button class="btn pink wide" data-act="awaken" ${canAw ? "" : "disabled"}>覚醒する ★${(it.star || 0) + 1}（✦ ${cost.toLocaleString("ja-JP")}）<span class="sub">強さ +30%・いま ✦ ${(s.kakera || 0).toLocaleString("ja-JP")}</span></button>
      </div>
      <div class="acts">
        ${isEq ? `<button class="btn ghost" disabled>取り付け中</button>` : `<button class="btn gold" data-act="equip">取り付ける</button>`}
        <button class="btn" data-act="lock">${it.lock ? "ロックを外す" : "ロックする"}</button>
        ${isEq || it.lock ? "" : `<button class="btn red" data-act="sell">分解（✦ ${game.kakeraOf(it).toLocaleString("ja-JP")}）</button>`}
      </div>
      <p class="note">${kmText(it.lv)}地点で入手。レベルは最高到達距離に合わせて自動で上がります。</p>
    </div>`;
}

// ================= 召喚パネル =================
export function renderGacha(game, el) {
  const s = game.s;
  const pityLeft = Math.max(0, GACHA.pity - s.pity);
  const r = GACHA.rates, u = GACHA.upRates;
  el.innerHTML = `
    <div class="gacha-hero" style="background-image:url('${src("ui", "gacha_hall")}')">
      <h2>星の召喚陣</h2>
      <p>拾う部品より強い、SR〜LR の部品が出ます。レベルは最高到達（${kmText(s.bestStage)}）に合わせて強くなります。</p>
    </div>
    ${s.tickets.free10 > 0 ? `<button class="btn pink wide tk-btn" data-pull="free10"><img class="px" src="${src("icon", "i_ticket")}" alt=""><span>はじめての10連召喚（SSR以上1枠確定）<span class="sub">チケット ${s.tickets.free10}枚</span></span></button>` : ""}
    ${s.tickets.share > 0 ? `<button class="btn pink wide tk-btn" data-pull="share"><img class="px" src="${src("icon", "i_ticket")}" alt=""><span>シェア召喚 10連（SSR以上1枠確定・確率2倍）<span class="sub">チケット ${s.tickets.share}枚</span></span></button>` : ""}
    <div class="gacha-btns">
      <button class="btn blue" data-pull="single">1回召喚<span class="sub">${gemImg.replace('class="px"', 'class="px" style="width:14px;vertical-align:-2px"')} ${GACHA.single}</span></button>
      <button class="btn gold" data-pull="ten">10連召喚<span class="sub">${GACHA.ten}ジェム・SR以上1枠確定</span></button>
      <button class="btn green full" data-pull="ad">▶ 広告を見て1回召喚<span class="sub">きょうはあと${game.adLeft("adGacha")}回</span></button>
    </div>
    <div class="card mail-card">
      <h3>📮 ジェムの定期便 <small>毎時0分に届く</small></h3>
      <div class="mail-next"><span>次の便</span><b data-mail="t"></b></div>
      <div class="mail-bar"><i data-mail="bar"></i></div>
      <p class="note" style="margin-bottom:0">1時間ごとに ${B.MAIL_GEMS}ジェム（召喚1回分）が自動で届きます。ゲームを閉じていても${B.MAIL_MAX}時間分（${B.MAIL_GEMS * B.MAIL_MAX}ジェム）までたまります。</p>
    </div>
    <div class="card">
      <h3>確率アップ券 <small>${s.gachaUp}枚</small></h3>
      <p class="note" style="margin-top:0">持っていると次の召喚で SSR・UR・LR の確率が2倍になります（1回か10連、どちらでも1枚使う）。</p>
      <button class="btn green wide" id="btn-ad-up" ${game.adLeft("gachaUp") > 0 ? "" : "disabled"}>▶ 広告を見て確率アップ券をもらう<span class="sub">きょうはあと${game.adLeft("gachaUp")}回</span></button>
    </div>
    <div class="card">
      <h3>天井</h3>
      <div class="pity"><span>UR以上確定まで</span><span class="bar"><i style="width:${(s.pity / GACHA.pity) * 100}%"></i></span><span>あと${pityLeft}回</span></div>
      <p class="note">UR以上が${GACHA.pity}回出ないと、次は必ずUR以上が出ます。</p>
    </div>
    <div class="card" id="rates">
      <h3>提供割合 <small>召喚1回ごと</small></h3>
      <table class="rate-table">
        <tr><td></td><td>ふつう</td><td>確率アップ</td></tr>
        ${["R", "SR", "SSR", "UR", "LR"].map((k, i) => `<tr><td><span class="rt r${i + 1}">${k}</span></td><td>${r[i]}%</td><td>${u[i]}%</td></tr>`).join("")}
      </table>
      <p class="note">10連の最後の1枠は SR 以上（はじめて・シェアの10連は SSR 以上）が確定します。有料の要素はありません。</p>
    </div>`;
}

// 定期便の「次の便」だけ毎秒書きかえる
export function updateGacha(game, el) {
  const t = el.querySelector('[data-mail="t"]'), bar = el.querySelector('[data-mail="bar"]');
  if (!t || !bar) return;
  const now = Date.now(), next = game.mailNext(now);
  const left = Math.max(0, next - now), d = new Date(next);
  const txt = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")} 着（あと${left >= 60e3 ? `${Math.ceil(left / 60e3)}分` : `${Math.ceil(left / 1e3)}秒`}）+${B.MAIL_GEMS}`;
  if (t.textContent !== txt) t.textContent = txt;
  bar.style.width = `${(1 - left / B.MAIL_EVERY_MS) * 100}%`;
}

// ================= ブーストパネル =================
export function renderBoost(game, el, shareState) {
  const s = game.s;
  const rows = Object.entries(BOOSTS).map(([k, b]) => {
    const left = game.boostLeft(k);
    return `
      <div class="row boost-row">
        <div class="pic">${b.icon}</div>
        <div class="info">
          <div class="nm">${b.name} <small style="color:var(--muted)">1回 ${b.hours}時間</small></div>
          <div class="ds">${b.desc}（最大${b.max}時間）</div>
          <div class="left" data-left="${k}">${left > 0 ? `のこり ${fmtTime(left)}` : ""}</div>
        </div>
        <div class="buy"><button class="btn green" data-boost="${k}" ${left >= b.max * 3600 - 60 ? "disabled" : ""}>▶ 広告を見る</button></div>
      </div>`;
  }).join("");
  const shareDone = s.daily.share;
  el.innerHTML = `
    <div class="card">
      <h3>シェアで召喚チケット ${shareDone ? "" : `<span class="reward-badge">きょうの分あり</span>`}</h3>
      <p class="note" style="margin-top:0">旅の記録をシェアすると、<b style="color:var(--gold)">シェア召喚10連（SSR以上確定・確率2倍）</b>のチケットがもらえます（1日1回）。</p>
      <div class="share-box"><div id="share-prev"></div>
        <div class="share-grid">
          <button class="btn pink full" data-share="record">${shareDone ? "記録をシェアする" : "記録をシェアしてチケットをもらう"}</button>
        </div>
      </div>
    </div>
    <div class="card">
      <h3>ブースト <small>広告を見ると使えます</small></h3>
      ${rows}
    </div>
    <div class="card">
      <h3>ジェムをもらう</h3>
      <div class="row boost-row">
        <div class="pic">💎</div>
        <div class="info"><div class="nm">ジェム +30</div><div class="ds">きょうはあと${game.adLeft("gems")}回</div></div>
        <div class="buy"><button class="btn green" id="btn-ad-gems" ${game.adLeft("gems") > 0 ? "" : "disabled"}>▶ 広告を見る</button></div>
      </div>
      <p class="note">毎日のログインで ${100}ジェム（連続ログインで最大220）。ボスを初めて倒すと 5ジェム、${kmText(B.MEGA_EVERY)}ごとの大ボスは 50ジェム。</p>
    </div>`;
}
export function updateBoost(game, el) {
  el.querySelectorAll("[data-left]").forEach((e) => {
    const k = e.dataset.left;
    const left = game.boostLeft(k);
    const t = left > 0 ? `のこり ${fmtTime(left)}` : "";
    if (e.textContent !== t) e.textContent = t;
  });
}

// ================= 順位パネル（ランキング＋記録） =================
const CROWN = ["", "👑", "🥈", "🥉"];
export function renderRec(game, el, rankKind = "all") {
  const s = game.s;
  const st = s.stats;
  const achN = ACHIEVEMENTS.filter((a) => s.ach[a.id]).length;
  const nextM = MILESTONES.find((m) => m > s.bestStage);
  el.innerHTML = `
    <div class="card rank-me" id="rank-me"><div class="note">ランキングを読み込み中…</div></div>
    <div class="card">
      <h3>ランキング <small id="rk-note">2分ごとに更新</small></h3>
      <div class="seg rk-tabs">${[["all", "全国"], ["week", "今週"], ["hit", "最強の一撃"]].map(([k, l]) => `<button data-rk="${k}" class="${rankKind === k ? "on" : ""}">${l}</button>`).join("")}</div>
      <ol class="rk-list" id="rk-list"></ol>
    </div>
    <div class="card" style="text-align:center">
      <div style="font-size:12px;color:var(--muted)">最高到達</div>
      <div style="font-size:40px;line-height:1.1;text-shadow:0 3px 0 #000">${kmText(s.bestStage)}</div>
      <div style="margin:4px 0 10px"><span class="title-badge">${titleFor(s.bestStage)}</span></div>
      ${nextM ? `<p class="note" style="margin:0 0 10px">次の到達記念は${kmText(nextM)}</p>` : ""}
      <button class="btn pink wide" data-share="record">記録をシェアする</button>
    </div>
    <div class="card">
      <h3>旅のきろく</h3>
      <div class="stats-grid">
        <div><small>最強の一撃</small><b>${fmt(st.maxHit)}</b></div>
        <div><small>倒した敵</small><b>${st.kills.toLocaleString("ja-JP")}</b></div>
        <div><small>倒したボス</small><b>${st.bossKills.toLocaleString("ja-JP")}</b></div>
        <div><small>タップ</small><b>${st.taps.toLocaleString("ja-JP")}</b></div>
        <div><small>召喚</small><b>${st.pulls.toLocaleString("ja-JP")}回</b></div>
        <div><small>最高レア</small><b>${st.bestPull ? `${RARITIES[st.bestPull.r].name} ${esc(st.bestPull.name)}` : "-"}</b></div>
        <div><small>再出発</small><b>${st.prestiges}回</b></div>
        <div><small>稼いだゴールド</small><b>${fmt(st.goldEarned)}</b></div>
        <div><small>最大コンボ</small><b>${(st.maxCombo || 0).toLocaleString("ja-JP")}</b></div>
        <div><small>黄金スライム</small><b>${st.lucky}回</b></div>
        <div><small>遊んだ時間</small><b>${fmtTime(st.playSec)}</b></div>
      </div>
    </div>
    <div class="card">
      <h3>実績 <small>${achN}/${ACHIEVEMENTS.length}</small></h3>
      <div class="ach-grid">${ACHIEVEMENTS.map((a) => `<div class="${s.ach[a.id] ? "on" : ""}"><b>${esc(a.name)}</b>${esc(a.desc)}・💎${a.gems}</div>`).join("")}</div>
    </div>`;
}

const pctText = (p) => (p < 1 ? `${Math.max(0.01, Math.round(p * 100) / 100)}%` : p < 10 ? `${Math.round(p * 10) / 10}%` : `${Math.round(p)}%`);
export { pctText };
function rkValue(kind, x) {
  if (kind === "hit") return fmt(D(10).pow(x.hit || 0));
  return kmText(kind === "week" ? x.wbest : x.best);
}
// 自分の順位のカード
export function rankMeHtml(rank, v) {
  const st = rank.state;
  if (!rank.s.rank.join) return `<h3>ランキング</h3><p class="note">いまランキングに参加していません。</p><button class="btn gold wide" id="rk-join">ランキングに参加する</button>`;
  if (st === "none") return `<h3>ランキング</h3><p class="note">ランキングは準備中です。もうしばらくお待ちください。</p>`;
  if (st === "error") return `<h3>ランキング</h3><p class="note">ランキングにつながりませんでした。時間をおいて開き直してください。</p>`;
  if (!v) return `<div class="note">ランキングを読み込み中…</div>`;
  const gap = v.above ? Math.max(1, (v.above.best || 0) - v.me.best) : 0;
  const rival = v.above
    ? `あと <b>${kmOf(gap).toLocaleString("ja-JP")}km</b>で <b>${esc(v.above.name)}</b>さん（${(v.rank - 1).toLocaleString("ja-JP")}位）を抜ける！`
    : `あなたが <b>全国1位</b>！ 追いかけてくる人を待とう`;
  return `
    ${rank.mock ? `<div class="rk-mock">お試しデータ（手元だけ）：架空の500人と比べています</div>` : ""}
    <div class="rk-big"><small>全国</small><b>${CROWN[v.rank] || ""}${v.rank.toLocaleString("ja-JP")}</b><small>位</small></div>
    <div class="rk-sub">${v.total.toLocaleString("ja-JP")}人中・<b>上位${pctText(v.pct)}</b></div>
    <div class="rk-rival">${rival}</div>
    <div class="rk-name">ランキングの名前：<b>${esc(v.me.name)}</b> <button class="btn small ghost" id="rk-rename">変える</button></div>
    <button class="btn pink wide" data-share="rank">順位をシェアする</button>`;
}
// 一覧
export function rankListHtml(kind, v) {
  if (!v) return `<li class="note">読み込み中…</li>`;
  const rows = v.top.map((x, i) => {
    const no = i + 1;
    return `<li class="rk-row ${x.me ? "me" : ""} ${no <= 3 ? `top${no}` : ""}"><span class="no">${CROWN[no] || ""}${no}</span><span class="nm">${esc(x.name)}<small>${esc(x.title || "")}${x.pres ? `・再出発${x.pres}` : ""}</small></span><span class="val">${rkValue(kind, x)}</span></li>`;
  });
  const inTop = v.top.some((x) => x.me);
  if (!inTop) rows.push(`<li class="rk-gap">…</li><li class="rk-row me"><span class="no">${v.rank.toLocaleString("ja-JP")}</span><span class="nm">${esc(v.me.name)}<small>あなた</small></span><span class="val">${rkValue(kind, v.me)}</span></li>`);
  return rows.join("") || `<li class="note">まだだれもいません</li>`;
}

// ================= 設定 =================
export function settingsHtml(s) {
  const tg = (k, label) => `<div class="set-row"><span>${label}</span><button class="toggle ${s.settings[k] ? "on" : ""}" data-set="${k}" aria-label="${label}"></button></div>`;
  return `
    <h2>設定</h2>
    <div class="set-row"><span>名前（シェアとランキングに出ます）</span></div>
    <input type="text" id="set-name" maxlength="12" value="${esc(s.rank.name || s.name)}">
    <div class="set-row"><span>ランキングに参加する</span><button class="toggle ${s.rank.join ? "on" : ""}" data-rankjoin="1" aria-label="ランキングに参加する"></button></div>
    ${tg("sound", "効果音")}
    ${tg("vibrate", "振動（対応端末のみ）")}
    ${tg("autoBoss", "強くなったら自動でボスに再挑戦")}
    ${tg("autoEquip", "強い部品を拾ったら自動で取り付け")}
    ${tg("autoSellN", "拾ったNは自動で分解（星のかけらに）")}
    <div class="set-row"><span>数の表示</span><span>
      <button class="btn small ${s.settings.numFmt === "jp" ? "gold" : "ghost"}" data-num="jp">万・億・兆</button>
      <button class="btn small ${s.settings.numFmt === "sci" ? "gold" : "ghost"}" data-num="sci">1.23e45</button></span></div>
    <h2 style="margin-top:14px">引き継ぎ</h2>
    <p class="note">別の端末で続けるときは、このコードを保存して、新しい端末の「コードを読み込む」に貼ってください。</p>
    <div class="acts"><button class="btn" id="btn-export">コードを表示</button><button class="btn" id="btn-import">コードを読み込む</button></div>
    <textarea id="save-code" hidden></textarea>
    <div class="acts" id="import-go" hidden><button class="btn gold" id="btn-import-go">このコードで上書きする</button></div>
    <h2 style="margin-top:14px">そのほか</h2>
    <div class="acts"><button class="btn red small" id="btn-wipe">データを消して最初から</button></div>
    <p class="note">データはこの端末のブラウザにだけ保存されます。</p>
    ${CONFIG.demo ? `<p class="note demo-note">これは<b>デモ版</b>です。内容やバランスは変わることがあります。画面の下の広告は、忍者AdMax の広告と作者のほかのサイトの紹介です。「広告を見る」では、作者のほかのサイトの紹介が出ます。</p>` : ""}
    <p class="note"><a href="about.html" target="_blank" rel="noopener">このゲームについて（データ・ランキング・お問い合わせ）</a></p>`;
}
