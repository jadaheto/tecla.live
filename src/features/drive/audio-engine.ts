import { speedRatio, type DriveSoundId } from "./drive-config";

type AudioContextCtor = new () => AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const legacy = window as unknown as { webkitAudioContext?: AudioContextCtor };
  return window.AudioContext ?? legacy.webkitAudioContext ?? null;
}

interface SoundGraph {
  update: (speed: number, throttle: number) => void;
  dispose: () => void;
}

function setParam(param: AudioParam, value: number, time: number, timeConstant = 0.08) {
  param.setTargetAtTime(value, time, timeConstant);
}

function createNoiseSource(context: AudioContext): AudioBufferSourceNode {
  const seconds = 2;
  const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let index = 0; index < data.length; index += 1) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[index] = last * 3.4;
  }
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
}

function createDistortion(context: AudioContext, amount = 16): WaveShaperNode {
  const samples = 1024;
  const curve = new Float32Array(samples);
  for (let index = 0; index < samples; index += 1) {
    const x = (index * 2) / samples - 1;
    curve[index] = ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x));
  }
  const shaper = context.createWaveShaper();
  shaper.curve = curve;
  shaper.oversample = "2x";
  return shaper;
}

/**
 * Motor de audio original de TECLA DRIVE. Todo se sintetiza en el navegador
 * con osciladores y ruido filtrado; no hay samples de terceros.
 */
export class DriveAudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private graph: SoundGraph | null = null;
  private preset: DriveSoundId = "electric";
  private volume = 0.55;
  private muted = false;
  private stopTimer: number | null = null;

  get available(): boolean {
    return getAudioContextCtor() !== null;
  }

  async start(preset: DriveSoundId): Promise<void> {
    const AudioCtor = getAudioContextCtor();
    if (!AudioCtor) throw new Error("Este navegador no ofrece Web Audio.");

    if (!this.context) {
      this.context = new AudioCtor();
      this.master = this.context.createGain();
      this.master.gain.value = 0;
      this.compressor = this.context.createDynamicsCompressor();
      this.compressor.threshold.value = -18;
      this.compressor.knee.value = 24;
      this.compressor.ratio.value = 5;
      this.compressor.attack.value = 0.005;
      this.compressor.release.value = 0.25;
      this.master.connect(this.compressor);
      this.compressor.connect(this.context.destination);
    }

    if (this.stopTimer !== null) {
      window.clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }

    await this.context.resume();
    this.preset = preset;
    this.buildGraph();
    const now = this.context.currentTime;
    setParam(this.master?.gain ?? this.context.createGain().gain, this.muted ? 0 : this.volume, now, 0.14);
  }

  setPreset(preset: DriveSoundId): void {
    if (preset === this.preset) return;
    this.preset = preset;
    if (this.context && this.graph) this.buildGraph();
  }

  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
    this.applyVolume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyVolume();
  }

  update(speed: number, throttle: number): void {
    this.graph?.update(speed, Math.min(1, Math.max(0, throttle)));
  }

  stop(): void {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    setParam(this.master.gain, 0, now, 0.12);
    if (this.stopTimer !== null) window.clearTimeout(this.stopTimer);
    this.stopTimer = window.setTimeout(() => {
      this.graph?.dispose();
      this.graph = null;
      this.stopTimer = null;
    }, 380);
  }

  dispose(): void {
    if (this.stopTimer !== null) {
      window.clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    this.graph?.dispose();
    this.graph = null;
    const context = this.context;
    this.context = null;
    this.master = null;
    this.compressor = null;
    if (context) void context.close().catch(() => undefined);
  }

  private applyVolume(): void {
    if (!this.context || !this.master) return;
    const target = this.muted ? 0 : this.volume;
    setParam(this.master.gain, target, this.context.currentTime, 0.08);
  }

  private buildGraph(): void {
    if (!this.context || !this.master) return;
    this.graph?.dispose();
    const context = this.context;
    const master = this.master;
    const now = context.currentTime;
    const sources: AudioScheduledSourceNode[] = [];
    const nodes: AudioNode[] = [];

    const noise = createNoiseSource(context);
    const ambientFilter = context.createBiquadFilter();
    ambientFilter.type = "lowpass";
    ambientFilter.frequency.value = 680;
    const ambientGain = context.createGain();
    ambientGain.gain.value = 0.02;
    noise.connect(ambientFilter);
    ambientFilter.connect(ambientGain);
    ambientGain.connect(master);
    noise.start(now);
    sources.push(noise);
    nodes.push(ambientFilter, ambientGain);

    const updateAmbient = (speed: number) => {
      const ratio = speedRatio(speed);
      setParam(ambientFilter.frequency, 420 + ratio * 1_100, now, 0.15);
      setParam(ambientGain.gain, 0.018 + ratio * 0.075, now, 0.15);
    };

    let updateEngine: (speed: number, throttle: number) => void = updateAmbient;
    let disposeEngine: () => void = () => undefined;

    if (this.preset === "electric") {
      const motorFilter = context.createBiquadFilter();
      motorFilter.type = "lowpass";
      motorFilter.frequency.value = 1_800;
      motorFilter.Q.value = 0.8;
      const motorGain = context.createGain();
      motorGain.gain.value = 0.03;

      const fundamental = context.createOscillator();
      fundamental.type = "sine";
      fundamental.frequency.value = 62;
      const harmonic = context.createOscillator();
      harmonic.type = "triangle";
      harmonic.frequency.value = 124;
      harmonic.detune.value = 4;
      const whine = context.createOscillator();
      whine.type = "sine";
      whine.frequency.value = 740;
      const whineGain = context.createGain();
      whineGain.gain.value = 0.006;

      fundamental.connect(motorFilter);
      harmonic.connect(motorFilter);
      motorFilter.connect(motorGain);
      motorGain.connect(master);
      whine.connect(whineGain);
      whineGain.connect(master);
      [fundamental, harmonic, whine].forEach((oscillator) => oscillator.start(now));
      sources.push(fundamental, harmonic, whine);
      nodes.push(motorFilter, motorGain, whineGain);

      updateEngine = (speed, throttle) => {
        const ratio = speedRatio(speed);
        setParam(fundamental.frequency, 50 + ratio * 150, now, 0.06);
        setParam(harmonic.frequency, 100 + ratio * 300, now, 0.06);
        setParam(whine.frequency, 620 + ratio * 1_250, now, 0.05);
        setParam(motorGain.gain, 0.025 + ratio * 0.105 + throttle * 0.022, now, 0.06);
        setParam(whineGain.gain, 0.0035 + ratio * 0.012 + throttle * 0.004, now, 0.08);
      };
      disposeEngine = () => {
        fundamental.stop();
        harmonic.stop();
        whine.stop();
      };
    } else if (this.preset === "v8") {
      const motorFilter = context.createBiquadFilter();
      motorFilter.type = "lowpass";
      motorFilter.frequency.value = 560;
      const shaper = createDistortion(context);
      const motorGain = context.createGain();
      motorGain.gain.value = 0.02;

      const oscillators = [-8, 0, 8].map((detune) => {
        const oscillator = context.createOscillator();
        oscillator.type = "sawtooth";
        oscillator.frequency.value = 42;
        oscillator.detune.value = detune;
        oscillator.connect(motorFilter);
        oscillator.start(now);
        sources.push(oscillator);
        return oscillator;
      });
      const sub = context.createOscillator();
      sub.type = "sine";
      sub.frequency.value = 24;
      sub.connect(motorFilter);
      sub.start(now);
      sources.push(sub);
      motorFilter.connect(shaper);
      shaper.connect(motorGain);
      motorGain.connect(master);

      const lfo = context.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 17;
      const lfoGain = context.createGain();
      lfoGain.gain.value = 0.012;
      lfo.connect(lfoGain);
      lfoGain.connect(motorGain.gain);
      lfo.start(now);
      sources.push(lfo);
      nodes.push(motorFilter, shaper, motorGain, lfoGain);

      updateEngine = (speed, throttle) => {
        const ratio = speedRatio(speed);
        oscillators.forEach((oscillator, index) => {
          setParam(oscillator.frequency, 30 + ratio * 62 + index * 0.4, now, 0.08);
        });
        setParam(sub.frequency, 18 + ratio * 32, now, 0.1);
        setParam(motorFilter.frequency, 280 + ratio * 900, now, 0.12);
        setParam(motorGain.gain, 0.018 + ratio * 0.09 + throttle * 0.03, now, 0.06);
      };
      disposeEngine = () => {
        oscillators.forEach((oscillator) => oscillator.stop());
        sub.stop();
        lfo.stop();
      };
    } else if (this.preset === "warp") {
      const motorFilter = context.createBiquadFilter();
      motorFilter.type = "bandpass";
      motorFilter.frequency.value = 480;
      motorFilter.Q.value = 2.2;
      const motorGain = context.createGain();
      motorGain.gain.value = 0.02;
      const oscillators = [-7, 7].map((detune) => {
        const oscillator = context.createOscillator();
        oscillator.type = "sawtooth";
        oscillator.frequency.value = 70;
        oscillator.detune.value = detune;
        oscillator.connect(motorFilter);
        oscillator.start(now);
        sources.push(oscillator);
        return oscillator;
      });
      const shimmer = context.createOscillator();
      shimmer.type = "sine";
      shimmer.frequency.value = 920;
      const shimmerGain = context.createGain();
      shimmerGain.gain.value = 0.004;
      shimmer.connect(shimmerGain);
      shimmerGain.connect(master);
      shimmer.start(now);
      sources.push(shimmer);
      motorFilter.connect(motorGain);
      motorGain.connect(master);

      const lfo = context.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 0.14;
      const lfoGain = context.createGain();
      lfoGain.gain.value = 220;
      lfo.connect(lfoGain);
      lfoGain.connect(motorFilter.frequency);
      lfo.start(now);
      sources.push(lfo);
      nodes.push(motorFilter, motorGain, shimmerGain, lfoGain);

      updateEngine = (speed, throttle) => {
        const ratio = speedRatio(speed);
        oscillators.forEach((oscillator) => {
          setParam(oscillator.frequency, 55 + ratio * 170, now, 0.09);
        });
        setParam(motorFilter.frequency, 420 + ratio * 1_500, now, 0.12);
        setParam(motorGain.gain, 0.015 + ratio * 0.08 + throttle * 0.025, now, 0.08);
        setParam(shimmer.frequency, 760 + ratio * 1_400, now, 0.1);
        setParam(shimmerGain.gain, 0.002 + ratio * 0.01, now, 0.1);
      };
      disposeEngine = () => {
        oscillators.forEach((oscillator) => oscillator.stop());
        shimmer.stop();
        lfo.stop();
      };
    }

    this.graph = {
      update: (speed, throttle) => {
        updateAmbient(speed);
        updateEngine(speed, throttle);
      },
      dispose: () => {
        try {
          disposeEngine();
        } catch {
          // El grafo pudo detenerse antes.
        }
        sources.forEach((source) => {
          try {
            source.stop();
          } catch {
            // Ya estaba detenido.
          }
          source.disconnect();
        });
        nodes.forEach((node) => node.disconnect());
        ambientGain.disconnect();
      },
    };
    this.graph.update(0, 0);
  }
}
