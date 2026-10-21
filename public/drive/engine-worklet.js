/*
 * TECLA DRIVE — procesador AudioWorklet del sintetizador de motor.
 * Es la misma física que src/features/drive/engine-synth.ts (que sirve de
 * respaldo con ScriptProcessorNode y de referencia para las pruebas de paridad).
 * Corre en el hilo de audio para que un lienzo pesado no corte el sonido.
 */
const TWO_PI = Math.PI * 2;
const wrap = (phase) => (phase >= 1 ? phase - 1 : phase);

class TeclaEngineProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.random = Math.random;
    this.engine = null;
    this.studio = { turbo: 1, crackles: 1, tone: 1, pitch: 1, lope: 1 };
    this.rpm = 0;
    this.throttle = 0;
    this.running = false;
    this.phaseMain = 0;
    this.phaseSub = 0;
    this.phaseHalf = 0;
    this.phaseSc = 0;
    this.phaseLfo = 0;
    this.phaseValve = 0;
    this.turboSpool = 0;
    this.noisePrev = 0;
    this.pulseEnv = 0;
    this.lastFire = 0;
    this.fireJitter = 1;
    this.intakeLp = 0;
    this.port.onmessage = (event) => this.handleMessage(event.data);
  }

  handleMessage(message) {
    if (!message || typeof message !== "object") return;
    if (message.type === "engine" && message.engine) {
      this.engine = message.engine;
      if (this.rpm < this.engine.idle) this.rpm = this.engine.idle;
    } else if (message.type === "studio" && message.studio) {
      this.studio = { ...this.studio, ...message.studio };
    } else if (message.type === "drive") {
      this.rpm = Number.isFinite(message.rpm) ? message.rpm : this.rpm;
      this.throttle = Math.max(0, Math.min(1, Number(message.throttle) || 0));
    } else if (message.type === "running") {
      this.running = Boolean(message.value);
    }
  }

  render(out, sr) {
    const s = this.engine;
    const studio = this.studio;
    const span = Math.max(1, s.redline - s.idle);
    const norm = Math.max(0, Math.min(1, (this.rpm - s.idle) / span));
    const et = s.engineType;
    const load = 0.35 + this.throttle * 0.65;
    const rps = Math.max(8, this.rpm) / 60;
    const firingFreq = rps * (s.cylinders > 0 ? s.cylinders / 2 : 2) * s.pitch * studio.pitch;
    const envDecay = Math.exp(-1 / (sr * (0.0022 + (1 - norm) * 0.0035)));
    const random = this.random;

    for (let i = 0; i < out.length; i += 1) {
      this.phaseMain += (firingFreq * this.fireJitter) / sr;
      if (this.phaseMain >= 1) {
        this.phaseMain -= 1;
        this.pulseEnv = 1;
        this.fireJitter = 1 + (random() - 0.5) * (0.06 * (1 - norm) * studio.lope + 0.004);
        this.lastFire = 0.7 + random() * 0.3 * (1 + (1 - norm) * studio.lope * 0.6);
      }
      this.pulseEnv *= envDecay;
      this.phaseSub = wrap(this.phaseSub + (firingFreq * 0.5) / sr);
      this.phaseHalf = wrap(this.phaseHalf + (firingFreq * 0.25) / sr);

      const white = random() * 2 - 1;
      this.noisePrev = this.noisePrev * 0.82 + white * 0.18;
      const noise = this.noisePrev;
      const impulse = this.pulseEnv * this.lastFire * (0.6 + load * 0.8);
      const pm = this.phaseMain;
      let sig = 0;

      if (et === "v8_cross") {
        const p1 = Math.sin(pm * TWO_PI);
        const p2 = Math.sin(this.phaseSub * TWO_PI + 0.8);
        const p3 = Math.sin(this.phaseHalf * TWO_PI) * 0.9;
        const lope = (1 - norm * 0.65) * studio.lope * Math.sin(this.phaseHalf * TWO_PI * 2);
        sig = Math.tanh((p1 * 0.6 + p2 * 0.7 + p3 + lope * 0.4 + impulse * 1.6) * 2.4) * (0.75 + noise * 0.45);
      } else if (et === "v8_flat") {
        const saw = 2 * pm - 1;
        const pulse = Math.tanh(Math.sin(pm * TWO_PI) * 3 + saw * 1.8 + impulse * 1.4);
        sig = (pulse * 0.55 + Math.sin(pm * TWO_PI * 2) * 0.65 + Math.sin(pm * TWO_PI * 4) * 0.35) * (0.85 + noise * 0.3);
      } else if (et === "v10_v12") {
        const f = Math.sin(pm * TWO_PI) + Math.sin(pm * TWO_PI * 2) * 0.8 + Math.sin(pm * TWO_PI * 3) * 0.6 + (2 * pm - 1) * 0.7;
        sig = Math.tanh((f + impulse * 1.1) * 1.9) * (0.88 + noise * 0.25);
      } else if (et === "rotary") {
        this.phaseLfo = wrap(this.phaseLfo + (6.8 + norm * 14) / sr);
        const gateOpen = Math.sin(this.phaseLfo * TWO_PI) > -0.15 * studio.lope;
        const brapGate = norm < 0.28 ? (gateOpen ? 1 : 0.08) : 1;
        const rotor = 2 * pm - 1 + Math.sin(pm * TWO_PI * 2) * 0.75 + impulse * 1.3;
        sig = Math.tanh(rotor * 2.8) * brapGate * (0.85 + noise * 0.35);
      } else if (et === "boxer") {
        const bankLeft = Math.tanh(Math.sin(pm * TWO_PI) * 3 + impulse * 1.5);
        const bankRight = Math.tanh(Math.sin((pm + 0.37) * TWO_PI) * 3);
        const subThrob = Math.sin(this.phaseSub * TWO_PI) * 1.15 * studio.lope;
        sig = (bankLeft * 0.5 + bankRight * 0.5 + subThrob) * (0.8 + noise * 0.4);
      } else if (et === "inline6") {
        const i1 = 2 * pm - 1;
        const i2 = Math.sin(pm * TWO_PI * 2) * 0.7;
        const i3 = Math.sin(this.phaseSub * TWO_PI) * 0.4;
        sig = Math.tanh((i1 + i2 + i3 + impulse * 1.2) * 2.2) * (0.82 + noise * 0.38);
      } else if (et === "supercharged") {
        const v8 = Math.tanh((Math.sin(pm * TWO_PI) + Math.sin(this.phaseHalf * TWO_PI) * 0.95 + impulse * 1.6) * 2.5);
        const scFreq = (480 + norm * 3600) * studio.pitch;
        this.phaseSc = wrap(this.phaseSc + scFreq / sr);
        const whine =
          (Math.sin(this.phaseSc * TWO_PI) + Math.sin(this.phaseSc * TWO_PI * 2) * 0.35) *
          s.supercharger * studio.turbo * (0.18 + norm * 0.55) * load;
        sig = v8 * 0.7 + whine * 0.45;
      } else if (et === "i4_race") {
        const i4 = Math.tanh((2 * pm - 1 + Math.sin(pm * TWO_PI) + impulse * 1.5) * 2.6);
        const gearFreq = (650 + norm * 2900) * studio.pitch;
        this.phaseSc = wrap(this.phaseSc + gearFreq / sr);
        sig = i4 * 0.75 + Math.sin(this.phaseSc * TWO_PI) * 0.32 * studio.turbo * norm;
      } else if (et === "ev") {
        const evFreq = (130 + norm * 920) * s.pitch * studio.pitch;
        this.phaseSc = wrap(this.phaseSc + evFreq / sr);
        const ph = this.phaseSc * TWO_PI;
        sig = (Math.sin(ph) + Math.sin(ph * 1.5) * 0.45 + Math.sin(ph * 3) * 0.25 * norm) * 0.6 + noise * 0.08 * norm;
      } else if (et === "hover") {
        const hFreq = (55 + norm * 195) * s.pitch * studio.pitch;
        this.phaseSc = wrap(this.phaseSc + hFreq / sr);
        this.phaseLfo = wrap(this.phaseLfo + (3.5 + norm * 8) / sr);
        const pulse = 0.65 + 0.35 * Math.sin(this.phaseLfo * TWO_PI);
        sig = (Math.sin(this.phaseSc * TWO_PI) + Math.sin(this.phaseSc * TWO_PI * 1.505) * 0.5) * pulse * 0.7 + noise * 0.18;
      } else if (et === "scifi") {
        const wFreq = (90 + Math.pow(norm, 1.25) * 680) * s.pitch * studio.pitch;
        this.phaseLfo = wrap(this.phaseLfo + (wFreq * 1.5) / sr);
        const fm = Math.sin(this.phaseLfo * TWO_PI) * (0.5 + norm * 2.2);
        this.phaseSc = wrap(this.phaseSc + wFreq / sr);
        sig = Math.sin(this.phaseSc * TWO_PI + fm) * 0.65;
      } else {
        this.phaseLfo = wrap(this.phaseLfo + 6.2 / sr);
        const vibrato = 1 + Math.sin(this.phaseLfo * TWO_PI) * 0.035;
        const spFreq = (110 + norm * 480) * vibrato * studio.pitch;
        this.phaseSc = wrap(this.phaseSc + spFreq / sr);
        const ph = this.phaseSc * TWO_PI;
        sig = (Math.sin(ph) + Math.sin(ph * 1.189) * 0.6 + Math.sin(ph * 1.414) * 0.5) * 0.55 + noise * 0.15;
      }

      if (s.cylinders > 0) {
        this.intakeLp = this.intakeLp * 0.9 + white * 0.1;
        sig += this.intakeLp * 0.35 * load * (0.15 + norm * 0.85);
        this.phaseValve += (firingFreq * 2) / sr;
        if (this.phaseValve >= 1) this.phaseValve -= 1;
        if (this.phaseValve < 0.02) sig += (random() - 0.5) * 0.25 * (0.5 + norm * 0.5);
      }

      if (s.turbo > 0 && studio.turbo > 0) {
        this.turboSpool = wrap(this.turboSpool + (1400 + norm * 3400) / sr);
        sig += Math.sin(this.turboSpool * TWO_PI) * s.turbo * studio.turbo * Math.pow(norm, 1.3) * 0.22 * load;
      }

      out[i] = Math.max(-1, Math.min(1, sig * 0.42));
    }
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    if (!output || !output[0]) return true;
    const out = output[0];
    if (!this.running || !this.engine) {
      out.fill(0);
    } else {
      this.render(out, sampleRate);
    }
    for (let channel = 1; channel < output.length; channel += 1) output[channel].set(out);
    return true;
  }
}

registerProcessor("tecla-engine", TeclaEngineProcessor);
