// ランキングの保存先：Firebase（匿名ログイン＋Firestore Lite）。SDK は Google の CDN から、使うときだけ読み込む
const SDK = "https://www.gstatic.com/firebasejs/12.19.0";

export async function create(cfg) {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore-lite.js`),
  ]);
  const app = initializeApp(cfg, "dokomade-rank");
  const auth = A.getAuth(app);
  const db = F.getFirestore(app);
  const col = F.collection(db, "players");
  let uid = null;
  const val = (d, f) => d.data()[f];
  const row = (d) => ({ id: d.id, ...d.data() });

  return {
    mock: false,
    async signIn() {
      // 前に匿名ログインしていればそれを使う（端末ごとに1人）
      uid = await new Promise((res) => { const off = A.onAuthStateChanged(auth, (u) => { off(); res(u ? u.uid : null); }); });
      if (!uid) uid = (await A.signInAnonymously(auth)).user.uid;
      return uid;
    },
    async put(e) {
      await F.setDoc(F.doc(db, "players", uid), { ...e, at: F.serverTimestamp(), v: 1 });
    },
    async remove() {
      await F.deleteDoc(F.doc(db, "players", uid));
    },
    async board(kind, me, n = 50) {
      const field = kind === "all" ? "best" : kind === "week" ? "wbest" : "hit";
      const base = kind === "week" ? [F.where("week", "==", me.week)] : [];
      const mine = me[field];
      const [top, better, total, above, below] = await Promise.all([
        F.getDocs(F.query(col, ...base, F.orderBy(field, "desc"), F.limit(n))),
        F.getCount(F.query(col, ...base, F.where(field, ">", mine))),
        F.getCount(F.query(col, ...base)),
        F.getDocs(F.query(col, ...base, F.where(field, ">", mine), F.orderBy(field, "asc"), F.limit(1))),
        F.getDocs(F.query(col, ...base, F.where(field, "<", mine), F.orderBy(field, "desc"), F.limit(1))),
      ]);
      return {
        kind,
        top: top.docs.map(row).map((x) => ({ ...x, me: x.id === uid })),
        rank: better.data().count + 1,
        total: Math.max(total.data().count, better.data().count + 1),
        above: above.docs[0] ? row(above.docs[0]) : null,
        below: below.docs[0] ? row(below.docs[0]) : null,
        uid,
      };
    },
  };
}
