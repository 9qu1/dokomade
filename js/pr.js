// デモ版の広告枠：くぁくぁのほかのサイトの紹介（広告会社の広告は出さない）
//   バナー（各パネルのいちばん下・PC の左の列）と、「広告を見る」ボタンの数秒の紹介画面（ads.js の pr）で使う
//   絵は 9qu1.com のトップ（自作アプリのまとめ）と同じもの: assets/pr/<id>.webp（画面写真）・<id>-icon.webp
export const PR_SITES = [
  { id: "rikaido", name: "リカイド", catch: "友達の理解度チェック", desc: "2択のじぶんクイズを作って友達にシェア。「本人ならどっち？」を予想して、正解数でランキング。", url: "https://rikaido.me/", cta: "つくってみる" },
  { id: "tokumasu", name: "トクマス", catch: "毎日3問のパズル", desc: "ナンプレ・クロスワード・ノノグラムが毎日1問ずつ届く。解くとポイントが貯まる。", url: "https://tokumasu.net/", cta: "遊んでみる" },
  { id: "nakamido", name: "ナカミド", catch: "あなたの中身を、ちゃんと測る", desc: "ひとりで答える診断、友達に答えてもらう診断、反応の速さのテスト。登録なしで無料。", url: "https://nakamido.com/", cta: "診断してみる" },
  { id: "amayadori", name: "アマヤドリ", catch: "雨音とポモドーロで集中", desc: "雨・焚き火・タイピングの音を流しながら、ポモドーロタイマーで集中できる夜の部屋。", url: "https://9qu1.com/amayadori/", cta: "使ってみる" },
];
export const PR_MORE = { name: "くぁくぁのつくったもの", url: "https://9qu1.com/" };

// どのサイトが出るかは順番に回す（同じ場所はしばらく同じサイトのまま＝描き直しでチラつかない）
let order = shuffle(PR_SITES.map((_, i) => i));
let next = 0;
const held = new Map(); // 場所 → { site, t }
const HOLD_MS = 60e3;
export function pickPr(where = "") {
  const h = held.get(where);
  if (where && h && Date.now() - h.t < HOLD_MS) return h.site;
  if (next >= order.length) { order = shuffle(order); next = 0; }
  const site = PR_SITES[order[next++]];
  if (where) held.set(where, { site, t: Date.now() });
  return site;
}
// どこから来たかが分かるように、リンクに印を付ける（各サイトのアクセス解析で見える）
export function prHref(s, where) {
  const u = new URL(s.url);
  u.searchParams.set("utm_source", "dokomade");
  u.searchParams.set("utm_medium", "pr");
  if (where) u.searchParams.set("utm_content", where);
  return u.toString();
}
// 横長のバナー（画面写真・名前・ひとこと）。compact は写真なしの細い帯（PC の左の列の空きに入れる）
export function prBannerHtml(where, compact = false) {
  const s = pickPr(where);
  if (compact) {
    return `<a class="pr-banner pr-compact" href="${prHref(s, where)}" target="_blank" rel="noopener" aria-label="${s.name}（${s.catch}）を開く">
    <span class="pr-tag">PR</span><img class="pr-cicon" src="assets/pr/${s.id}-icon.webp" alt="">
    <span class="pr-text"><b>${s.name}</b><small>${s.catch}</small></span><em class="pr-cgo">${s.cta} ›</em>
  </a>`;
  }
  return `<a class="pr-banner" href="${prHref(s, where)}" target="_blank" rel="noopener" aria-label="${s.name}（${s.catch}）を開く">
    <span class="pr-tag">PR</span>
    <span class="pr-shot" style="background-image:url('assets/pr/${s.id}.webp')"><img class="pr-icon" src="assets/pr/${s.id}-icon.webp" alt=""></span>
    <span class="pr-text"><b>${s.name}</b><small>${s.catch}</small><em>${s.cta} ›</em></span>
  </a>
  <a class="pr-more" href="${prHref(PR_MORE, where)}" target="_blank" rel="noopener">ほかの作品も見る（${PR_MORE.name}）›</a>`;
}

function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}
