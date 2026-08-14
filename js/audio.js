window.Sfx = (function () {
  let ctx = null, master = null, comp = null;
  let muted = !!Store.settings.muted;
  const VOL = Store.settings.vol || 0.3;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      comp = ctx.createDynamicsCompressor();   // 连击叠音时防爆
      comp.threshold.value = -18; comp.ratio.value = 6;
      master = ctx.createGain();
      master.gain.value = muted ? 0 : VOL;
      master.connect(comp).connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone({ f = 440, f2, type = 'sine', dur = .18, vol = .8, at = .006, delay = 0 } = {}) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + at);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + .02);
  }

  function noise({ dur = .3, vol = .5, type = 'lowpass', f = 1200, f2, delay = 0 } = {}) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime + delay, len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ctx.createBufferSource(); s.buffer = buf;
    const flt = ctx.createBiquadFilter(); flt.type = type;
    flt.frequency.setValueAtTime(f, t);
    if (f2) flt.frequency.exponentialRampToValueAtTime(Math.max(40, f2), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(flt).connect(g).connect(master); s.start(t); s.stop(t + dur);
  }

  const SCALE = [523, 587, 659, 784, 880, 1046, 1175, 1318, 1568];
  const P = {
    hover:  () => tone({ f: 1100, type: 'sine', dur: .04, vol: .1 }),
    click:  () => tone({ f: 560, f2: 820, type: 'triangle', dur: .07, vol: .35 }),
    select: () => tone({ f: 760, type: 'sine', dur: .06, vol: .22 }),
    tick:   () => tone({ f: 1500, type: 'sine', dur: .025, vol: .1 }),
    flip:   () => { noise({ dur: .07, f: 2400, f2: 600, vol: .22 });
                    tone({ f: 700, type: 'triangle', dur: .06, vol: .18 }); },
    place:  () => tone({ f: 320, f2: 540, type: 'sine', dur: .09, vol: .38 }),
    pop:    (i = 0) => tone({ f: 520 * Math.pow(1.1, i), f2: 1000, dur: .13, vol: .4 }),
    flag:   () => { tone({ f: 980, type: 'square', dur: .04, vol: .2 });
                    tone({ f: 1380, type: 'square', dur: .05, vol: .16, delay: .05 }); },
    wrong:  () => tone({ f: 240, f2: 130, type: 'sawtooth', dur: .24, vol: .3 }),
    boom:   () => { noise({ dur: .65, f: 900, f2: 60, vol: .75 });
                    tone({ f: 110, f2: 38, dur: .55, vol: .55 }); },
    hint:   () => [0, .06, .12].forEach((d, i) =>
              tone({ f: 880 + i * 220, dur: .1, vol: .22, delay: d })),
    combo:  (n = 1) => {
      const f = SCALE[Math.min(n, SCALE.length) - 1];
      tone({ f, type: 'triangle', dur: .18, vol: .34 });
      tone({ f: f * 2, dur: .12, vol: .12, delay: .025 });
    },
    win:    () => [523, 659, 784, 1046, 1318].forEach((f, i) =>
              tone({ f, type: 'triangle', dur: .3, vol: .3, delay: i * .09 })),
    record: () => [784, 988, 1175, 1568].forEach((f, i) =>
              tone({ f, type: 'sine', dur: .34, vol: .28, delay: i * .08 })),
    lose:   () => [440, 392, 330, 262].forEach((f, i) =>
              tone({ f, type: 'sawtooth', dur: .3, vol: .22, delay: i * .12 })),
    shuffle:() => noise({ dur: .4, type: 'bandpass', f: 500, f2: 3000, vol: .26 })
  };

  const api = {
    play(n, a) { const f = P[n]; if (f) { ensure(); f(a); } },
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      Store.settings.muted = muted; Store.saveSettings();
      document.body.classList.toggle('muted', muted);
      if (!muted) { ensure(); if (master) master.gain.value = VOL; api.play('click'); }
      else if (master) master.gain.value = 0;
      return muted;
    },
    init() {
      document.body.classList.toggle('muted', muted);
      const unlock = () => ensure();
      window.addEventListener('pointerdown', unlock, { once: true });
      document.addEventListener('visibilitychange', () => {
        if (!ctx) return;
        document.hidden ? ctx.suspend() : ctx.resume();   // 切后台停振荡器，省电
      });
    }
  };
  return api;
})();