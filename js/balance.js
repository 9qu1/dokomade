// 数式（敵の強さ・値段・ダメージ）。ブラウザと調整用シミュレーター(tools/sim.mjs)の両方から使う
import { D, Decimal } from "./big.js";
import { COMPANIONS, HERO_SKILLS, RARITIES, SLOTS, STAGES_PER_BIOME, BIOMES, GACHA, TAP_UPS, SKILLS } from "./data.js";

const O = globalThis.__BAL || {}; // 調整用シミュレーターが上書きする
export const HP_GROWTH = O.hpGrowth ?? 1.2;
export const WAVES = 10;               // 1ステージの敵の数
export const BOSS_EVERY = 5;           // 5ステージごとにボス
export const MEGA_EVERY = 50;          // 50ステージごとに大ボス
export const COMP_GROWTH = O.compGrowth ?? 1.07; // 仲間のレベルごとの値上がり
export const HERO_GROWTH = 1.075;
export const TAP_DPS_RATIO = 0.08;     // タップ1回に DPS の8%を上乗せ
export const BASE_CRIT = 3;            // 会心率 3%
export const BASE_CRIT_MULT = 2.5;     // 会心は2.5倍
export const PRESTIGE_MIN = 60;
export const SCALE = 10;               // 数の見た目の倍率（比率は変わらない）
// ジェムの定期便：毎時0分（時計の区切り）に届く。閉じていても MAIL_MAX 便までたまる
export const MAIL_EVERY_MS = 3600e3;   // 1時間ごと
export const MAIL_GEMS = 30;           // 1便＝召喚1回分
export const MAIL_MAX = 12;            // 12時間分まで

const G = new Decimal(HP_GROWTH);
const hpCache = new Map();
export function enemyHp(s) {
  let v = hpCache.get(s);
  if (!v) { v = G.pow(s - 1).add(s - 1).mul(10 * SCALE); if (hpCache.size > 4000) hpCache.clear(); hpCache.set(s, v); }
  return v;
}
export const isBoss = (s) => s % BOSS_EVERY === 0;
export const isMega = (s) => s % MEGA_EVERY === 0;
export const bossHpMul = (s) => (isMega(s) ? 25 : 10);
export const bossTime = (s) => (isMega(s) ? 45 : 30);
export const GOLD_RATIO = O.goldRatio ?? 0.03;
// 序盤はゴールドを多めに（最初の数分で買い物が楽しくなるように）。後半はほぼ GOLD_RATIO どおり
export const goldPerKill = (s) => enemyHp(s).mul(GOLD_RATIO * (1 + 5 * Math.exp(-(s - 1) / 12)));
export const bossGold = (s) => goldPerKill(s).mul(isMega(s) ? 40 : 8);
export const biomeIndex = (s) => Math.floor((s - 1) / STAGES_PER_BIOME) % BIOMES.length;
export const loopIndex = (s) => Math.floor((s - 1) / (STAGES_PER_BIOME * BIOMES.length));
export const bossGems = (s) => (isMega(s) ? 50 : 5);

// ---- 仲間 ----
export const MS_EVERY = O.msEvery ?? 25;
export function compMilestoneMul(lv) {
  // Lv10/25/50/75/100 で×2、以降25ごとに×2
  let m = 1;
  if (lv >= 10) m *= 2;
  if (lv >= 25) m *= 2;
  if (lv >= 50) m *= 2;
  if (lv >= 75) m *= 2;
  if (lv >= 100) m *= Math.pow(2, 1 + Math.floor((lv - 100) / MS_EVERY));
  return m;
}
export function nextCompMilestone(lv) {
  const ms = [10, 25, 50, 75, 100];
  for (const x of ms) if (lv < x) return x;
  return 100 + (Math.floor((lv - 100) / MS_EVERY) + 1) * MS_EVERY;
}
export const TIER_COST = O.tierCost ?? 1.8;
export const TIER_DPS = O.tierDps ?? 0.8;
export const compBaseCost = (k) => COMPANIONS[k].cost * SCALE * Math.pow(TIER_COST, k);
export const compBaseDps = (k) => COMPANIONS[k].dps * SCALE * Math.pow(TIER_DPS, k);
export function compCost(k, lv) {
  // lv → lv+1 にする値段
  return D(compBaseCost(k)).mul(D(COMP_GROWTH).pow(lv));
}
export function compCostBulk(k, lv, n) {
  // n 回分の合計（等比数列）
  const r = D(COMP_GROWTH);
  return D(compBaseCost(k)).mul(r.pow(lv)).mul(r.pow(n).sub(1)).div(COMP_GROWTH - 1);
}
export function compAffordable(k, lv, gold) {
  // 今のゴールドで何レベル上げられるか
  const c0 = compCost(k, lv);
  if (D(gold).lt(c0)) return 0;
  // gold >= c0 (r^n - 1)/(r-1)  →  n = floor(log(gold*(r-1)/c0 + 1)/log r)
  const x = D(gold).mul(COMP_GROWTH - 1).div(c0).add(1);
  return Math.max(0, Math.floor(x.log10() / Math.log10(COMP_GROWTH)));
}
export function compDpsRaw(k, lv) {
  if (lv <= 0) return D(0);
  return D(compBaseDps(k)).mul(lv * compMilestoneMul(lv));
}

// ---- 勇者 ----
export function heroCost(lv) { return D(5 * SCALE).mul(D(HERO_GROWTH).pow(lv - 1)); }
export function heroCostBulk(lv, n) {
  const r = D(HERO_GROWTH);
  return D(5 * SCALE).mul(r.pow(lv - 1)).mul(r.pow(n).sub(1)).div(HERO_GROWTH - 1);
}
export function heroAffordable(lv, gold) {
  const c0 = heroCost(lv);
  if (D(gold).lt(c0)) return 0;
  const x = D(gold).mul(HERO_GROWTH - 1).div(c0).add(1);
  return Math.max(0, Math.floor(x.log10() / Math.log10(HERO_GROWTH)));
}
export function heroTapBase(lv) {
  // Lv1=1。10レベルごとに少しずつ伸び方が増える
  return D(lv * SCALE).mul(1 + Math.floor(lv / 10) * 0.25).mul(Math.pow(1.5, Math.floor(lv / 50)));
}
export function heroSkillEffects(lv) {
  const e = { crit: 0, critDmg: 0, tapMul: 1, compMul: 1, goldMul: 1, allMul: 1 };
  for (const s of HERO_SKILLS) {
    if (lv < s.lv) break;
    for (const [k, v] of Object.entries(s.eff)) {
      if (k === "crit" || k === "critDmg") e[k] += v; else e[k] *= v;
    }
  }
  // Lv300 以降は100ごとに全ダメージ×2
  if (lv >= 400) e.allMul *= Math.pow(2, Math.floor((lv - 300) / 100));
  return e;
}

// ---- 装備 ----
// 装備は「持ち主と一緒に育つ」：数値は入手時のレベルで固定せず、いつも最高到達ステージに合わせて計算する。
// 覚えておくのは「レベル1のときの値（b）」だけ。会心率とドロップ率はレベルで伸びない固定値。
// だからガチャで当てたレアは、先へ進んでも価値が落ちない（強さの差はレアリティと★で決まる）
export const LV_SLOPE = O.lvSlope ?? 0.05;
export const levelFactor = (lv) => 1 + LV_SLOPE * (lv - 1);
const MAIN_SCALE = { atk: 1, critDmg: 1.5, dps: 1, gold: 0.6 };
const SUB_SCALE = { atk: 0.35, dps: 0.35, tap: 0.6, critDmg: 0.5, gold: 0.25, boss: 0.45 };
export const SUB_FLAT = { crit: [0, 0, 1, 2, 3, 5], drop: [0, 0, 5, 10, 15, 25] };
export const isFlatStat = (t) => !!SUB_FLAT[t];
export function mainStatBase(slot, r, roll = 1) {
  const t = SLOTS.find((s) => s.key === slot).main;
  return RARITIES[r].main * MAIN_SCALE[t] * roll;
}
export function subStatBase(t, r, roll = 1) {
  if (SUB_FLAT[t]) return SUB_FLAT[t][r] * (0.8 + 0.4 * (roll - 0.9) / 0.2);
  return RARITIES[r].main * SUB_SCALE[t] * roll;
}
// ★（覚醒）：1つごとに +30%（会心率・ドロップ率は別）
export const STAR_STEP = 0.3;
export const starMul = (star) => 1 + STAR_STEP * (star || 0);
export function statNow(x, lvl, star = 0) {
  return isFlatStat(x.t) ? x.b : x.b * levelFactor(Math.max(1, lvl)) * starMul(star);
}
// 分解でもらえる星のかけら・覚醒に要るかけら
export const KAKERA_GAIN = [1, 3, 10, 40, 120, 400];
export const AWAKEN_BASE = [6, 10, 20, 40, 80, 150];
export const awakenCost = (r, star) => AWAKEN_BASE[r] * ((star || 0) + 1);
export const dismantleGain = (it) => KAKERA_GAIN[it.r] + Math.floor(AWAKEN_BASE[it.r] * ((it.star || 0) * ((it.star || 0) + 1)) / 2 * 0.5);

// ---- タップ強化・必殺技 ----
export const tapLv = (st, id) => (st.tapUp && st.tapUp[id]) || 0;
export function tapUpCost(id, lv) { const u = TAP_UPS.find((x) => x.id === id); return D(u.base * SCALE).mul(D(u.growth).pow(lv)); }
export function tapUpCostBulk(id, lv, n) { const u = TAP_UPS.find((x) => x.id === id); const r = D(u.growth); return D(u.base * SCALE).mul(r.pow(lv)).mul(r.pow(n).sub(1)).div(u.growth - 1); }
export const tapPowerMul = (lv) => (1 + 0.25 * lv) * Math.pow(2, Math.floor(lv / 25));
export const comboCap = (lv) => 100 + 25 * lv;
export const comboPer = (lv) => 0.01 * (1 + 0.1 * lv);          // 1コンボあたり（+1% から）
export const comboMul = (combo, lv) => 1 + Math.min(combo, comboCap(lv)) * comboPer(lv);
export const echoChance = (lv) => Math.min(1, 0.05 * lv);
export const autoTapRate = (lv) => 0.5 * lv;                    // 1秒あたり
export const TAP_GOLD_RATE = 0.02;                               // 金の指 1つごとに 敵1体分の2%
export const FEVER_MAX = 100, FEVER_TIME = 8, FEVER_MUL = 5;
export function skillCost(id, lv) { const k = SKILLS.find((x) => x.id === id); return D(k.base * SCALE).mul(D(k.growth).pow(lv)); }
export const skillCd = (id, lv) => SKILLS.find((x) => x.id === id).cd * Math.max(0.5, 1 - 0.03 * lv);
export const meteorSecs = (lv) => 20 * (1 + 0.5 * lv);
export const rushSecs = (lv) => 8 + lv;
export const midasSecs = (lv) => 15 + 2 * lv;
export const freezeSecs = (lv) => 10 + lv;

// ---- 転生 ----
export const SOUL_GROWTH = O.soulGrowth ?? 1.075;
export function soulsFor(stage) {
  // 転生でもらえる魂。ステージが上がるほど指数的に増える（D を返す）
  if (stage < PRESTIGE_MIN) return D(0);
  return D(SOUL_GROWTH).pow(stage - PRESTIGE_MIN).mul(2 * (1 + (stage - PRESTIGE_MIN) / 50)).floor();
}

// ---- 能力値のまとめ ----
// state と「いま効いている一時効果」から、戦闘に使う数字をまとめて出す
export function computeStats(st, now = Date.now(), fx = {}) {
  const gear = { atk: 0, dps: 0, tap: 0, crit: 0, critDmg: 0, gold: 0, drop: 0, boss: 0 };
  const eq = st.equip || {};
  const lvl = st.bestStage || 1;
  for (const slot of Object.keys(eq)) {
    const it = eq[slot] && st.items.find((x) => x.id === eq[slot]);
    if (!it) continue;
    gear[it.main.t] += statNow(it.main, lvl, it.star);
    for (const s of it.subs) gear[s.t] += statNow(s, lvl, it.star);
  }
  const hs = heroSkillEffects(st.heroLv);
  const soulMul = D(st.souls || 0).mul(0.1).add(1);
  const fever = fx.fever ? 7 : 1;
  const tapFever = fx.tapFever ? 10 : 1;

  let compDps = D(0);
  const compEach = [];
  for (let k = 0; k < COMPANIONS.length; k++) {
    const v = compDpsRaw(k, st.comp[k] || 0);
    compEach.push(v);
    compDps = compDps.add(v);
  }
  const compMul = (1 + gear.dps / 100) * hs.compMul;
  compDps = compDps.mul(compMul);
  const heroBase = heroTapBase(st.heroLv);
  const heroAuto = heroBase.mul(1.0);
  const tapBase = heroBase.mul(tapPowerMul(tapLv(st, "power")));
  const baseDps = compDps.add(heroAuto);
  const allMul = soulMul.mul((1 + gear.atk / 100) * hs.allMul * fever);
  const critRate = Math.min(100, BASE_CRIT + hs.crit + gear.crit) / 100;
  const critMult = BASE_CRIT_MULT + (hs.critDmg + gear.critDmg) / 100;
  const critFactor = 1 + critRate * (critMult - 1);
  const dps = baseDps.mul(allMul).mul(critFactor);
  const tapMul = hs.tapMul * (1 + gear.tap / 100) * tapFever;
  const tapDmg = tapBase.add(baseDps.mul(TAP_DPS_RATIO + 0.01 * tapLv(st, "link"))).mul(allMul).mul(tapMul); // 会心・コンボは別
  const tapCritRate = Math.min(1, critRate + 0.01 * tapLv(st, "crit"));
  const tapCritMult = critMult + 0.3 * tapLv(st, "critDmg");
  const goldMul = (1 + gear.gold / 100) * hs.goldMul * (fx.goldBoost ? 2 : 1);
  const dropMul = (1 + gear.drop / 100) * (fx.dropBoost ? 2 : 1);
  const bossMul = 1 + gear.boss / 100;
  return { dps, tapDmg, tapCritRate, tapCritMult, critRate, critMult, goldMul, dropMul, bossMul, allMul, compMul, soulMul, gear, hs, compEach, baseDps, compDps };
}

// ガチャの1回分のレアリティを決める
export function rollGachaRarity(rng, { up = false, minR = 1, pityHit = false } = {}) {
  const rates = up ? GACHA.upRates : GACHA.rates; // R..LR
  let r;
  if (pityHit) {
    // UR以上確定：UR:LR = 元の比率
    const u = rates[3], l = rates[4];
    r = rng() * (u + l) < l ? 5 : 4;
  } else {
    const tot = rates.reduce((a, b) => a + b, 0);
    let x = rng() * tot;
    r = 1;
    for (let i = 0; i < rates.length; i++) { if (x < rates[i]) { r = i + 1; break; } x -= rates[i]; }
  }
  if (r < minR) {
    // 最低保証：minR 以上から、元の比率で選び直す
    const sub = rates.slice(minR - 1);
    const tot = sub.reduce((a, b) => a + b, 0);
    let x = rng() * tot;
    r = minR;
    for (let i = 0; i < sub.length; i++) { if (x < sub[i]) { r = minR + i; break; } x -= sub[i]; }
  }
  return r;
}
