// WebAudio ses motoru: efektler, prosedürel müzik ve konuşma sesleri.
import { G } from '../game/G';

type Track = 'title' | 'void' | 'forest' | 'village' | 'inn' | 'battle' | 'night' | 'guild' | 'none';

export interface VoiceProfile {
  wave: OscillatorType;
  pitch: number; // Hz
  spread: number; // rastgele perde oranı
  dur: number; // saniye
  every: number; // her kaç harfte bir ses
  vol: number;
  glide?: number; // perde kayması oranı
}

export const VOICES: Record<string, VoiceProfile> = {
  joseph: { wave: 'triangle', pitch: 210, spread: 0.08, dur: 0.05, every: 2, vol: 0.5 },
  bertram: { wave: 'sawtooth', pitch: 95, spread: 0.05, dur: 0.075, every: 2, vol: 0.32, glide: -0.1 },
  vera: { wave: 'square', pitch: 330, spread: 0.12, dur: 0.035, every: 1, vol: 0.22 },
  lina: { wave: 'sine', pitch: 520, spread: 0.25, dur: 0.04, every: 2, vol: 0.45, glide: 0.25 },
  celeste: { wave: 'sine', pitch: 380, spread: 0.03, dur: 0.06, every: 2, vol: 0.4, glide: -0.05 },
  system: { wave: 'sine', pitch: 1320, spread: 0.0, dur: 0.07, every: 3, vol: 0.18 },
  male: { wave: 'triangle', pitch: 150, spread: 0.1, dur: 0.05, every: 2, vol: 0.45 },
  male_old: { wave: 'triangle', pitch: 120, spread: 0.06, dur: 0.07, every: 2, vol: 0.45, glide: -0.08 },
  female: { wave: 'triangle', pitch: 300, spread: 0.1, dur: 0.045, every: 2, vol: 0.45 },
  female_old: { wave: 'triangle', pitch: 260, spread: 0.06, dur: 0.06, every: 2, vol: 0.45 },
  child: { wave: 'sine', pitch: 560, spread: 0.18, dur: 0.035, every: 2, vol: 0.45, glide: 0.15 },
  gruff: { wave: 'sawtooth', pitch: 110, spread: 0.08, dur: 0.06, every: 2, vol: 0.28 },
  goblin: { wave: 'square', pitch: 260, spread: 0.3, dur: 0.03, every: 1, vol: 0.18 },
};

const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  musicBus!: GainNode;
  sfxBus!: GainNode;
  voiceBus!: GainNode;
  noiseBuf!: AudioBuffer;
  reverb!: ConvolverNode;
  reverbSend!: GainNode;
  private track: Track = 'none';
  private wanted: Track = 'none';
  private trackGain: GainNode | null = null;
  private nextBeat = 0;
  private beat = 0;
  private timer: any = null;
  private rngSeed = 1;
  private voiceCounter = 0;
  private ambience: { node: AudioBufferSourceNode; gain: GainNode } | null = null;

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC({ latencyHint: 'interactive' });
    const c = this.ctx!;
    this.master = c.createGain();
    this.master.gain.value = 0.9;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(c.destination);
    this.musicBus = c.createGain();
    this.sfxBus = c.createGain();
    this.voiceBus = c.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.voiceBus.connect(this.master);
    // basit yankı
    this.reverb = c.createConvolver();
    const len = c.sampleRate * 2.2;
    const ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    this.reverb.buffer = ir;
    this.reverbSend = c.createGain();
    this.reverbSend.gain.value = 0.28;
    this.reverbSend.connect(this.reverb).connect(this.master);
    // gürültü
    this.noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const nd = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    G.events.on('settings', () => this.applyVolumes());
    this.timer = setInterval(() => this.schedule(), 40);
    if (this.wanted !== 'none') this.play(this.wanted, true);
  }

  /** Sayfa gizlenince sesi tamamen durdur (AudioContext askıya alınır). */
  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }

  /** Sayfa yeniden görünür olunca sürdür (önceden dokunuşla açılmışsa). */
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  applyVolumes() {
    if (!this.ctx) return;
    const s = G.settings;
    this.musicBus.gain.setTargetAtTime(s.music * 0.55, this.ctx.currentTime, 0.1);
    this.sfxBus.gain.setTargetAtTime(s.sfx * 0.9, this.ctx.currentTime, 0.05);
    this.voiceBus.gain.setTargetAtTime(s.voice * 0.7, this.ctx.currentTime, 0.05);
  }

  private rand() {
    this.rngSeed = (this.rngSeed * 16807) % 2147483647;
    return this.rngSeed / 2147483647;
  }

  // ------------------------------------------------------------ temel sesler
  private osc(type: OscillatorType, freq: number, t: number, dur: number, vol: number, dest: AudioNode, opts: { glide?: number; attack?: number; release?: number; detune?: number } = {}) {
    const c = this.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (opts.glide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * (1 + opts.glide)), t + dur);
    if (opts.detune) o.detune.value = opts.detune;
    const a = opts.attack ?? 0.005;
    const r = opts.release ?? dur * 0.6;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + a);
    g.gain.setValueAtTime(vol, t + Math.max(a, dur - r));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
    return { o, g };
  }

  private noise(t: number, dur: number, vol: number, dest: AudioNode, filter: { type: BiquadFilterType; f: number; q?: number; f2?: number }) {
    const c = this.ctx!;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = filter.type;
    f.frequency.setValueAtTime(filter.f, t);
    if (filter.f2) f.frequency.exponentialRampToValueAtTime(filter.f2, t + dur);
    f.Q.value = filter.q ?? 1;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(dest);
    s.start(t, this.rand() * 1.5);
    s.stop(t + dur + 0.02);
  }

  // ------------------------------------------------------------ efektler
  sfx(name: string, vol = 1) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + 0.005;
    const B = this.sfxBus;
    const v = vol;
    switch (name) {
      case 'swing':
        this.noise(t, 0.16, 0.25 * v, B, { type: 'bandpass', f: 900, f2: 2600, q: 1.2 });
        break;
      case 'heavy':
        this.noise(t, 0.3, 0.35 * v, B, { type: 'bandpass', f: 400, f2: 1600, q: 1 });
        this.osc('sine', 90, t, 0.25, 0.25 * v, B, { glide: -0.4 });
        break;
      case 'hit':
        this.noise(t, 0.09, 0.45 * v, B, { type: 'lowpass', f: 2400, f2: 600 });
        this.osc('square', 140, t, 0.08, 0.18 * v, B, { glide: -0.5 });
        break;
      case 'crit':
        this.noise(t, 0.14, 0.55 * v, B, { type: 'highpass', f: 1200 });
        this.osc('sawtooth', 220, t, 0.12, 0.2 * v, B, { glide: -0.6 });
        this.osc('sine', 1760, t, 0.18, 0.12 * v, this.reverbSend);
        break;
      case 'hurt':
        this.osc('sawtooth', 300, t, 0.18, 0.22 * v, B, { glide: -0.6 });
        this.noise(t, 0.1, 0.3 * v, B, { type: 'lowpass', f: 1500 });
        break;
      case 'miss':
        this.noise(t, 0.12, 0.12 * v, B, { type: 'highpass', f: 3000 });
        break;
      case 'dodge':
        this.noise(t, 0.22, 0.2 * v, B, { type: 'bandpass', f: 600, f2: 200, q: 0.7 });
        break;
      case 'draw':
        // silahı çekme: kınından sıyrılan metal + kısa çınlama
        this.noise(t, 0.16, 0.18 * v, B, { type: 'bandpass', f: 2600, f2: 5200, q: 2.5 });
        this.osc('triangle', 2350, t + 0.1, 0.22, 0.05 * v, this.reverbSend, { glide: 0.02 });
        break;
      case 'sheathe':
        this.noise(t, 0.2, 0.12 * v, B, { type: 'bandpass', f: 3000, f2: 1400, q: 2 });
        this.noise(t + 0.18, 0.05, 0.12 * v, B, { type: 'lowpass', f: 900 });
        break;
      case 'bowstring':
        this.osc('triangle', 180, t, 0.18, 0.22 * v, B, { glide: -0.35 });
        this.noise(t, 0.08, 0.2 * v, B, { type: 'bandpass', f: 1200, q: 3 });
        break;
      case 'perfect':
        this.osc('sine', 1046, t, 0.5, 0.2 * v, this.reverbSend);
        this.osc('sine', 1568, t + 0.04, 0.5, 0.15 * v, this.reverbSend);
        this.osc('sine', 2093, t + 0.08, 0.6, 0.1 * v, B);
        break;
      case 'step':
        this.noise(t, 0.04, 0.06 * v, B, { type: 'lowpass', f: 700 });
        break;
      case 'coin':
        this.osc('square', 1318, t, 0.07, 0.1 * v, B);
        this.osc('square', 1975, t + 0.06, 0.16, 0.1 * v, B);
        break;
      case 'pickup':
        this.osc('triangle', 660, t, 0.08, 0.2 * v, B, { glide: 0.5 });
        this.osc('triangle', 990, t + 0.05, 0.1, 0.15 * v, B);
        break;
      case 'click':
        this.osc('triangle', 880, t, 0.04, 0.12 * v, B);
        break;
      case 'open':
        this.osc('sine', 520, t, 0.1, 0.12 * v, B, { glide: 0.5 });
        break;
      case 'close':
        this.osc('sine', 700, t, 0.1, 0.1 * v, B, { glide: -0.4 });
        break;
      case 'error':
        this.osc('square', 140, t, 0.12, 0.12 * v, B);
        this.osc('square', 120, t + 0.1, 0.14, 0.12 * v, B);
        break;
      case 'system':
        [1568, 2093, 2637].forEach((f, i) => this.osc('sine', f, t + i * 0.05, 0.7, 0.07 * v, this.reverbSend));
        this.osc('triangle', 1046, t, 0.25, 0.06 * v, B);
        break;
      case 'levelup':
        [523, 659, 784, 1046, 1318].forEach((f, i) => {
          this.osc('triangle', f, t + i * 0.08, 0.35, 0.16 * v, B);
          this.osc('sine', f * 2, t + i * 0.08, 0.5, 0.05 * v, this.reverbSend);
        });
        break;
      case 'skillup':
        [784, 988, 1318].forEach((f, i) => this.osc('triangle', f, t + i * 0.07, 0.3, 0.14 * v, B));
        break;
      case 'title':
        [392, 523, 659, 784].forEach((f, i) => this.osc('sawtooth', f, t + i * 0.12, 0.5, 0.06 * v, this.reverbSend));
        break;
      case 'alert':
        this.osc('square', 880, t, 0.06, 0.1 * v, B);
        this.osc('square', 1175, t + 0.07, 0.08, 0.1 * v, B);
        break;
      case 'windup':
        this.osc('sawtooth', 200, t, 0.3, 0.06 * v, B, { glide: 0.8 });
        break;
      case 'bite':
        this.noise(t, 0.08, 0.3 * v, B, { type: 'bandpass', f: 1800, q: 2 });
        break;
      case 'die':
        this.osc('sawtooth', 220, t, 0.5, 0.15 * v, B, { glide: -0.8 });
        this.noise(t, 0.3, 0.2 * v, B, { type: 'lowpass', f: 800, f2: 200 });
        break;
      case 'heal':
        [523, 784, 1046].forEach((f, i) => this.osc('sine', f, t + i * 0.06, 0.4, 0.1 * v, this.reverbSend));
        break;
      case 'fire':
        this.noise(t, 0.4, 0.3 * v, B, { type: 'bandpass', f: 500, f2: 1500, q: 0.8 });
        break;
      case 'holy':
        [659, 880, 1318, 1760].forEach((f, i) => this.osc('sine', f, t + i * 0.03, 0.9, 0.08 * v, this.reverbSend));
        break;
      case 'door':
        this.osc('triangle', 160, t, 0.15, 0.2 * v, B, { glide: -0.3 });
        this.noise(t + 0.05, 0.15, 0.12 * v, B, { type: 'lowpass', f: 900 });
        break;
      case 'chop':
        this.noise(t, 0.08, 0.5 * v, B, { type: 'bandpass', f: 1200, q: 1.5 });
        this.osc('triangle', 180, t, 0.12, 0.3 * v, B, { glide: -0.4 });
        break;
      case 'thud':
        this.osc('sine', 80, t, 0.25, 0.4 * v, B, { glide: -0.5 });
        break;
      case 'bell':
        [880, 1320, 1760].forEach((f, i) => this.osc('sine', f, t, 2.2 - i * 0.4, 0.08 * v, this.reverbSend));
        break;
      case 'heartbeat':
        this.osc('sine', 55, t, 0.15, 0.5 * v, B);
        this.osc('sine', 50, t + 0.22, 0.15, 0.4 * v, B);
        break;
      case 'awaken':
        for (let i = 0; i < 8; i++) this.osc('sine', 392 * Math.pow(2, i / 4), t + i * 0.12, 1.4, 0.07 * v, this.reverbSend);
        this.noise(t, 2.5, 0.08 * v, this.reverbSend, { type: 'highpass', f: 4000 });
        break;
      case 'appraise':
        this.osc('sine', 1760, t, 0.15, 0.08 * v, B, { glide: 0.2 });
        this.osc('sine', 2637, t + 0.08, 0.3, 0.06 * v, this.reverbSend);
        break;
      case 'laugh':
        for (let i = 0; i < 6; i++) this.osc('triangle', 300 + this.rand() * 200, t + i * 0.09, 0.07, 0.12 * v, B, { glide: -0.2 });
        break;
    }
  }

  // ------------------------------------------------------------ prolog: araba kazası
  /**
   * Yaklaşık 1 saniyelik araba kazası: lastik sürtünmesi + çarpma.
   * assets/audio/car_crash.(ogg|mp3|wav) varsa o dosya çalınır.
   * Ses bitince çözülür.
   */
  async carCrash(): Promise<void> {
    if (!this.ctx) return;
    const file = G.audioFile('car_crash');
    if (file) {
      const dur = await this.playFile(file, this.sfxBus);
      if (dur > 0) {
        await new Promise((r) => setTimeout(r, Math.min(3000, dur * 1000)));
        return;
      }
    }
    const c = this.ctx;
    const t = c.currentTime + 0.02;
    const B = this.sfxBus;
    const hit = 0.62;
    // Lastik sürtünmesi: titreşen iki testere dalgası + dar bant gürültü
    for (const [f0, det] of [[1480, 0], [1530, 7]] as [number, number][]) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f0, t);
      o.frequency.linearRampToValueAtTime(f0 * 0.86, t + hit);
      o.detune.value = det;
      const lfo = c.createOscillator();
      lfo.frequency.value = 27;
      const lg = c.createGain();
      lg.gain.value = 55;
      lfo.connect(lg).connect(o.frequency);
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1500;
      bp.Q.value = 4;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.08);
      g.gain.setValueAtTime(0.16, t + hit - 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, t + hit + 0.02);
      o.connect(bp).connect(g).connect(B);
      o.start(t);
      lfo.start(t);
      o.stop(t + hit + 0.05);
      lfo.stop(t + hit + 0.05);
    }
    this.noise(t, hit, 0.3, B, { type: 'bandpass', f: 2400, f2: 1700, q: 6 });
    // Çarpma: gövde, metal ve cam
    const T = t + hit;
    this.noise(T, 0.36, 0.95, B, { type: 'lowpass', f: 1400, f2: 140 });
    this.osc('sine', 72, T, 0.42, 0.85, B, { glide: -0.55, attack: 0.002 });
    this.osc('square', 140, T, 0.12, 0.25, B, { glide: -0.6, attack: 0.002 });
    for (const [f, d] of [[383, 0.42], [596, 0.34], [1171, 0.3], [1693, 0.22]] as [number, number][]) this.osc('triangle', f, T + 0.01, d, 0.09, this.reverbSend, { attack: 0.002, release: d * 0.9 });
    this.noise(T + 0.03, 0.3, 0.32, B, { type: 'highpass', f: 5200 });
    for (let i = 0; i < 6; i++) this.osc('sine', 3000 + this.rand() * 2400, T + 0.05 + i * 0.045, 0.12, 0.05, this.reverbSend, { attack: 0.001 });
    await new Promise((r) => setTimeout(r, (hit + 0.42) * 1000));
  }

  /** Bir ses dosyasını bir kez çalar; süresini (sn) döndürür, olmazsa 0. */
  async playFile(url: string, dest: AudioNode): Promise<number> {
    if (!this.ctx) return 0;
    try {
      const res = await fetch(url);
      if (!res.ok) return 0;
      const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
      const s = this.ctx.createBufferSource();
      s.buffer = buf;
      s.connect(dest);
      s.start();
      return buf.duration;
    } catch {
      return 0;
    }
  }

  // ------------------------------------------------------------ konuşma sesi
  /** Bir harf için dıt sesi. Boşluk/noktalama sessiz. */
  blip(voice: string, ch: string) {
    if (!this.ctx) return;
    if (!/[\p{L}\p{N}]/u.test(ch)) return;
    const p = VOICES[voice] ?? VOICES.male;
    this.voiceCounter++;
    if (this.voiceCounter % p.every !== 0) return;
    const t = this.ctx.currentTime + 0.002;
    const f = p.pitch * (1 + (this.rand() * 2 - 1) * p.spread);
    this.osc(p.wave, f, t, p.dur, p.vol * 0.35, this.voiceBus, { glide: p.glide, attack: 0.003, release: p.dur * 0.5 });
    if (voice === 'system') this.osc('sine', f * 1.5, t, p.dur * 2, p.vol * 0.15, this.reverbSend);
  }

  // ------------------------------------------------------------ müzik
  play(track: Track, force = false) {
    this.wanted = track;
    if (!this.ctx) return;
    if (track === this.track && !force) return;
    const c = this.ctx;
    if (this.trackGain) {
      const old = this.trackGain;
      old.gain.setTargetAtTime(0.0001, c.currentTime, 0.6);
      setTimeout(() => old.disconnect(), 3000);
    }
    this.track = track;
    this.trackGain = c.createGain();
    this.trackGain.gain.setValueAtTime(0.0001, c.currentTime);
    this.trackGain.gain.setTargetAtTime(1, c.currentTime + 0.2, 0.8);
    this.trackGain.connect(this.musicBus);
    this.nextBeat = c.currentTime + 0.3;
    this.beat = 0;
    this.setAmbience(track);
  }

  current() {
    return this.wanted;
  }

  private setAmbience(track: Track) {
    const c = this.ctx!;
    if (this.ambience) {
      const a = this.ambience;
      a.gain.gain.setTargetAtTime(0.0001, c.currentTime, 0.5);
      setTimeout(() => a.node.stop(), 2500);
      this.ambience = null;
    }
    if (track !== 'forest' && track !== 'night' && track !== 'void') return;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = track === 'void' ? 'highpass' : 'bandpass';
    f.frequency.value = track === 'void' ? 6000 : 500;
    f.Q.value = 0.4;
    const g = c.createGain();
    g.gain.value = 0.0001;
    g.gain.setTargetAtTime(track === 'void' ? 0.02 : 0.035, c.currentTime, 1.5);
    s.connect(f).connect(g).connect(this.musicBus);
    s.start();
    this.ambience = { node: s, gain: g };
  }

  private schedule() {
    if (!this.ctx || !this.trackGain || this.track === 'none') return;
    const c = this.ctx;
    while (this.nextBeat < c.currentTime + 0.25) {
      this.playBeat(this.track, this.beat, this.nextBeat);
      const bpm = { title: 64, void: 50, forest: 76, village: 96, inn: 132, battle: 140, night: 60, guild: 88, none: 60 }[this.track];
      this.nextBeat += 60 / bpm / 2; // sekizlik
      this.beat++;
    }
  }

  private note(t: number, midi: number, dur: number, vol: number, type: OscillatorType = 'triangle', rev = 0.3) {
    const out = this.trackGain!;
    const f = NOTE(midi);
    this.osc(type, f, t, dur, vol, out, { attack: 0.01, release: dur * 0.7 });
    if (rev > 0) this.osc(type, f, t, dur, vol * rev, this.reverbSend, { attack: 0.01, release: dur * 0.7 });
  }

  private pluck(t: number, midi: number, vol: number, dur = 0.5) {
    const out = this.trackGain!;
    const f = NOTE(midi);
    this.osc('triangle', f, t, dur, vol, out, { attack: 0.003, release: dur * 0.9 });
    this.osc('sine', f * 2, t, dur * 0.5, vol * 0.3, out, { attack: 0.002, release: dur * 0.4 });
    this.osc('sine', f, t, dur, vol * 0.25, this.reverbSend, { attack: 0.003, release: dur * 0.9 });
  }

  private pad(t: number, midis: number[], dur: number, vol: number) {
    for (const m of midis) {
      this.osc('sine', NOTE(m), t, dur, vol, this.trackGain!, { attack: dur * 0.3, release: dur * 0.5, detune: -6 });
      this.osc('triangle', NOTE(m), t, dur, vol * 0.5, this.reverbSend, { attack: dur * 0.3, release: dur * 0.5, detune: 6 });
    }
  }

  private drum(t: number, kind: 'kick' | 'snare' | 'hat', vol: number) {
    const out = this.trackGain!;
    if (kind === 'kick') this.osc('sine', 120, t, 0.18, vol, out, { glide: -0.6, attack: 0.002 });
    else if (kind === 'snare') this.noise(t, 0.12, vol * 0.7, out, { type: 'bandpass', f: 1800, q: 0.8 });
    else this.noise(t, 0.04, vol * 0.4, out, { type: 'highpass', f: 7000 });
  }

  private playBeat(track: Track, b: number, t: number) {
    const bar = Math.floor(b / 8);
    const step = b % 8;
    const r = () => this.rand();
    switch (track) {
      case 'title': {
        const prog = [[50, 57, 62, 65], [46, 53, 58, 62], [48, 55, 60, 64], [45, 52, 57, 61]];
        const ch = prog[bar % 4];
        if (step === 0) this.pad(t, ch, 3.6, 0.045);
        if (step % 2 === 0 && r() < 0.6) this.note(t, ch[1 + Math.floor(r() * 3)] + 12, 1.2, 0.05, 'sine', 0.6);
        if (step === 4 && bar % 2 === 1) this.note(t, ch[3] + 24, 2, 0.03, 'sine', 0.8);
        break;
      }
      case 'void': {
        if (step === 0 && bar % 2 === 0) this.pad(t, [60, 67, 71, 76], 7, 0.03);
        if (r() < 0.15) this.note(t, [84, 88, 91, 95, 96][Math.floor(r() * 5)], 2.5, 0.025, 'sine', 1);
        break;
      }
      case 'forest': {
        const prog = [[45, 52, 57, 60], [43, 50, 55, 59], [41, 48, 53, 57], [43, 50, 55, 62]];
        const ch = prog[bar % 4];
        const scale = [57, 60, 62, 64, 67, 69, 72, 74, 76];
        if (step === 0) this.pad(t, [ch[0], ch[2]], 2.6, 0.035);
        if (step % 2 === 0) this.pluck(t, ch[(step / 2) % 4] + 12, 0.05, 0.9);
        if ((step === 3 || step === 6) && r() < 0.55) this.pluck(t, scale[Math.floor(r() * scale.length)] + 12, 0.04, 0.7);
        if (r() < 0.04) {
          // kuş cıvıltısı
          const f = 2400 + r() * 1800;
          this.osc('sine', f, t, 0.08, 0.02, this.trackGain!, { glide: 0.3 });
          this.osc('sine', f * 1.1, t + 0.1, 0.06, 0.015, this.trackGain!, { glide: -0.2 });
        }
        break;
      }
      case 'village': {
        const prog = [[48, 55, 64], [53, 57, 65], [55, 59, 62], [48, 55, 64], [45, 52, 60], [53, 57, 65], [55, 59, 67], [48, 52, 60]];
        const ch = prog[bar % 8];
        const mel = [72, 74, 76, 79, 81, 79, 76, 74];
        if (step === 0) this.note(t, ch[0] - 12, 0.9, 0.08, 'triangle', 0.2);
        if (step === 4) this.note(t, ch[1] - 12, 0.7, 0.06, 'triangle', 0.2);
        if (step % 2 === 1) this.pluck(t, ch[(step >> 1) % 3] + 12, 0.035, 0.4);
        if (bar % 2 === 0 && (step === 0 || step === 2 || step === 3 || step === 6)) this.note(t, mel[(bar / 2 + step) % 8] - (r() < 0.3 ? 2 : 0), 0.35, 0.04, 'square', 0.3);
        break;
      }
      case 'inn': {
        // 6/8 hissi: 3'lü gruplar
        const prog = [[50, 57, 62, 66], [55, 59, 62, 67], [57, 61, 64, 69], [50, 57, 62, 66]];
        const ch = prog[Math.floor(b / 6) % 4];
        const s6 = b % 6;
        if (s6 === 0) this.note(t, ch[0] - 12, 0.4, 0.09, 'triangle', 0.1);
        if (s6 === 3) this.note(t, ch[1] - 12, 0.3, 0.06, 'triangle', 0.1);
        if (s6 !== 0 && s6 !== 3) this.pluck(t, ch[1 + (s6 % 3)], 0.03, 0.25);
        const mel = [74, 76, 78, 81, 79, 78, 76, 74, 73, 74];
        if (r() < 0.55) this.note(t, mel[(b * 7) % mel.length] + (r() < 0.2 ? 12 : 0), 0.18, 0.035, 'square', 0.15);
        if (s6 === 0) this.drum(t, 'kick', 0.12);
        if (s6 === 3) this.drum(t, 'hat', 0.08);
        break;
      }
      case 'battle': {
        const prog = [[45, 52, 57], [41, 48, 53], [43, 50, 55], [40, 47, 52]];
        const ch = prog[bar % 4];
        this.note(t, ch[0] - 12 + (step % 2 ? 12 : 0), 0.12, 0.07, 'sawtooth', 0.05);
        if (step === 0 || step === 3 || step === 6) this.drum(t, 'kick', 0.25);
        if (step === 4) this.drum(t, 'snare', 0.25);
        this.drum(t, 'hat', 0.06);
        if (step % 4 === 2) this.note(t, ch[2] + 12, 0.2, 0.04, 'square', 0.2);
        if (bar % 2 === 1 && step === 0) this.note(t, ch[1] + 24, 0.8, 0.035, 'sawtooth', 0.4);
        break;
      }
      case 'night': {
        const prog = [[45, 52, 60], [41, 48, 57], [43, 50, 59], [40, 47, 55]];
        const ch = prog[bar % 4];
        if (step === 0) this.pad(t, ch, 4, 0.03);
        if (step === 2 && r() < 0.5) this.note(t, ch[2] + 12, 1.5, 0.025, 'sine', 0.8);
        if (r() < 0.06) {
          // cırcır böceği
          for (let i = 0; i < 3; i++) this.osc('square', 4200, t + i * 0.05, 0.02, 0.006, this.trackGain!);
        }
        break;
      }
      case 'guild': {
        const prog = [[48, 55, 60, 63], [44, 51, 56, 60], [46, 53, 58, 62], [43, 50, 55, 59]];
        const ch = prog[bar % 4];
        if (step === 0) this.pad(t, ch, 2.8, 0.035);
        if (step % 2 === 0) this.pluck(t, ch[(step / 2) % 4] + 12, 0.035, 0.6);
        if (step === 0) this.drum(t, 'kick', 0.06);
        break;
      }
    }
  }
}

export const Sound = new AudioEngine();
