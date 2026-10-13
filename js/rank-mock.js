// ランキングのお試しデータ（localhost だけ）。架空の参加者500人を作り、Firebase と同じ形で返す
import { titleFor } from "./data.js";

const NAMES = ["ゆうき", "にゃんこ剣士", "たろう", "ほのか", "ぽてと", "しろくま", "カイト", "みゆ", "ラーメン大好き", "もちもち", "ソラ", "ケンタ", "りんご", "はやて", "こはる", "ゲーマー太郎", "ねこ", "アキラ", "ゆず", "ハル", "つばさ", "ミナト", "ひなた", "レン", "ぴよ", "黒猫", "まめ", "ユウ", "サクラ", "ねむい人"];

export function create(meEntry) {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const players = [];
  for (let i = 0; i < 500; i++) {
    const best = Math.max(1, Math.round(Math.exp(rnd() * rnd() * 7.2) + rnd() * 20));
    const played = rnd() < 0.55;
    players.push({
      id: `p${i}`, name: `${NAMES[i % NAMES.length]}${i >= NAMES.length ? Math.floor(i / NAMES.length) : ""}`,
      best, week: played ? meEntry.week : "2026-01-05", wbest: played ? Math.max(1, Math.round(best * (0.6 + rnd() * 0.4))) : 1,
      hit: Math.round((best * 0.075 + 1 + rnd() * 3) * 100) / 100, pres: Math.floor(best / 150), title: titleFor(best), rar: Math.min(5, Math.floor(rnd() * 6)),
    });
  }
  let me = { id: "me", ...meEntry };
  return {
    mock: true,
    async signIn() { return "me"; },
    async put(e) { me = { id: "me", ...e }; },
    async remove() { me = null; },
    async board(kind, mine, n = 50) {
      const field = kind === "all" ? "best" : kind === "week" ? "wbest" : "hit";
      const all = [...players, ...(me ? [{ ...me, ...mine, id: "me" }] : [])].filter((x) => kind !== "week" || x.week === mine.week);
      all.sort((a, b) => b[field] - a[field]);
      const v = mine[field];
      const better = all.filter((x) => x[field] > v).length;
      const above = all.filter((x) => x[field] > v).sort((a, b) => a[field] - b[field])[0] || null;
      const below = all.filter((x) => x[field] < v)[0] || null;
      await new Promise((r) => setTimeout(r, 120));
      return { kind, top: all.slice(0, n).map((x) => ({ ...x, me: x.id === "me" })), rank: better + 1, total: all.length, above, below, uid: "me" };
    },
  };
}
