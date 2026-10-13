// 装備の生成と比較
import { SLOTS, ICONS, ICON_BASE, PREFIX, LEGENDS, SUB_POOL, RARITIES, STATS } from "./data.js";
import { mainStatBase, subStatBase, statNow } from "./balance.js";
import { fmtPct } from "./big.js";

let seq = 0;
const uid = () => `${Date.now().toString(36)}${(seq++ % 1296).toString(36).padStart(2, "0")}${Math.floor(Math.random() * 1296).toString(36)}`;
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const roll = (rng) => 0.9 + rng() * 0.2; // 個体差 ±10%

export function pickSlot(rng) {
  const tot = SLOTS.reduce((a, s) => a + s.weight, 0);
  let x = rng() * tot;
  for (const s of SLOTS) { if (x < s.weight) return s.key; x -= s.weight; }
  return "weapon";
}

export function makeItem(r, lv, rng = Math.random, slot = null) {
  let icon, name;
  if (r >= 5) {
    const L = slot ? LEGENDS.filter((x) => x.slot === slot) : LEGENDS;
    const leg = pick(rng, L.length ? L : LEGENDS);
    slot = leg.slot; icon = leg.icon; name = leg.name;
  } else {
    slot = slot || pickSlot(rng);
    icon = pick(rng, ICONS[slot]);
    name = pick(rng, PREFIX[r]) + ICON_BASE[icon];
  }
  const mainT = SLOTS.find((s) => s.key === slot).main;
  const main = { t: mainT, b: mainStatBase(slot, r, roll(rng)) };
  const subs = [];
  const pool = SUB_POOL.filter((t) => t !== mainT);
  for (let i = 0; i < RARITIES[r].subs && pool.length; i++) {
    const t = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    subs.push({ t, b: subStatBase(t, r, roll(rng)) });
  }
  // lv は「手に入れたステージ」（記録用）。強さの計算には使わない（いつも最高到達ステージで計算）
  return { id: uid(), slot, icon, r, lv, star: 0, name, main, subs, ts: Date.now(), isNew: true };
}

// 自動装備の比較用のざっくりした強さ（同じ部位どうしで比べる）。lvl は最高到達ステージ
const W = { atk: 1, dps: 0.9, critDmg: 0.35, gold: 0.45, tap: 0.25, boss: 0.3 };
export function itemScore(it, lvl = 100) {
  if (!it) return -1;
  let s = statScore(it.main.t, statNow(it.main, lvl, it.star));
  for (const x of it.subs) s += statScore(x.t, statNow(x, lvl, it.star));
  return s;
}
export const itemStats = (it, lvl) => [it.main, ...it.subs].map((x) => ({ t: x.t, v: statNow(x, lvl, it.star), main: x === it.main }));
function statScore(t, v) {
  if (t === "crit") return v * 12;
  if (t === "drop") return v * 1.5;
  return v * (W[t] ?? 0.3);
}

export function statText(t, v) {
  const n = STATS[t]?.name || t;
  if (STATS[t]?.fmt === "pt") return `${n} +${Math.round(v * 10) / 10}%`;
  return `${n} ${fmtPct(v)}`;
}
