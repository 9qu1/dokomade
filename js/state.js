// セーブデータ：初期値・保存・読み込み・引き継ぎコード
import { D, Decimal } from "./big.js";
import { COMPANIONS, OLD_ICON_MAP, OLD_ICON_BASE, ICON_BASE, LEGENDS } from "./data.js";
import { levelFactor, isFlatStat, MAIL_EVERY_MS } from "./balance.js";

const KEY = "dokomade-save-v1";
export const SAVE_VERSION = 3;

export const todayStr = (t = Date.now()) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function newState() {
  const now = Date.now();
  return {
    v: SAVE_VERSION,
    created: now,
    lastSeen: now,
    name: "車掌",
    gold: D(0),
    gems: 300,
    souls: D(0),
    stage: 1,
    wave: 0,
    runMax: 1,      // この転生での最高ステージ
    bestStage: 1,   // 全期間の最高ステージ（共有する記録）
    farming: false,
    heroLv: 1,
    comp: Array(COMPANIONS.length).fill(0),
    items: [],
    kakera: 0,        // 星のかけら（分解で増え、覚醒で使う）
    equip: { weapon: null, head: null, body: null, acc: null },
    boosts: { speed: 0, drop: 0, gold: 0 },
    gachaUp: 0,       // 確率アップ券（広告）
    tickets: { free10: 0, share: 0 },
    pity: 0,
    daily: { date: "", login: false, share: false, ad: {} },
    streak: 0,
    msShared: {},     // 到達記念でシェアしたステージ
    ach: {},
    stats: {
      kills: 0, bossKills: 0, taps: 0, pulls: 0, bestR: -1, prestiges: 0, playSec: 0,
      goldEarned: D(0), maxHit: D(0), maxHitLog: 0, shares: 0, lucky: 0, items: 0, ads: 0,
      bestPull: null, // { name, r, icon }
      maxCombo: 0, fevers: 0, skillUses: 0,
    },
    settings: { sound: true, bgm: false, vibrate: true, autoEquip: true, autoBoss: true, autoSellN: true, numFmt: "jp", buyMode: 1, fast: false },
    tapUp: {},        // タップ強化のレベル { power: 3, ... }
    skills: {},       // 必殺技 { meteor: { lv, ready(ms) } }
    tutorial: 0,
    vs: null,         // 挑戦状 { stage, name }
    rank: { join: true, name: "", uid: "", last: 0, lastBest: 0, seen: {} }, // ランキング
    mail: { slot: Math.floor(now / MAIL_EVERY_MS) }, // ジェムの定期便：最後に受け取った区切り（はじめは今から数える）
  };
}

// Decimal にするフィールド
const DEC = ["gold", "souls"];
const DEC_STATS = ["goldEarned", "maxHit"];

export function serialize(st) {
  return JSON.stringify(st, (k, v) => (v instanceof Decimal ? v.toString() : v));
}
export function deserialize(json) {
  const raw = JSON.parse(json);
  const base = newState();
  const st = { ...base, ...raw };
  for (const k of DEC) st[k] = D(raw[k] ?? 0);
  st.stats = { ...base.stats, ...(raw.stats || {}) };
  for (const k of DEC_STATS) st.stats[k] = D(st.stats[k] ?? 0);
  st.settings = { ...base.settings, ...(raw.settings || {}) };
  st.boosts = { ...base.boosts, ...(raw.boosts || {}) };
  st.tickets = { ...base.tickets, ...(raw.tickets || {}) };
  st.equip = { ...base.equip, ...(raw.equip || {}) };
  st.daily = { ...base.daily, ...(raw.daily || {}) };
  st.daily.ad = { ...(st.daily.ad || {}) };
  if (!Array.isArray(st.comp) || st.comp.length !== COMPANIONS.length) st.comp = COMPANIONS.map((_, i) => (raw.comp && raw.comp[i]) || 0);
  if (!Array.isArray(st.items)) st.items = [];
  st.rank = { ...base.rank, ...(raw.rank || {}) };
  st.tapUp = { ...(raw.tapUp || {}) };
  st.skills = { ...(raw.skills || {}) };
  // v1 → v2：装備の値を「入手時のレベルの値(v)」から「レベル1の値(b)」に直す（いつも最高到達ステージで計算するため）
  if ((raw.v || 1) < 2) {
    for (const it of st.items) {
      const f = levelFactor(Math.max(1, it.lv || 1));
      for (const x of [it.main, ...(it.subs || [])]) {
        if (x && x.b == null && x.v != null) { x.b = isFlatStat(x.t) ? x.v : x.v / f; delete x.v; }
      }
      it.star = it.star || 0;
    }
    st.kakera = st.kakera || 0;
  }
  // v2 → v3：勇者の装備の絵と名前を、列車の部品に置きかえる（強さはそのまま）
  if ((raw.v || 1) < 3) {
    for (const it of st.items) migrateItemLook(it);
    if (st.stats.bestPull) migrateItemLook(st.stats.bestPull);
  }
  st.v = SAVE_VERSION;
  return st;
}

function migrateItemLook(it) {
  const icon = OLD_ICON_MAP[it.icon];
  if (!icon) return;
  const leg = LEGENDS.find((l) => l.icon === icon);
  if (leg && it.r >= 5) it.name = leg.name;
  else {
    const oldBase = OLD_ICON_BASE[it.icon] || "";
    const prefix = oldBase && String(it.name || "").endsWith(oldBase) ? it.name.slice(0, -oldBase.length) : "";
    it.name = prefix + (ICON_BASE[icon] || "");
  }
  it.icon = icon;
}

export function load() {
  try {
    const s = localStorage.getItem(KEY);
    if (!s) return null;
    return deserialize(s);
  } catch (e) {
    console.warn("セーブの読み込みに失敗", e);
    return null;
  }
}
export function save(st) {
  try {
    st.lastSeen = Date.now();
    localStorage.setItem(KEY, serialize(st));
    return true;
  } catch (e) {
    console.warn("保存に失敗", e);
    return false;
  }
}
export function wipe() { try { localStorage.removeItem(KEY); } catch {} }

// 引き継ぎコード（端末を変えるとき用）
export function exportCode(st) {
  const json = serialize(st);
  const bytes = new TextEncoder().encode(json);
  let bin = ""; for (const b of bytes) bin += String.fromCharCode(b);
  return "DKMD1." + btoa(bin);
}
export function importCode(code) {
  code = String(code || "").trim();
  if (!code.startsWith("DKMD1.")) throw new Error("コードの形式が違います");
  const bin = atob(code.slice(6));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return deserialize(new TextDecoder().decode(bytes));
}
