// Optional ambience, generated in the browser (no audio files): filtered-noise wind
// and a soft "whoosh" for section changes. Off by default; started only from the
// Sound button's own click.
export function createAudio() {
    let ctx = null, master = null, windFilter = null, lfo = null, noiseBuf = null;
    let on = false;

    function build() {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain();
        master.gain.value = 0;
        master.connect(ctx.destination);

        // Two seconds of brown-ish noise, looped.
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        let lastOut = 0;
        for (let i = 0; i < d.length; i++) {
            const white = Math.random() * 2 - 1;
            lastOut = (lastOut + 0.02 * white) / 1.02;
            d[i] = lastOut * 3.5;
        }
        const wind = ctx.createBufferSource();
        wind.buffer = noiseBuf;
        wind.loop = true;
        windFilter = ctx.createBiquadFilter();
        windFilter.type = 'bandpass';
        windFilter.frequency.value = 420;
        windFilter.Q.value = 0.6;
        const windGain = ctx.createGain();
        windGain.gain.value = 0.35;
        lfo = ctx.createOscillator();
        lfo.frequency.value = 0.07;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 220;
        lfo.connect(lfoGain).connect(windFilter.frequency);
        wind.connect(windFilter).connect(windGain).connect(master);
        wind.start();
        lfo.start();
    }

    function fadeTo(v, time = 0.35) {
        const t = ctx.currentTime;
        master.gain.cancelScheduledValues(t);
        master.gain.setValueAtTime(master.gain.value, t);
        master.gain.linearRampToValueAtTime(v, t + time);
    }

    return {
        get on() { return on; },
        async toggle() {
            if (!ctx) build();
            on = !on;
            if (on) {
                await ctx.resume();
                fadeTo(0.5);
            } else {
                fadeTo(0);
            }
            return on;
        },
        whoosh() {
            if (!on || !ctx) return;
            const src = ctx.createBufferSource();
            src.buffer = noiseBuf;
            const f = ctx.createBiquadFilter();
            f.type = 'bandpass';
            f.Q.value = 1.2;
            const g = ctx.createGain();
            const t = ctx.currentTime;
            f.frequency.setValueAtTime(300, t);
            f.frequency.exponentialRampToValueAtTime(1800, t + 0.6);
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.25, t + 0.15);
            g.gain.linearRampToValueAtTime(0, t + 0.9);
            src.connect(f).connect(g).connect(master);
            src.start(t, Math.random());
            src.stop(t + 1);
        },
        crack() {
            if (!on || !ctx) return;
            const t = ctx.currentTime;
            // A sharp noise burst through a high band-pass, then a short low thud.
            const src = ctx.createBufferSource();
            src.buffer = noiseBuf;
            const f = ctx.createBiquadFilter();
            f.type = 'highpass';
            f.frequency.value = 1800;
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.5, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
            src.connect(f).connect(g).connect(master);
            src.start(t, Math.random());
            src.stop(t + 0.4);
            const o = ctx.createOscillator();
            o.frequency.setValueAtTime(140, t);
            o.frequency.exponentialRampToValueAtTime(45, t + 0.25);
            const og = ctx.createGain();
            og.gain.setValueAtTime(0.35, t);
            og.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
            o.connect(og).connect(master);
            o.start(t);
            o.stop(t + 0.32);
        },
        suspend() { if (ctx && on) ctx.suspend(); },
        resume() { if (ctx && on) ctx.resume(); },
        dispose() { if (ctx) ctx.close(); },
    };
}
