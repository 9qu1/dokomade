// 効果音：WebAudio でその場で合成する（音声ファイルなし・ファミコン風）
let ac = null, master = null, rev = null, enabled = true, noiseBuf = null;

export function setSound(on) { enabled = !!on; if (master) master.gain.value = on ? 0.55 : 0; }
export function unlockAudio() {
  if (ac) { if (ac.state === "suspended") ac.resume(); return; }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain();
    master.gain.value = enabled ? 0.55 : 0;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6;
    master.connect(comp); comp.connect(ac.destination);
    // 残響
    rev = ac.createConvolver();
    const len = ac.sampleRate * 1.6, ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    rev.buffer = ir;
    const rg = ac.createGain(); rg.gain.value = 0.35; rev.connect(rg); rg.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  } catch { ac = null; }
}
const ok = () => ac && enabled && ac.state === "running";

function tone({ type = "square", f = 440, f2 = null, dur = 0.1, vol = 0.15, at = 0.004, delay = 0, reverb = false, detune = 0 }) {
  if (!ok()) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator(), gn = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  gn.gain.setValueAtTime(0.0001, t);
  gn.gain.exponentialRampToValueAtTime(vol, t + at);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(gn); gn.connect(master); if (reverb) gn.connect(rev);
  o.start(t); o.stop(t + dur + 0.05);
}
function noise({ dur = 0.2, vol = 0.2, type = "lowpass", f = 1200, f2 = null, q = 1, delay = 0, at = 0.005, reverb = false }) {
  if (!ok()) return;
  const t = ac.currentTime + delay;
  const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const gn = ac.createGain();
  gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(vol, t + at); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(gn); gn.connect(master); if (reverb) gn.connect(rev);
  s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

let lastHit = 0;
export const sfx = {
  // 汽笛（ポッ・ポーー）：3つの音の和音に息の音を重ねる
  whistle() {
    [[0, 0.24], [0.32, 0.6]].forEach(([d, len]) => {
      [[587, 0.05], [740, 0.042], [880, 0.036]].forEach(([f, v]) => tone({ type: "triangle", f: f * 0.96, f2: f, dur: len, vol: v, at: 0.04, delay: d, reverb: true }));
      noise({ dur: len, vol: 0.045, type: "bandpass", f: 1900, q: 2, delay: d, at: 0.04 });
    });
  },
  tap() { tone({ type: "square", f: 880, f2: 440, dur: 0.05, vol: 0.06 }); noise({ dur: 0.05, vol: 0.08, type: "highpass", f: 3000 }); },
  crit() { tone({ type: "square", f: 1400, f2: 300, dur: 0.14, vol: 0.12 }); noise({ dur: 0.18, vol: 0.2, f: 5000, f2: 400 }); },
  hit() { const n = performance.now(); if (n - lastHit < 70) return; lastHit = n; noise({ dur: 0.04, vol: 0.05, type: "bandpass", f: 1800, q: 2 }); },
  kill() { tone({ type: "square", f: 300, f2: 60, dur: 0.16, vol: 0.1 }); noise({ dur: 0.2, vol: 0.12, f: 1500, f2: 100 }); },
  coin() { tone({ type: "square", f: NOTE(88), dur: 0.05, vol: 0.05 }); tone({ type: "square", f: NOTE(93), dur: 0.12, vol: 0.05, delay: 0.05 }); },
  buy() { [72, 76, 79].forEach((n, i) => tone({ type: "square", f: NOTE(n), dur: 0.07, vol: 0.06, delay: i * 0.04 })); },
  cant() { tone({ type: "square", f: 150, dur: 0.12, vol: 0.07 }); },
  milestone() { [72, 76, 79, 84].forEach((n, i) => tone({ type: "square", f: NOTE(n), dur: 0.12, vol: 0.07, delay: i * 0.06, reverb: true })); },
  boss() { for (let i = 0; i < 3; i++) { tone({ type: "sawtooth", f: 220, f2: 200, dur: 0.22, vol: 0.09, delay: i * 0.32 }); tone({ type: "sawtooth", f: 233, dur: 0.22, vol: 0.07, delay: i * 0.32 }); } },
  bossWin() { [67, 71, 74, 79, 83, 86].forEach((n, i) => tone({ type: "square", f: NOTE(n), dur: 0.16, vol: 0.07, delay: i * 0.07, reverb: true })); },
  fail() { [64, 60, 55].forEach((n, i) => tone({ type: "triangle", f: NOTE(n), dur: 0.25, vol: 0.1, delay: i * 0.18 })); },
  drop(r = 1) {
    const base = [60, 64, 67, 72, 76, 79][r] || 60;
    [0, 4, 7, 12].slice(0, 2 + Math.min(2, r)).forEach((d, i) => tone({ type: "square", f: NOTE(base + d + 12), dur: 0.1, vol: 0.05, delay: i * 0.05, reverb: r >= 3 }));
  },
  lucky() { [84, 88, 91, 96, 100].forEach((n, i) => tone({ type: "square", f: NOTE(n), dur: 0.09, vol: 0.06, delay: i * 0.045, reverb: true })); },
  ach() { [79, 84, 88, 91].forEach((n, i) => tone({ type: "triangle", f: NOTE(n), dur: 0.2, vol: 0.09, delay: i * 0.08, reverb: true })); },
  click() { tone({ type: "square", f: 660, dur: 0.03, vol: 0.04 }); },
  // 連打：コンボが増えるほど音が高くなる
  tapCombo(n) {
    const note = 72 + Math.min(24, Math.floor(n / 5));
    tone({ type: "square", f: NOTE(note), f2: NOTE(note - 12), dur: 0.05, vol: 0.05 });
    noise({ dur: 0.04, vol: 0.06, type: "highpass", f: 3000 });
  },
  comboTier(n) {
    const up = Math.min(12, Math.floor(Math.log2(Math.max(1, n / 10))) * 3);
    [0, 4, 7, 12].forEach((d, i) => tone({ type: "square", f: NOTE(79 + up + d), dur: 0.1, vol: 0.06, delay: i * 0.04, reverb: true }));
  },
  fever() {
    this.riser(0.5, 3000);
    [72, 76, 79, 84, 88, 91, 96].forEach((n, i) => tone({ type: "sawtooth", f: NOTE(n), dur: 0.12, vol: 0.04, delay: 0.3 + i * 0.05, reverb: true }));
    this.boom(0.8);
  },
  meteor() { for (let i = 0; i < 6; i++) { noise({ dur: 0.3, vol: 0.15, type: "bandpass", f: 2000, f2: 200, q: 2, delay: i * 0.08 }); } setTimeout(() => this.boom(1.5), 500); },
  rush() { for (let i = 0; i < 8; i++) tone({ type: "square", f: NOTE(60 + i * 3), dur: 0.06, vol: 0.05, delay: i * 0.04 }); },
  midas() { [84, 88, 91, 96, 100, 103].forEach((n, i) => tone({ type: "triangle", f: NOTE(n), dur: 0.2, vol: 0.06, delay: i * 0.06, reverb: true })); },
  freeze() { tone({ type: "sine", f: 1760, f2: 440, dur: 0.8, vol: 0.08, reverb: true }); noise({ dur: 0.6, vol: 0.08, type: "highpass", f: 6000, reverb: true }); },

  // ---- ガチャ ----
  rumble(dur = 2) { noise({ dur, vol: 0.28, type: "lowpass", f: 90, f2: 180, at: 0.3 }); tone({ type: "sine", f: 40, f2: 55, dur, vol: 0.25, at: 0.3 }); },
  riser(dur = 1.5, top = 2400) { noise({ dur, vol: 0.18, type: "bandpass", f: 300, f2: top, q: 3, at: dur * 0.8 }); tone({ type: "sawtooth", f: 110, f2: 880, dur, vol: 0.06, at: dur * 0.8 }); },
  boom(big = 1) {
    tone({ type: "sine", f: 120, f2: 30, dur: 0.6 * big, vol: 0.5 });
    noise({ dur: 0.9 * big, vol: 0.4, type: "lowpass", f: 4000, f2: 80, reverb: true });
  },
  promote(level = 1) {
    // 昇格：キュイン＋ドン
    tone({ type: "square", f: NOTE(84 + level * 2), f2: NOTE(96 + level * 2), dur: 0.18, vol: 0.08 });
    tone({ type: "square", f: NOTE(91 + level * 2), f2: NOTE(103 + level * 2), dur: 0.18, vol: 0.06, delay: 0.06 });
    this.boom(0.8 + level * 0.15);
  },
  heartbeat() { tone({ type: "sine", f: 70, f2: 40, dur: 0.18, vol: 0.5 }); tone({ type: "sine", f: 70, f2: 40, dur: 0.18, vol: 0.4, delay: 0.24 }); },
  whoosh() { noise({ dur: 0.35, vol: 0.16, type: "bandpass", f: 400, f2: 3000, q: 1.5 }); },
  flip(r = 1) { noise({ dur: 0.06, vol: 0.1, type: "highpass", f: 2500 }); tone({ type: "square", f: NOTE(72 + r * 3), dur: 0.08, vol: 0.05 }); },
  reveal(r) {
    const sets = {
      1: [[72, 76, 79]],
      2: [[74, 78, 81, 86]],
      3: [[72, 76, 79, 84], [77, 81, 84, 89], [79, 83, 86, 91]],
      4: [[72, 76, 79, 84, 88], [77, 81, 84, 89, 93], [79, 83, 86, 91, 95], [84, 88, 91, 96, 100]],
      5: [[60, 67, 72, 76, 79], [65, 72, 77, 81, 84], [67, 74, 79, 83, 86], [72, 79, 84, 88, 91, 96]],
    };
    const seq = sets[Math.min(5, Math.max(1, r))];
    seq.forEach((ch, i) => ch.forEach((n) => {
      tone({ type: r >= 4 ? "sawtooth" : "square", f: NOTE(n), dur: i === seq.length - 1 ? 1.4 : 0.22, vol: 0.035, delay: i * 0.2, reverb: true, detune: (Math.random() - 0.5) * 12 });
      if (r >= 4) tone({ type: "triangle", f: NOTE(n - 12), dur: i === seq.length - 1 ? 1.6 : 0.22, vol: 0.05, delay: i * 0.2, reverb: true });
    }));
    if (r >= 3) this.boom(r >= 5 ? 1.6 : 1);
    if (r >= 4) for (let i = 0; i < 14; i++) tone({ type: "sine", f: NOTE(96 + Math.floor(Math.random() * 12)), dur: 0.3, vol: 0.02, delay: 0.3 + i * 0.07, reverb: true });
  },
  silence() {},
  glass() { noise({ dur: 0.5, vol: 0.25, type: "highpass", f: 3000, f2: 8000, reverb: true }); for (let i = 0; i < 8; i++) tone({ type: "sine", f: 2000 + Math.random() * 3000, dur: 0.15, vol: 0.03, delay: i * 0.03 }); },
};
