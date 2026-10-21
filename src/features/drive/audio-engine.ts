import {
  DEFAULT_STUDIO,
  rpmNorm,
  speedRatio,
  type DriveEngine,
  type StudioSettings,
} from "./drive-config";
import { EngineSynth } from "./engine-synth";

type AudioContextCtor = new () => AudioContext;

const WORKLET_URL = "/drive/engine-worklet.js";
const WORKLET_NAME = "tecla-engine";

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const legacy = window as unknown as { webkitAudioContext?: AudioContextCtor };
  return window.AudioContext ?? legacy.webkitAudioContext ?? null;
}

function ramp(param: AudioParam, value: number, time: number, timeConstant = 0.08) {
  param.setTargetAtTime(value, time, timeConstant);
}

interface Graph {
  source: AudioWorkletNode | ScriptProcessorNode;
  sourceKind: "worklet" | "script";
  resonators: [BiquadFilterNode, BiquadFilterNode, BiquadFilterNode];
  lowpass: BiquadFilterNode;
  synthGain: GainNode;
  pipeDelay: DelayNode;
  pipeFeedback: GainNode;
  pipeTone: BiquadFilterNode;
  windSource: AudioBufferSourceNode;
  windFilter: BiquadFilterNode;
  windGain: GainNode;
  engineGain: GainNode;
  master: GainNode;
  compressor: DynamicsCompressorNode;
}

/**
 * Motor de audio de TECLA DRIVE: síntesis física en tiempo real con
 * resonadores de escape, tubo con realimentación, viento por velocidad y
 * petardeos/válvula de descarga. La síntesis corre en un `AudioWorklet`
 * (hilo de audio) y cae a `ScriptProcessorNode` si el navegador no lo ofrece.
 * Todo se genera en el navegador; no hay samples ni descargas.
 */
export class DriveAudioEngine {
  private context: AudioContext | null = null;
  private graph: Graph | null = null;
  private synth: EngineSynth;
  private engine: DriveEngine;
  private studio: StudioSettings = { ...DEFAULT_STUDIO };
  private volume = 0.85;
  private muted = false;
  private duck = 1;
  private running = false;
  private rpm: number;
  private throttle = 0;

  constructor(engine: DriveEngine) {
    this.engine = engine;
    this.rpm = engine.idle;
    this.synth = new EngineSynth(engine);
  }

  get available(): boolean {
    return getAudioContextCtor() !== null;
  }

  get isRunning(): boolean {
    return this.running;
  }

  /** "worklet", "script" o null si aún no hay grafo. */
  get backend(): "worklet" | "script" | null {
    return this.graph?.sourceKind ?? null;
  }

  /** Crea el contexto (requiere un gesto del usuario) y enciende el motor. */
  async start(): Promise<void> {
    const AudioCtor = getAudioContextCtor();
    if (!AudioCtor) throw new Error("Este navegador no ofrece Web Audio.");
    if (!this.context) {
      this.context = new AudioCtor();
      this.graph = await this.buildGraph(this.context);
    }
    await this.context.resume();
    this.running = true;
    this.postToWorklet({ type: "running", value: true });
    this.applyGains();
  }

  /** Apaga el motor (el viento sigue mientras haya velocidad). */
  stop(): void {
    this.running = false;
    this.postToWorklet({ type: "running", value: false });
    this.applyGains();
  }

  setEngine(engine: DriveEngine): void {
    this.engine = engine;
    this.synth.setEngine(engine);
    this.postToWorklet({ type: "engine", engine });
  }

  setStudio(studio: StudioSettings): void {
    this.studio = { ...studio };
    this.synth.setStudio(studio);
    this.postToWorklet({ type: "studio", studio });
  }

  setVolume(volume: number): void {
    this.volume = Math.min(1.5, Math.max(0, volume));
    this.applyGains();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyGains();
  }

  /** Atenuación temporal (0–1): estacionado largo o voz de TECLA AI. */
  setDuck(factor: number): void {
    const next = Math.min(1, Math.max(0, factor));
    if (next === this.duck) return;
    this.duck = next;
    this.applyGains();
  }

  /** Se llama en cada cuadro con el estado de la simulación. */
  update(speedKmh: number, rpm: number, throttle: number): void {
    this.rpm = rpm;
    this.throttle = Math.max(0, Math.min(1, throttle));
    this.synth.setDrive(rpm, this.throttle);
    this.postToWorklet({ type: "drive", rpm, throttle: this.throttle });
    const graph = this.graph;
    const context = this.context;
    if (!graph || !context) return;
    const now = context.currentTime;
    const ratio = speedRatio(speedKmh);

    const windLevel =
      Math.min(0.5, Math.pow(ratio * 1.8, 1.6) * 0.5) * (this.muted ? 0 : this.volume * this.duck);
    ramp(graph.windGain.gain, windLevel, now, 0.3);
    ramp(graph.windFilter.frequency, 300 + speedKmh * 3.7, now, 0.3);
    if (!this.running) return;

    const s = this.engine;
    const norm = rpmNorm(s, rpm);
    const tone = this.studio.tone;
    ramp(graph.resonators[0].frequency, s.resonators[0] * tone, now, 0.04);
    ramp(graph.resonators[1].frequency, s.resonators[1] * tone, now, 0.04);
    ramp(graph.resonators[2].frequency, s.resonators[2] * tone, now, 0.04);
    const cutoff = (500 + norm * 4200 + this.throttle * 1800) * tone;
    ramp(graph.lowpass.frequency, Math.min(14000, Math.max(220, cutoff)), now, 0.05);
    ramp(graph.pipeDelay.delayTime, 0.0045 + (1 - tone) * 0.002 + 0.002 * (1 - norm), now, 0.1);
    const level = 0.24 + norm * 0.34 + this.throttle * 0.12;
    ramp(graph.engineGain.gain, level, now, 0.04);
  }

  /** Golpe seco de cambio de marcha (manual o automático). */
  shiftClunk(): void {
    const context = this.context;
    const graph = this.graph;
    if (!context || !graph || !this.running || this.muted) return;
    const now = context.currentTime;
    const sr = context.sampleRate;
    const buffer = context.createBuffer(1, Math.floor(sr * 0.09), sr);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sr * 0.012));
    const noise = context.createBufferSource();
    noise.buffer = buffer;
    const band = context.createBiquadFilter();
    band.type = "lowpass";
    band.frequency.value = 900;
    const thump = context.createOscillator();
    thump.type = "sine";
    thump.frequency.setValueAtTime(140, now);
    thump.frequency.exponentialRampToValueAtTime(55, now + 0.08);
    const gain = context.createGain();
    gain.gain.setValueAtTime(Math.min(0.5, 0.3 * this.volume * this.duck), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    noise.connect(band);
    band.connect(gain);
    thump.connect(gain);
    gain.connect(graph.compressor);
    noise.onended = () => {
      noise.disconnect();
      band.disconnect();
      thump.disconnect();
      gain.disconnect();
    };
    noise.start(now);
    thump.start(now);
    thump.stop(now + 0.13);
  }

  /** Válvula de descarga + petardeos al soltar o cambiar de marcha. */
  liftOff(): void {
    const context = this.context;
    const graph = this.graph;
    if (!context || !graph || !this.running || this.muted) return;
    const s = this.engine;
    const norm = rpmNorm(s, this.rpm);
    if (norm < 0.25) return;
    const now = context.currentTime;
    const sr = context.sampleRate;
    const studio = this.studio;
    const outVolume = this.volume * this.duck;

    if (s.turbo > 0 && studio.turbo > 0.05) {
      const duration = s.flutter ? 0.6 : 0.38;
      const buffer = context.createBuffer(1, Math.floor(sr * duration), sr);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        const t = i / sr;
        const fm = s.flutter ? 0.45 + 0.55 * Math.sin(t * Math.PI * 2 * 18.5) : 1;
        data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 5) * fm;
      }
      const source = context.createBufferSource();
      source.buffer = buffer;
      const band = context.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.setValueAtTime(2500, now);
      band.frequency.exponentialRampToValueAtTime(1000, now + duration);
      band.Q.value = 3.2;
      const gain = context.createGain();
      gain.gain.value = Math.min(0.7, 0.32 * s.turbo * studio.turbo * outVolume);
      source.connect(band);
      band.connect(gain);
      gain.connect(graph.compressor);
      source.onended = () => {
        source.disconnect();
        band.disconnect();
        gain.disconnect();
      };
      source.start(now);
    }

    const pops = Math.min(12, Math.round(s.crackle * studio.crackles));
    for (let p = 0; p < pops; p += 1) {
      const delay = 0.04 + p * (0.055 + Math.random() * 0.06);
      const buffer = context.createBuffer(1, Math.floor(sr * 0.075), sr);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sr * 0.014));
      }
      const source = context.createBufferSource();
      source.buffer = buffer;
      const band = context.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = s.resonators[1] * studio.tone * (0.8 + Math.random() * 0.5);
      band.Q.value = 1.4;
      const gain = context.createGain();
      gain.gain.value = Math.min(0.85, 0.55 * studio.crackles * outVolume * Math.pow(0.84, p));
      source.connect(band);
      band.connect(gain);
      gain.connect(graph.compressor);
      source.onended = () => {
        source.disconnect();
        band.disconnect();
        gain.disconnect();
      };
      source.start(now + delay);
    }
  }

  dispose(): void {
    this.running = false;
    const graph = this.graph;
    if (graph) {
      if (graph.sourceKind === "script") (graph.source as ScriptProcessorNode).onaudioprocess = null;
      else (graph.source as AudioWorkletNode).port.close();
      try {
        graph.windSource.stop();
      } catch {
        // Ya estaba detenido.
      }
      [
        graph.source,
        graph.resonators[0],
        graph.resonators[1],
        graph.resonators[2],
        graph.lowpass,
        graph.synthGain,
        graph.pipeDelay,
        graph.pipeFeedback,
        graph.pipeTone,
        graph.windSource,
        graph.windFilter,
        graph.windGain,
        graph.engineGain,
        graph.master,
        graph.compressor,
      ].forEach((node) => node.disconnect());
    }
    this.graph = null;
    const context = this.context;
    this.context = null;
    if (context) void context.close().catch(() => undefined);
  }

  private postToWorklet(message: Record<string, unknown>): void {
    const graph = this.graph;
    if (!graph || graph.sourceKind !== "worklet") return;
    (graph.source as AudioWorkletNode).port.postMessage(message);
  }

  private applyGains(): void {
    const graph = this.graph;
    const context = this.context;
    if (!graph || !context) return;
    const now = context.currentTime;
    ramp(graph.master.gain, this.muted ? 0 : this.volume * this.duck, now, 0.08);
    if (!this.running) ramp(graph.engineGain.gain, 0.0001, now, 0.08);
  }

  private async createSource(
    context: AudioContext,
  ): Promise<{ node: AudioWorkletNode | ScriptProcessorNode; kind: "worklet" | "script" }> {
    const sr = context.sampleRate;
    if (context.audioWorklet && typeof AudioWorkletNode !== "undefined") {
      try {
        await context.audioWorklet.addModule(WORKLET_URL);
        const node = new AudioWorkletNode(context, WORKLET_NAME, {
          numberOfInputs: 0,
          numberOfOutputs: 1,
          outputChannelCount: [1],
        });
        node.port.postMessage({ type: "engine", engine: this.engine });
        node.port.postMessage({ type: "studio", studio: this.studio });
        node.port.postMessage({ type: "drive", rpm: this.rpm, throttle: this.throttle });
        node.port.postMessage({ type: "running", value: this.running });
        return { node, kind: "worklet" };
      } catch {
        // Sin AudioWorklet (o módulo bloqueado): usamos el procesador en el hilo principal.
      }
    }
    const processor = context.createScriptProcessor(2048, 1, 1);
    processor.onaudioprocess = (event) => {
      const out = event.outputBuffer.getChannelData(0);
      if (!this.running) {
        out.fill(0);
        return;
      }
      this.synth.render(out, sr);
    };
    return { node: processor, kind: "script" };
  }

  private async buildGraph(context: AudioContext): Promise<Graph> {
    const sr = context.sampleRate;
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.knee.value = 18;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.12;
    compressor.connect(context.destination);

    const master = context.createGain();
    master.gain.value = this.muted ? 0 : this.volume * this.duck;
    master.connect(compressor);

    const engineGain = context.createGain();
    engineGain.gain.value = 0.0001;
    engineGain.connect(master);

    const resonators: Graph["resonators"] = [
      context.createBiquadFilter(),
      context.createBiquadFilter(),
      context.createBiquadFilter(),
    ];
    const resonatorGains = [10, 7, 5];
    const resonatorQs = [2.4, 3.2, 3.6];
    resonators.forEach((filter, index) => {
      filter.type = "peaking";
      filter.Q.value = resonatorQs[index] ?? 3;
      filter.gain.value = resonatorGains[index] ?? 6;
      filter.frequency.value = this.engine.resonators[index as 0 | 1 | 2];
    });
    const lowpass = context.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 2400;
    lowpass.Q.value = 1.1;

    const synthGain = context.createGain();
    synthGain.gain.value = 1;

    const pipeDelay = context.createDelay(0.05);
    pipeDelay.delayTime.value = 0.0062;
    const pipeFeedback = context.createGain();
    pipeFeedback.gain.value = 0.32;
    const pipeTone = context.createBiquadFilter();
    pipeTone.type = "lowpass";
    pipeTone.frequency.value = 1800;

    const { node: source, kind: sourceKind } = await this.createSource(context);

    source.connect(resonators[0]);
    resonators[0].connect(resonators[1]);
    resonators[1].connect(resonators[2]);
    resonators[2].connect(lowpass);
    lowpass.connect(synthGain);
    synthGain.connect(pipeDelay);
    pipeDelay.connect(pipeTone);
    pipeTone.connect(pipeFeedback);
    pipeFeedback.connect(pipeDelay);
    synthGain.connect(engineGain);
    pipeDelay.connect(engineGain);

    const windBuffer = context.createBuffer(1, sr * 2, sr);
    const windData = windBuffer.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < windData.length; i += 1) {
      brown = brown * 0.985 + (Math.random() * 2 - 1) * 0.03;
      windData[i] = brown * 3.2;
    }
    const windSource = context.createBufferSource();
    windSource.buffer = windBuffer;
    windSource.loop = true;
    const windFilter = context.createBiquadFilter();
    windFilter.type = "bandpass";
    windFilter.frequency.value = 400;
    windFilter.Q.value = 0.6;
    const windGain = context.createGain();
    windGain.gain.value = 0;
    windSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(compressor);
    windSource.start();

    return {
      source,
      sourceKind,
      resonators,
      lowpass,
      synthGain,
      pipeDelay,
      pipeFeedback,
      pipeTone,
      windSource,
      windFilter,
      windGain,
      engineGain,
      master,
      compressor,
    };
  }
}
