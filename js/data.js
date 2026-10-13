// ゲームの素材データ（名前・並び・確率）。数式は balance.js
export const GAME_TITLE = "ドコマデ列車";
export const HASHTAG = "ドコマデ列車";
export const DEFAULT_NAMES = ["車掌", "勇者"]; // 名前を決めていない人（「勇者」は旧版の初期値）
export const isDefaultName = (n) => !n || DEFAULT_NAMES.includes(n);

// ---------- 距離（1ステージ＝10km。記録・ランキング・シェアはすべて km で見せる） ----------
export const KM_PER_STAGE = 10;
export const kmOf = (stage) => Math.max(0, Math.floor(stage)) * KM_PER_STAGE;
export const kmText = (stage) => `${kmOf(stage).toLocaleString("ja-JP")}km`;
// 身近な距離とのくらべ（通過したらお知らせ・シェア文にも入れる）。鉄道は営業キロ
export const DISTANCE_MARKS = [
  { km: 34.5, name: "山手線1周", note: "34.5km" },
  { km: 366, name: "東京→名古屋", note: "新幹線で366km" },
  { km: 552.6, name: "東京→新大阪", note: "新幹線で552.6km" },
  { km: 1174.9, name: "東京→博多", note: "新幹線で1,174.9km" },
  { km: 3000, name: "日本列島の端から端", note: "約3,000km" },
  { km: 10000, name: "東京→ニューヨーク", note: "約1万km" },
  { km: 20000, name: "地球半周", note: "約2万km" },
  { km: 40075, name: "地球1周", note: "赤道で約4万km" },
  { km: 384400, name: "月まで", note: "約38万km" },
];
export const markFor = (stage) => { const k = kmOf(stage); let m = null; for (const x of DISTANCE_MARKS) if (k >= x.km) m = x; return m; };

// ---------- レアリティ ----------
export const RARITIES = [
  { key: "N", name: "N", label: "ノーマル", color: "#aab4c3", main: 10, subs: 0, sell: 1 },
  { key: "R", name: "R", label: "レア", color: "#4db4ff", main: 20, subs: 0, sell: 3 },
  { key: "SR", name: "SR", label: "スーパーレア", color: "#c07cff", main: 40, subs: 1, sell: 10 },
  { key: "SSR", name: "SSR", label: "ダブルスーパーレア", color: "#ffd23f", main: 80, subs: 2, sell: 40 },
  { key: "UR", name: "UR", label: "ウルトラレア", color: "#ff5bd0", main: 160, subs: 3, sell: 150 },
  { key: "LR", name: "LR", label: "レジェンド", color: "#ffffff", main: 320, subs: 4, sell: 600 },
];
export const R_N = 0, R_R = 1, R_SR = 2, R_SSR = 3, R_UR = 4, R_LR = 5;

// ---------- 装備 ----------
// 部位の key は保存データと共通（weapon/head/body/acc）。見せる名前だけ列車の部品にしてある
export const SLOTS = [
  { key: "weapon", name: "主砲", main: "atk", weight: 30 },
  { key: "head", name: "ライト", main: "critDmg", weight: 22 },
  { key: "body", name: "連結器", main: "dps", weight: 26 },
  { key: "acc", name: "お守り", main: "gold", weight: 22 },
];
export const STATS = {
  atk: { name: "攻撃力", fmt: "pct" },
  dps: { name: "車両の力", fmt: "pct" },
  tap: { name: "タップ攻撃", fmt: "pct" },
  crit: { name: "会心率", fmt: "pt" },
  critDmg: { name: "会心ダメージ", fmt: "pct" },
  gold: { name: "ゴールド", fmt: "pct" },
  drop: { name: "ドロップ率", fmt: "pct" },
  boss: { name: "ボス特効", fmt: "pct" },
};
export const SUB_POOL = ["atk", "dps", "tap", "crit", "critDmg", "gold", "drop", "boss"];

export const ICONS = {
  weapon: ["p_w_cannon", "p_w_twin", "p_w_magic", "p_w_ballista", "p_w_steam"],
  head: ["p_h_lantern", "p_h_headlamp", "p_h_magiclamp", "p_h_search", "p_h_crystal"],
  body: ["p_b_iron", "p_b_chain", "p_b_gold", "p_b_rune", "p_b_bone"],
  acc: ["p_a_cat", "p_a_horseshoe", "p_a_clover", "p_a_daruma", "i_a_omamori"],
};
export const ICON_BASE = {
  p_w_cannon: "大砲", p_w_twin: "連装砲", p_w_magic: "魔導砲", p_w_ballista: "バリスタ", p_w_steam: "蒸気砲",
  p_h_lantern: "カンテラ", p_h_headlamp: "前照灯", p_h_magiclamp: "魔法のランプ", p_h_search: "探照灯", p_h_crystal: "水晶灯",
  p_b_iron: "連結器", p_b_chain: "鎖連結器", p_b_gold: "飾り連結器", p_b_rune: "ルーン連結器", p_b_bone: "竜骨連結器",
  p_a_cat: "招き猫", p_a_horseshoe: "蹄鉄", p_a_clover: "四つ葉", p_a_daruma: "だるま", i_a_omamori: "お守り",
};
// 旧版（勇者の装備）の絵 → 列車の部品。セーブの読み込みで置きかえる
export const OLD_ICON_MAP = {
  i_w_sword: "p_w_cannon", i_w_greatsword: "p_w_twin", i_w_katana: "p_w_magic", i_w_spear: "p_w_ballista", i_w_axe: "p_w_steam",
  i_w_hammer: "p_w_cannon", i_w_bow: "p_w_ballista", i_w_staff: "p_w_magic", i_w_dagger: "p_w_twin", i_w_scythe: "p_w_steam",
  i_h_cap: "p_h_lantern", i_h_helm: "p_h_headlamp", i_h_hat: "p_h_magiclamp", i_h_kabuto: "p_h_search", i_h_crown: "p_h_crystal",
  i_b_leather: "p_b_iron", i_b_chain: "p_b_chain", i_b_plate: "p_b_gold", i_b_robe: "p_b_rune", i_b_dragon: "p_b_bone",
  i_a_ring: "p_a_cat", i_a_amulet: "p_a_horseshoe", i_a_bracelet: "p_a_clover", i_a_feather: "p_a_daruma",
  i_l_holysword: "p_l_dragoncannon", i_l_demonsword: "p_l_starcannon", i_l_rainbowbow: "p_l_railgun", i_l_cosmicstaff: "p_l_starcannon",
  i_l_godkatana: "p_l_railgun", i_l_suncrown: "p_l_sunlamp", i_l_dragonarmor: "p_l_engine", i_l_infinityring: "p_l_ticket",
};
export const OLD_ICON_BASE = {
  i_w_sword: "剣", i_w_greatsword: "大剣", i_w_katana: "刀", i_w_spear: "槍", i_w_axe: "斧", i_w_hammer: "ハンマー", i_w_bow: "弓", i_w_staff: "杖", i_w_dagger: "短剣", i_w_scythe: "大鎌",
  i_h_cap: "帽子", i_h_helm: "兜", i_h_hat: "とんがり帽子", i_h_kabuto: "武者兜", i_h_crown: "冠",
  i_b_leather: "レザーベスト", i_b_chain: "鎖かたびら", i_b_plate: "鎧", i_b_robe: "ローブ", i_b_dragon: "スケイルメイル",
  i_a_ring: "指輪", i_a_amulet: "首飾り", i_a_bracelet: "腕輪", i_a_omamori: "お守り", i_a_feather: "羽根飾り",
};
export const PREFIX = [
  ["木の", "古びた", "錆びた", "見習いの", "安物の"],
  ["鉄の", "鋼の", "兵士の", "旅人の", "銅の"],
  ["ミスリルの", "騎士の", "魔法の", "銀の", "疾風の"],
  ["聖銀の", "英雄の", "黄金の", "炎帝の", "氷帝の", "雷神の"],
  ["竜殺しの", "星降る", "覇王の", "月光の", "天空の", "神速の", "深淵の"],
];
// LR は専用の見た目と名前
export const LEGENDS = [
  { icon: "p_l_dragoncannon", slot: "weapon", name: "竜砲ヴォルカノン" },
  { icon: "p_l_starcannon", slot: "weapon", name: "星砲ステラノヴァ" },
  { icon: "p_l_railgun", slot: "weapon", name: "雷光レールガン" },
  { icon: "p_l_sunlamp", slot: "head", name: "日輪の前照灯" },
  { icon: "p_l_engine", slot: "body", name: "永久機関の連結器" },
  { icon: "p_l_ticket", slot: "acc", name: "無限の乗車券" },
];

// ---------- 車両（クッキークリッカーの「施設」にあたる）。1両ごとに乗務員が屋根から攻撃する ----------
// id は乗務員の元絵（保存データの並びと共通）、car は車両の絵、crew は屋根に乗る小さい絵、who は乗務員
export const COMPANIONS = [
  { id: "c01_mage", car: "t_c01_mage", crew: "k01_mage", name: "星見の魔法車", who: "見習い魔女ミミ", cost: 10, dps: 1.6, fx: "magic", line: "ほうきより速い乗り物を見つけた" },
  { id: "c02_archer", car: "t_c02_archer", crew: "k02_archer", name: "森の狩人車", who: "エルフの射手リーフ", cost: 90, dps: 9, fx: "arrow", line: "揺れても百発百中（自称）" },
  { id: "c03_cleric", car: "t_c03_cleric", crew: "k03_cleric", name: "聖堂車", who: "聖女セレナ", cost: 850, dps: 60, fx: "holy", line: "祈りで殴る" },
  { id: "c04_ninja", car: "t_c04_ninja", crew: "k04_ninja", name: "忍び車", who: "忍カゲマル", cost: 8000, dps: 390, fx: "shuriken", line: "もう前の車両にいる" },
  { id: "c05_samurai", car: "t_c05_samurai", crew: "k05_samurai", name: "天守車", who: "侍ムサシノ", cost: 8.5e4, dps: 2800, fx: "slash", line: "斬れぬものなし（線路以外）" },
  { id: "c06_monk", car: "t_c06_monk", crew: "k06_monk", name: "道場車", who: "拳法家ラン", cost: 1e6, dps: 2.1e4, fx: "punch", line: "揺れる屋根で足腰を鍛える" },
  { id: "c07_alchemist", car: "t_c07_alchemist", crew: "k07_alchemist", name: "錬金車", who: "錬金術師ポポ", cost: 1.4e7, dps: 1.7e5, fx: "potion", line: "だいたい爆発する" },
  { id: "c08_bard", car: "t_c08_bard", crew: "k08_bard", name: "劇場車", who: "吟遊詩人カノン", cost: 2.2e8, dps: 1.5e6, fx: "note", line: "車内アナウンスも歌う" },
  { id: "c09_dragoon", car: "t_c09_dragoon", crew: "k09_dragoon", name: "竜騎車", who: "竜騎士ガイア", cost: 4e9, dps: 1.5e7, fx: "lance", line: "屋根から跳ぶ" },
  { id: "c10_golem", car: "t_c10_golem", crew: "k10_golem", name: "岩石車", who: "ゴーレムのゴロ", cost: 8e10, dps: 1.6e8, fx: "rock", line: "…（重さで線路がきしむ）" },
  { id: "c11_robot", car: "t_c11_robot", crew: "k11_robot", name: "機甲車", who: "機甲兵MK-II", cost: 2e12, dps: 2e9, fx: "beam", line: "定刻ドオリ殲滅シマス" },
  { id: "c12_dragon", car: "t_c12_dragon", crew: "k12_dragon", name: "竜の車両", who: "ちびドラゴンのボム", cost: 6e13, dps: 3e10, fx: "fire", line: "がおー（ボイラーも温める）" },
];

// ---------- タップ強化（クッキークリッカーの「クリックの強化」にあたる） ----------
// base はゴールド（SCALE をかける前）・growth は1レベルごとの値上がり・max 0 は上限なし
export const TAP_UPS = [
  { id: "power", name: "指の力", icon: "👆", base: 200, growth: 1.14, max: 0, what: "タップの基本ダメージ" },
  { id: "link", name: "車両の応援", icon: "📣", base: 1500, growth: 1.22, max: 0, what: "タップに車両のDPSを上乗せ" },
  { id: "crit", name: "会心の指", icon: "💥", base: 800, growth: 1.45, max: 40, what: "タップの会心率" },
  { id: "critDmg", name: "会心の極み", icon: "⚡", base: 1200, growth: 1.2, max: 0, what: "タップの会心ダメージ" },
  { id: "combo", name: "連打の達人", icon: "🔥", base: 3000, growth: 1.4, max: 40, what: "コンボの上限と1コンボの効果" },
  { id: "echo", name: "分身タップ", icon: "👥", base: 5000, growth: 1.45, max: 20, what: "分身がもう1回当てる確率" },
  { id: "gold", name: "金の指", icon: "🪙", base: 2500, growth: 1.3, max: 50, what: "タップするたびにゴールド" },
  { id: "auto", name: "オートタップ", icon: "🤖", base: 20000, growth: 1.7, max: 20, what: "自動で1秒に0.5回ずつタップ" },
];
// ---------- 必殺技（待ち時間つき・機関車のレベルで解放） ----------
export const SKILLS = [
  { id: "meteor", name: "流星群", icon: "☄️", unlock: 15, cd: 60, base: 5000, growth: 1.6, what: "DPSの20秒分を一気にたたき込む" },
  { id: "rush", name: "汽笛ラッシュ", bar: "汽笛<wbr>ラッシュ", icon: "📯", unlock: 40, cd: 90, base: 60000, growth: 1.7, what: "8秒間、1秒に15回の自動タップ（コンボも増える）" },
  { id: "midas", name: "黄金の石炭", bar: "黄金の<wbr>石炭", icon: "💰", unlock: 70, cd: 120, base: 800000, growth: 1.8, what: "15秒間、タップのゴールドが10倍（金の指がないときも少し出る）" },
  { id: "freeze", name: "時刻表の魔法", bar: "時刻表の<wbr>魔法", icon: "⏱", unlock: 100, cd: 180, base: 1e7, growth: 1.9, what: "10秒間、ボスの制限時間が止まる" },
];
export const COMBO_TIERS = [10, 25, 50, 100, 200, 300, 500, 1000];

// ---------- 機関車の改造（レベルで解放） ----------
export const HERO_SKILLS = [
  { lv: 10, name: "照準器", desc: "会心率 +5%", eff: { crit: 5 } },
  { lv: 25, name: "強化ピストン", desc: "タップ攻撃 ×2", eff: { tapMul: 2 } },
  { lv: 50, name: "太い連結棒", desc: "車両の力 ×2", eff: { compMul: 2 } },
  { lv: 75, name: "金の煙突", desc: "ゴールド ×1.5", eff: { goldMul: 1.5 } },
  { lv: 100, name: "魔導ボイラー", desc: "全ダメージ ×2", eff: { allMul: 2 } },
  { lv: 125, name: "特製レンズ", desc: "会心ダメージ +100%", eff: { critDmg: 100 } },
  { lv: 150, name: "双発エンジン", desc: "タップ攻撃 ×3", eff: { tapMul: 3 } },
  { lv: 200, name: "長編成の心得", desc: "車両の力 ×3", eff: { compMul: 3 } },
  { lv: 250, name: "黄金の釜", desc: "ゴールド ×2", eff: { goldMul: 2 } },
  { lv: 300, name: "超魔導ボイラー", desc: "全ダメージ ×3", eff: { allMul: 3 } },
];

// ---------- 世界 ----------
export const STAGES_PER_BIOME = 25;
export const BIOMES = [
  { id: "bg01_meadow", name: "はじまりの草原", mons: ["m01_slime", "m02_bat", "m03_mushroom", "m04_goblin", "m05_wolf"], boss: "b01_kingslime", sky: "#6fb8ff" },
  { id: "bg02_forest", name: "まどろみの森", mons: ["m03_mushroom", "m09_treant", "m05_wolf", "m11_harpy", "m04_goblin"], boss: "b02_minotaur", sky: "#2f6b4a" },
  { id: "bg03_desert", name: "灼熱の砂漠", mons: ["m13_scorpion", "m20_mummy", "m08_lizardman", "m02_bat", "m19_eyeball"], boss: "b05_serpent", sky: "#f2a650" },
  { id: "bg04_snow", name: "氷雪の峰", mons: ["m14_yeti", "m05_wolf", "m07_ghost", "m18_crystal", "m24_cyclops"], boss: "b06_frostwyrm", sky: "#b8d8f0" },
  { id: "bg05_volcano", name: "紅蓮の火山", mons: ["m15_firespirit", "m17_imp", "m12_orc", "m08_lizardman", "m24_cyclops"], boss: "b03_dragon", sky: "#6a1a14" },
  { id: "bg06_sky", name: "天空の浮島", mons: ["m11_harpy", "m02_bat", "m19_eyeball", "m22_tengu", "m07_ghost"], boss: "b08_phoenix", sky: "#ffb27a" },
  { id: "bg07_crystal", name: "水晶の大空洞", mons: ["m18_crystal", "m19_eyeball", "m07_ghost", "m10_mimic", "m06_skeleton"], boss: "b07_titan", sky: "#2a2350" },
  { id: "bg08_shrine", name: "黄昏の神社", mons: ["m21_oni", "m22_tengu", "m23_kappa", "m07_ghost", "m03_mushroom"], boss: "b09_orochi", sky: "#e07a5f" },
  { id: "bg09_castle", name: "魔王城", mons: ["m16_darkknight", "m06_skeleton", "m17_imp", "m10_mimic", "m24_cyclops"], boss: "b04_lich", sky: "#2b1638" },
  { id: "bg10_cosmos", name: "世界の果て", mons: ["m19_eyeball", "m18_crystal", "m07_ghost", "m16_darkknight", "m15_firespirit"], boss: "b10_demonlord", sky: "#0b0820" },
];
export const MONSTERS = {
  m01_slime: "スライム", m02_bat: "コウモリン", m03_mushroom: "ドクキノコ", m04_goblin: "ゴブリン", m05_wolf: "ダイアウルフ",
  m06_skeleton: "スケルトン兵", m07_ghost: "ゴースト", m08_lizardman: "リザードマン", m09_treant: "トレント", m10_mimic: "ミミック",
  m11_harpy: "ハーピー", m12_orc: "オーク", m13_scorpion: "デススコーピオン", m14_yeti: "イエティ", m15_firespirit: "ほのおの精",
  m16_darkknight: "暗黒騎士", m17_imp: "インプ", m18_crystal: "クリスタルゴーレム", m19_eyeball: "ゲイザー", m20_mummy: "マミー",
  m21_oni: "赤鬼", m22_tengu: "天狗", m23_kappa: "河童", m24_cyclops: "サイクロプス",
};
// 飛んでいる敵（地面から少し浮かせる）
export const FLYING = new Set(["m02_bat", "m07_ghost", "m11_harpy", "m17_imp", "m19_eyeball", "m15_firespirit", "b08_phoenix", "c12_dragon"]);
export const BOSSES = {
  b01_kingslime: "大王スライム", b02_minotaur: "ミノタウロス", b03_dragon: "紅蓮竜ヴォルカ", b04_lich: "冥王リッチ", b05_serpent: "砂海の大蛇",
  b06_frostwyrm: "氷竜フロスト", b07_titan: "古代巨神", b08_phoenix: "黒炎の不死鳥", b09_orochi: "ヤマタノオロチ", b10_demonlord: "魔王ゼノス",
};
// 周回ごとの名前の頭（1周＝250ステージ）
export const LOOP_PREFIX = ["", "裏・", "真・", "極・", "神・"];
export const loopPrefix = (loop) => (loop < LOOP_PREFIX.length ? LOOP_PREFIX[loop] : `神${loop - 3}・`);

// ---------- 称号（最高到達ステージ。1ステージ＝10km） ----------
export const TITLES = [
  [1, "見習い車掌"], [25, "駆け出し運転士"], [50, "一人前の運転士"], [100, "ベテラン運転士"], [150, "特急の運転士"],
  [200, "名物運転士"], [300, "鉄道王"], [500, "伝説の運転士"], [750, "生ける伝説"], [1000, "大陸横断王"],
  [1500, "星をめざす車掌"], [2000, "地球半周の旅人"], [3000, "次元の旅人"], [4008, "地球を一周した者"], [10000, "無限の向こう側"],
];
export const titleFor = (stage) => { let t = TITLES[0][1]; for (const [s, n] of TITLES) if (stage >= s) t = n; return t; };

// 到達記念（シェアを促すタイミング）
export const MILESTONES = [10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 7500, 10000];

// ---------- ガチャ ----------
export const GACHA = {
  single: 30, ten: 300,
  // R, SR, SSR, UR, LR の順（%）。N は出ない
  rates: [55, 33.7, 9, 2, 0.3],
  upRates: [43.7, 33.7, 18, 4, 0.6], // 確率アップ（広告）・シェア召喚
  pity: 80, // この回数 UR 以上が出なければ次は UR 以上確定
};
// 敵のドロップのレアリティ（%）N,R,SR,SSR,UR
export const DROP_RATES = [62, 27, 9, 1.7, 0.3];
export const BOSS_DROP_RATES = [0, 45, 40, 12, 3];

// ---------- ブースト（広告） ----------
export const BOOSTS = {
  speed: { name: "2倍速", desc: "ゲームが2倍の速さで進む", hours: 24, max: 24, icon: "⏩" },
  drop: { name: "ドロップ率2倍", desc: "装備を拾う確率が2倍", hours: 2, max: 12, icon: "🎁" },
  gold: { name: "ゴールド2倍", desc: "手に入るゴールドが2倍", hours: 2, max: 12, icon: "💰" },
};
export const AD_LIMITS = { gachaUp: 3, adGacha: 5, gems: 3 }; // 1日の上限

// ---------- 実績 ----------
export const ACHIEVEMENTS = [
  { id: "st10", name: "出発進行", desc: "100kmに到達", test: (s) => s.bestStage >= 10, gems: 20 },
  { id: "st50", name: "一人前", desc: "500kmに到達", test: (s) => s.bestStage >= 50, gems: 50 },
  { id: "st100", name: "千キロの壁", desc: "1,000kmに到達", test: (s) => s.bestStage >= 100, gems: 100 },
  { id: "st200", name: "長距離列車", desc: "2,000kmに到達", test: (s) => s.bestStage >= 200, gems: 150 },
  { id: "st500", name: "伝説", desc: "5,000kmに到達", test: (s) => s.bestStage >= 500, gems: 300 },
  { id: "st1000", name: "大陸横断", desc: "1万kmに到達", test: (s) => s.bestStage >= 1000, gems: 500 },
  { id: "tap100", name: "連打の入口", desc: "100回タップ", test: (s) => s.stats.taps >= 100, gems: 10 },
  { id: "tap5000", name: "指が本体", desc: "5,000回タップ", test: (s) => s.stats.taps >= 5000, gems: 50 },
  { id: "kill1000", name: "千体撃破", desc: "敵を1,000体倒す", test: (s) => s.stats.kills >= 1000, gems: 30 },
  { id: "kill10000", name: "万体撃破", desc: "敵を10,000体倒す", test: (s) => s.stats.kills >= 10000, gems: 100 },
  { id: "pull10", name: "はじめての召喚", desc: "召喚を10回", test: (s) => s.stats.pulls >= 10, gems: 20 },
  { id: "pull100", name: "召喚士", desc: "召喚を100回", test: (s) => s.stats.pulls >= 100, gems: 100 },
  { id: "ssr", name: "金色の光", desc: "SSRを手に入れる", test: (s) => s.stats.bestR >= 3, gems: 30 },
  { id: "ur", name: "虹色の光", desc: "URを手に入れる", test: (s) => s.stats.bestR >= 4, gems: 100 },
  { id: "lr", name: "伝説の降臨", desc: "LRを手に入れる", test: (s) => s.stats.bestR >= 5, gems: 300 },
  { id: "comp12", name: "全車両連結", desc: "12種類の車両をすべて連結する", test: (s) => s.comp.every((l) => l > 0), gems: 100 },
  { id: "prestige1", name: "生まれ変わり", desc: "はじめて転生する", test: (s) => s.stats.prestiges >= 1, gems: 100 },
  { id: "combo100", name: "百連打", desc: "100コンボ", test: (s) => (s.stats.maxCombo || 0) >= 100, gems: 30 },
  { id: "combo500", name: "指が止まらない", desc: "500コンボ", test: (s) => (s.stats.maxCombo || 0) >= 500, gems: 100 },
  { id: "combo1000", name: "千手観音", desc: "1000コンボ", test: (s) => (s.stats.maxCombo || 0) >= 1000, gems: 300 },
  { id: "fever10", name: "フィーバー常連", desc: "タップフィーバーを10回", test: (s) => (s.stats.fevers || 0) >= 10, gems: 30 },
  { id: "skill50", name: "必殺技マスター", desc: "必殺技を50回使う", test: (s) => (s.stats.skillUses || 0) >= 50, gems: 50 },
  { id: "man", name: "万を超えて", desc: "1回で1万ダメージ", test: (s) => s.stats.maxHitLog >= 4, gems: 10 },
  { id: "oku", name: "億の一撃", desc: "1回で1億ダメージ", test: (s) => s.stats.maxHitLog >= 8, gems: 30 },
  { id: "cho", name: "兆の一撃", desc: "1回で1兆ダメージ", test: (s) => s.stats.maxHitLog >= 12, gems: 50 },
  { id: "muryo", name: "無量大数", desc: "1回で無量大数ダメージ", test: (s) => s.stats.maxHitLog >= 68, gems: 500 },
  { id: "share1", name: "自慢したい", desc: "はじめてシェアする", test: (s) => s.stats.shares >= 1, gems: 30 },
  { id: "lucky10", name: "黄金の出会い", desc: "黄金スライムを10回つかまえる", test: (s) => s.stats.lucky >= 10, gems: 30 },
];

// ---------- ニュース（クッキークリッカーの速報ティッカー風） ----------
export const NEWS = [
  "【速報】近所のスライム、なぜか年々強くなっている模様",
  "【天気】明日は所により宝箱が降るでしょう",
  "【経済】ゴールドのインフレ止まらず、パン1個が1億ゴールドに",
  "【悲報】魔王、列車がどこまで来るのか怯えている",
  "【特集】召喚の光が虹色だったときの正しい叫び方",
  "【街の声】「あの列車、寝てる間も走ってるらしいよ」",
  "【研究】タップの速さと会心率に関係はない（たぶん）",
  "【求人】乗務員募集。条件：揺れに強い人",
  "【注意】黄金スライムを見かけたらすぐタップしてください",
  "【芸能】吟遊詩人カノン、新曲『インフレの向こう側』発表",
  "【科学】無量大数の次の単位、まだ決まらず",
  "【スポーツ】忍カゲマル、走る列車の屋根で100m走。記録は時速80km",
  "【交通】ドコマデ列車、本日も定刻どおり（魔物の都合を除く）",
  "【グルメ】車内販売の駅弁、ゴールド払いで大人気",
  "【お願い】線路の上で昼寝をしないでください（スライムの皆さまへ）",
  "【鉄道】次の駅がどこにあるのか、運転士も知らない",
];
