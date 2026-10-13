// ゲームの進行（戦闘・購入・ドロップ・ガチャ・転生・放置の計算）。画面とは切り離してある
import { D } from "./big.js";
import * as B from "./balance.js";
import {
  COMPANIONS, BIOMES, MONSTERS, BOSSES, FLYING, DROP_RATES, BOSS_DROP_RATES, GACHA, RARITIES, HERO_SKILLS,
  BOOSTS, AD_LIMITS, ACHIEVEMENTS, MILESTONES, loopPrefix, R_SR, R_SSR, R_UR, TAP_UPS, SKILLS, COMBO_TIERS,
} from "./data.js";
import { makeItem, itemScore } from "./items.js";
import { todayStr } from "./state.js";

const HIT_INTERVAL = 0.32;   // 仲間の攻撃の見た目の間隔（秒）
const WALK_TIME = 0.8;
const DEAD_TIME = 0.35;
const BOSS_INTRO = 1.4;
const INV_MAX = 120;

function rollIndex(rates, rng = Math.random) {
  const tot = rates.reduce((a, b) => a + b, 0);
  let x = rng() * tot;
  for (let i = 0; i < rates.length; i++) { if (x < rates[i]) return i; x -= rates[i]; }
  return 0;
}

export class Game {
  constructor(st) {
    this.s = st;
    this.listeners = {};
    this.fx = { fever: 0, tapFever: 0, gauge: 0, rush: 0, midas: 0, freeze: 0 }; // 期限（ms）
    this.combo = 0; this.comboAt = 0;      // 連打のコンボ
    this.gauge = 0; this.gaugeAt = 0;      // タップフィーバーのゲージ（0〜100）
    this.autoAcc = 0;                      // 自動タップの端数
    this.combat = { phase: "walk", t: 0, dur: WALK_TIME, enemy: null, bossLeft: 0, hitAcc: D(0), hitT: 0, rush: 1 };
    this.lucky = null;           // 黄金スライム
    this.luckyNext = 25 + Math.random() * 40; // 最初は早めに
    this._stats = null;
    this._statsAt = 0;
    this.pendingBossRetry = false;
    this.lastFailDps = null;
    this.walkDist = 0;
    this.rollDaily();
  }

  // ---------- イベント ----------
  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); return () => this.off(ev, fn); }
  off(ev, fn) { this.listeners[ev] = (this.listeners[ev] || []).filter((f) => f !== fn); }
  emit(ev, data) { for (const fn of this.listeners[ev] || []) fn(data); }

  // ---------- 効果と能力値 ----------
  effects(now = Date.now()) {
    const b = this.s.boosts;
    return {
      fever: now < this.fx.fever, tapFever: now < this.fx.tapFever,
      gaugeFever: now < this.fx.gauge, rush: now < this.fx.rush, midas: now < this.fx.midas, freeze: now < this.fx.freeze,
      goldBoost: now < b.gold, dropBoost: now < b.drop, speed: now < b.speed ? 2 : 1,
    };
  }
  stats() {
    const now = Date.now();
    if (!this._stats || now - this._statsAt > 250) { this._stats = B.computeStats(this.s, now, this.effects(now)); this._statsAt = now; }
    return this._stats;
  }
  dirty() { this._stats = null; this.emit("change"); }
  speed() { return this.effects().speed; }

  // ---------- 1日ごと ----------
  rollDaily() {
    const t = todayStr();
    const d = this.s.daily;
    if (d.date !== t) {
      const yesterday = todayStr(Date.now() - 86400000);
      this.s.streak = d.date === yesterday ? (this.s.streak || 0) + 1 : 1;
      this.s.daily = { date: t, login: false, share: false, ad: {} };
      return true;
    }
    return false;
  }
  loginBonus() {
    if (this.s.daily.login) return 0;
    this.s.daily.login = true;
    const gems = 100 + Math.min(6, (this.s.streak || 1) - 1) * 20;
    this.s.gems += gems;
    this.dirty();
    return gems;
  }
  // ---------- ジェムの定期便（毎時0分に届く・閉じていても MAIL_MAX 便までたまる） ----------
  mailSlot(t = Date.now()) { return Math.floor(t / B.MAIL_EVERY_MS); }
  mailNext(t = Date.now()) { return (this.mailSlot(t) + 1) * B.MAIL_EVERY_MS; }
  collectMail(now = Date.now()) {
    const s = this.s, cur = this.mailSlot(now);
    // はじめて・時計が戻ったときは今から数えなおす（さかのぼって配らない）
    if (!s.mail || !Number.isFinite(s.mail.slot) || s.mail.slot > cur) { s.mail = { slot: cur }; return null; }
    const due = cur - s.mail.slot;
    const n = Math.min(B.MAIL_MAX, due);
    s.mail.slot = cur;
    if (n <= 0) return null;
    const gems = n * B.MAIL_GEMS;
    s.gems += gems;
    s.stats.mailGems = (s.stats.mailGems || 0) + gems;
    this.dirty();
    return { n, gems, missed: due - n }; // missed：たまる上限を超えて届かなかった便
  }
  adLeft(kind) { return Math.max(0, (AD_LIMITS[kind] ?? 99) - (this.s.daily.ad[kind] || 0)); }
  adUse(kind) { this.s.daily.ad[kind] = (this.s.daily.ad[kind] || 0) + 1; this.s.stats.ads++; }

  // ---------- ブースト ----------
  addBoost(kind) {
    const def = BOOSTS[kind];
    const now = Date.now();
    const cur = Math.max(now, this.s.boosts[kind] || 0);
    const next = Math.min(now + def.max * 3600e3, cur + def.hours * 3600e3);
    this.s.boosts[kind] = next;
    this.dirty();
  }
  boostLeft(kind) { return Math.max(0, (this.s.boosts[kind] || 0) - Date.now()) / 1000; }

  // ---------- 敵 ----------
  biome(stage = this.s.stage) { return BIOMES[B.biomeIndex(stage)]; }
  spawnEnemy() {
    const s = this.s.stage;
    const bio = this.biome(s);
    const loop = B.loopIndex(s);
    const boss = B.isBoss(s) && !this.s.farming;
    let sprite, name, hp, elite = false;
    if (boss) {
      sprite = bio.boss;
      name = (B.isMega(s) ? "真・" : "") + loopPrefix(loop) + BOSSES[sprite];
      hp = B.enemyHp(s).mul(B.bossHpMul(s));
    } else {
      sprite = bio.mons[Math.floor(Math.random() * bio.mons.length)];
      elite = Math.random() < 0.06;
      name = (elite ? "強化" : "") + loopPrefix(loop) + MONSTERS[sprite];
      hp = B.enemyHp(s).mul((0.9 + Math.random() * 0.2) * (elite ? 3 : 1));
    }
    const e = { sprite, name, hp, max: hp, boss, mega: boss && B.isMega(s), elite, flying: FLYING.has(sprite), hue: loop * 47 % 360, born: performance.now() };
    const st = this.stats();
    const over = st.dps.mul(HIT_INTERVAL).div(hp).toNumber();
    this.combat.rush = boss ? 1 : Math.min(5, Math.max(1, 1 + Math.log10(Math.max(1, over))));
    this.combat.enemy = e;
    return e;
  }

  // ---------- 1フレーム ----------
  tick(realDt) {
    const now = Date.now();
    const sp = this.speed();
    let dt = Math.min(realDt, 0.25) * sp;
    this.s.stats.playSec += realDt;
    // 黄金スライム（実時間）
    this.luckyNext -= realDt;
    if (!this.lucky && this.luckyNext <= 0) this.spawnLucky();
    if (this.lucky && now > this.lucky.until) { this.lucky = null; this.luckyNext = 70 + Math.random() * 90; }
    // コンボは1秒あくと切れる。ゲージは2秒さわらないと減っていく
    const pn = performance.now();
    if (this.combo > 0 && pn - this.comboAt > 1000) { this.emit("comboEnd", { combo: this.combo }); this.combo = 0; }
    if (this.gauge > 0 && now >= this.fx.gauge && pn - this.gaugeAt > 2000) this.gauge = Math.max(0, this.gauge - realDt * 12);
    // 自動タップ（オートタップの強化・連打ラッシュ）
    const fxNow = this.effects(now);
    const rate = B.autoTapRate(B.tapLv(this.s, "auto")) + (fxNow.rush ? 15 : 0);
    if (rate > 0) {
      this.autoAcc += realDt * rate * sp;
      let n = 0;
      while (this.autoAcc >= 1 && n++ < 40) { this.autoAcc -= 1; this.tap(null, null, fxNow.rush); }
      if (this.autoAcc > 5) this.autoAcc = 0;
    }
    // 戦闘（細かく刻む）
    while (dt > 0) {
      const step = Math.min(dt, 0.05);
      this.step(step);
      dt -= step;
    }
  }

  step(dt) {
    const c = this.combat;
    c.t += dt;
    if (c.phase === "walk") {
      this.walkDist += dt * 30 * c.rush;
      if (c.t >= c.dur) {
        const e = this.spawnEnemy();
        c.t = 0;
        if (e.boss) { c.phase = "bossIntro"; c.dur = BOSS_INTRO; this.emit("bossIntro", e); }
        else { c.phase = "fight"; c.hitT = 0; c.hitAcc = D(0); this.emit("spawn", e); if (this.pendingMeteor) { const lv = this.pendingMeteor - 1; this.pendingMeteor = 0; this.dropMeteor(lv); } }
      }
    } else if (c.phase === "bossIntro") {
      if (c.t >= c.dur) { c.phase = "fight"; c.t = 0; c.bossLeft = B.bossTime(this.s.stage); c.hitT = 0; c.hitAcc = D(0); this.emit("spawn", c.enemy); if (this.pendingMeteor) { const lv = this.pendingMeteor - 1; this.pendingMeteor = 0; this.dropMeteor(lv); } }
    } else if (c.phase === "fight") {
      const e = c.enemy;
      const st = this.stats();
      let dmg = st.dps.mul(dt);
      if (e.boss) dmg = dmg.mul(st.bossMul);
      e.hp = e.hp.sub(dmg);
      c.hitAcc = c.hitAcc.add(dmg);
      c.hitT += dt;
      if (c.hitT >= HIT_INTERVAL / c.rush || e.hp.lte(0)) {
        this.emit("hit", { dmg: c.hitAcc, tap: false, crit: false });
        this.recordHit(c.hitAcc);
        c.hitAcc = D(0); c.hitT = 0;
      }
      if (e.hp.lte(0)) { this.kill(e); return; }
      if (e.boss && !this.effects().freeze) {
        c.bossLeft -= dt;
        if (c.bossLeft <= 0) this.bossFail();
      }
    } else if (c.phase === "dead") {
      if (c.t >= c.dur) this.afterKill();
    }
  }

  recordHit(dmg) {
    if (dmg.gt(this.s.stats.maxHit)) { this.s.stats.maxHit = dmg; this.s.stats.maxHitLog = dmg.log10(); }
  }

  // タップ攻撃（x, y は画面上の位置：演出用）
  // manual: 指でのタップ（コンボとゲージが増える）。オートタップは false
  tap(x, y, manual = true) {
    const c = this.combat;
    const s = this.s;
    const now = Date.now();
    if (manual) {
      s.stats.taps++;
      const pn = performance.now();
      this.combo = pn - this.comboAt < 1000 ? this.combo + 1 : 1;
      this.comboAt = pn;
      if (this.combo > (s.stats.maxCombo || 0)) s.stats.maxCombo = this.combo;
      if (COMBO_TIERS.includes(this.combo)) this.emit("comboTier", { combo: this.combo });
      // タップフィーバーのゲージ
      if (now >= this.fx.gauge) {
        this.gauge = Math.min(B.FEVER_MAX, this.gauge + 1);
        this.gaugeAt = pn;
        if (this.gauge >= B.FEVER_MAX) {
          this.fx.gauge = now + B.FEVER_TIME * 1000;
          this.gauge = 0;
          s.stats.fevers = (s.stats.fevers || 0) + 1;
          this.emit("feverStart", {});
          this.checkAch();
        }
      }
    }
    if (c.phase !== "fight" || !c.enemy) { if (manual) this.emit("tapMiss", { x, y }); return null; }
    const st = this.stats();
    const fx = this.effects(now);
    const crit = Math.random() < st.tapCritRate;
    const cm = manual || fx.rush ? B.comboMul(this.combo, B.tapLv(s, "combo")) : 1;
    let dmg = st.tapDmg.mul(cm * (crit ? st.tapCritMult : 1) * (fx.gaugeFever ? B.FEVER_MUL : 1));
    if (c.enemy.boss) dmg = dmg.mul(st.bossMul);
    c.enemy.hp = c.enemy.hp.sub(dmg);
    this.recordHit(dmg);
    this.emit("hit", { dmg, tap: true, crit, x, y, combo: manual ? this.combo : 0, auto: !manual });
    // 分身タップ：もう1回（半分の強さ）
    if (Math.random() < B.echoChance(B.tapLv(s, "echo")) && c.enemy.hp.gt(0)) {
      const d2 = dmg.mul(0.5);
      c.enemy.hp = c.enemy.hp.sub(d2);
      this.emit("hit", { dmg: d2, tap: true, crit: false, x: x == null ? null : x + 18, y: y == null ? null : y - 14, echo: true, combo: 0 });
    }
    // 金の指（黄金の手の間は10倍・フィーバー中は2倍）
    const gl = B.tapLv(s, "gold") || (fx.midas ? 1 : 0);
    if (gl > 0) {
      const g = B.goldPerKill(s.stage).mul(B.TAP_GOLD_RATE * gl * (fx.midas ? 10 : 1) * (fx.gaugeFever ? 2 : 1)).mul(st.goldMul);
      this.addGold(g);
      if (manual) this.emit("tapGold", { gold: g, x, y });
    }
    if (c.enemy.hp.lte(0)) this.kill(c.enemy);
    return { dmg, crit, combo: this.combo };
  }

  // ---------- タップ強化・必殺技 ----------
  tapUpInfo(id, n) {
    const u = TAP_UPS.find((x) => x.id === id);
    const lv = B.tapLv(this.s, id);
    let k = n;
    if (n === "max") {
      // 買えるだけ（上限つき）
      k = 0; let cost = D(0);
      while (k < 1000) { const c = cost.add(B.tapUpCost(id, lv + k)); if (c.gt(this.s.gold)) break; cost = c; k++; }
      k = Math.max(1, k);
    }
    if (u.max) k = Math.max(0, Math.min(k, u.max - lv));
    return { n: k, cost: k > 0 ? B.tapUpCostBulk(id, lv, k) : D(Infinity), maxed: !!u.max && lv >= u.max };
  }
  buyTap(id, n) {
    const { n: k, cost, maxed } = this.tapUpInfo(id, n);
    if (maxed || k <= 0 || this.s.gold.lt(cost)) return false;
    this.s.gold = this.s.gold.sub(cost);
    this.s.tapUp[id] = B.tapLv(this.s, id) + k;
    this.dirty();
    return true;
  }
  skill(id) { return this.s.skills[id] || (this.s.skills[id] = { lv: 0, ready: 0 }); }
  skillUnlocked(id) { return this.s.heroLv >= SKILLS.find((x) => x.id === id).unlock; }
  skillLeft(id) { return Math.max(0, (this.skill(id).ready || 0) - Date.now()) / 1000; }
  useSkill(id) {
    if (!this.skillUnlocked(id) || this.skillLeft(id) > 0) return false;
    const sk = this.skill(id);
    const now = Date.now();
    const c = this.combat;
    if (id === "meteor") {
      // 敵がいないときは、次に出てきた敵に落とす
      if (c.phase !== "fight" || !c.enemy) this.pendingMeteor = sk.lv + 1;
      else this.dropMeteor(sk.lv);
    } else if (id === "rush") this.fx.rush = now + B.rushSecs(sk.lv) * 1000;
    else if (id === "midas") this.fx.midas = now + B.midasSecs(sk.lv) * 1000;
    else if (id === "freeze") this.fx.freeze = now + B.freezeSecs(sk.lv) * 1000;
    sk.ready = now + B.skillCd(id, sk.lv) * 1000;
    this.s.stats.skillUses = (this.s.stats.skillUses || 0) + 1;
    this.emit("useSkill", { id });
    this.checkAch();
    return true;
  }
  dropMeteor(lv) {
    const c = this.combat;
    const st = this.stats();
    let dmg = st.dps.mul(B.meteorSecs(lv));
    if (c.enemy.boss) dmg = dmg.mul(st.bossMul);
    this.emit("meteor", { dmg });
    // 流れ星が落ちるまで少し待ってから当てる
    setTimeout(() => {
      if (this.combat.enemy !== c.enemy || c.phase !== "fight") return;
      c.enemy.hp = c.enemy.hp.sub(dmg);
      this.recordHit(dmg);
      if (c.enemy.hp.lte(0)) this.kill(c.enemy);
    }, 600);
  }
  buySkill(id) {
    const sk = this.skill(id);
    const cost = B.skillCost(id, sk.lv);
    if (!this.skillUnlocked(id) || this.s.gold.lt(cost)) return false;
    this.s.gold = this.s.gold.sub(cost);
    sk.lv++;
    this.dirty();
    return true;
  }

  kill(e) {
    const c = this.combat;
    const st = this.stats();
    const s = this.s.stage;
    let gold = (e.boss ? B.bossGold(s) : B.goldPerKill(s)).mul(st.goldMul);
    if (e.elite) gold = gold.mul(5);
    this.addGold(gold);
    this.s.stats.kills++;
    if (e.boss) this.s.stats.bossKills++;
    this.emit("kill", { enemy: e, gold });
    // ドロップ
    const chance = (e.mega ? 1 : e.boss ? 0.3 : e.elite ? 0.25 : 0.04) * st.dropMul;
    if (Math.random() < chance) {
      const r = e.boss ? rollIndex(BOSS_DROP_RATES) : rollIndex(DROP_RATES);
      const it = makeItem(e.mega ? Math.max(r, R_SSR) : r, s);
      this.addItem(it, "drop");
    }
    c.phase = "dead"; c.t = 0; c.dur = DEAD_TIME / c.rush;
  }

  afterKill() {
    const c = this.combat;
    const e = c.enemy;
    const s = this.s;
    if (e && e.boss) {
      // ボス撃破 → 次のステージへ
      if (s.stage >= s.bestStage) s.gems += B.bossGems(s.stage);
      this.emit("bossWin", { stage: s.stage, gems: s.stage >= s.bestStage ? B.bossGems(s.stage) : 0 });
      this.advanceStage();
    } else {
      s.wave++;
      if (s.wave >= B.WAVES) {
        s.wave = 0;
        if (!s.farming) this.advanceStage();
        else this.maybeRetryBoss();
      }
    }
    c.enemy = null; c.phase = "walk"; c.t = 0; c.dur = WALK_TIME / c.rush;
  }

  advanceStage() {
    const s = this.s;
    s.stage++;
    s.wave = 0;
    if (s.stage > s.runMax) s.runMax = s.stage;
    const prevBest = s.bestStage;
    if (s.stage > s.bestStage) {
      s.bestStage = s.stage;
      for (const m of MILESTONES) if (prevBest < m && s.bestStage >= m) this.emit("milestone", { stage: m });
      if (s.vs && prevBest <= s.vs.stage && s.bestStage > s.vs.stage) this.emit("vsClear", { ...s.vs });
    }
    if (B.biomeIndex(s.stage) !== B.biomeIndex(s.stage - 1)) this.emit("biome", { biome: this.biome(), stage: s.stage });
    this.emit("stage", { stage: s.stage });
    this.checkAch();
  }

  bossFail() {
    const s = this.s;
    const c = this.combat;
    this.emit("bossFail", { stage: s.stage });
    s.farming = true;
    s.stage = Math.max(1, s.stage - 1);
    s.wave = 0;
    this.lastFailDps = this.stats().dps;
    this.failAt = Date.now();
    c.enemy = null; c.phase = "walk"; c.t = 0; c.dur = WALK_TIME;
  }

  // 周回中：強くなったら自動でボスに再挑戦
  maybeRetryBoss(force = false) {
    const s = this.s;
    if (!s.farming) return;
    const target = s.stage + 1;
    const st = this.stats();
    const need = B.enemyHp(target).mul(B.bossHpMul(target));
    const ttk = need.div(st.dps.mul(st.bossMul).max(1e-9)).toNumber();
    const ok = ttk <= B.bossTime(target) * 0.9;
    if (force || (s.settings.autoBoss && (ok || (this.failAt && Date.now() - this.failAt > 5 * 60e3 && ttk <= B.bossTime(target) * 1.6)))) {
      s.farming = false;
      s.stage = target;
      s.wave = 0;
      this.failAt = Date.now();
      this.emit("stage", { stage: s.stage });
    }
  }
  challengeBoss() {
    if (!this.s.farming) return;
    this.maybeRetryBoss(true);
    const c = this.combat;
    c.enemy = null; c.phase = "walk"; c.t = 0; c.dur = 0.3;
  }
  bossEstimate() {
    const s = this.s;
    const target = s.farming ? s.stage + 1 : (B.isBoss(s.stage) ? s.stage : Math.ceil(s.stage / B.BOSS_EVERY) * B.BOSS_EVERY);
    const st = this.stats();
    const need = B.enemyHp(target).mul(B.bossHpMul(target));
    return { stage: target, ttk: need.div(st.dps.mul(st.bossMul).max(1e-9)).toNumber(), limit: B.bossTime(target) };
  }

  // ---------- お金 ----------
  addGold(g) {
    this.s.gold = this.s.gold.add(g);
    this.s.stats.goldEarned = this.s.stats.goldEarned.add(g);
  }
  heroBuyInfo(n) {
    const lv = this.s.heroLv;
    if (n === "max") n = Math.max(1, B.heroAffordable(lv, this.s.gold));
    return { n, cost: B.heroCostBulk(lv, n) };
  }
  buyHero(n) {
    const { n: k, cost } = this.heroBuyInfo(n);
    if (this.s.gold.lt(cost)) return false;
    const before = this.s.heroLv;
    this.s.gold = this.s.gold.sub(cost);
    this.s.heroLv += k;
    for (const sk of (this.heroSkillsUnlocked(before, this.s.heroLv))) this.emit("skill", sk);
    this.dirty(); this.checkAch();
    return true;
  }
  heroSkillsUnlocked(a, b) {
    return HERO_SKILLS.filter((x) => a < x.lv && b >= x.lv);
  }
  compBuyInfo(k, n) {
    const lv = this.s.comp[k];
    if (n === "max") n = Math.max(1, B.compAffordable(k, lv, this.s.gold));
    return { n, cost: B.compCostBulk(k, lv, n) };
  }
  compUnlocked(k) { return k === 0 || this.s.comp[k - 1] > 0; }
  buyComp(k, n) {
    if (!this.compUnlocked(k)) return false;
    const { n: m, cost } = this.compBuyInfo(k, n);
    if (this.s.gold.lt(cost)) return false;
    const before = this.s.comp[k];
    this.s.gold = this.s.gold.sub(cost);
    this.s.comp[k] += m;
    if (before === 0) this.emit("hire", { k });
    if (B.compMilestoneMul(this.s.comp[k]) > B.compMilestoneMul(before)) this.emit("compMilestone", { k, lv: this.s.comp[k] });
    this.dirty(); this.checkAch();
    return true;
  }

  // ---------- 装備 ----------
  addItem(it, src) {
    const s = this.s;
    s.stats.items++;
    if (it.r > s.stats.bestR || (it.r === s.stats.bestR && !s.stats.bestPull)) { s.stats.bestR = Math.max(s.stats.bestR, it.r); s.stats.bestPull = { name: it.name, r: it.r, icon: it.icon }; }
    let equipped = false;
    const cur = s.items.find((x) => x.id === s.equip[it.slot]);
    s.items.push(it);
    const L = s.bestStage;
    if (s.settings.autoEquip && itemScore(it, L) > itemScore(cur, L)) { s.equip[it.slot] = it.id; equipped = true; }
    // N は自動で売る（装備しなかったとき）
    // N は自動で分解（星のかけらになる）
    if (!equipped && s.settings.autoSellN && it.r === 0 && (src === "drop" || src === "offline")) { this.dismantle(it.id, true); this.emit("drop", { item: it, equipped, sold: true }); this.dirty(); return; }
    // 持ちきれないときは弱いものから売る
    if (s.items.length > INV_MAX) {
      const eqIds = new Set(Object.values(s.equip));
      const cands = s.items.filter((x) => !eqIds.has(x.id) && !x.lock).sort((a, b) => a.r - b.r || itemScore(a, L) - itemScore(b, L));
      while (s.items.length > INV_MAX && cands.length) this.dismantle(cands.shift().id, true);
    }
    if (src === "drop") this.emit("drop", { item: it, equipped });
    this.dirty(); this.checkAch();
    return equipped;
  }
  equip(id) {
    const it = this.s.items.find((x) => x.id === id);
    if (!it) return;
    this.s.equip[it.slot] = id;
    it.isNew = false;
    this.dirty();
  }
  // 分解：装備を星のかけらにする（装備中・ロック中はできない）
  kakeraOf(it) { return B.dismantleGain(it); }
  dismantle(id, silent = false) {
    const s = this.s;
    if (Object.values(s.equip).includes(id)) return 0;
    const i = s.items.findIndex((x) => x.id === id);
    if (i < 0 || s.items[i].lock) return 0;
    const it = s.items[i];
    s.items.splice(i, 1);
    const k = this.kakeraOf(it);
    s.kakera = (s.kakera || 0) + k;
    if (!silent) this.dirty();
    return k;
  }
  dismantleBelow(r) {
    const eq = new Set(Object.values(this.s.equip));
    const ids = this.s.items.filter((x) => x.r <= r && !eq.has(x.id) && !x.lock).map((x) => x.id);
    let k = 0;
    for (const id of ids) k += this.dismantle(id, true);
    this.dirty();
    return { n: ids.length, kakera: k };
  }
  // 覚醒：星のかけらで★を1つ上げる（+30%）
  awakenCost(it) { return B.awakenCost(it.r, it.star || 0); }
  awaken(id) {
    const s = this.s;
    const it = s.items.find((x) => x.id === id);
    if (!it) return false;
    const cost = this.awakenCost(it);
    if ((s.kakera || 0) < cost) return false;
    s.kakera -= cost;
    it.star = (it.star || 0) + 1;
    s.stats.awakens = (s.stats.awakens || 0) + 1;
    this.dirty(); this.checkAch();
    this.emit("awaken", { item: it });
    return true;
  }
  autoEquipAll() {
    const s = this.s;
    let changed = 0;
    for (const slot of Object.keys(s.equip)) {
      const cur = s.items.find((x) => x.id === s.equip[slot]);
      let best = cur;
      for (const it of s.items) if (it.slot === slot && itemScore(it, s.bestStage) > itemScore(best, s.bestStage)) best = it;
      if (best && best !== cur) { s.equip[slot] = best.id; changed++; }
    }
    this.dirty();
    return changed;
  }

  // ---------- ガチャ ----------
  // kind: single | ten | free10 | share | ad
  canPull(kind) {
    const s = this.s;
    if (kind === "single") return s.gems >= GACHA.single;
    if (kind === "ten") return s.gems >= GACHA.ten;
    if (kind === "free10") return s.tickets.free10 > 0;
    if (kind === "share") return s.tickets.share > 0;
    if (kind === "ad") return this.adLeft("adGacha") > 0;
    return false;
  }
  pull(kind) {
    const s = this.s;
    if (!this.canPull(kind)) return null;
    let n = 10, up = false, guaranteeLast = R_SR;
    if (kind === "single") { s.gems -= GACHA.single; n = 1; guaranteeLast = 1; }
    else if (kind === "ten") s.gems -= GACHA.ten;
    else if (kind === "free10") { s.tickets.free10--; guaranteeLast = R_SSR; up = true; }
    else if (kind === "share") { s.tickets.share--; guaranteeLast = R_SSR; up = true; }
    else if (kind === "ad") { this.adUse("adGacha"); n = 1; guaranteeLast = 1; }
    let usedUp = false;
    if (!up && s.gachaUp > 0) { up = true; usedUp = true; s.gachaUp--; }
    const lv = Math.max(1, s.bestStage);
    const out = [];
    let maxR = 0;
    for (let i = 0; i < n; i++) {
      s.pity++;
      const pityHit = s.pity >= GACHA.pity;
      let minR = 1;
      if (i === n - 1 && maxR < guaranteeLast) minR = guaranteeLast;
      const r = B.rollGachaRarity(Math.random, { up, minR, pityHit });
      if (r >= R_UR) s.pity = 0;
      maxR = Math.max(maxR, r);
      out.push(makeItem(r, lv));
    }
    s.stats.pulls += n;
    // 追加（自動装備はしない：演出のあとで「装備する」）
    for (const it of out) {
      s.items.push(it);
      s.stats.items++;
      if (it.r > s.stats.bestR) { s.stats.bestR = it.r; s.stats.bestPull = { name: it.name, r: it.r, icon: it.icon }; }
    }
    this.trimInventory();
    this.dirty(); this.checkAch();
    return { items: out, maxR, up, usedUp, kind };
  }
  trimInventory() {
    const s = this.s;
    if (s.items.length <= INV_MAX) return;
    const eqIds = new Set(Object.values(s.equip));
    const L = s.bestStage;
    const cands = s.items.filter((x) => !eqIds.has(x.id) && !x.lock && !x.isNew).sort((a, b) => a.r - b.r || itemScore(a, L) - itemScore(b, L));
    while (s.items.length > INV_MAX && cands.length) this.dismantle(cands.shift().id, true);
  }

  // ---------- 黄金スライム（クッキークリッカーのゴールデンクッキー） ----------
  spawnLucky() {
    const dur = 9000;
    this.lucky = { born: Date.now(), until: Date.now() + dur, dur, y: 0.18 + Math.random() * 0.3, dir: Math.random() < 0.5 ? 1 : -1 };
    this.emit("luckySpawn", this.lucky);
  }
  luckyPos(now = Date.now()) {
    const L = this.lucky;
    if (!L) return null;
    const p = (now - L.born) / L.dur;
    const x = L.dir > 0 ? -0.1 + p * 1.2 : 1.1 - p * 1.2;
    const y = L.y + Math.sin(p * Math.PI * 6) * 0.04;
    return { x, y, p };
  }
  catchLucky() {
    if (!this.lucky) return null;
    this.lucky = null;
    this.luckyNext = 70 + Math.random() * 90;
    this.s.stats.lucky++;
    const k = rollIndex([34, 28, 20, 12, 6]);
    const st = this.stats();
    let res;
    if (k === 0) {
      const g = B.goldPerKill(this.s.stage).mul(st.goldMul).mul(80 + this.s.stage);
      this.addGold(g); res = { type: "gold", gold: g, text: "ゴールドラッシュ！" };
    } else if (k === 1) {
      this.fx.fever = Date.now() + 30000; res = { type: "fever", text: "フィーバー！ 全ダメージ×7（30秒）" };
    } else if (k === 2) {
      this.fx.tapFever = Date.now() + 20000; res = { type: "tapFever", text: "連打祭り！ タップ×10（20秒）" };
    } else if (k === 3) {
      this.s.gems += 15; res = { type: "gems", gems: 15, text: "ジェム +15" };
    } else {
      const it = makeItem(rollIndex([0, 0, 70, 25, 5]), this.s.stage);
      this.addItem(it, "drop"); res = { type: "item", item: it, text: "宝箱！" };
    }
    this.dirty(); this.checkAch();
    this.emit("lucky", res);
    return res;
  }

  // ---------- 転生 ----------
  prestigeGain() { return B.soulsFor(this.s.runMax); }
  canPrestige() { return this.s.runMax >= B.PRESTIGE_MIN; }
  prestige() {
    if (!this.canPrestige()) return null;
    const s = this.s;
    const gain = this.prestigeGain();
    s.souls = D(s.souls).add(gain);
    s.stats.prestiges++;
    s.gems += 100;
    s.stage = 1; s.wave = 0; s.runMax = 1; s.farming = false;
    s.gold = D(0); s.heroLv = 1; s.comp = s.comp.map(() => 0);
    this.combat = { phase: "walk", t: 0, dur: WALK_TIME, enemy: null, bossLeft: 0, hitAcc: D(0), hitT: 0, rush: 1 };
    this.dirty(); this.checkAch();
    this.emit("prestige", { gain });
    this.emit("stage", { stage: 1 });
    return gain;
  }

  // ---------- 放置（オフライン）の計算 ----------
  offline(seconds) {
    const s = this.s;
    const now = Date.now();
    const cap = 12 * 3600;
    const real = Math.min(seconds, cap);
    // 倍速ブーストが効いていた時間は2倍進む
    const speedEnd = s.boosts.speed || 0;
    const start = now - real * 1000;
    const overlap = Math.max(0, Math.min(now, speedEnd) - start) / 1000;
    let t = real + overlap;
    const st = B.computeStats(s, now, { goldBoost: (s.boosts.gold || 0) > start, dropBoost: (s.boosts.drop || 0) > start });
    const res = { seconds: real, from: s.stage, to: s.stage, gold: D(0), kills: 0, items: [], gems: 0 }; // 時間のジェムは定期便（collectMail）で
    // オートタップの分（コンボなし）も放置の攻撃に入れる
    const autoRate = B.autoTapRate(B.tapLv(s, "auto"));
    if (autoRate > 0) st.dps = st.dps.add(st.tapDmg.mul(autoRate * (1 + st.tapCritRate * (st.tapCritMult - 1))));
    let guard = 0;
    while (t > 0 && guard++ < 200000) {
      const stage = s.stage;
      if (B.isBoss(stage) && !s.farming) {
        const hp = B.enemyHp(stage).mul(B.bossHpMul(stage));
        const ttk = hp.div(st.dps.mul(st.bossMul).max(1e-9)).toNumber();
        if (ttk <= B.bossTime(stage)) {
          t -= ttk + BOSS_INTRO + WALK_TIME;
          res.gold = res.gold.add(B.bossGold(stage).mul(st.goldMul));
          if (stage >= s.bestStage) res.gems += B.bossGems(stage);
          res.kills++;
          if (Math.random() < 0.3 * st.dropMul && res.items.length < 30) res.items.push(makeItem(rollIndex(BOSS_DROP_RATES), stage));
          s.stage++; s.wave = 0;
          if (s.stage > s.runMax) s.runMax = s.stage;
          if (s.stage > s.bestStage) s.bestStage = s.stage;
        } else {
          s.farming = true; s.stage = Math.max(1, stage - 1); s.wave = 0; t -= B.bossTime(stage) + BOSS_INTRO;
        }
        continue;
      }
      const hp = B.enemyHp(stage);
      const ttk = hp.div(st.dps.max(1e-9)).toNumber();
      const over = st.dps.mul(HIT_INTERVAL).div(hp).toNumber();
      const rush = Math.min(5, Math.max(1, 1 + Math.log10(Math.max(1, over))));
      const per = Math.max(ttk, HIT_INTERVAL / rush) + (WALK_TIME + DEAD_TIME) / rush;
      if (s.farming) {
        // 周回中は残り時間をまとめて計算
        const kills = Math.floor(t / per);
        res.kills += kills;
        res.gold = res.gold.add(B.goldPerKill(stage).mul(st.goldMul).mul(kills));
        const expDrops = Math.min(30 - res.items.length, Math.floor(kills * 0.04 * st.dropMul));
        for (let i = 0; i < expDrops; i++) res.items.push(makeItem(rollIndex(DROP_RATES), stage));
        t = 0;
        break;
      }
      t -= per;
      res.kills++;
      res.gold = res.gold.add(B.goldPerKill(stage).mul(st.goldMul));
      if (Math.random() < 0.04 * st.dropMul && res.items.length < 30) res.items.push(makeItem(rollIndex(DROP_RATES), stage));
      s.wave++;
      if (s.wave >= B.WAVES) { s.wave = 0; s.stage++; if (s.stage > s.runMax) s.runMax = s.stage; if (s.stage > s.bestStage) s.bestStage = s.stage; }
    }
    res.to = s.stage;
    s.stats.kills += res.kills;
    return res;
  }
  applyOffline(res, mult = 1) {
    this.addGold(res.gold.mul(mult));
    this.s.gems += res.gems * mult;
    for (const it of res.items) this.addItem(it, "offline");
    this.dirty(); this.checkAch();
  }

  // ---------- 実績 ----------
  checkAch() {
    const s = this.s;
    for (const a of ACHIEVEMENTS) {
      if (s.ach[a.id]) continue;
      let ok = false;
      try { ok = a.test(s); } catch {}
      if (ok) { s.ach[a.id] = Date.now(); s.gems += a.gems; this.emit("ach", a); }
    }
  }
}
