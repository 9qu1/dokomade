// 巨大な数（上限なし）の扱いと表示。中身は break_infinity.js の Decimal
import Decimal from "./vendor/break_infinity.esm.js";

export { Decimal };
export const D = (x) => (x instanceof Decimal ? x : new Decimal(x ?? 0));
export const ZERO = new Decimal(0);

// 日本式の単位（4桁ごと）。無量大数(1e68)より上は指数表記
const JP = ["", "万", "億", "兆", "京", "垓", "秭", "穣", "溝", "澗", "正", "載", "極", "恒河沙", "阿僧祇", "那由他", "不可思議", "無量大数"];
let mode = "jp"; // jp | sci
export const setNumberMode = (m) => { mode = m === "sci" ? "sci" : "jp"; };

function sig4(v) {
  // 1 ≤ v < 10000 を4桁くらいで
  if (v >= 1000) return Math.floor(v).toString();
  if (v >= 100) return (Math.floor(v * 10) / 10).toString();
  if (v >= 10) return (Math.floor(v * 100) / 100).toString();
  return (Math.floor(v * 1000) / 1000).toString();
}

export function fmt(x) {
  if (typeof x === "number") {
    if (!isFinite(x)) return "∞";
    if (Math.abs(x) < 10000) return Math.floor(x).toLocaleString("ja-JP");
    x = new Decimal(x);
  }
  x = D(x);
  if (x.lt(0)) return "-" + fmt(x.neg());
  if (x.lt(10000)) return Math.floor(x.toNumber()).toLocaleString("ja-JP");
  const e = x.e;
  if (mode === "sci" || e >= 72) {
    return `${(Math.floor(x.m * 100) / 100).toFixed(2)}e${e}`;
  }
  const u = Math.floor(e / 4);
  const v = x.m * Math.pow(10, e - u * 4);
  return sig4(v) + JP[u];
}

// 小数を含む倍率・％用
export function fmtMul(v) {
  if (v instanceof Decimal) return v.lt(1e4) ? `×${trimNum(v.toNumber())}` : `×${fmt(v)}`;
  return v < 1e4 ? `×${trimNum(v)}` : `×${fmt(v)}`;
}
export function trimNum(v) {
  if (v >= 100) return Math.floor(v).toLocaleString("ja-JP");
  if (v >= 10) return (Math.round(v * 10) / 10).toString();
  return (Math.round(v * 100) / 100).toString();
}
export function fmtPct(v) {
  // v は % の値（例 150 → +150%）
  if (v >= 1e6) return `+${fmt(Math.floor(v))}%`;
  if (v >= 100) return `+${Math.floor(v).toLocaleString("ja-JP")}%`;
  return `+${Math.round(v * 10) / 10}%`;
}

export function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h >= 24) return `${Math.floor(h / 24)}日${h % 24}時間`;
  if (h > 0) return `${h}時間${m}分`;
  if (m > 0) return `${m}分${s.toString().padStart(2, "0")}秒`;
  return `${s}秒`;
}

// Decimal を含むオブジェクトの保存・復元
export const toSave = (x) => (x instanceof Decimal ? x.toString() : x);
export const fromSave = (x) => new Decimal(x ?? 0);
