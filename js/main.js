// 起動と配線：ゲーム本体・戦闘シーン・画面・広告・シェア・セーブをつなぐ
import { load, save, newState, exportCode, importCode, wipe } from "./state.js";
import { Game } from "./game.js";
import { Scene } from "./scene.js";
import { GachaFX } from "./gacha-fx.js";
import { sfx, unlockAudio, setSound } from "./sfx.js";
import { showRewarded } from "./ads.js";
import * as SH from "./share.js";
import { Ranking, nameProblem } from "./ranking.js";
import * as UI from "./ui.js";
import { $, $$, toast, modal, closeModal, banner, esc } from "./ui.js";
import { loadMeta, preload, src, META } from "./assets.js";
import { rollPanelAd, startOverlayAd } from "./banner.js";
import { fmt, fmtTime, setNumberMode, trimNum, D } from "./big.js";
import * as B from "./balance.js";
import { BIOMES, NEWS, RARITIES, COMPANIONS, BOOSTS, GACHA, ICONS, titleFor, MILESTONES, SKILLS, kmOf, kmText, markFor, DISTANCE_MARKS, isDefaultName } from "./data.js";

// ---------- データ ----------
let st = load();
const fresh = !st;
if (!st) st = newState();
let game = new Game(st);
setNumberMode(st.settings.numFmt);
setSound(st.settings.sound);

// 挑戦状（シェアされたリンクから来た人）
const q = new URLSearchParams(location.search);
const vsStage = parseInt(q.get("vs") || "0", 10);
if (vsStage > 0 && vsStage > st.bestStage) st.vs = { stage: vsStage, name: (q.get("n") || "").slice(0, 12) };

await loadMeta();
// まだ絵ができていない装備の見た目は出さない
for (const k of Object.keys(ICONS)) { const ok = ICONS[k].filter((id) => META[id]); if (ok.length) ICONS[k].splice(0, ICONS[k].length, ...ok); }
const scene = new Scene($("#scene"), game);
const rank = new Ranking(game);
const gfx = new GachaFX();
preload([["sprite", "t_loco"], ["bg", game.biome().id], ["ui", "logo_train"], ["ui", matchMedia("(orientation: portrait)").matches ? "kv_train_tall" : "kv_train"], ["sprite", "m01_slime"], ...COMPANIONS.flatMap((c) => [["sprite", c.car], ["sprite", c.crew]])]);
// 通過済みの「身近な距離」は知らせない（旧版から続けている人・引き継いだ人）
st.marks = st.marks || {};
for (const m of DISTANCE_MARKS) if (kmOf(st.bestStage) >= m.km) st.marks[m.name] = 1;

// ---------- タイトル ----------
const titleEl = $("#title");
if (st.vs) {
  const v = $("#title-vs");
  v.hidden = false;
  v.innerHTML = `${st.vs.name ? `<b style="font-size:15px;color:#fff">${esc(st.vs.name)}</b> さんからの挑戦状<br>` : "挑戦状が届いています<br>"}<b>${kmText(st.vs.stage)}</b> より遠くへ行ける？`;
}
$("#btn-start").textContent = fresh ? "出発進行！" : "つづきから";
$("#btn-start").onclick = () => {
  unlockAudio();
  sfx.whistle();
  titleEl.classList.add("hide");
  started = true;
  afterStart();
};
let started = false;

function afterStart() {
  // 放置の結果 → ログインボーナス → チュートリアル の順に出す
  const away = (Date.now() - (st.lastSeen || Date.now())) / 1000;
  const mail = game.collectMail();
  const queue = [];
  if (!fresh && away > 60) queue.push(() => showOffline(away, false, mail));
  else if (mail) mailToast(mail);
  queue.push(() => showLogin());
  runQueue(queue);
  rank.start().then(() => refreshRankHud());
  // ガチャ演出の絵は遊び始めてから裏で先読み（最初の召喚で絵が遅れないように）
  setTimeout(() => preload([["fx", "fx_circle"], ["ui", "gacha_hall"], ["ui", "card_back"], ["fx", "cut_dragon"], ["fx", "cut_phoenix"], ["fx", "cut_goddess"], ["icon", "i_ticket"], ["icon", "i_soul"], ["icon", "i_chest"]]), 4000);
  // スマホだけ: 画面のいちばん下に固定する小さい広告（js/banner.js）
  startOverlayAd();
}
function runQueue(q) {
  const next = q.shift();
  if (!next) return;
  const r = next();
  if (r && r.then) r.then(() => runQueue(q)); else runQueue(q);
}

// ---------- ループ ----------
let last = performance.now();
let hudT = 0, panelT = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (started) game.tick(dt);
  scene.draw(dt);
  hudT += dt; panelT += dt;
  hudFast();
  if (hudT > 0.1) { hudT = 0; hudSlow(); hudSkills(); }
  if (panelT > 0.4) { panelT = 0; refreshPanel(); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 見えない間は止まる → 戻ってきたら放置として計算
let hiddenAt = 0;
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") { hiddenAt = Date.now(); save(st); rank.submit(true); }
  else if (hiddenAt && started) {
    const sec = (Date.now() - hiddenAt) / 1000;
    hiddenAt = 0;
    last = performance.now();
    const mail = game.collectMail();
    if (sec > 20) showOffline(sec, sec < 180, mail);
    else if (mail) mailToast(mail);
  }
});
window.addEventListener("pagehide", () => save(st));
setInterval(() => {
  if (!started) return;
  // 日付が変わったら（開きっぱなしでも）ログインボーナスとシェアの権利を戻す
  if (game.rollDaily()) { showLogin(); renderPanel(); }
  const mail = game.collectMail();
  if (mail) { mailToast(mail); if (tab === "gacha") renderPanel(); }
  save(st);
  rank.noteStage(st.stage);
  if (++rankTick % 6 === 0) rank.submit().then((sent) => { if (sent) refreshRankHud(); });
}, 10000);
let rankTick = 0;

// ---------- ランキング ----------
let rankKind = "all";
async function refreshRankHud(force = false) {
  if (rank.state !== "ready") { $("#rank-hud").hidden = true; return; }
  try {
    const v = await rank.board("all", force);
    if (!v) return;
    const h = $("#rank-hud");
    h.hidden = false;
    h.innerHTML = `全国 <b>${v.rank.toLocaleString("ja-JP")}</b>位`;
    if (v.above) pushNews(`【ランキング】あと${kmOf(Math.max(1, v.above.best - v.me.best)).toLocaleString("ja-JP")}kmで ${v.above.name}さん（${v.rank - 1}位）を抜ける！`);
    if (tab === "rec") fillRank();
  } catch (e) { console.warn(e); }
}
rank.on((ev, d) => {
  if (ev === "up") {
    sfx.milestone(); vib([40, 30, 60]);
    toast(`👑 全国 ${d.from.toLocaleString("ja-JP")}位 → <b style="color:var(--gold)">${d.to.toLocaleString("ja-JP")}位</b>！`, { cls: "ach", life: 3.4 });
  }
});
async function fillRank() {
  const me = $("#rank-me"), list = $("#rk-list");
  if (!me || !list) return;
  if (rank.state !== "ready") { me.innerHTML = UI.rankMeHtml(rank, null); list.innerHTML = ""; return; }
  try {
    const [vAll, vKind] = await Promise.all([rank.board("all"), rank.board(rankKind)]);
    if (!$("#rank-me")) return;
    $("#rank-me").innerHTML = UI.rankMeHtml(rank, vAll);
    $("#rk-list").innerHTML = UI.rankListHtml(rankKind, vKind);
    const note = $("#rk-note");
    if (note) note.textContent = rankKind === "week" ? `今週（月曜はじまり）・${vKind.total.toLocaleString("ja-JP")}人` : `${vKind.total.toLocaleString("ja-JP")}人・2分ごとに更新`;
  } catch (e) {
    console.warn(e);
    me.innerHTML = UI.rankMeHtml({ state: "error", s: st, mock: false }, null);
  }
}
function renameRank() {
  modal(`<h2>ランキングの名前</h2>
    <p class="note">12文字まで。ほかの人に見えます。本名や連絡先は入れないでください。</p>
    <input type="text" id="rk-name-in" maxlength="12" value="${esc(st.rank.name || (!isDefaultName(st.name) ? st.name : ""))}" placeholder="例：くぁくぁ">
    <p class="note" id="rk-name-err" style="color:var(--red)"></p>
    <div class="acts"><button class="btn gold" id="rk-name-ok">決める</button></div>`, {
    onOpen: (box, close) => {
      $("#rk-name-ok", box).onclick = async () => {
        const v = $("#rk-name-in", box).value.trim();
        const p = await rank.rename(v);
        if (p) { $("#rk-name-err", box).textContent = p; sfx.cant(); return; }
        st.name = v; save(st); close(); sfx.buy(); toast(`ランキングの名前を「${esc(v)}」にしました`);
        rank.cache = {};
        fillRank(); refreshRankHud();
      };
    },
  });
}

// ---------- HUD ----------
const el = {
  gold: $("#gold"), gems: $("#gems"), stage: $("#stage-num"), biome: $("#biome-name"), dots: $("#wave-dots"), best: $("#best-num"),
  enName: $("#en-name"), hp: $("#hp-fill"), hpText: $("#hp-text"), bossTimer: $("#boss-timer"), bossFill: $("#boss-fill"), bossLeft: $("#boss-left"),
  dps: $("#dps"), tap: $("#tapdmg"), soulBox: $("#pl-soul"), soul: $("#soulmul"), chips: $("#boost-chips"), bossBtn: $("#boss-btn"), enemyBar: $("#enemy-bar"),
};
function setText(e, t) { if (e.textContent !== t) e.textContent = t; }
const comboEl = $("#combo"), comboN = $("#combo-n"), comboMulEl = $("#combo-mul"), feverFill = $("#fever-fill"), feverText = $("#fever-text");
let lastCombo = 0;
function hudCombo() {
  const n = game.combo;
  if (n >= 2) {
    comboEl.hidden = false;
    if (n !== lastCombo) {
      comboN.textContent = n.toLocaleString("ja-JP");
      comboMulEl.textContent = `×${trimNum(B.comboMul(n, B.tapLv(st, "combo")))}`;
      comboEl.className = `combo ${n >= 300 ? "t4" : n >= 100 ? "t3" : n >= 50 ? "t2" : n >= 10 ? "t1" : ""}`;
      void comboEl.offsetWidth; comboEl.classList.add("pop");
    }
  } else comboEl.hidden = true;
  lastCombo = n;
  const fx = game.effects();
  battle.classList.toggle("fever", fx.gaugeFever);
  battle.classList.toggle("freeze", fx.freeze);
  if (fx.gaugeFever) {
    const left = (game.fx.gauge - Date.now()) / 1000;
    feverFill.style.width = `${(left / B.FEVER_TIME) * 100}%`;
    feverText.textContent = `FEVER ×${B.FEVER_MUL} ${left.toFixed(1)}秒`;
  } else {
    feverFill.style.width = `${(game.gauge / B.FEVER_MAX) * 100}%`;
    feverText.textContent = game.gauge > 0 ? `FEVER ${Math.floor(game.gauge)}%` : "連打でFEVER";
  }
}
// 必殺技のボタン
const skillBar = $("#skill-bar");
skillBar.innerHTML = SKILLS.map((k) => `<button class="skill-btn" data-skill="${k.id}" title="${k.name}"><span class="ic">${k.icon}</span><span class="nm">${k.bar || k.name}</span><span class="cd" hidden></span></button>`).join("");
function hudSkills() {
  const fx = game.effects();
  skillBar.querySelectorAll("[data-skill]").forEach((b) => {
    const id = b.dataset.skill;
    const k = SKILLS.find((x) => x.id === id);
    const open = game.skillUnlocked(id);
    const left = game.skillLeft(id);
    const active = (id === "rush" && fx.rush) || (id === "midas" && fx.midas) || (id === "freeze" && fx.freeze);
    b.classList.toggle("locked", !open);
    b.classList.toggle("ready", open && left <= 0);
    b.classList.toggle("active", active);
    const cd = b.querySelector(".cd");
    if (!open) { cd.hidden = false; cd.style.setProperty("--p", "100%"); cd.textContent = `Lv${k.unlock}`; }
    else if (left > 0) { cd.hidden = false; cd.style.setProperty("--p", `${(left / B.skillCd(id, game.skill(id).lv)) * 100}%`); cd.textContent = `${Math.ceil(left)}`; }
    else cd.hidden = true;
  });
}
skillBar.addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-skill]");
  if (!b || !started) return;
  unlockAudio();
  const id = b.dataset.skill;
  const k = SKILLS.find((x) => x.id === id);
  if (!game.skillUnlocked(id)) { toast(`${k.icon} ${k.name}は 機関車Lv${k.unlock}で使えるようになります`); sfx.cant(); return; }
  if (game.skillLeft(id) > 0) { sfx.cant(); return; }
  if (!game.useSkill(id)) { toast("敵と戦っているときに使えます"); sfx.cant(); return; }
});
game.on("useSkill", ({ id }) => {
  const k = SKILLS.find((x) => x.id === id);
  vib([30, 20, 60]);
  if (id === "meteor") { sfx.meteor(); if (game.pendingMeteor) toast("☄️ 次の敵に流星群を落とします"); }
  if (id === "rush") { sfx.whistle(); sfx.rush(); banner(`${k.icon} ${k.name}！<small>汽笛の合図で全員が連打してコンボを稼ぐ</small>`, 1400); }
  if (id === "midas") { sfx.midas(); banner(`${k.icon} ${k.name}！<small>タップするたびにゴールドがあふれる</small>`, 1400); }
  if (id === "freeze") { sfx.freeze(); banner(`${k.icon} ${k.name}！<small>ボスの制限時間が止まった</small>`, 1400); }
});
game.on("meteor", ({ dmg }) => { scene.meteor(); setTimeout(() => scene.addNum(dmg, scene.enemyX, scene.enemyCenterY(game.combat.enemy) - 20, "crit"), 650); });
game.on("comboTier", ({ combo }) => {
  sfx.comboTier(combo);
  if (combo >= 100) { vib(40); scene.flash = 0.2; }
  if (combo >= 50) pushNews(`【速報】${combo}コンボ達成！ 指が止まらない`);
});
game.on("feverStart", () => {
  sfx.fever(); vib([60, 30, 120]);
  scene.flash = 0.6; scene.shake = 6;
  banner(`🔥 タップフィーバー！<small>${B.FEVER_TIME}秒間 タップのダメージ×${B.FEVER_MUL}・ゴールド2倍</small>`, 1600);
});
let lastGoldSpark = 0;
game.on("tapGold", (e) => { const n = performance.now(); if (n - lastGoldSpark > 60) { lastGoldSpark = n; scene.goldSpark(e.x, e.y); } });

function hudFast() {
  hudCombo();
  const c = game.combat, e = c.enemy;
  if (e && (c.phase === "fight" || c.phase === "bossIntro")) {
    el.enemyBar.style.visibility = "visible";
    const k = Math.max(0, Math.min(1, e.hp.div(e.max).toNumber()));
    el.hp.style.width = `${k * 100}%`;
    setText(el.hpText, `${fmt(e.hp.max(0))} / ${fmt(e.max)}`);
    setText(el.enName, e.name);
    el.enName.className = `en-name ${e.boss ? "boss" : e.elite ? "elite" : ""}`;
    el.bossTimer.hidden = !e.boss;
    if (e.boss) {
      const lim = B.bossTime(st.stage);
      const left = c.phase === "fight" ? Math.max(0, c.bossLeft) : lim;
      el.bossFill.style.width = `${(left / lim) * 100}%`;
      setText(el.bossLeft, `${left.toFixed(1)}秒`);
    }
  } else if (c.phase === "walk") {
    el.enemyBar.style.visibility = "hidden";
  }
}
function hudSlow() {
  const s = st;
  setText(el.gold, fmt(s.gold));
  setText(el.gems, s.gems.toLocaleString("ja-JP"));
  setText(el.stage, kmOf(s.stage).toLocaleString("ja-JP"));
  setText(el.best, kmOf(s.bestStage).toLocaleString("ja-JP"));
  setText(el.biome, game.biome().name + (s.farming ? "（周回中）" : ""));
  // 進み具合の点
  const boss = B.isBoss(s.stage) && !s.farming;
  const key = `${s.stage}:${s.wave}:${boss}`;
  if (el.dots.dataset.k !== key) {
    el.dots.dataset.k = key;
    el.dots.innerHTML = boss ? `<i class="boss"></i>` : Array.from({ length: B.WAVES }, (_, i) => `<i class="${i < s.wave ? "on" : ""}"></i>`).join("");
  }
  const stt = game.stats();
  setText(el.dps, fmt(stt.dps));
  setText(el.tap, fmt(stt.tapDmg));
  el.soulBox.hidden = D(s.souls).lte(0);
  if (!el.soulBox.hidden) setText(el.soul, stt.soulMul.lt(1e4) ? `×${trimNum(stt.soulMul.toNumber())}` : `×${fmt(stt.soulMul)}`);
  // ブーストの札
  const fx = game.effects();
  const chips = [];
  for (const [k, b] of Object.entries(BOOSTS)) { const left = game.boostLeft(k); if (left > 0) chips.push(`<div class="chip">${b.icon} ${b.name} ${fmtTime(left)}</div>`); }
  if (fx.fever) chips.push(`<div class="chip fever">🔥 フィーバー ${Math.ceil((game.fx.fever - Date.now()) / 1000)}秒</div>`);
  if (fx.tapFever) chips.push(`<div class="chip fever">👆 連打祭り ${Math.ceil((game.fx.tapFever - Date.now()) / 1000)}秒</div>`);
  if (st.gachaUp > 0) chips.push(`<div class="chip">✦ 確率アップ券 ${st.gachaUp}</div>`);
  const ch = chips.join("");
  if (el.chips.dataset.h !== ch) { el.chips.dataset.h = ch; el.chips.innerHTML = ch; }
  el.bossBtn.hidden = !s.farming;
  // タブの点
  $("#dot-gacha").hidden = !(st.tickets.free10 > 0 || st.tickets.share > 0 || st.gems >= GACHA.ten);
  $("#dot-boost").hidden = st.daily.share;
  $("#dot-gear").hidden = !st.items.some((x) => x.isNew);
}

// ---------- タップ ----------
const battle = $("#battle");
let tapCount = 0;
battle.addEventListener("pointerdown", (ev) => {
  if (!started) return;
  ev.preventDefault();
  unlockAudio();
  if (scene.hitLucky(ev.clientX, ev.clientY)) {
    scene.luckyBurst();
    const r = game.catchLucky();
    if (r) { sfx.lucky(); showLuckyResult(r); }
    return;
  }
  const r = game.tap(ev.clientX, ev.clientY);
  if (r) { r.crit ? sfx.crit() : sfx.tapCombo(r.combo || 1); if (r.crit) vib(20); }
  tapCount++;
  if (tapCount === 5) $("#tap-hint").hidden = true;
});
if (st.stats.taps >= 5) $("#tap-hint").hidden = true;
$("#boss-btn").onclick = (e) => { e.stopPropagation(); game.challengeBoss(); sfx.click(); };
$("#boss-btn").addEventListener("pointerdown", (e) => e.stopPropagation());

function vib(p) { if (st.settings.vibrate) try { navigator.vibrate?.(p); } catch {} }

// ---------- ゲームのできごと ----------
let lastKillSnd = 0;
game.on("kill", (e) => {
  const n = performance.now();
  if (n - lastKillSnd > 120) { lastKillSnd = n; e.enemy.boss ? sfx.boom(1.2) : sfx.kill(); }
});
game.on("hit", (e) => { if (!e.tap) sfx.hit(); });
game.on("bossIntro", (e) => {
  const w = $("#warning");
  $("#warning-name").textContent = e.name;
  w.hidden = false;
  setTimeout(() => (w.hidden = true), 1400);
  sfx.boss(); vib([60, 60, 60]);
});
game.on("bossWin", (e) => {
  sfx.bossWin();
  banner(`BOSS撃破！${e.gems ? `<small>はじめての撃破 ジェム+${e.gems}</small>` : ""}`, 1800);
});
game.on("bossFail", () => {
  sfx.fail();
  banner(`時間切れ…<small>ひとつ前の区間で力をためます（強くなったら自動で再挑戦）</small>`, 2600);
});
game.on("biome", (e) => {
  banner(`${esc(e.biome.name)}<small>${kmText(e.stage)}地点〜</small>`, 2400, { wait: 1500 });
  preload([["bg", e.biome.id]]);
  pushNews(`【速報】ドコマデ列車、${e.biome.name}に到着`);
});
game.on("drop", (e) => {
  const it = e.item;
  if (e.sold) return;
  sfx.drop(it.r);
  if (it.r >= 2 || e.equipped) toast(`<span class="rt r${it.r}">${RARITIES[it.r].name}</span> ${esc(it.name)} を拾った${e.equipped ? " → <b style=\"color:var(--green)\">取り付け！</b>" : ""}`, { icon: src("icon", it.icon), cls: `r${it.r}` });
  if (it.r >= 3) { scene.flash = 0.4; vib([40, 30, 80]); }
});
game.on("hire", ({ k }) => { const c = COMPANIONS[k]; toast(`<b>${esc(c.name)}</b>を連結！<br><small>乗務員：${esc(c.who)}</small>`, { icon: src("sprite", c.car) }); sfx.milestone(); pushNews(`【速報】ドコマデ列車に${c.name}が連結される`); });
game.on("compMilestone", ({ k, lv }) => toast(`${esc(COMPANIONS[k].name)} Lv${lv}！ 力が2倍に`, { icon: src("sprite", COMPANIONS[k].car) }));
game.on("skill", (sk) => { toast(`🔧 機関車の改造「${esc(sk.name)}」 ${esc(sk.desc)}`, { icon: src("sprite", "t_loco"), cls: "ach" }); sfx.ach(); });
game.on("ach", (a) => { toast(`🏆 実績「${esc(a.name)}」 ジェム+${a.gems}`, { cls: "ach", life: 3.2 }); sfx.ach(); });
game.on("milestone", ({ stage }) => { milestoneQueue.push(stage); if (!UI.modalOpen() && !gfx.running) showMilestone(); pushNews(`【速報】ドコマデ列車、ついに${kmText(stage)}突破`); rank.submit(true).then((ok) => ok && refreshRankHud(true)); });
game.on("stage", ({ stage }) => {
  rank.noteStage(stage);
  // 身近な距離を越えたら知らせる（はじめて越えたときだけ）
  const m = markFor(stage);
  if (m && !st.marks[m.name]) {
    st.marks[m.name] = 1;
    toast(`<b>${esc(m.name)}</b>の距離を越えた！<br><small>${esc(m.note)}</small>`, { icon: src("sprite", "t_loco"), cls: "ach", life: 4 });
    pushNews(`【速報】ドコマデ列車、${m.name}の距離を突破`);
    sfx.milestone();
  }
});
game.on("vsClear", (vs) => showVsClear(vs));
game.on("stage", ({ stage }) => {
  // チュートリアル：ステージ3で はじめての召喚
  if (st.tutorial < 2 && stage >= 3) {
    st.tutorial = 2;
    st.tickets.free10 += 1;
    setTimeout(() => showFirstGacha(), 600);
  }
});
game.on("change", () => { needRender = true; });

const milestoneQueue = [];

// ---------- タブとパネル ----------
let tab = "up", gearFilter = "all", needRender = true;
$$("#tabs button").forEach((b) => b.addEventListener("click", () => { setTab(b.dataset.tab); sfx.click(); }));
function setTab(t) {
  tab = t;
  $$("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === t));
  $$(".panel").forEach((p) => p.classList.toggle("on", p.id === `p-${t}`));
  renderPanel();
  rollPanelAd(t);
  $(".panels").scrollTop = 0;
}
function renderPanel() {
  needRender = false;
  const p = $(`#p-${tab}`);
  if (tab === "up") UI.renderUp(game, p);
  else if (tab === "gear") UI.renderGear(game, p, gearFilter);
  else if (tab === "gacha") { UI.renderGacha(game, p); UI.updateGacha(game, p); }
  else if (tab === "boost") { UI.renderBoost(game, p); drawSharePreview(); }
  else if (tab === "rec") { UI.renderRec(game, p, rankKind); fillRank(); }
}
let lastGearSig = "";
function refreshPanel() {
  const p = $(`#p-${tab}`);
  if (tab === "up") {
    // 転生カードの出し入れだけは作り直す
    const want = st.bestStage >= B.PRESTIGE_MIN - 10 || st.stats.prestiges > 0;
    if (want !== !!p.querySelector("#prestige-card") || !p.querySelector("#hero-row")) UI.renderUp(game, p);
    else UI.updateUp(game, p);
  } else if (tab === "gear") {
    const sig = `${st.items.length}:${Object.values(st.equip).join(",")}:${st.items.filter((x) => x.isNew).length}`;
    if (sig !== lastGearSig || needRender) { lastGearSig = sig; UI.renderGear(game, p, gearFilter); needRender = false; }
  } else if (tab === "boost") UI.updateBoost(game, p);
  else if (tab === "gacha") { if (needRender) renderPanel(); UI.updateGacha(game, p); }
  else if (needRender && tab === "rec") renderPanel();
}

// パネル内のボタン（まとめて受ける）
$(".panels").addEventListener("click", async (ev) => {
  const t = ev.target.closest("button, [data-item]");
  if (!t) return;
  unlockAudio();
  // 購入の単位
  if (t.dataset.mode) { st.settings.buyMode = t.dataset.mode === "max" ? "max" : Number(t.dataset.mode); UI.renderUp(game, $("#p-up")); sfx.click(); return; }
  if (t.dataset.buy) {
    const before = st.heroLv;
    const ok = t.dataset.buy === "hero" ? game.buyHero(st.settings.buyMode) : game.buyComp(Number(t.dataset.buy), st.settings.buyMode);
    for (const k of SKILLS) if (before < k.unlock && st.heroLv >= k.unlock) { toast(`${k.icon} 必殺技「${k.name}」が使えるようになった！ 戦闘画面の下のボタンで使えます`, { cls: "ach", life: 4 }); sfx.ach(); }
    if (ok) { sfx.buy(); UI.updateUp(game, $("#p-up")); bump(t); } else sfx.cant();
    if (st.tutorial < 1 && st.comp[0] > 0) st.tutorial = 1;
    return;
  }
  if (t.dataset.buytap) {
    if (game.buyTap(t.dataset.buytap, st.settings.buyMode)) { sfx.buy(); UI.updateUp(game, $("#p-up")); bump(t); } else sfx.cant();
    return;
  }
  if (t.dataset.buyskill) {
    if (game.buySkill(t.dataset.buyskill)) { sfx.buy(); UI.updateUp(game, $("#p-up")); bump(t); } else sfx.cant();
    return;
  }
  if (t.id === "btn-prestige") return confirmPrestige();
  // ランキング
  if (t.dataset.rk) { rankKind = t.dataset.rk; $$("[data-rk]").forEach((b) => b.classList.toggle("on", b.dataset.rk === rankKind)); $("#rk-list").innerHTML = UI.rankListHtml(rankKind, null); fillRank(); sfx.click(); return; }
  if (t.id === "rk-rename") return renameRank();
  if (t.id === "rk-join") { await rank.rejoin(); save(st); fillRank(); refreshRankHud(); return; }
  // 装備
  if (t.dataset.filter) { gearFilter = t.dataset.filter; UI.renderGear(game, $("#p-gear"), gearFilter); return; }
  if (t.dataset.item !== undefined && t.dataset.item) return showItem(t.dataset.item);
  if (t.id === "btn-autoequip") { const n = game.autoEquipAll(); toast(n ? `${n}か所を付け替えました` : "いまの部品がいちばん強い"); sfx.buy(); UI.renderGear(game, $("#p-gear"), gearFilter); return; }
  if (t.id === "btn-sellnr") {
    const r = game.dismantleBelow(1);
    toast(r.n ? `${r.n}個を分解して 星のかけら ✦${r.kakera}` : "分解できるものがありません"); sfx.coin();
    UI.renderGear(game, $("#p-gear"), gearFilter); return;
  }
  // 召喚
  if (t.dataset.pull) return doPull(t.dataset.pull);
  if (t.id === "btn-ad-up") return watchAd("gacha_up", "確率アップ券 1枚", () => { game.adUse("gachaUp"); st.gachaUp++; game.dirty(); renderPanel(); toast("確率アップ券をもらった！ 次の召喚で SSR以上の確率2倍"); });
  // ブースト
  if (t.dataset.boost) { const k = t.dataset.boost; const b = BOOSTS[k]; return watchAd(`boost_${k}`, `${b.name} ${b.hours}時間`, () => { game.addBoost(k); renderPanel(); toast(`${b.icon} ${b.name}！ のこり ${fmtTime(game.boostLeft(k))}`); sfx.milestone(); }); }
  if (t.id === "btn-ad-gems") return watchAd("gems", "ジェム +30", () => { game.adUse("gems"); st.gems += 30; game.dirty(); renderPanel(); toast("ジェム +30"); sfx.coin(); });
  // シェア
  if (t.dataset.share) return doShare("record");
});
function bump(e) { e.animate([{ transform: "scale(1.08)" }, { transform: "scale(1)" }], { duration: 160 }); }

// ---------- 装備の詳しい画面 ----------
function showItem(id) {
  const it = st.items.find((x) => x.id === id);
  if (!it) return;
  it.isNew = false;
  modal(UI.itemDetailHtml(game, it), {
    onOpen: (box, close) => {
      box.querySelectorAll("[data-act]").forEach((b) => b.onclick = () => {
        const a = b.dataset.act;
        if (a === "equip") { game.equip(id); sfx.buy(); toast(`${esc(it.name)} を取り付けた`); }
        if (a === "lock") { it.lock = !it.lock; }
        if (a === "sell") { const k = game.dismantle(id); if (k) { sfx.coin(); toast(`分解して 星のかけら ✦${k}`); } }
        if (a === "awaken") {
          if (game.awaken(id)) {
            sfx.reveal(Math.min(5, it.r)); vib([40, 30, 90]);
            toast(`${esc(it.name)} が ★${it.star} に覚醒！`, { icon: src("icon", it.icon), cls: `r${Math.max(3, it.r)}` });
            UI.renderGear(game, $("#p-gear"), gearFilter);
            return showItem(id); // 続けて覚醒できるように開き直す
          }
          sfx.cant(); return;
        }
        close();
        UI.renderGear(game, $("#p-gear"), gearFilter);
      });
    },
  });
}

// ---------- 広告 ----------
async function watchAd(placement, rewardText, onReward) {
  sfx.click();
  const r = await showRewarded(placement, { reward: rewardText });
  last = performance.now();
  if (r.rewarded) { onReward(); save(st); }
  else if (r.reason === "closed") toast("最後まで見ると受け取れます");
}

// ---------- 召喚 ----------
async function doPull(kind) {
  if (kind === "ad") {
    if (game.adLeft("adGacha") <= 0) { toast("きょうの分は終わりました"); return; }
    const r = GACHA.rates;
    modal(`<h2>広告を見て1回召喚</h2>
      <p style="font-size:13px">広告を最後まで見ると、1回召喚できます。出る確率は次のとおりです。</p>
      <table class="rate-table">${["R", "SR", "SSR", "UR", "LR"].map((k, i) => `<tr><td><span class="rt r${i + 1}">${k}</span></td><td>${(st.gachaUp > 0 ? GACHA.upRates : r)[i]}%</td></tr>`).join("")}</table>
      <div class="acts"><button class="btn green" id="go-ad">▶ 広告を見る</button></div>`, {
      onOpen: (box, close) => { $("#go-ad", box).onclick = () => { close(); watchAd("gacha_single", "召喚1回", () => runPull("ad")); }; },
    });
    return;
  }
  runPull(kind);
}
function runPull(kind) {
  const res = game.pull(kind);
  if (!res) { toast(kind === "ten" || kind === "single" ? "ジェムが足りません" : "チケットがありません"); sfx.cant(); return; }
  save(st);
  const againKind = kind === "single" ? "single" : "ten";
  const canAgain = () => game.canPull(againKind);
  gfx.play(res, {
    level: st.bestStage,
    onEquip: () => { const n = game.autoEquipAll(); return n; },
    onShare: (r) => doShare("gacha", r),
    againLabel: canAgain() ? (againKind === "single" ? `もう1回（${GACHA.single}ジェム）` : `もう10連（${GACHA.ten}ジェム）`) : null,
    onAgain: () => runPull(againKind),
    onClose: () => { renderPanel(); if (milestoneQueue.length) showMilestone(); },
  });
}

function showFirstGacha() {
  sfx.milestone();
  modal(`<h2>はじめての召喚</h2>
    <div style="text-align:center"><img src="${src("ui", "card_back")}" style="width:90px;image-rendering:pixelated;animation:floaty 2s infinite ease-in-out" alt=""></div>
    <p style="text-align:center">出発のお祝いに<br><b style="color:var(--gold)">SSR以上1枠確定の10連召喚</b>をプレゼント！</p>
    <div class="acts"><button class="btn pink big" id="go-first">召喚する</button></div>`, {
    onOpen: (box, close) => { $("#go-first", box).onclick = () => { close(); setTab("gacha"); runPull("free10"); }; },
  });
}

// ---------- シェア ----------
async function drawSharePreview() {
  const box = $("#share-prev");
  if (!box) return;
  const cv = await SH.recordCard(st, game);
  cv.style.width = "100%";
  box.innerHTML = "";
  box.appendChild(cv);
}
async function doShare(kind, payload) {
  sfx.click();
  let text, canvas, fname = "dokomade.png";
  const url = SH.challengeUrl(st);
  if (kind === "gacha") { text = SH.gachaText(payload); canvas = await SH.gachaCard(payload); fname = "dokomade-gacha.png"; }
  else if (kind === "milestone") { text = SH.milestoneText(st, payload); canvas = await SH.recordCard(st, game); }
  else if (kind === "vs") { text = SH.vsText(st, payload); canvas = await SH.recordCard(st, game, rankInfo()); }
  else if (kind === "rank") { const v = await rank.board("all").catch(() => null); text = v ? SH.rankText(st, v) : SH.recordText(st); canvas = await SH.recordCard(st, game, rankInfo()); }
  else { text = SH.recordText(st); canvas = await SH.recordCard(st, game, rankInfo()); }
  if (SH.isMobile()) {
    const r = await SH.shareNative({ text, url, canvas, filename: fname });
    last = performance.now();
    if (r === "shared") return shareRewarded(kind, payload);
    if (r === "cancel") return;
  }
  // PC など：自前の共有画面
  const img = canvas.toDataURL("image/png");
  const rewardNote = !st.daily.share ? `<p class="note" style="text-align:center;color:var(--gold)">シェアするとシェア召喚チケット（1日1回）</p>` : "";
  modal(`<h2>シェアする</h2>
    <div class="share-box"><img class="prev" src="${img}" alt="シェアする画像"></div>
    <textarea readonly style="height:84px">${esc(text)}\n${esc(url)}</textarea>
    ${rewardNote}
    <div class="share-grid" style="margin-top:8px">
      <button class="btn blue full" data-sh="x">X にポスト</button>
      <button class="btn green" data-sh="line">LINE で送る</button>
      <button class="btn" data-sh="save">画像を保存</button>
      <button class="btn" data-sh="copyimg">画像をコピー</button>
      <button class="btn" data-sh="copy">文とリンクをコピー</button>
    </div>
    <p class="note">X へは画像を添付できないので、先に「画像を保存」か「画像をコピー」してから貼りつけてください。</p>`, {
    onOpen: (box, close) => {
      box.querySelectorAll("[data-sh]").forEach((b) => b.onclick = async () => {
        const a = b.dataset.sh;
        if (a === "x") { window.open(SH.xIntent(text, SH.challengeUrl(st, "x")), "_blank", "noopener"); await SH.waitReturn(); shareRewarded(kind, payload); close(); }
        else if (a === "line") { window.open(SH.lineIntent(text, SH.challengeUrl(st, "line")), "_blank", "noopener"); await SH.waitReturn(); shareRewarded(kind, payload); close(); }
        else if (a === "save") { await SH.saveImage(canvas, fname); toast("画像を保存しました"); }
        else if (a === "copyimg") { toast((await SH.copyImage(canvas)) ? "画像をコピーしました" : "この端末ではコピーできません。保存してください"); }
        else if (a === "copy") { try { await navigator.clipboard.writeText(`${text}\n${url}`); toast("コピーしました"); } catch { toast("コピーできませんでした"); } }
      });
    },
  });
}
function rankInfo() {
  const c = rank.cache?.all?.v;
  return c && rank.state === "ready" ? { rank: c.rank, total: c.total, pct: c.pct } : null;
}
function shareRewarded(kind, payload) {
  st.stats.shares++;
  let got = [], gotTicket = false;
  if (!st.daily.share) { st.daily.share = true; st.tickets.share++; got.push("シェア召喚チケット"); gotTicket = true; }
  if (kind === "milestone" && payload && !st.msShared[payload]) { st.msShared[payload] = Date.now(); st.gems += 50; got.push("ジェム+50"); }
  if (kind === "vs" && st.vs) { st.gems += 50; got.push("ジェム+50"); st.vs = null; }
  game.dirty(); game.checkAch(); save(st);
  if (got.length) { sfx.milestone(); toast(`シェアありがとう！ ${got.join("・")}をゲット`, { cls: "ach", life: 3.4, icon: gotTicket ? src("icon", "i_ticket") : null }); }
  else toast("シェアありがとう！");
  renderPanel();
}

// ---------- 到達記念・挑戦状 ----------
function showMilestone() {
  const m = milestoneQueue.shift();
  if (m == null) return;
  sfx.milestone(); vib([60, 40, 60]);
  modal(`<div class="milestone-big">
      <div class="ttl">到達記念</div>
      <div class="num">${kmText(m)}</div>
      <div style="margin:6px 0"><span class="title-badge">称号「${titleFor(m)}」</span></div>
      <p style="font-size:13px">この到達を友だちに自慢しよう！${st.msShared[m] ? "" : "<br><b style='color:var(--gold)'>シェアでジェム+50</b>"}${st.daily.share ? "" : "<br><b style='color:var(--gold)'>＋シェア召喚チケット</b>"}</p>
    </div>
    <div class="acts"><button class="btn pink" id="ms-share">自慢する</button><button class="btn ghost" id="ms-close">あとで</button></div>`, {
    onOpen: (box, close) => {
      $("#ms-share", box).onclick = () => { close(); doShare("milestone", m); };
      $("#ms-close", box).onclick = () => { close(); if (milestoneQueue.length) setTimeout(showMilestone, 300); };
    },
  });
}
function showVsClear(vs) {
  sfx.bossWin();
  modal(`<div class="milestone-big">
      <div class="ttl">挑戦状クリア！</div>
      <div class="num" style="font-size:40px">${kmText(vs.stage)} 突破</div>
      <p>${vs.name ? `${esc(vs.name)}さん` : "友だち"}の記録を超えました！<br>超えたことを知らせよう（ジェム+50）</p></div>
    <div class="acts"><button class="btn pink" id="vs-share">超えたと知らせる</button><button class="btn ghost" id="vs-close">あとで</button></div>`, {
    onOpen: (box, close) => { $("#vs-share", box).onclick = () => { close(); doShare("vs", vs); }; $("#vs-close", box).onclick = close; },
  });
}

// ---------- 放置・ログイン ----------
// ジェムの定期便が届いたお知らせ
function mailToast(m) {
  const more = st.gems >= GACHA.ten ? "<br><small>10連がひけます！</small>" : st.gems >= GACHA.single ? "<br><small>召喚しにいこう</small>" : "";
  toast(`📮 <b>ジェムの定期便</b> +${m.gems}${m.n > 1 ? `（${m.n}便）` : "（召喚1回分）"}${more}`, { icon: src("icon", "i_gem"), cls: "ach", life: 3.6 });
  sfx.coin();
}
function showOffline(sec, quiet = false, mail = null) {
  const res = game.offline(sec);
  const rows = `
    <div><span>放置していた時間</span><b>${fmtTime(res.seconds)}${sec > 12 * 3600 ? "（上限12時間）" : ""}</b></div>
    <div><span>距離</span><b>${kmText(res.from)} → ${kmText(res.to)}</b></div>
    <div><span>倒した敵</span><b>${res.kills.toLocaleString("ja-JP")}</b></div>
    <div><span>ゴールド</span><b>+${fmt(res.gold)}</b></div>
    ${res.items.length ? `<div><span>拾った部品</span><b>${res.items.length}個</b></div>` : ""}
    ${res.gems ? `<div><span>ジェム</span><b>+${res.gems}</b></div>` : ""}`;
  if (quiet) {
    game.applyOffline(res, 1);
    toast(`離れている間に ${fmt(res.gold)}G・${kmText(res.to)}まで進みました${mail ? `<br><small>📮 ジェムの定期便 +${mail.gems}</small>` : ""}`);
    return null;
  }
  return new Promise((resolve) => {
    modal(`<h2>おかえりなさい！</h2>
      <p style="font-size:13px;text-align:center">列車は休まず走り続けていました。</p>
      <div class="offline-list">${rows}</div>
      ${mail ? `<p class="mail-got">📮 ジェムの定期便 <b>+${mail.gems}</b>（${mail.n}便）が届いています${mail.missed ? `<br><small>閉じている間は${B.MAIL_MAX}便までたまります</small>` : ""}</p>` : ""}
      <div class="acts"><button class="btn green" id="off-ad">▶ 広告を見て2倍</button><button class="btn gold" id="off-ok">受け取る</button></div>`, {
      closable: false,
      onOpen: (box, close) => {
        $("#off-ok", box).onclick = () => { game.applyOffline(res, 1); close(); sfx.coin(); resolve(); };
        $("#off-ad", box).onclick = async () => {
          close();
          const r = await showRewarded("offline_double", { reward: "放置の報酬 2倍" });
          last = performance.now();
          game.applyOffline(res, r.rewarded ? 2 : 1);
          toast(r.rewarded ? "放置の報酬が2倍になった！" : "放置の報酬を受け取りました");
          sfx.milestone(); resolve();
        };
      },
    });
  });
}
function showLogin() {
  game.rollDaily();
  const gems = game.loginBonus();
  if (!gems) return null;
  toast(`ログインボーナス ジェム+${gems}${st.streak > 1 ? `（${st.streak}日連続）` : ""}`, { icon: src("icon", "i_gem"), cls: "ach", life: 3.5 });
  sfx.coin();
  return null;
}

// ---------- 黄金スライム ----------
function showLuckyResult(r) {
  if (r.type === "gold") toast(`✨ ${r.text} +${fmt(r.gold)}G`, { icon: src("icon", "i_coin"), cls: "r3" });
  else if (r.type === "item") toast(`✨ ${r.text} <span class="rt r${r.item.r}">${RARITIES[r.item.r].name}</span> ${esc(r.item.name)}`, { icon: src("icon", "i_chest"), cls: `r${r.item.r}` });
  else toast(`✨ ${r.text}`, { cls: "r3" });
}

// ---------- 再出発（転生） ----------
function confirmPrestige() {
  const gain = game.prestigeGain();
  modal(`<h2>再出発しますか？</h2>
    <p style="text-align:center">魔法の炎 <b style="color:#e0b0ff;font-size:20px">+${fmt(gain)}</b><br>全ダメージが <b>${fmt(D(st.souls).add(gain).mul(0.1).add(1))}倍</b> になります</p>
    <p class="note">始発（${kmText(1)}）から。ゴールド・機関車と車両のレベルは0に戻ります。部品・ジェム・記録は残ります。</p>
    <div class="acts"><button class="btn pink" id="pr-go">再出発する</button><button class="btn ghost" id="pr-no">やめる</button></div>`, {
    onOpen: (box, close) => {
      $("#pr-no", box).onclick = close;
      $("#pr-go", box).onclick = () => {
        close();
        game.prestige();
        save(st);
        sfx.reveal(4);
        scene.flash = 1; scene.shake = 8;
        banner(`再出発！<small>魔法の炎で、もっと遠くへ</small>`, 2600);
        renderPanel();
      };
    },
  });
}

// ---------- 設定 ----------
$("#btn-settings").onclick = () => {
  sfx.click();
  modal(UI.settingsHtml(st), {
    onOpen: (box, close) => {
      box.querySelectorAll("[data-set]").forEach((b) => b.onclick = () => {
        const k = b.dataset.set;
        st.settings[k] = !st.settings[k];
        b.classList.toggle("on", st.settings[k]);
        if (k === "sound") setSound(st.settings.sound);
        save(st);
      });
      box.querySelectorAll("[data-num]").forEach((b) => b.onclick = () => {
        st.settings.numFmt = b.dataset.num; setNumberMode(st.settings.numFmt); save(st);
        box.querySelectorAll("[data-num]").forEach((x) => x.className = `btn small ${x.dataset.num === st.settings.numFmt ? "gold" : "ghost"}`);
        renderPanel();
      });
      $("#set-name", box).onchange = async (e) => {
        const v = (e.target.value || "").trim().slice(0, 12);
        const p = v ? nameProblem(v) : "";
        if (p) { toast(p); e.target.value = st.rank.name || st.name; return; }
        st.name = v || "車掌";
        if (v) await rank.rename(v); else st.rank.name = "";
        save(st);
      };
      box.querySelectorAll("[data-rankjoin]").forEach((b) => b.onclick = async () => {
        if (st.rank.join) { await rank.leave(); toast("ランキングから記録を消しました"); }
        else { await rank.rejoin(); toast("ランキングに参加しました"); }
        b.classList.toggle("on", st.rank.join);
        save(st); refreshRankHud();
      });
      const code = $("#save-code", box);
      $("#btn-export", box).onclick = () => { code.hidden = false; code.readOnly = true; code.value = exportCode(st); code.select(); $("#import-go", box).hidden = true; };
      $("#btn-import", box).onclick = () => { code.hidden = false; code.readOnly = false; code.value = ""; code.placeholder = "DKMD1. から始まるコードを貼る"; $("#import-go", box).hidden = false; };
      $("#btn-import-go", box).onclick = () => {
        try {
          const ns = importCode(code.value);
          save(ns);
          location.reload();
        } catch (e) { toast(`読み込めませんでした：${esc(e.message)}`); }
      };
      $("#btn-wipe", box).onclick = () => {
        if (confirm("本当にデータを消して最初からにしますか？（元に戻せません）")) { wipe(); location.href = location.pathname; }
      };
    },
  });
};

// ---------- ニュース ----------
const newsQ = [];
function pushNews(t) { newsQ.push(t); }
function nextNews() {
  const t = newsQ.length ? newsQ.shift() : NEWS[Math.floor(Math.random() * NEWS.length)];
  const tk = $("#ticker");
  tk.textContent = t;
  tk.style.animation = "none"; void tk.offsetWidth; tk.style.animation = "";
}
$("#ticker").addEventListener("animationiteration", nextNews);
nextNews();

// ---------- 開発用（localhost だけ） ----------
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
  window.__dk = { game, st, scene, gfx, rank, save: () => save(st), B };
  if (q.get("stage")) { const n = parseInt(q.get("stage"), 10); st.stage = n; st.runMax = Math.max(st.runMax, n); st.bestStage = Math.max(st.bestStage, n); }
  if (q.get("gems")) st.gems = parseInt(q.get("gems"), 10);
  if (q.get("gold")) st.gold = D(q.get("gold"));
  if (q.get("away")) st.lastSeen = Date.now() - parseInt(q.get("away"), 10) * 1000;
  if (q.get("hero")) st.heroLv = Math.max(1, parseInt(q.get("hero"), 10));
  if (q.get("mail")) st.mail = { slot: Math.floor(Date.now() / B.MAIL_EVERY_MS) - parseInt(q.get("mail"), 10) };
  // ?comp=5 → 車両を5種類（前から順に）Lv10で連結した状態にする
  if (q.get("comp")) { const n = Math.min(COMPANIONS.length, parseInt(q.get("comp"), 10)); st.comp = st.comp.map((v, i) => (i < n ? Math.max(v, 10) : v)); }
  if (q.get("start") === "1") { setTimeout(() => $("#btn-start").click(), 50); }
}

// ---------- PC のすき間：記録カードとブースト ----------
const quick = $("#quick");
let quickT = 0;
async function renderQuick() {
  if (getComputedStyle(quick).display === "none") return;
  const shareDone = st.daily.share;
  quick.innerHTML = `<div class="quick-grid">
    <div class="card"><h3>旅の記録 <small>${shareDone ? "" : "シェアでチケット"}</small></h3><div id="q-card"></div>
      <button class="btn pink wide" data-share="record">${shareDone ? "記録をシェアする" : "シェアしてシェア召喚チケットをもらう"}</button></div>
    <div class="card"><h3>ブースト <small>広告を見ると使える</small></h3><div class="q-boosts">${Object.entries(BOOSTS).map(([k, b]) => `<button class="btn green" data-boost="${k}">${b.icon} ${b.name}（${b.hours}時間）<span class="sub" data-qleft="${k}"></span></button>`).join("")}</div></div>
  </div>`;
  const cv = await SH.recordCard(st, game);
  $("#q-card")?.appendChild(cv);
}
quick.addEventListener("click", async (ev) => {
  const t = ev.target.closest("button");
  if (!t) return;
  if (t.dataset.share) return doShare("record");
  if (t.dataset.boost) { const k = t.dataset.boost; const b = BOOSTS[k]; return watchAd(`boost_${k}`, `${b.name} ${b.hours}時間`, () => { game.addBoost(k); toast(`${b.icon} ${b.name}！ のこり ${fmtTime(game.boostLeft(k))}`); sfx.milestone(); }); }
});
setInterval(() => {
  if (getComputedStyle(quick).display === "none") return;
  quick.querySelectorAll("[data-qleft]").forEach((e) => { const l = game.boostLeft(e.dataset.qleft); e.textContent = l > 0 ? `のこり ${fmtTime(l)}` : "▶ 広告を見る"; });
  if (++quickT % 30 === 0) renderQuick();
}, 1000);
game.on("stage", () => { if (st.stage % 5 === 0) renderQuick(); });
window.addEventListener("resize", () => { if (!quick.innerHTML) renderQuick(); });
renderQuick();

setTab("up");
