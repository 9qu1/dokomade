// 公開のときに変える設定はここだけ
export const CONFIG = {
  // デモ版（9qu1.com の下で広告会社の広告なしに公開）。true のあいだ「デモ版」の表示を出す
  demo: true,
  // シェアのリンク先（空なら今のページのURL）
  siteUrl: "https://9qu1.com/dokomade/",
  // ランキングの保存先（Firebase のウェブアプリの設定）。空のあいだは、localhost ではお試しデータ・公開サイトでは「準備中」
  //   例: { apiKey: "...", authDomain: "xxxx.firebaseapp.com", projectId: "xxxx", appId: "..." }
  firebase: {apiKey: "AIzaSyDiaQDRcuoXnJWKVIYvYJhCNxd9fES2HZA", authDomain: "dokomade-ressha.firebaseapp.com", projectId: "dokomade-ressha", appId: "1:505664096098:web:d3f9a83151e110df804e3b"},
  // リワード広告（動画）
  //   provider: "pr"（デモ版：作者のほかのサイトの紹介を数秒）| "mock"（テスト表示）| "free"（広告なしで報酬だけ）
  //             | "gpt"（Google アド マネージャーのリワード広告）| "h5"（AdSense H5 Games Ads）
  ads: {
    provider: "pr",
    prSeconds: 5,
    mockSeconds: 5,
    gptAdUnitPath: "",   // 例: "/23368764337/dokomade_rewarded"
    h5ClientId: "",      // 例: "ca-pub-xxxxxxxxxxxxxxxx"
    grantOnNoFill: true, // 広告が在庫切れのときは報酬だけ渡す（遊ぶ人を待たせない）
  },
};
