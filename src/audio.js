// Tiny procedural sound: a steel marble on wood, and a music-box chime.
export function createAudio() {
  let ctx = null, rollGain, rollFilter, master;
  const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66];

  function start() {
    if (ctx) { ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) { b = b * 0.97 + (Math.random() * 2 - 1) * 0.03; d[i] = b * 6; }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    rollFilter = ctx.createBiquadFilter(); rollFilter.type = 'bandpass'; rollFilter.frequency.value = 300; rollFilter.Q.value = 0.8;
    rollGain = ctx.createGain(); rollGain.gain.value = 0;
    src.connect(rollFilter).connect(rollGain).connect(master);
    src.start();
  }

  function roll(speed, touching, glass) {
    if (!ctx) return;
    const t = ctx.currentTime, v = touching ? Math.min(1, speed / 7) : 0;
    rollGain.gain.setTargetAtTime(v * (glass ? 0.12 : 0.3), t, 0.05);
    rollFilter.frequency.setTargetAtTime((glass ? 900 : 220) + speed * (glass ? 220 : 130), t, 0.05);
  }

  function tone(freq, when, dur, vol, type = 'sine') {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(vol, when + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g).connect(master); o.start(when); o.stop(when + dur + 0.05);
  }

  function thunk(strength, glass) {
    if (!ctx || strength < 1.2) return;
    const v = Math.min(0.5, strength * 0.035), t = ctx.currentTime;
    tone(glass ? 1900 : 170 + Math.random() * 40, t, glass ? 0.12 : 0.09, v, glass ? 'sine' : 'triangle');
    tone(glass ? 3100 : 420, t, 0.05, v * 0.5);
  }

  function chime(i) {
    if (!ctx) return;
    const t = ctx.currentTime, f = SCALE[i % SCALE.length];
    tone(f, t, 1.6, 0.22); tone(f * 2, t, 0.9, 0.08); tone(f * 1.5, t + 0.14, 1.4, 0.12);
  }

  function finale() {
    if (!ctx) return;
    const t = ctx.currentTime;
    [0, 2, 3, 5, 3, 2, 3, 5, 6, 5, 3, 5].forEach((n, i) => { tone(SCALE[n], t + i * 0.2, 1.6, 0.16); tone(SCALE[n] * 2, t + i * 0.2, 0.7, 0.05); });
  }

  return { start, roll, thunk, chime, finale };
}
