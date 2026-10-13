// ランキング（全国・今週・最強の一撃）。保存先は Firebase（本番）か、手元だけのお試しデータ（localhost）
//   players/{匿名ログインのID} = { name, best, week, wbest, hit, pres, title, rar, at, v }
//   書き込みは3分に1回まで（ルールでも50秒あける・急に伸びすぎた記録ははじく）
import { CONFIG } from "./config.js";
import { titleFor, isDefaultName } from "./data.js";
import { hasNgWord } from "./ngwords.js";

// 週は日本時間の月曜はじまり。キーはその週の月曜日の日付
export function weekKey(t = Date.now()) {
  const d = new Date(t + 9 * 3600e3);
  const day = (d.getUTCDay() + 6) % 7;
  const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  return `${m.getUTCFullYear()}-${String(m.getUTCMonth() + 1).padStart(2, "0")}-${String(m.getUTCDate()).padStart(2, "0")}`;
}
export const KINDS = {
  all: { name: "全国", field: "best", label: "最高到達" },
  week: { name: "今週", field: "wbest", label: "今週の到達" },
  hit: { name: "最強の一撃", field: "hit", label: "一撃" },
};
export function nameProblem(name) {
  const n = String(name || "").trim();
  if (!n) return "名前を入れてください";
  if ([...n].length > 12) return "12文字までにしてください";
  if (hasNgWord(n)) return "その名前は使えません";
  return "";
}
const isLocal = () => /^(localhost|127\.0\.0\.1)$/.test(location.hostname);

export class Ranking {
  constructor(game) {
    this.game = game;
    this.s = game.s;
    this.backend = null;
    this.state = "off"; // off | loading | ready | none（未設定）| error
    this.cache = {};
    this.lastSig = "";
    this.listeners = [];
  }
  on(fn) { this.listeners.push(fn); }
  emit(ev, d) { for (const fn of this.listeners) fn(ev, d); }
  get mock() { return this.backend?.mock; }

  // その週の最高到達（転生で1に戻っても、週の中の最高を覚えておく）
  noteStage(stage) {
    const r = this.s.rank, wk = weekKey();
    if (r.week !== wk) { r.week = wk; r.wbest = stage; }
    else r.wbest = Math.max(r.wbest || 1, stage);
  }
  displayName() {
    const r = this.s.rank;
    if (r.name) return r.name;
    if (!isDefaultName(this.s.name) && !nameProblem(this.s.name)) return this.s.name;
    return `車掌${(this.uid || this.s.rank.uid || "0000").replace(/[^0-9a-z]/gi, "").slice(-4).toUpperCase()}`;
  }
  entry() {
    const s = this.s;
    this.noteStage(s.stage);
    const best = s.bestStage;
    return {
      name: this.displayName(),
      best,
      week: s.rank.week,
      wbest: Math.max(1, Math.min(s.rank.wbest || 1, best)),
      hit: Math.round(Math.min(s.stats.maxHitLog || 0, best * 0.2 + 29) * 100) / 100,
      pres: s.stats.prestiges || 0,
      title: titleFor(best),
      rar: Math.max(-1, Math.min(5, s.stats.bestR ?? -1)),
    };
  }

  async start() {
    if (!this.s.rank.join || this.backend || this.state === "loading") return;
    this.state = "loading";
    try {
      // localhost では本番のランキングを汚さないようにお試しデータを使う（?realrank=1 で本物につなぐ）
      const fb = CONFIG.firebase;
      const real = !isLocal() || new URLSearchParams(location.search).get("realrank") === "1";
      if (fb && fb.projectId && real) this.backend = await (await import("./rank-firebase.js")).create(fb);
      else if (isLocal()) this.backend = (await import("./rank-mock.js")).create(this.entry());
      else { this.state = "none"; return; }
      this.uid = await this.backend.signIn();
      this.s.rank.uid = this.uid;
      this.state = "ready";
      await this.submit(true);
      this.emit("ready");
    } catch (e) {
      console.warn("ランキングの準備に失敗", e);
      this.state = "error";
    }
  }

  // 記録を送る（3分に1回まで・変わっていなければ送らない）
  async submit(force = false) {
    if (this.state !== "ready" || !this.s.rank.join) return false;
    const now = Date.now();
    const e = this.entry();
    const sig = `${e.name}|${e.best}|${e.week}|${e.wbest}|${e.hit}|${e.pres}|${e.rar}`;
    if (sig === this.lastSig) return false;
    const since = now - (this.s.rank.last || 0);
    if (since < 55e3 || (!force && since < 180e3)) return false;
    try {
      await this.backend.put(e);
      this.lastSig = sig;
      this.s.rank.last = now;
      this.cache = {};
      return true;
    } catch (err) {
      console.warn("ランキングの送信に失敗", err);
      return false;
    }
  }

  // 一覧と自分の順位。2分間は同じ結果を使う
  async board(kind = "all", force = false) {
    if (this.state !== "ready") return null;
    const c = this.cache[kind];
    if (!force && c && Date.now() - c.t < 120e3) return c.v;
    const me = this.entry();
    const v = await this.backend.board(kind, me, 50);
    v.me = me;
    v.pct = v.total ? Math.max(0.01, (v.rank / v.total) * 100) : 100;
    this.cache[kind] = { t: Date.now(), v };
    // 全国の順位が上がったら知らせる
    if (kind === "all") {
      const prev = this.s.rank.lastRank || 0;
      if (prev && v.rank < prev) this.emit("up", { from: prev, to: v.rank, passed: v.passed || null });
      this.s.rank.lastRank = v.rank;
    }
    return v;
  }

  async rename(name) {
    const p = nameProblem(name);
    if (p) return p;
    this.s.rank.name = name.trim();
    this.lastSig = "";
    this.s.rank.last = Math.min(this.s.rank.last || 0, Date.now() - 56e3); // 名前の変更はすぐ送る（ルールの50秒は守る）
    await this.submit(true);
    return "";
  }
  async leave() {
    try { await this.backend?.remove(); } catch (e) { console.warn(e); }
    this.s.rank.join = false;
    this.state = "off";
    this.backend = null;
    this.cache = {};
  }
  async rejoin() {
    this.s.rank.join = true;
    this.lastSig = "";
    this.s.rank.last = 0;
    await this.start();
  }
}
