/**
 * Renderizador de escenas de TECLA DRIVE: carretera pseudo-3D con curvas y
 * colinas, objetos con profundidad, tráfico, niebla y efectos por escena.
 * Todo se dibuja con Canvas 2D en el navegador; no hay imágenes externas.
 */
import { DEFAULT_SCENE_ID, type DriveSceneId, type WeatherGroup } from "./drive-config";

const VIEW = 42; // unidades de distancia visibles
const SEG = 64; // segmentos de carretera
const TAU = Math.PI * 2;

interface GeoPoint {
  x: number;
  y: number;
  hw: number;
  scale: number;
  z: number;
  p: number;
}

interface TrackObject {
  kind: string;
  z: number;
  side: -1 | 1;
  off: number;
  seed: number;
  size: number;
}

interface TrafficCar {
  z: number;
  lane: number;
  oncoming: boolean;
  v: number;
  hue: number;
  w: number;
}

interface Spawner {
  kind: string;
  rate: number;
  off: readonly [number, number];
  side?: -1 | 1;
  size?: number;
}

interface SceneDefinition {
  night: boolean;
  style?: "neon";
  noGeometry?: boolean;
  spawn: readonly Spawner[];
  draw: (r: DriveSceneRenderer, speedFactor: number) => void;
}

interface MountainLayer {
  col: string;
  amp: number;
  lift: number;
  f1: number;
  f2: number;
  o: number;
  snow?: string;
}

interface RoadStyle {
  asphalt: string;
  edge: string;
  center: string;
  shoulder: string | null;
  glow: string | null;
}

type SpriteFn = (r: DriveSceneRenderer, x: number, y: number, s: number, seed: number, p: number) => void;

const rnd = (seed: number): number => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export function curvatureAt(d: number): number {
  return Math.sin(d * 0.085) * 0.75 + Math.sin(d * 0.027 + 1.3) * 0.65 + Math.sin(d * 0.0077 + 4) * 0.5;
}

function hillAt(d: number): number {
  return Math.sin(d * 0.045) * 0.55 + Math.sin(d * 0.013 + 2) * 0.45;
}

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) * f);
  const g = Math.min(255, ((n >> 8) & 255) * f);
  const b = Math.min(255, (n & 255) * f);
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

const bgStars = Array.from({ length: 160 }, (_, i) => ({
  x: rnd(i * 3.3),
  y: rnd(i * 7.1) * 0.6,
  r: 0.5 + rnd(i * 1.7) * 1.4,
  a: 0.25 + rnd(i * 9.2) * 0.75,
  tw: rnd(i) * 6,
}));

export class DriveSceneRenderer {
  readonly ctx: CanvasRenderingContext2D;
  W = 960;
  H = 540;
  roadDist = 0;
  animTime = 0;
  horizonY = 0;
  camX = 0;
  geo: GeoPoint[] = [];
  lightning = 0;
  private lightningTimer = 4;
  private sceneId: DriveSceneId = DEFAULT_SCENE_ID;
  private trackObjects: TrackObject[] = [];
  private trackSeedZ = 0;
  private traffic: TrafficCar[] = [];
  private speedKmh = 0;
  /** Curvatura impuesta desde fuera (giro real del GPS), −1…1, o null para la sintética. */
  private externalCurvature: number | null = null;
  private smoothedExternal = 0;
  lowDetail = false;
  /** Clima real dibujado sobre la escena (lluvia, llovizna, niebla, nieve). */
  private weather: WeatherGroup | null = null;
  private readonly rain = Array.from({ length: 140 }, () => ({
    x: Math.random(),
    y: Math.random(),
    len: 0.02 + Math.random() * 0.035,
    speed: 0.9 + Math.random() * 0.7,
  }));
  private readonly warpStars = Array.from({ length: 260 }, () => ({
    x: (Math.random() - 0.5) * 1800,
    y: (Math.random() - 0.5) * 900,
    z: Math.random() * 900,
    hue: Math.random() > 0.35 ? 195 : 280,
  }));
  private readonly particles = Array.from({ length: 70 }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: 1 + Math.random() * 2.2,
    vx: (Math.random() - 0.5) * 0.0006,
    vy: 0.0008 + Math.random() * 0.0018,
    ph: Math.random() * 6,
  }));

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  resize(width: number, height: number): void {
    this.W = Math.max(320, width);
    this.H = Math.max(240, height);
  }

  setScene(id: DriveSceneId): void {
    if (id === this.sceneId) return;
    this.sceneId = id;
    this.resetTrack();
  }

  get scene(): DriveSceneId {
    return this.sceneId;
  }

  setWeather(group: WeatherGroup | null): void {
    this.weather = group;
  }

  private drawWeather(dt: number): void {
    const { ctx, W, H, weather } = this;
    if (!weather || this.lowDetail) return;
    if (weather === "rain" || weather === "drizzle" || weather === "storm") {
      const heavy = weather !== "drizzle";
      ctx.save();
      ctx.strokeStyle = heavy ? "rgba(200,220,255,0.35)" : "rgba(200,220,255,0.2)";
      ctx.lineWidth = heavy ? 1.2 : 0.8;
      ctx.beginPath();
      for (const drop of this.rain) {
        drop.y += drop.speed * dt * (heavy ? 1.6 : 1.1);
        drop.x -= dt * 0.08;
        if (drop.y > 1.05) {
          drop.y = -0.05;
          drop.x = Math.random();
        }
        if (drop.x < -0.05) drop.x = 1.05;
        const x = drop.x * W;
        const y = drop.y * H;
        ctx.moveTo(x, y);
        ctx.lineTo(x - W * 0.004, y + drop.len * H);
      }
      ctx.stroke();
      ctx.restore();
      const wet = ctx.createLinearGradient(0, this.horizonY, 0, H);
      wet.addColorStop(0, "rgba(120,160,220,0)");
      wet.addColorStop(1, "rgba(120,160,220,0.1)");
      ctx.fillStyle = wet;
      ctx.fillRect(0, this.horizonY, W, H - this.horizonY);
    } else if (weather === "fog") {
      this.drawFog("200,210,225", 0.3);
    } else if (weather === "snow") {
      this.drawParticles("rgba(255,255,255,0.85)", false, 2, 1);
    }
  }

  /** Curvatura unos metros por delante, para el paseo automático. */
  curvatureAhead(): number {
    return this.externalCurvature === null ? curvatureAt(this.roadDist + 6) : this.smoothedExternal;
  }

  /** Giro real del vehículo (grados/segundo, derecha positiva) o null para la carretera sintética. */
  setExternalTurnRate(degPerSec: number | null): void {
    if (degPerSec === null || !Number.isFinite(degPerSec)) {
      this.externalCurvature = null;
      return;
    }
    this.externalCurvature = Math.max(-1, Math.min(1, degPerSec / 25));
  }

  private roadCurvature(d: number): number {
    if (this.externalCurvature === null) return curvatureAt(d);
    return this.smoothedExternal;
  }

  render(speedFactor: number, speedKmh: number, dt: number, reducedMotion: boolean): void {
    const scene = SCENES[this.sceneId] ?? SCENES.halloween;
    const ctx = this.ctx;
    const { W, H } = this;
    this.speedKmh = speedKmh;
    const speedUnits = speedFactor * 0.022 * dt * 60;
    this.roadDist += speedUnits;
    this.animTime += 0.016 * dt * 60;
    if (this.externalCurvature !== null) {
      this.smoothedExternal += (this.externalCurvature - this.smoothedExternal) * Math.min(1, dt * 2.5);
    }

    this.camX += (-this.roadCurvature(this.roadDist + 3) * W * 0.05 * Math.min(1, speedKmh / 112) - this.camX) * 0.05;
    const shake = reducedMotion ? 0 : (speedKmh / 240) * 1.6;
    const sx = (Math.random() - 0.5) * shake;
    const sy = (Math.random() - 0.5) * shake;

    if (this.sceneId === "halloween" && !reducedMotion) {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightning = 1;
        this.lightningTimer = 5 + Math.random() * 9;
      }
      this.lightning = Math.max(0, this.lightning - dt * 2.2);
      if (this.lightning > 0 && this.lightning < 0.55 && Math.random() < 0.05) this.lightning = 0.9;
    } else {
      this.lightning = 0;
    }

    ctx.save();
    ctx.translate(sx, sy);
    ctx.clearRect(-2, -2, W + 4, H + 4);
    if (!scene.noGeometry) {
      this.buildGeometry();
      this.spawnTrack(scene.spawn);
      this.updateTraffic(speedUnits);
    }
    scene.draw(this, speedFactor);
    if (!scene.noGeometry) this.drawWeather(dt);
    ctx.restore();
  }

  // ---------- Geometría ----------

  private buildGeometry(): void {
    const { W, H } = this;
    this.geo = [];
    this.horizonY = H * 0.46 + hillAt(this.roadDist) * H * 0.035;
    const kCurve = (W / 960) * 0.085;
    let x = W * 0.5 + this.camX;
    let dx = 0;
    for (let i = 0; i <= SEG; i += 1) {
      const z = (i / SEG) * VIEW;
      const p = 1 - i / SEG;
      dx += this.roadCurvature(this.roadDist + z) * kCurve;
      x += dx;
      const y =
        this.horizonY +
        Math.pow(p, 2.15) * (H - this.horizonY) -
        (hillAt(this.roadDist + z) - hillAt(this.roadDist)) * (1 - p) * H * 0.06;
      this.geo.push({
        x,
        y,
        hw: 8 + Math.pow(p, 2.05) * W * 0.36,
        scale: 0.07 + Math.pow(p, 1.95) * 1.45 * (H / 540),
        z,
        p,
      });
    }
  }

  geoAt(p: number): GeoPoint {
    const f = (1 - Math.max(0, Math.min(1, p))) * SEG;
    const i = Math.min(SEG - 1, Math.floor(f));
    const t = f - i;
    const a = this.geo[i];
    const b = this.geo[i + 1];
    if (!a || !b) return { x: this.W / 2, y: this.horizonY, hw: 8, scale: 0.07, z: 0, p };
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      hw: a.hw + (b.hw - a.hw) * t,
      scale: a.scale + (b.scale - a.scale) * t,
      z: a.z + (b.z - a.z) * t,
      p,
    };
  }

  private resetTrack(): void {
    this.trackObjects = [];
    this.trackSeedZ = this.roadDist;
    this.traffic = [];
  }

  private spawnTrack(spawners: readonly Spawner[]): void {
    while (this.trackSeedZ < this.roadDist + VIEW + 2) {
      const seedZ = this.trackSeedZ;
      for (const sp of spawners) {
        const r = rnd(seedZ * 13.7 + sp.kind.length * 3.1);
        if (r < (this.lowDetail ? sp.rate * 0.5 : sp.rate)) {
          const side: -1 | 1 = sp.side ?? (rnd(seedZ * 7.3 + 1) < 0.5 ? -1 : 1);
          this.trackObjects.push({
            kind: sp.kind,
            z: seedZ + rnd(seedZ) * 0.9,
            side,
            off: sp.off[0] + rnd(seedZ * 3 + 9) * (sp.off[1] - sp.off[0]),
            seed: rnd(seedZ * 5 + 2) * 1000,
            size: sp.size ?? 1,
          });
        }
      }
      this.trackSeedZ += 1;
    }
    this.trackObjects = this.trackObjects.filter((o) => o.z > this.roadDist - 0.5);
  }

  private updateTraffic(speedUnits: number): void {
    if (this.traffic.length < 3 && Math.random() < 0.012) {
      const oncoming = Math.random() < 0.55;
      const lane = oncoming ? -0.5 : 0.5;
      if (!this.traffic.some((c) => c.lane === lane && c.z > this.roadDist + VIEW - 10)) {
        this.traffic.push({
          z: this.roadDist + VIEW + 1,
          lane,
          oncoming,
          v: oncoming ? 0.07 + Math.random() * 0.05 : 0.035 + Math.random() * 0.03,
          hue: Math.random() * 360,
          w: 0.9 + Math.random() * 0.4,
        });
      }
    }
    for (const c of this.traffic) c.z += c.oncoming ? -(c.v + speedUnits) : c.v - speedUnits;
    this.traffic = this.traffic.filter((c) => c.z > this.roadDist - 1 && c.z < this.roadDist + VIEW + 3);
  }

  // ---------- Primitivas ----------

  drawGround(colTop: string, colBottom: string): void {
    const { ctx, W, H, horizonY } = this;
    const g = ctx.createLinearGradient(0, horizonY - 10, 0, H);
    g.addColorStop(0, colTop);
    g.addColorStop(1, colBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, horizonY - 12, W, H - horizonY + 12);
  }

  drawRoad(style: RoadStyle): void {
    const { ctx, geo } = this;
    for (let i = SEG - 1; i >= 0; i -= 1) {
      const a = geo[i + 1];
      const b = geo[i];
      if (!a || !b) continue;
      const zA = this.roadDist + a.z;
      if (style.shoulder) {
        ctx.fillStyle = style.shoulder;
        ctx.beginPath();
        ctx.moveTo(a.x - a.hw * 1.12, a.y);
        ctx.lineTo(a.x + a.hw * 1.12, a.y);
        ctx.lineTo(b.x + b.hw * 1.12, b.y);
        ctx.lineTo(b.x - b.hw * 1.12, b.y);
        ctx.closePath();
        ctx.fill();
      }
      const band = Math.floor(zA * 1.5) % 2 === 0;
      ctx.fillStyle = band ? style.asphalt : shade(style.asphalt, 1.08);
      ctx.beginPath();
      ctx.moveTo(a.x - a.hw, a.y);
      ctx.lineTo(a.x + a.hw, a.y);
      ctx.lineTo(b.x + b.hw, b.y);
      ctx.lineTo(b.x - b.hw, b.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = style.edge;
      ctx.lineWidth = Math.max(0.8, b.p * 4);
      ctx.beginPath();
      ctx.moveTo(a.x - a.hw * 0.94, a.y);
      ctx.lineTo(b.x - b.hw * 0.94, b.y);
      ctx.moveTo(a.x + a.hw * 0.94, a.y);
      ctx.lineTo(b.x + b.hw * 0.94, b.y);
      ctx.stroke();
      if (Math.floor(zA * 1.5) % 3 === 0) {
        ctx.strokeStyle = style.center;
        ctx.lineWidth = Math.max(0.8, b.p * 3.4);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      if (style.glow && Math.floor(zA * 1.5) % 6 === 0 && b.p > 0.2) {
        ctx.fillStyle = style.glow;
        ctx.beginPath();
        ctx.arc(b.x - b.hw * 0.94, b.y, Math.max(0.6, b.p * 2.2), 0, TAU);
        ctx.arc(b.x + b.hw * 0.94, b.y, Math.max(0.6, b.p * 2.2), 0, TAU);
        ctx.fill();
      }
    }
  }

  drawTrackObjects(night: boolean, style?: "neon"): void {
    type Item = { z: number; car?: TrafficCar; obj?: TrackObject };
    const items: Item[] = [
      ...this.trackObjects.map((obj) => ({ z: obj.z, obj })),
      ...this.traffic.map((car) => ({ z: car.z, car })),
    ].sort((a, b) => b.z - a.z);
    for (const item of items) {
      const p = 1 - (item.z - this.roadDist) / VIEW;
      if (p < 0.02 || p > 1.02) continue;
      const g = this.geoAt(p);
      if (item.car) {
        this.drawCar(g.x + item.car.lane * g.hw, g.y, g.scale * item.car.w, item.car, night, style);
        continue;
      }
      const obj = item.obj;
      if (!obj) continue;
      const x = g.x + obj.side * (g.hw * 1.12 + obj.off * g.hw);
      const fn = SPRITES[obj.kind];
      if (fn) fn(this, x, g.y, g.scale * obj.size, obj.seed, p);
    }
  }

  roundRect(x: number, y: number, w: number, h: number, r: number): void {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  private drawCar(x: number, y: number, s: number, c: TrafficCar, night: boolean, style?: "neon"): void {
    const { ctx } = this;
    const w = 48 * s;
    const h = 22 * s;
    ctx.save();
    if (night) {
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 8 * s;
    }
    ctx.fillStyle = style === "neon" ? `hsl(${c.hue},80%,22%)` : night ? "#0a0b12" : `hsl(${c.hue},25%,32%)`;
    this.roundRect(x - w / 2, y - h, w, h, 4 * s);
    ctx.fill();
    ctx.fillStyle = night ? "#0d0f18" : `hsl(${c.hue},25%,26%)`;
    this.roundRect(x - w * 0.34, y - h * 1.7, w * 0.68, h * 0.85, 5 * s);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = night ? "rgba(90,110,150,0.25)" : "rgba(160,200,230,0.55)";
    this.roundRect(x - w * 0.3, y - h * 1.62, w * 0.6, h * 0.5, 3 * s);
    ctx.fill();
    ctx.fillStyle = "#050507";
    ctx.fillRect(x - w * 0.46, y - 6 * s, 9 * s, 7 * s);
    ctx.fillRect(x + w * 0.46 - 9 * s, y - 6 * s, 9 * s, 7 * s);
    const lx = [x - w * 0.36, x + w * 0.36];
    const ly = y - h * 0.55;
    if (c.oncoming) {
      for (const px of lx) {
        const gl = ctx.createRadialGradient(px, ly, 1, px, ly, 26 * s);
        gl.addColorStop(0, "rgba(255,255,235,1)");
        gl.addColorStop(0.25, night ? "rgba(255,250,210,0.55)" : "rgba(255,250,210,0.3)");
        gl.addColorStop(1, "transparent");
        ctx.fillStyle = gl;
        ctx.beginPath();
        ctx.arc(px, ly, 26 * s, 0, TAU);
        ctx.fill();
      }
      if (night) {
        const cone = ctx.createLinearGradient(x, ly, x, ly + 90 * s);
        cone.addColorStop(0, "rgba(255,250,220,0.18)");
        cone.addColorStop(1, "transparent");
        ctx.fillStyle = cone;
        ctx.beginPath();
        ctx.moveTo(x - w * 0.45, ly);
        ctx.lineTo(x + w * 0.45, ly);
        ctx.lineTo(x + w * 1.4, ly + 90 * s);
        ctx.lineTo(x - w * 1.4, ly + 90 * s);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      for (const px of lx) {
        const gl = ctx.createRadialGradient(px, ly, 1, px, ly, 16 * s);
        gl.addColorStop(0, "rgba(255,70,70,1)");
        gl.addColorStop(0.3, "rgba(255,40,40,0.5)");
        gl.addColorStop(1, "transparent");
        ctx.fillStyle = gl;
        ctx.beginPath();
        ctx.arc(px, ly, 16 * s, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = "#ff2d2d";
      ctx.fillRect(x - w * 0.42, ly - 2 * s, w * 0.18, 4 * s);
      ctx.fillRect(x + w * 0.24, ly - 2 * s, w * 0.18, 4 * s);
    }
    ctx.restore();
  }

  drawStars(alpha: number): void {
    const { ctx, W, horizonY, animTime } = this;
    for (const st of bgStars) {
      const tw = 0.7 + 0.3 * Math.sin(animTime * 2 + st.tw);
      ctx.fillStyle = `rgba(255,255,255,${st.a * alpha * tw})`;
      ctx.beginPath();
      ctx.arc(st.x * W, st.y * horizonY, st.r, 0, TAU);
      ctx.fill();
    }
  }

  drawMoon(mx: number, my: number, r: number, col: string, haloCol: string): void {
    const { ctx } = this;
    const halo = ctx.createRadialGradient(mx, my, r * 0.6, mx, my, r * 3);
    halo.addColorStop(0, haloCol);
    halo.addColorStop(1, "transparent");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(mx, my, r * 3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(120,115,105,0.35)";
    const craters: [number, number, number][] = [
      [-0.33, 0.22, 0.26],
      [0.28, -0.18, 0.33],
      [0.15, 0.4, 0.18],
      [-0.46, -0.28, 0.16],
      [0.5, 0.3, 0.12],
    ];
    for (const [dx, dy, rr] of craters) {
      ctx.beginPath();
      ctx.arc(mx + dx * r, my + dy * r, rr * r, 0, TAU);
      ctx.fill();
    }
  }

  drawClouds(count: number, col: string, yBase: number, speed: number): void {
    const { ctx, W, H, animTime } = this;
    for (let c = 0; c < count; c += 1) {
      const cx = (((c * 0.23 + animTime * speed) % 1.3) - 0.15) * W;
      const cy = yBase + (c % 3) * 0.06 * H;
      const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, W * 0.16);
      g.addColorStop(0, col);
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.fillRect(cx - W * 0.16, cy - H * 0.15, W * 0.32, H * 0.3);
    }
  }

  drawFog(rgb: string, strength: number): void {
    const { ctx, W, H, horizonY, animTime } = this;
    if (this.lowDetail) {
      const flat = ctx.createLinearGradient(0, horizonY - H * 0.08, 0, horizonY + H * 0.22);
      flat.addColorStop(0, "transparent");
      flat.addColorStop(0.45, `rgba(${rgb},${strength})`);
      flat.addColorStop(1, "transparent");
      ctx.fillStyle = flat;
      ctx.fillRect(0, horizonY - H * 0.08, W, H * 0.3);
      return;
    }
    const g = ctx.createLinearGradient(0, horizonY - H * 0.08, 0, horizonY + H * 0.22);
    g.addColorStop(0, "transparent");
    g.addColorStop(0.45, `rgba(${rgb},${strength})`);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(0, horizonY - H * 0.08, W, H * 0.3);
    for (let i = 0; i < 5; i += 1) {
      const fx = (((i * 0.27 + animTime * 0.02 * (1 + i * 0.3)) % 1.4) - 0.2) * W;
      const fy = horizonY + H * (0.08 + i * 0.07);
      const fg = ctx.createRadialGradient(fx, fy, 2, fx, fy, W * 0.22);
      fg.addColorStop(0, `rgba(${rgb},${strength * 0.9})`);
      fg.addColorStop(1, "transparent");
      ctx.fillStyle = fg;
      ctx.fillRect(fx - W * 0.22, fy - H * 0.06, W * 0.44, H * 0.12);
    }
  }

  drawParticles(col: string, rise: boolean, drift: number, speedFactor: number): void {
    if (this.lowDetail) return;
    const { ctx, W, H, animTime } = this;
    ctx.fillStyle = col;
    for (const pt of this.particles) {
      pt.x = (pt.x + pt.vx * drift + Math.sin(animTime + pt.ph) * 0.0003 + 1) % 1;
      pt.y = (pt.y + (rise ? -1 : 1) * pt.vy * (0.6 + speedFactor * 0.15) + 1) % 1;
      ctx.beginPath();
      ctx.arc(pt.x * W, pt.y * H, pt.r, 0, TAU);
      ctx.fill();
    }
  }

  drawVignette(strength: number): void {
    const { ctx, W, H } = this;
    const g = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.35, W / 2, H * 0.5, H * 0.95);
    g.addColorStop(0, "transparent");
    g.addColorStop(1, `rgba(0,0,0,${strength})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  drawHeadlights(): void {
    const { ctx, H } = this;
    const n = this.geoAt(0.98);
    const f = this.geoAt(0.55);
    const g = ctx.createLinearGradient(0, n.y, 0, f.y);
    g.addColorStop(0, "rgba(255,250,225,0.22)");
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(n.x - n.hw * 0.75, H);
    ctx.lineTo(f.x - f.hw * 1.1, f.y);
    ctx.lineTo(f.x + f.hw * 1.1, f.y);
    ctx.lineTo(n.x + n.hw * 0.75, H);
    ctx.closePath();
    ctx.fill();
  }

  drawLightning(): void {
    const { ctx, W, H, horizonY, lightning } = this;
    if (lightning <= 0) return;
    ctx.fillStyle = `rgba(230,225,255,${lightning * 0.35})`;
    ctx.fillRect(0, 0, W, H);
    if (lightning > 0.6) {
      ctx.strokeStyle = `rgba(255,255,255,${lightning})`;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "#c4b5fd";
      ctx.shadowBlur = 18;
      let x = W * (0.55 + rnd(this.lightningTimer) * 0.35);
      let y = 0;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let i = 0; i < 9; i += 1) {
        x += (Math.random() - 0.5) * 60;
        y += horizonY / 9;
        ctx.lineTo(x, y);
        if (i === 4) {
          ctx.moveTo(x, y);
          ctx.lineTo(x + 40, y + 50);
          ctx.moveTo(x, y);
        }
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  drawMountains(layers: readonly MountainLayer[]): void {
    const { ctx, W, H, horizonY } = this;
    layers.forEach((L, li) => {
      const par = curvatureAt(this.roadDist) * (li + 1) * 12;
      const pts: [number, number, number][] = [];
      for (let x = 0; x <= W + 60; x += 40) {
        const n = x / W;
        const hgt = (Math.sin(n * L.f1 + L.o) * 0.5 + Math.sin(n * L.f2 + L.o * 2) * 0.35 + 0.5) * L.amp * H;
        pts.push([x - par, horizonY - hgt + L.lift * H, hgt]);
      }
      ctx.fillStyle = L.col;
      ctx.beginPath();
      ctx.moveTo(-40, horizonY + 6);
      for (const q of pts) ctx.lineTo(q[0], q[1]);
      ctx.lineTo(W + 60, horizonY + 6);
      ctx.closePath();
      ctx.fill();
      if (L.snow) {
        const thr = L.amp * H * 0.62;
        ctx.fillStyle = L.snow;
        ctx.beginPath();
        pts.forEach((q, i) => (i === 0 ? ctx.moveTo(q[0], q[1]) : ctx.lineTo(q[0], q[1])));
        for (let i = pts.length - 1; i >= 0; i -= 1) {
          const q = pts[i];
          if (!q) continue;
          const th = Math.max(0, q[2] - thr) * 0.3 + (q[2] > thr ? 3 + rnd(i) * 5 : 0);
          ctx.lineTo(q[0], q[1] + th);
        }
        ctx.closePath();
        ctx.fill();
      }
    });
  }

  drawCity(baseY: number, count: number, col: string, litCol: string): void {
    const { ctx, W, H } = this;
    const par = curvatureAt(this.roadDist) * 30;
    for (let i = 0; i < count; i += 1) {
      const bw = 22 + rnd(i * 3) * 40;
      const bh = (0.08 + rnd(i * 5) * 0.22) * H;
      const bx = (i / count) * (W + 120) - 60 - par;
      ctx.fillStyle = col;
      ctx.fillRect(bx, baseY - bh, bw, bh + 4);
      if (rnd(i * 7) > 0.6) {
        ctx.fillRect(bx + bw * 0.4, baseY - bh - 14, 3, 14);
        ctx.fillStyle = "#ff3b5c";
        ctx.fillRect(bx + bw * 0.4, baseY - bh - 16, 3, 3);
      }
      ctx.fillStyle = litCol;
      for (let wy = baseY - bh + 6; wy < baseY - 6; wy += 9) {
        for (let wx = bx + 4; wx < bx + bw - 4; wx += 7) {
          if (rnd(wx * 0.37 + wy * 1.3) > 0.45) ctx.fillRect(wx, wy, 3, 4);
        }
      }
    }
  }

  drawLighthouse(x: number, baseY: number, s: number): void {
    const { ctx, animTime } = this;
    ctx.fillStyle = "#f1f5f9";
    ctx.beginPath();
    ctx.moveTo(x - 14 * s, baseY);
    ctx.lineTo(x - 9 * s, baseY - 90 * s);
    ctx.lineTo(x + 9 * s, baseY - 90 * s);
    ctx.lineTo(x + 14 * s, baseY);
    ctx.fill();
    ctx.fillStyle = "#dc2626";
    for (let i = 0; i < 3; i += 1) {
      ctx.fillRect(x - 13 * s + i * 1.2 * s, baseY - 16 * s - i * 28 * s, (26 - i * 2.4) * s, 10 * s);
    }
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(x - 11 * s, baseY - 104 * s, 22 * s, 14 * s);
    ctx.beginPath();
    ctx.moveTo(x - 13 * s, baseY - 104 * s);
    ctx.lineTo(x, baseY - 116 * s);
    ctx.lineTo(x + 13 * s, baseY - 104 * s);
    ctx.fill();
    const ly = baseY - 97 * s;
    ctx.save();
    ctx.translate(x, ly);
    ctx.rotate(animTime * 1.4);
    const beam = ctx.createLinearGradient(0, 0, 420 * s, 0);
    beam.addColorStop(0, "rgba(255,250,200,0.55)");
    beam.addColorStop(1, "transparent");
    ctx.fillStyle = beam;
    for (let half = 0; half < 2; half += 1) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(420 * s, -28 * s);
      ctx.lineTo(420 * s, 28 * s);
      ctx.fill();
      ctx.rotate(Math.PI);
    }
    ctx.restore();
    ctx.fillStyle = "#fef08a";
    ctx.beginPath();
    ctx.arc(x, ly, 5 * s, 0, TAU);
    ctx.fill();
  }

  drawBirds(cy: number, count: number, col: string): void {
    const { ctx, W, animTime } = this;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.6;
    for (let i = 0; i < count; i += 1) {
      const bx = (((animTime * 0.02 * (1 + i * 0.2) + i * 0.17) % 1.2) - 0.1) * W;
      const by = cy + Math.sin(animTime + i) * 12 + i * 9;
      const fl = Math.sin(animTime * 7 + i) * 4;
      ctx.beginPath();
      ctx.moveTo(bx - 8, by + fl);
      ctx.quadraticCurveTo(bx - 3, by - 3, bx, by);
      ctx.quadraticCurveTo(bx + 3, by - 3, bx + 8, by + fl);
      ctx.stroke();
    }
  }

  drawCastle(cx: number, baseY: number, s: number, lit: boolean): void {
    const { ctx, animTime } = this;
    ctx.fillStyle = lit ? "#1e1530" : "#0a0612";
    const tower = (tx: number, tw: number, th: number) => {
      ctx.fillRect(tx - tw / 2, baseY - th, tw, th);
      for (let i = -2; i <= 2; i += 1) ctx.fillRect(tx + i * tw * 0.3 - tw * 0.1, baseY - th - 8 * s, tw * 0.2, 8 * s);
      ctx.beginPath();
      ctx.moveTo(tx - tw * 0.6, baseY - th - 6 * s);
      ctx.lineTo(tx, baseY - th - 40 * s);
      ctx.lineTo(tx + tw * 0.6, baseY - th - 6 * s);
      ctx.fill();
    };
    ctx.fillRect(cx - 110 * s, baseY - 60 * s, 220 * s, 60 * s);
    for (let i = -5; i <= 5; i += 1) ctx.fillRect(cx + i * 20 * s - 5 * s, baseY - 68 * s, 10 * s, 8 * s);
    tower(cx - 95 * s, 34 * s, 95 * s);
    tower(cx + 95 * s, 34 * s, 95 * s);
    tower(cx, 44 * s, 130 * s);
    tower(cx - 45 * s, 24 * s, 80 * s);
    tower(cx + 45 * s, 24 * s, 80 * s);
    const win = (wx: number, wy: number, ww: number, wh: number, ph: number) => {
      const a = 0.55 + 0.45 * Math.sin(animTime * 2.5 + ph);
      ctx.fillStyle = `rgba(251,191,36,${a})`;
      ctx.beginPath();
      ctx.moveTo(wx - ww / 2, wy + wh);
      ctx.lineTo(wx - ww / 2, wy + wh * 0.3);
      ctx.arc(wx, wy + wh * 0.3, ww / 2, Math.PI, 0);
      ctx.lineTo(wx + ww / 2, wy + wh);
      ctx.fill();
    };
    win(cx, baseY - 105 * s, 10 * s, 16 * s, 0);
    win(cx, baseY - 75 * s, 8 * s, 12 * s, 1);
    win(cx - 95 * s, baseY - 70 * s, 7 * s, 11 * s, 2);
    win(cx + 95 * s, baseY - 70 * s, 7 * s, 11 * s, 3);
    win(cx - 45 * s, baseY - 55 * s, 6 * s, 10 * s, 4);
    win(cx + 45 * s, baseY - 55 * s, 6 * s, 10 * s, 5);
    win(cx - 60 * s, baseY - 40 * s, 7 * s, 12 * s, 6);
    win(cx + 60 * s, baseY - 40 * s, 7 * s, 12 * s, 7);
    ctx.fillStyle = "#050308";
    ctx.beginPath();
    ctx.moveTo(cx - 12 * s, baseY);
    ctx.lineTo(cx - 12 * s, baseY - 18 * s);
    ctx.arc(cx, baseY - 18 * s, 12 * s, Math.PI, 0);
    ctx.lineTo(cx + 12 * s, baseY);
    ctx.fill();
  }

  drawBats(cx: number, cy: number, count: number): void {
    const { ctx, animTime } = this;
    ctx.strokeStyle = "#07040a";
    ctx.lineWidth = 2;
    for (let i = 0; i < count; i += 1) {
      const t = animTime * 0.35 + i * 1.7;
      const bx = cx + Math.cos(t) * (60 + i * 25) + Math.sin(t * 2.3) * 20;
      const by = cy + Math.sin(t * 1.3) * (30 + i * 10);
      const flap = Math.sin(animTime * 9 + i) * 6;
      const sz = 0.7 + rnd(i) * 0.6;
      ctx.beginPath();
      ctx.moveTo(bx - 12 * sz, by + flap);
      ctx.quadraticCurveTo(bx - 6 * sz, by - 4, bx - 2 * sz, by);
      ctx.lineTo(bx, by + 3 * sz);
      ctx.lineTo(bx + 2 * sz, by);
      ctx.quadraticCurveTo(bx + 6 * sz, by - 4, bx + 12 * sz, by + flap);
      ctx.stroke();
    }
  }

  drawWitch(mx: number, my: number): void {
    const { ctx, animTime } = this;
    const cyc = (animTime * 0.05) % 1;
    if (cyc > 0.28) return;
    const t = cyc / 0.28;
    const wx = mx + 160 - t * 320;
    const wy = my - 20 + Math.sin(t * 6) * 10;
    ctx.save();
    ctx.translate(wx, wy);
    ctx.fillStyle = "#07040a";
    ctx.fillRect(-28, 4, 56, 3);
    ctx.beginPath();
    ctx.moveTo(26, 5.5);
    ctx.lineTo(44, 2);
    ctx.lineTo(44, 9);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-6, 4);
    ctx.lineTo(-10, -14);
    ctx.lineTo(4, -14);
    ctx.lineTo(8, 4);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-3, -18, 4.5, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-12, -20);
    ctx.lineTo(6, -20);
    ctx.lineTo(-4, -38);
    ctx.fill();
    ctx.restore();
  }

  drawWarpStars(speedFactor: number): void {
    const { ctx, W, H } = this;
    const warp = 1.5 + speedFactor * 4.5;
    for (const s of this.warpStars) {
      s.z -= warp;
      if (s.z <= 2) {
        s.z = 900;
        s.x = (Math.random() - 0.5) * 1800;
        s.y = (Math.random() - 0.5) * 900;
      }
      const sx = (s.x / s.z) * (W * 0.45) + W / 2;
      const sy = (s.y / s.z) * (H * 0.45) + H / 2;
      const px = (s.x / (s.z + warp * 2.8)) * (W * 0.45) + W / 2;
      const py = (s.y / (s.z + warp * 2.8)) * (H * 0.45) + H / 2;
      ctx.strokeStyle = `hsla(${s.hue},100%,78%,${1 - s.z / 900})`;
      ctx.lineWidth = Math.max(1, (1 - s.z / 900) * 3.2);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(sx, sy);
      ctx.stroke();
    }
  }

  get speed(): number {
    return this.speedKmh;
  }
}

// ============================================================================
// SPRITES (x, y = punto de apoyo en el suelo; s = escala)
// ============================================================================
const SPRITES: Record<string, SpriteFn> = {};

SPRITES.deadTree = (r, x, y, s, seed) => {
  if (s < 0.1) return;
  const { ctx, animTime } = r;
  ctx.save();
  ctx.strokeStyle = "#090510";
  ctx.lineCap = "round";
  const sway = Math.sin(animTime * 1.2 + seed) * 0.03;
  const branch = (bx: number, by: number, len: number, ang: number, wid: number, d: number) => {
    if (d === 0 || len < 2) return;
    const ex = bx + Math.sin(ang) * len;
    const ey = by - Math.cos(ang) * len;
    ctx.lineWidth = Math.max(0.6, wid);
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    branch(ex, ey, len * (0.62 + rnd(seed + d) * 0.16), ang - 0.35 - rnd(seed + d * 2) * 0.3 + sway, wid * 0.66, d - 1);
    branch(ex, ey, len * (0.6 + rnd(seed + d * 3) * 0.16), ang + 0.3 + rnd(seed + d * 4) * 0.35 + sway, wid * 0.66, d - 1);
    if (d > 3 && rnd(seed + d * 5) > 0.5) branch(ex, ey, len * 0.5, ang + (rnd(seed + d) - 0.5) * 0.3, wid * 0.5, d - 2);
  };
  branch(x, y, 58 * s, (rnd(seed) - 0.5) * 0.2, 6.5 * s, 5);
  ctx.restore();
};

SPRITES.pumpkin = (r, x, y, s, seed) => {
  if (s < 0.08) return;
  const { ctx, animTime } = r;
  const flick = 0.85 + 0.15 * Math.sin(animTime * 9 + seed);
  const glow = ctx.createRadialGradient(x, y - 10 * s, 2 * s, x, y - 10 * s, 36 * s);
  glow.addColorStop(0, `rgba(255,150,0,${0.7 * flick})`);
  glow.addColorStop(0.5, "rgba(234,88,12,0.22)");
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y - 10 * s, 36 * s, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#ea580c";
  ctx.beginPath();
  ctx.ellipse(x, y - 11 * s, 15 * s, 11.5 * s, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "#9a3412";
  ctx.lineWidth = Math.max(0.6, 1.2 * s);
  for (const dx of [-7, 0, 7]) {
    ctx.beginPath();
    ctx.ellipse(x + dx * s * 0.5, y - 11 * s, 6 * s, 11 * s, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.strokeStyle = "#3f6212";
  ctx.lineWidth = Math.max(1, 2.5 * s);
  ctx.beginPath();
  ctx.moveTo(x, y - 22 * s);
  ctx.lineTo(x + 3 * s, y - 27 * s);
  ctx.stroke();
  ctx.fillStyle = `rgba(254,240,138,${flick})`;
  ctx.beginPath();
  ctx.moveTo(x - 8 * s, y - 12 * s);
  ctx.lineTo(x - 4 * s, y - 17 * s);
  ctx.lineTo(x - 2 * s, y - 12 * s);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 2 * s, y - 12 * s);
  ctx.lineTo(x + 5 * s, y - 17 * s);
  ctx.lineTo(x + 8 * s, y - 12 * s);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y - 9 * s, 7 * s, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.fill();
  ctx.fillStyle = "#ea580c";
  ctx.fillRect(x - 2 * s, y - 5 * s, 2.2 * s, 2.5 * s);
  ctx.fillRect(x + 3 * s, y - 5.5 * s, 2 * s, 2.5 * s);
};

SPRITES.pumpkinPile = (r, x, y, s, seed, p) => {
  const pumpkin = SPRITES.pumpkin;
  if (!pumpkin) return;
  for (let k = 0; k < 6; k += 1) pumpkin(r, x + (k - 2.5) * 11 * s, y - (k % 2) * 7 * s, s * 0.55, seed + k, p);
};

SPRITES.ghost = (r, x, y, s, seed) => {
  if (s < 0.1) return;
  const { ctx, animTime } = r;
  const fy = y - 34 * s + Math.sin(animTime * 2.2 + seed) * 8 * s;
  const fx = x + Math.sin(animTime * 0.8 + seed) * 10 * s;
  ctx.save();
  ctx.globalAlpha = 0.78 + 0.1 * Math.sin(animTime * 3 + seed);
  const g = ctx.createRadialGradient(fx, fy - 8 * s, 2, fx, fy - 8 * s, 26 * s);
  g.addColorStop(0, "rgba(220,235,255,0.35)");
  g.addColorStop(1, "transparent");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(fx, fy - 8 * s, 26 * s, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#e2e8f0";
  ctx.beginPath();
  ctx.arc(fx, fy - 12 * s, 10 * s, Math.PI, 0);
  ctx.lineTo(fx + 10 * s, fy + 8 * s);
  for (let i = 3; i >= -3; i -= 2) {
    ctx.quadraticCurveTo(fx + (i + 1) * 3.3 * s, fy + 2 * s + Math.sin(animTime * 6 + i) * 2 * s, fx + i * 3.3 * s, fy + 8 * s);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.ellipse(fx - 3.5 * s, fy - 13 * s, 1.8 * s, 2.6 * s, 0, 0, TAU);
  ctx.ellipse(fx + 3.5 * s, fy - 13 * s, 1.8 * s, 2.6 * s, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(fx, fy - 6 * s, 2.2 * s, 3.2 * s, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
};

SPRITES.zombie = (r, x, y, s, seed) => {
  if (s < 0.12) return;
  const { ctx, animTime } = r;
  const t = animTime * 3 + seed;
  const step = Math.sin(t);
  const lean = 0.12 + Math.sin(t * 0.5) * 0.05;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean * (Math.floor(seed) % 2 ? 1 : -1));
  ctx.lineCap = "round";
  ctx.strokeStyle = "#2a2d1a";
  ctx.lineWidth = 4 * s;
  ctx.beginPath();
  ctx.moveTo(-2 * s, -22 * s);
  ctx.lineTo(-4 * s + step * 4 * s, 0);
  ctx.moveTo(2 * s, -22 * s);
  ctx.lineTo(5 * s - step * 4 * s, 0);
  ctx.stroke();
  ctx.fillStyle = "#3f4a2a";
  ctx.fillRect(-6 * s, -42 * s, 12 * s, 21 * s);
  ctx.fillStyle = "#6b7a3d";
  ctx.fillRect(-6 * s, -42 * s, 5 * s, 9 * s);
  ctx.strokeStyle = "#8da068";
  ctx.lineWidth = 3.2 * s;
  ctx.beginPath();
  ctx.moveTo(-5 * s, -38 * s);
  ctx.lineTo(-18 * s, -36 * s + step * 2 * s);
  ctx.moveTo(5 * s, -38 * s);
  ctx.lineTo(17 * s, -35 * s - step * 2 * s);
  ctx.stroke();
  ctx.fillStyle = "#9db37a";
  ctx.beginPath();
  ctx.arc(1.5 * s, -49 * s, 6.5 * s, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#1a1d10";
  ctx.fillRect(-1 * s, -50 * s, 2 * s, 2 * s);
  ctx.fillRect(4 * s, -50.5 * s, 2 * s, 2 * s);
  ctx.fillStyle = "#b91c1c";
  ctx.fillRect(-1 * s, -45 * s, 6 * s, 1.2 * s);
  ctx.restore();
};

SPRITES.tombstone = (r, x, y, s, seed) => {
  if (s < 0.1) return;
  const { ctx } = r;
  const tilt = (rnd(seed) - 0.5) * 0.25;
  const v = rnd(seed + 1);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.fillStyle = "#3b3b4a";
  if (v < 0.5) {
    ctx.beginPath();
    ctx.moveTo(-9 * s, 0);
    ctx.lineTo(-9 * s, -16 * s);
    ctx.arc(0, -16 * s, 9 * s, Math.PI, 0);
    ctx.lineTo(9 * s, 0);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillRect(-3 * s, -26 * s, 6 * s, 26 * s);
    ctx.fillRect(-10 * s, -19 * s, 20 * s, 5.5 * s);
  }
  ctx.fillStyle = "#23232e";
  ctx.fillRect(-7 * s, -11 * s, 14 * s, 1.2 * s);
  ctx.fillRect(-5 * s, -8 * s, 10 * s, 1.2 * s);
  ctx.fillStyle = "rgba(60,120,60,0.5)";
  ctx.fillRect(-9 * s, -5 * s, 6 * s, 5 * s);
  ctx.restore();
};

SPRITES.lantern = (r, x, y, s, seed) => {
  const { ctx, animTime } = r;
  ctx.strokeStyle = "#2a2438";
  ctx.lineWidth = Math.max(1, 3 * s);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 48 * s);
  ctx.lineTo(x + 8 * s, y - 52 * s);
  ctx.stroke();
  const flick = 0.8 + 0.2 * Math.sin(animTime * 13 + seed);
  const g = ctx.createRadialGradient(x + 8 * s, y - 50 * s, 1, x + 8 * s, y - 50 * s, 30 * s);
  g.addColorStop(0, `rgba(254,240,138,${flick})`);
  g.addColorStop(0.4, "rgba(245,158,11,0.4)");
  g.addColorStop(1, "transparent");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x + 8 * s, y - 50 * s, 30 * s, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#17141f";
  ctx.fillRect(x + 5.5 * s, y - 56 * s, 5 * s, 2 * s);
};

SPRITES.scarecrow = (r, x, y, s) => {
  if (s < 0.12) return;
  const { ctx } = r;
  ctx.strokeStyle = "#78350f";
  ctx.lineWidth = 2.5 * s;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 48 * s);
  ctx.moveTo(x - 18 * s, y - 34 * s);
  ctx.lineTo(x + 18 * s, y - 34 * s);
  ctx.stroke();
  ctx.fillStyle = "#b91c1c";
  ctx.fillRect(x - 9 * s, y - 36 * s, 18 * s, 18 * s);
  ctx.fillRect(x - 16 * s, y - 36 * s, 32 * s, 6 * s);
  ctx.fillStyle = "#fde68a";
  ctx.beginPath();
  ctx.arc(x, y - 43 * s, 6 * s, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#1c1917";
  ctx.beginPath();
  ctx.moveTo(x - 11 * s, y - 46 * s);
  ctx.lineTo(x + 11 * s, y - 46 * s);
  ctx.lineTo(x, y - 55 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#111";
  ctx.fillRect(x - 2.5 * s, y - 44 * s, 1.5 * s, 1.5 * s);
  ctx.fillRect(x + 1 * s, y - 44 * s, 1.5 * s, 1.5 * s);
};

SPRITES.cauldron = (r, x, y, s, seed) => {
  if (s < 0.1) return;
  const { ctx, animTime } = r;
  const g = ctx.createRadialGradient(x, y - 14 * s, 1, x, y - 14 * s, 40 * s);
  g.addColorStop(0, "rgba(74,222,128,0.6)");
  g.addColorStop(1, "transparent");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y - 14 * s, 40 * s, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#0b0b10";
  ctx.beginPath();
  ctx.ellipse(x, y - 9 * s, 13 * s, 10 * s, 0, 0, TAU);
  ctx.fill();
  ctx.fillRect(x - 15 * s, y - 20 * s, 30 * s, 4 * s);
  ctx.fillStyle = "#4ade80";
  ctx.beginPath();
  ctx.ellipse(x, y - 18 * s, 12 * s, 3 * s, 0, 0, TAU);
  ctx.fill();
  for (let i = 0; i < 4; i += 1) {
    const by = y - 22 * s - ((animTime * 25 + i * 9 + seed) % 30) * s;
    ctx.fillStyle = "rgba(134,239,172,0.6)";
    ctx.beginPath();
    ctx.arc(x + Math.sin(i + animTime) * 6 * s, by, (2 + i) * s * 0.6, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = "#f97316";
  for (let i = -1; i <= 1; i += 1) {
    ctx.beginPath();
    ctx.moveTo(x + i * 5 * s, y);
    ctx.lineTo(x + i * 5 * s + 3 * s, y - (6 + 3 * Math.sin(animTime * 10 + i)) * s);
    ctx.lineTo(x + i * 5 * s + 6 * s, y);
    ctx.fill();
  }
};

SPRITES.fencePost = (r, x, y, s) => {
  const { ctx } = r;
  ctx.strokeStyle = "#0b0912";
  ctx.lineWidth = Math.max(0.8, 2.2 * s);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 30 * s);
  ctx.stroke();
  ctx.fillStyle = "#0b0912";
  ctx.beginPath();
  ctx.moveTo(x - 2.5 * s, y - 29 * s);
  ctx.lineTo(x, y - 36 * s);
  ctx.lineTo(x + 2.5 * s, y - 29 * s);
  ctx.fill();
};

// --- Neón ---
SPRITES.neonPalm = (r, x, y, s, seed) => {
  if (s < 0.1) return;
  const { ctx, animTime } = r;
  ctx.save();
  ctx.strokeStyle = "#ff2ea6";
  ctx.shadowColor = "#ff2ea6";
  ctx.shadowBlur = 10 * s;
  ctx.lineWidth = Math.max(1, 3 * s);
  ctx.lineCap = "round";
  const top = y - 70 * s;
  const lean = (rnd(seed) - 0.5) * 20 * s;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + lean, y - 35 * s, x + lean, top);
  ctx.stroke();
  ctx.strokeStyle = "#22d3ee";
  ctx.shadowColor = "#22d3ee";
  for (let i = 0; i < 7; i += 1) {
    const a = -Math.PI + (i / 6) * Math.PI;
    const sw = Math.sin(animTime * 1.5 + i + seed) * 3 * s;
    ctx.beginPath();
    ctx.moveTo(x + lean, top);
    ctx.quadraticCurveTo(x + lean + Math.cos(a) * 22 * s, top - 10 * s + sw, x + lean + Math.cos(a) * 34 * s, top + 10 * s + sw);
    ctx.stroke();
  }
  ctx.restore();
};

SPRITES.neonArch = (r, _x, _y, s, seed, p) => {
  const { ctx } = r;
  const g = r.geoAt(p);
  ctx.save();
  const color = seed % 2 > 1 ? "#22d3ee" : "#ff2ea6";
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 14 * s;
  ctx.lineWidth = Math.max(1, 3.5 * s);
  ctx.beginPath();
  ctx.moveTo(g.x - g.hw * 1.25, g.y);
  ctx.lineTo(g.x - g.hw * 1.25, g.y - 40 * s);
  ctx.quadraticCurveTo(g.x, g.y - 95 * s, g.x + g.hw * 1.25, g.y - 40 * s);
  ctx.lineTo(g.x + g.hw * 1.25, g.y);
  ctx.stroke();
  ctx.lineWidth = Math.max(0.6, 1.2 * s);
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.shadowBlur = 0;
  ctx.beginPath();
  for (let i = 1; i < 8; i += 1) {
    const t = i / 8;
    const px = g.x - g.hw * 1.25 + t * g.hw * 2.5;
    const py = g.y - 40 * s - Math.sin(t * Math.PI) * 27 * s;
    ctx.moveTo(px, py);
    ctx.lineTo(px, py + 10 * s);
  }
  ctx.stroke();
  ctx.restore();
};

SPRITES.billboard = (r, x, y, s, seed) => {
  if (s < 0.1) return;
  const { ctx, animTime } = r;
  ctx.fillStyle = "#1a0b2e";
  ctx.fillRect(x - 2 * s, y - 60 * s, 4 * s, 60 * s);
  const hue = (seed * 3 + animTime * 40) % 360;
  ctx.save();
  ctx.shadowColor = `hsl(${hue},100%,60%)`;
  ctx.shadowBlur = 16 * s;
  ctx.fillStyle = `hsla(${hue},90%,55%,0.85)`;
  ctx.fillRect(x - 24 * s, y - 92 * s, 48 * s, 30 * s);
  ctx.restore();
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  for (let i = 0; i < 3; i += 1) ctx.fillRect(x - 18 * s, y - 86 * s + i * 8 * s, (30 - i * 8) * s, 3 * s);
};

// --- Cañón ---
SPRITES.cactus = (r, x, y, s, seed) => {
  if (s < 0.1) return;
  const { ctx } = r;
  ctx.strokeStyle = "#166534";
  ctx.lineCap = "round";
  ctx.lineWidth = 9 * s;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 52 * s);
  ctx.stroke();
  ctx.lineWidth = 6 * s;
  const hA = 20 + rnd(seed) * 10;
  const hB = 26 + rnd(seed + 1) * 10;
  ctx.beginPath();
  ctx.moveTo(x, y - hA * s);
  ctx.lineTo(x - 14 * s, y - hA * s);
  ctx.lineTo(x - 14 * s, y - (hA + 18) * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y - hB * s);
  ctx.lineTo(x + 13 * s, y - hB * s);
  ctx.lineTo(x + 13 * s, y - (hB + 14) * s);
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 1 * s;
  for (let i = -1; i <= 1; i += 1) {
    ctx.beginPath();
    ctx.moveTo(x + i * 2.5 * s, y);
    ctx.lineTo(x + i * 2.5 * s, y - 50 * s);
    ctx.stroke();
  }
};

SPRITES.rock = (r, x, y, s, seed) => {
  const { ctx } = r;
  ctx.fillStyle = "#5b2a12";
  ctx.beginPath();
  ctx.moveTo(x - 14 * s, y);
  ctx.lineTo(x - 9 * s, y - 10 * s);
  ctx.lineTo(x + 2 * s, y - (12 + rnd(seed) * 6) * s);
  ctx.lineTo(x + 13 * s, y - 6 * s);
  ctx.lineTo(x + 15 * s, y);
  ctx.fill();
  ctx.fillStyle = "#8a4a22";
  ctx.beginPath();
  ctx.moveTo(x - 9 * s, y - 10 * s);
  ctx.lineTo(x + 2 * s, y - 12 * s);
  ctx.lineTo(x + 1 * s, y);
  ctx.lineTo(x - 11 * s, y);
  ctx.fill();
};

SPRITES.roadSign = (r, x, y, s, seed) => {
  if (s < 0.12) return;
  const { ctx } = r;
  ctx.fillStyle = "#6b7280";
  ctx.fillRect(x - 1.5 * s, y - 40 * s, 3 * s, 40 * s);
  ctx.save();
  ctx.translate(x, y - 48 * s);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = "#facc15";
  ctx.fillRect(-9 * s, -9 * s, 18 * s, 18 * s);
  ctx.restore();
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  const dir = rnd(seed) > 0.5 ? 1 : -1;
  ctx.moveTo(x - 4 * s * dir, y - 42 * s);
  ctx.quadraticCurveTo(x + 4 * s * dir, y - 48 * s, x - 4 * s * dir, y - 54 * s);
  ctx.stroke();
};

SPRITES.tumbleweed = (r, x, y, s, seed) => {
  if (s < 0.1) return;
  const { ctx, animTime } = r;
  const tx = x + Math.sin(animTime * 0.9 + seed) * 60 * s;
  const bounce = Math.abs(Math.sin(animTime * 4 + seed)) * 8 * s;
  ctx.save();
  ctx.translate(tx, y - 10 * s - bounce);
  ctx.rotate(animTime * 3 + seed);
  ctx.strokeStyle = "#a16207";
  ctx.lineWidth = Math.max(0.6, 1 * s);
  for (let i = 0; i < 10; i += 1) {
    const a = (i / 10) * TAU;
    ctx.beginPath();
    ctx.arc(0, 0, 9 * s, a, a + 2.5);
    ctx.stroke();
  }
  ctx.restore();
};

// --- Costa ---
SPRITES.palm = (r, x, y, s, seed) => {
  if (s < 0.1) return;
  const { ctx, animTime } = r;
  ctx.save();
  ctx.strokeStyle = "#5b3a1e";
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(1, 5 * s);
  const lean = (rnd(seed) - 0.5) * 30 * s;
  const top = y - 75 * s;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + lean * 0.4, y - 40 * s, x + lean, top);
  ctx.stroke();
  ctx.strokeStyle = "#15803d";
  ctx.lineWidth = Math.max(1, 3.5 * s);
  for (let i = 0; i < 8; i += 1) {
    const a = -Math.PI * 1.05 + (i / 7) * Math.PI * 1.1;
    const sw = Math.sin(animTime * 1.6 + i + seed) * 4 * s;
    ctx.beginPath();
    ctx.moveTo(x + lean, top);
    ctx.quadraticCurveTo(x + lean + Math.cos(a) * 26 * s, top - 14 * s + sw, x + lean + Math.cos(a) * 40 * s, top + 14 * s + sw);
    ctx.stroke();
  }
  ctx.fillStyle = "#713f12";
  ctx.beginPath();
  ctx.arc(x + lean - 3 * s, top + 3 * s, 3 * s, 0, TAU);
  ctx.arc(x + lean + 3 * s, top + 3 * s, 3 * s, 0, TAU);
  ctx.fill();
  ctx.restore();
};

SPRITES.umbrella = (r, x, y, s, seed) => {
  if (s < 0.12) return;
  const { ctx } = r;
  ctx.strokeStyle = "#f8fafc";
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 30 * s);
  ctx.stroke();
  ctx.fillStyle = rnd(seed) > 0.5 ? "#ef4444" : "#0ea5e9";
  ctx.beginPath();
  ctx.arc(x, y - 30 * s, 18 * s, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = "#fef3c7";
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.moveTo(x - 18 * s + i * 12 * s, y - 30 * s);
    ctx.arc(x - 12 * s + i * 12 * s, y - 30 * s, 6 * s, Math.PI, 0);
    ctx.fill();
  }
};

SPRITES.pierPost = (r, x, y, s) => {
  const { ctx } = r;
  ctx.fillStyle = "#3f2f1f";
  ctx.fillRect(x - 2.5 * s, y - 20 * s, 5 * s, 20 * s);
  ctx.fillRect(x - 5 * s, y - 22 * s, 10 * s, 2.5 * s);
};

// --- Alpes ---
SPRITES.pine = (r, x, y, s, seed) => {
  if (s < 0.08) return;
  const { ctx } = r;
  const hgt = 60 + rnd(seed) * 20;
  ctx.fillStyle = "#3b2a1a";
  ctx.fillRect(x - 2.5 * s, y - 12 * s, 5 * s, 12 * s);
  for (let t = 0; t < 4; t += 1) {
    const ty = y - (14 + (t * (hgt - 14)) / 4) * s;
    const wdt = (24 - t * 5) * s;
    const hh = (hgt / 4 + 6) * s;
    ctx.fillStyle = "#0f3d2e";
    ctx.beginPath();
    ctx.moveTo(x, ty - hh);
    ctx.lineTo(x - wdt, ty);
    ctx.lineTo(x + wdt, ty);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.moveTo(x, ty - hh);
    ctx.lineTo(x - wdt * 0.55, ty - hh * 0.45);
    ctx.lineTo(x + wdt * 0.55, ty - hh * 0.45);
    ctx.closePath();
    ctx.fill();
  }
};

SPRITES.cabin = (r, x, y, s, seed) => {
  if (s < 0.1) return;
  const { ctx, animTime } = r;
  ctx.fillStyle = "#4a2f1d";
  ctx.fillRect(x - 26 * s, y - 30 * s, 52 * s, 30 * s);
  ctx.fillStyle = "#e2e8f0";
  ctx.beginPath();
  ctx.moveTo(x - 32 * s, y - 28 * s);
  ctx.lineTo(x, y - 54 * s);
  ctx.lineTo(x + 32 * s, y - 28 * s);
  ctx.closePath();
  ctx.fill();
  const warm = 0.85 + 0.15 * Math.sin(animTime * 5 + seed);
  ctx.save();
  ctx.shadowColor = "#fbbf24";
  ctx.shadowBlur = 14 * s;
  ctx.fillStyle = `rgba(251,191,36,${warm})`;
  ctx.fillRect(x - 18 * s, y - 22 * s, 10 * s, 10 * s);
  ctx.fillRect(x + 8 * s, y - 22 * s, 10 * s, 10 * s);
  ctx.restore();
  ctx.fillStyle = "#1c1917";
  ctx.fillRect(x - 4 * s, y - 16 * s, 8 * s, 16 * s);
  ctx.fillStyle = "#6b7280";
  ctx.fillRect(x + 14 * s, y - 52 * s, 6 * s, 14 * s);
  for (let i = 0; i < 3; i += 1) {
    const py = y - 56 * s - ((animTime * 10 + i * 10 + seed) % 30) * s;
    ctx.fillStyle = `rgba(200,200,210,${0.4 - i * 0.1})`;
    ctx.beginPath();
    ctx.arc(x + 17 * s + Math.sin(animTime + i) * 3 * s, py, (3 + i * 1.5) * s, 0, TAU);
    ctx.fill();
  }
};

SPRITES.guardrail = (r, x, y, s) => {
  const { ctx } = r;
  ctx.fillStyle = "#94a3b8";
  ctx.fillRect(x - 1.5 * s, y - 14 * s, 3 * s, 14 * s);
  ctx.fillStyle = "#cbd5e1";
  ctx.fillRect(x - 10 * s, y - 13 * s, 20 * s, 3.5 * s);
};

SPRITES.snowman = (r, x, y, s) => {
  if (s < 0.12) return;
  const { ctx } = r;
  ctx.fillStyle = "#f8fafc";
  for (const [dx, dy, rad] of [
    [0, 12, 12],
    [0, 30, 9],
    [0, 44, 6.5],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x + dx * s, y - dy * s, rad * s, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = "#f97316";
  ctx.beginPath();
  ctx.moveTo(x + 2 * s, y - 44 * s);
  ctx.lineTo(x + 10 * s, y - 43 * s);
  ctx.lineTo(x + 2 * s, y - 42 * s);
  ctx.fill();
  ctx.fillStyle = "#111";
  ctx.fillRect(x - 3 * s, y - 46 * s, 1.5 * s, 1.5 * s);
  ctx.fillRect(x + 1 * s, y - 46 * s, 1.5 * s, 1.5 * s);
  ctx.fillRect(x - 5 * s, y - 53 * s, 10 * s, 2 * s);
  ctx.fillRect(x - 3.5 * s, y - 60 * s, 7 * s, 7 * s);
  ctx.fillStyle = "#dc2626";
  ctx.fillRect(x - 7 * s, y - 38 * s, 14 * s, 3 * s);
};

SPRITES.deer = (r, x, y, s) => {
  if (s < 0.12) return;
  const { ctx } = r;
  ctx.fillStyle = "#3f2a1a";
  ctx.fillRect(x - 12 * s, y - 24 * s, 24 * s, 11 * s);
  ctx.fillRect(x - 11 * s, y - 14 * s, 3 * s, 14 * s);
  ctx.fillRect(x + 8 * s, y - 14 * s, 3 * s, 14 * s);
  ctx.fillRect(x - 5 * s, y - 14 * s, 3 * s, 14 * s);
  ctx.fillRect(x + 2 * s, y - 14 * s, 3 * s, 14 * s);
  ctx.fillRect(x + 10 * s, y - 36 * s, 5 * s, 14 * s);
  ctx.fillRect(x + 9 * s, y - 38 * s, 10 * s, 5 * s);
  ctx.strokeStyle = "#3f2a1a";
  ctx.lineWidth = 1.2 * s;
  ctx.beginPath();
  ctx.moveTo(x + 12 * s, y - 38 * s);
  ctx.lineTo(x + 8 * s, y - 48 * s);
  ctx.lineTo(x + 5 * s, y - 50 * s);
  ctx.moveTo(x + 8 * s, y - 48 * s);
  ctx.lineTo(x + 10 * s, y - 52 * s);
  ctx.moveTo(x + 14 * s, y - 38 * s);
  ctx.lineTo(x + 18 * s, y - 48 * s);
  ctx.lineTo(x + 21 * s, y - 50 * s);
  ctx.stroke();
};

// --- Portal / Galaxia ---
SPRITES.crystal = (r, x, y, s, seed) => {
  if (s < 0.1) return;
  const { ctx, animTime } = r;
  const fl = y - 20 * s - Math.sin(animTime * 1.5 + seed) * 10 * s;
  ctx.save();
  ctx.translate(x, fl);
  ctx.rotate(animTime * 0.6 + seed);
  const hue = (seed * 7) % 360;
  ctx.shadowColor = `hsl(${hue},100%,65%)`;
  ctx.shadowBlur = 18 * s;
  ctx.fillStyle = `hsla(${hue},90%,60%,0.85)`;
  ctx.beginPath();
  ctx.moveTo(0, -16 * s);
  ctx.lineTo(8 * s, 0);
  ctx.lineTo(0, 16 * s);
  ctx.lineTo(-8 * s, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

SPRITES.monolith = (r, x, y, s) => {
  if (s < 0.1) return;
  const { ctx } = r;
  ctx.fillStyle = "#0b0718";
  ctx.fillRect(x - 6 * s, y - 70 * s, 12 * s, 70 * s);
  ctx.save();
  ctx.shadowColor = "#22d3ee";
  ctx.shadowBlur = 12 * s;
  ctx.fillStyle = "#22d3ee";
  ctx.fillRect(x - 1 * s, y - 66 * s, 2 * s, 62 * s);
  ctx.restore();
};

// ============================================================================
// ESCENAS
// ============================================================================
function skyGradient(r: DriveSceneRenderer, stops: readonly [number, string][]): void {
  const { ctx, W, horizonY } = r;
  const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
  for (const [at, color] of stops) sky.addColorStop(at, color);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, horizonY + 4);
}

const SCENES: Record<DriveSceneId, SceneDefinition> = {
  halloween: {
    night: true,
    spawn: [
      { kind: "deadTree", rate: 0.45, off: [0.15, 0.9], size: 1.1 },
      { kind: "pumpkin", rate: 0.5, off: [0.02, 0.12], size: 0.95 },
      { kind: "pumpkinPile", rate: 0.12, off: [0.5, 1.2] },
      { kind: "tombstone", rate: 0.55, off: [0.2, 1.3] },
      { kind: "tombstone", rate: 0.35, off: [0.4, 1.6] },
      { kind: "ghost", rate: 0.18, off: [0.1, 0.8] },
      { kind: "zombie", rate: 0.22, off: [0.05, 0.5] },
      { kind: "lantern", rate: 0.22, off: [0.02, 0.06], side: -1 },
      { kind: "fencePost", rate: 0.9, off: [0.08, 0.08], side: 1 },
      { kind: "scarecrow", rate: 0.1, off: [0.6, 1.1], side: -1 },
      { kind: "cauldron", rate: 0.07, off: [0.5, 0.9] },
    ],
    draw(r, speedFactor) {
      const { ctx, W, H, horizonY } = r;
      skyGradient(r, [
        [0, "#0b0714"],
        [0.55, "#24153d"],
        [1, "#4a2a6a"],
      ]);
      r.drawStars(0.7);
      r.drawClouds(6, "rgba(110,70,160,0.22)", H * 0.08, 0.004);
      const mx = W * 0.2;
      const my = H * 0.14;
      r.drawMoon(mx, my, H * 0.1, "#e4dfd0", "rgba(235,230,210,0.3)");
      r.drawWitch(mx, my);
      r.drawBats(mx + 40, my - 20, 5);
      r.drawBats(W * 0.7, H * 0.12, 4);
      const par = curvatureAt(r.roadDist) * 18;
      ctx.fillStyle = "#0e0916";
      ctx.beginPath();
      ctx.moveTo(0, horizonY + 6);
      ctx.quadraticCurveTo(W * 0.2 - par, horizonY - H * 0.07, W * 0.45 - par, horizonY - H * 0.02);
      ctx.quadraticCurveTo(W * 0.7 - par, horizonY - H * 0.09, W, horizonY - H * 0.03);
      ctx.lineTo(W, horizonY + 6);
      ctx.fill();
      r.drawCastle(W * 0.72 - par, horizonY - H * 0.065, (H / 540) * 0.75, r.lightning > 0.3);
      r.drawGround("#1c132b", "#07050c");
      r.drawRoad({
        asphalt: "#15141d",
        edge: "rgba(255,255,255,0.3)",
        center: "rgba(217,155,38,0.6)",
        shoulder: "#120d1c",
        glow: "rgba(255,200,80,0.8)",
      });
      r.drawHeadlights();
      r.drawTrackObjects(true);
      r.drawFog("150,120,190", 0.16);
      r.drawParticles("rgba(251,146,60,0.65)", true, 1, speedFactor);
      r.drawLightning();
      r.drawVignette(0.65);
    },
  },
  neon: {
    night: true,
    style: "neon",
    spawn: [
      { kind: "neonPalm", rate: 0.5, off: [0.1, 0.6] },
      { kind: "neonArch", rate: 0.16, off: [0, 0], side: 1 },
      { kind: "billboard", rate: 0.14, off: [0.5, 1.0] },
    ],
    draw(r) {
      const { ctx, W, H, horizonY } = r;
      skyGradient(r, [
        [0, "#060212"],
        [0.5, "#2a0a4e"],
        [1, "#ff2a7f"],
      ]);
      r.drawStars(0.6);
      const sunX = W * 0.5 - curvatureAt(r.roadDist) * 40;
      const sunY = horizonY - H * 0.04;
      const R = H * 0.17;
      const sg = ctx.createLinearGradient(0, sunY - R, 0, sunY + R);
      sg.addColorStop(0, "#ffe259");
      sg.addColorStop(0.55, "#ff2ea6");
      sg.addColorStop(1, "#7c3aed");
      ctx.save();
      ctx.shadowColor = "#ff2ea6";
      ctx.shadowBlur = 40;
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(sunX, sunY, R, 0, TAU);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = "#2a0a4e";
      for (let i = 0; i < 7; i += 1) ctx.fillRect(sunX - R, sunY - R * 0.1 + i * R * 0.17, R * 2, 2 + i * 1.5);
      r.drawCity(horizonY + 2, 36, "#0b0420", "rgba(34,211,238,0.85)");
      r.drawMountains([{ col: "#12052b", amp: 0.12, lift: 0.02, f1: 7, f2: 19, o: 1 }]);
      r.drawGround("#0a0318", "#030109");
      ctx.strokeStyle = "rgba(255,46,166,0.35)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 16; i += 1) {
        const p = i / 16 + ((r.roadDist * 0.25) % (1 / 16));
        const y = horizonY + Math.pow(p, 2.1) * (H - horizonY);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      for (let i = -8; i <= 8; i += 1) {
        ctx.beginPath();
        ctx.moveTo(W / 2 + i * 30, horizonY);
        ctx.lineTo(W / 2 + i * W * 0.25, H);
        ctx.stroke();
      }
      r.drawRoad({ asphalt: "#160a33", edge: "#22d3ee", center: "#ff2ea6", shoulder: null, glow: "#ffffff" });
      r.drawTrackObjects(true, "neon");
      r.drawVignette(0.45);
    },
  },
  canyon: {
    night: false,
    spawn: [
      { kind: "cactus", rate: 0.5, off: [0.1, 1.1] },
      { kind: "rock", rate: 0.45, off: [0.05, 1.4] },
      { kind: "roadSign", rate: 0.09, off: [0.02, 0.06], side: 1 },
      { kind: "tumbleweed", rate: 0.12, off: [0.05, 0.4] },
    ],
    draw(r, speedFactor) {
      const { ctx, W, H, horizonY } = r;
      skyGradient(r, [
        [0, "#1e0a08"],
        [0.45, "#9a3412"],
        [0.85, "#f59e0b"],
        [1, "#fde68a"],
      ]);
      const sunX = W * 0.38 - curvatureAt(r.roadDist) * 30;
      const sunY = horizonY - H * 0.06;
      const sg = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, H * 0.3);
      sg.addColorStop(0, "rgba(255,250,200,0.9)");
      sg.addColorStop(0.15, "rgba(253,224,71,0.6)");
      sg.addColorStop(1, "transparent");
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, W, horizonY + 4);
      r.drawBirds(H * 0.12, 4, "#3b1b0a");
      r.drawMountains([
        { col: "#7c2d12", amp: 0.2, lift: 0, f1: 5, f2: 13, o: 2 },
        { col: "#5b1f0c", amp: 0.16, lift: 0, f1: 9, f2: 23, o: 5 },
        { col: "#3f1407", amp: 0.1, lift: 0, f1: 15, f2: 31, o: 8 },
      ]);
      const par = curvatureAt(r.roadDist) * 24;
      const buttes: [number, number, number][] = [
        [0.08, 0.14, 0.11],
        [0.3, 0.1, 0.07],
        [0.62, 0.16, 0.13],
        [0.88, 0.12, 0.09],
      ];
      for (const [nx, bh, bw] of buttes) {
        const bx = nx * W - par;
        const hh = bh * H;
        const ww = bw * W;
        ctx.fillStyle = "#451a03";
        ctx.beginPath();
        ctx.moveTo(bx, horizonY + 4);
        ctx.lineTo(bx + ww * 0.18, horizonY - hh);
        ctx.lineTo(bx + ww * 0.82, horizonY - hh);
        ctx.lineTo(bx + ww, horizonY + 4);
        ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath();
        ctx.moveTo(bx + ww * 0.82, horizonY - hh);
        ctx.lineTo(bx + ww, horizonY + 4);
        ctx.lineTo(bx + ww * 0.6, horizonY + 4);
        ctx.fill();
        ctx.strokeStyle = "rgba(251,146,60,0.25)";
        ctx.lineWidth = 1.5;
        for (let k = 1; k < 5; k += 1) {
          ctx.beginPath();
          ctx.moveTo(bx + ww * 0.18 * (1 - k / 5) + ww * 0.03, horizonY - hh * (1 - k / 5));
          ctx.lineTo(bx + ww - ww * 0.18 * (1 - k / 5) - ww * 0.03, horizonY - hh * (1 - k / 5));
          ctx.stroke();
        }
      }
      r.drawGround("#9a4a1a", "#3b1707");
      r.drawRoad({ asphalt: "#2b2420", edge: "rgba(255,255,255,0.5)", center: "#f59e0b", shoulder: "#7a3a14", glow: null });
      r.drawTrackObjects(false);
      const haze = ctx.createLinearGradient(0, horizonY - 8, 0, horizonY + H * 0.1);
      haze.addColorStop(0, "rgba(253,224,171,0.35)");
      haze.addColorStop(1, "transparent");
      ctx.fillStyle = haze;
      ctx.fillRect(0, horizonY - 8, W, H * 0.1);
      r.drawParticles("rgba(253,186,116,0.35)", true, 3, speedFactor);
      r.drawVignette(0.3);
    },
  },
  coast: {
    night: false,
    spawn: [
      { kind: "palm", rate: 0.55, off: [0.08, 0.7], side: 1 },
      { kind: "umbrella", rate: 0.25, off: [0.6, 1.4], side: 1 },
      { kind: "pierPost", rate: 0.6, off: [0.42, 0.42], side: -1 },
    ],
    draw(r) {
      const { ctx, W, H, horizonY, animTime, geo } = r;
      skyGradient(r, [
        [0, "#1e3a8a"],
        [0.5, "#f97316"],
        [0.85, "#fda4af"],
        [1, "#fde68a"],
      ]);
      const sunX = W * 0.3 - curvatureAt(r.roadDist) * 30;
      const sunY = horizonY - H * 0.03;
      const sg = ctx.createRadialGradient(sunX, sunY, 5, sunX, sunY, H * 0.28);
      sg.addColorStop(0, "rgba(255,255,230,1)");
      sg.addColorStop(0.12, "rgba(255,200,120,0.8)");
      sg.addColorStop(1, "transparent");
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, W, horizonY + 4);
      r.drawClouds(5, "rgba(255,180,160,0.3)", H * 0.1, 0.003);
      r.drawBirds(H * 0.2, 6, "#1f2937");
      const sea = ctx.createLinearGradient(0, horizonY, 0, H);
      sea.addColorStop(0, "#0e7490");
      sea.addColorStop(0.5, "#0369a1");
      sea.addColorStop(1, "#082f49");
      ctx.fillStyle = sea;
      ctx.fillRect(0, horizonY, W, H - horizonY);
      for (let i = 0; i < 18; i += 1) {
        const p = i / 18 + ((animTime * 0.02 + r.roadDist * 0.06) % (1 / 18));
        const y = horizonY + Math.pow(p, 2) * (H - horizonY);
        ctx.strokeStyle = `rgba(255,255,255,${0.12 + p * 0.25})`;
        ctx.lineWidth = 1 + p * 2;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 24) ctx.lineTo(x, y + Math.sin(x * 0.02 + animTime * 2 + i) * 3 * p);
        ctx.stroke();
      }
      const refl = ctx.createLinearGradient(0, horizonY, 0, H * 0.75);
      refl.addColorStop(0, "rgba(255,220,150,0.5)");
      refl.addColorStop(1, "transparent");
      ctx.fillStyle = refl;
      ctx.fillRect(sunX - 40, horizonY, 80, H * 0.3);
      for (let i = 0; i < 3; i += 1) {
        const bx = ((animTime * 0.004 * (i + 1) + i * 0.35) % 1.1) * W;
        const by = horizonY + 6 + i * 8;
        const bs = 0.6 + i * 0.3;
        ctx.fillStyle = "#1f2937";
        ctx.fillRect(bx - 8 * bs, by, 16 * bs, 3 * bs);
        ctx.fillStyle = "#f8fafc";
        ctx.beginPath();
        ctx.moveTo(bx, by - 1);
        ctx.lineTo(bx, by - 14 * bs);
        ctx.lineTo(bx + 8 * bs, by - 1);
        ctx.fill();
      }
      r.drawLighthouse(W * 0.84 - curvatureAt(r.roadDist) * 20, horizonY + 2, (H / 540) * 0.7);
      const near = geo[0];
      const far = geo[SEG];
      if (near && far) {
        ctx.fillStyle = "#e9c46a";
        ctx.beginPath();
        ctx.moveTo(far.x + far.hw * 1.14, far.y);
        for (let i = SEG; i >= 0; i -= 1) {
          const g = geo[i];
          if (g) ctx.lineTo(g.x + g.hw * 1.14, g.y);
        }
        ctx.lineTo(near.x + near.hw * 1.14, H);
        ctx.lineTo(W, H);
        ctx.lineTo(W, far.y + 2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#d9b45a";
        ctx.beginPath();
        for (let i = SEG; i >= 0; i -= 1) {
          const g = geo[i];
          if (g) ctx.lineTo(g.x - g.hw * 1.14, g.y);
        }
        ctx.lineTo(near.x - near.hw * 1.14, H);
        ctx.lineTo(near.x - near.hw * 1.5, H);
        for (let i = 0; i <= SEG; i += 1) {
          const g = geo[i];
          if (g) ctx.lineTo(g.x - g.hw * 1.5, g.y);
        }
        ctx.closePath();
        ctx.fill();
      }
      r.drawRoad({ asphalt: "#2f2e33", edge: "rgba(255,255,255,0.55)", center: "#fbbf24", shoulder: null, glow: null });
      r.drawTrackObjects(false);
      r.drawVignette(0.25);
    },
  },
  alpine: {
    night: false,
    spawn: [
      { kind: "pine", rate: 0.9, off: [0.1, 1.5] },
      { kind: "pine", rate: 0.6, off: [0.8, 2.2], size: 0.9 },
      { kind: "cabin", rate: 0.1, off: [0.5, 1.1] },
      { kind: "guardrail", rate: 1, off: [0.05, 0.05], side: -1 },
      { kind: "snowman", rate: 0.07, off: [0.2, 0.6] },
      { kind: "deer", rate: 0.07, off: [0.3, 0.9] },
    ],
    draw(r, speedFactor) {
      const { H } = r;
      skyGradient(r, [
        [0, "#0b1a33"],
        [0.55, "#1d4e89"],
        [1, "#bfe3f8"],
      ]);
      r.drawStars(0.25);
      r.drawClouds(5, "rgba(255,255,255,0.18)", H * 0.14, 0.003);
      r.drawMountains([
        { col: "#2b4a6f", amp: 0.3, lift: 0, f1: 4, f2: 11, o: 1, snow: "#f1f5f9" },
        { col: "#1f3a58", amp: 0.22, lift: 0, f1: 8, f2: 21, o: 4, snow: "#e2e8f0" },
        { col: "#0f3d2e", amp: 0.1, lift: 0, f1: 17, f2: 37, o: 9 },
      ]);
      r.drawGround("#dbe6ee", "#9fb3c4");
      r.drawRoad({ asphalt: "#2a3140", edge: "#cbd5e1", center: "#38bdf8", shoulder: "#eef3f7", glow: null });
      r.drawTrackObjects(false);
      r.drawFog("230,240,250", 0.22);
      r.drawParticles("rgba(255,255,255,0.85)", false, 2, speedFactor);
      r.drawVignette(0.28);
    },
  },
  aurora: {
    night: true,
    spawn: [
      { kind: "pine", rate: 0.9, off: [0.1, 1.6] },
      { kind: "pine", rate: 0.5, off: [1.0, 2.4], size: 0.8 },
      { kind: "cabin", rate: 0.06, off: [0.6, 1.2] },
    ],
    draw(r) {
      const { ctx, W, H, horizonY, animTime } = r;
      skyGradient(r, [
        [0, "#020617"],
        [1, "#083344"],
      ]);
      r.drawStars(0.9);
      const colors = ["16,185,129", "56,189,248", "167,139,250", "52,211,153"];
      for (let b = 0; b < 4; b += 1) {
        ctx.beginPath();
        const by = H * (0.05 + b * 0.06);
        ctx.moveTo(0, by);
        for (let x = 0; x <= W; x += 16) {
          ctx.lineTo(x, by + Math.sin(x * 0.01 + animTime * (1.1 + b * 0.25)) * 30 + Math.sin(x * 0.027 - animTime) * 12);
        }
        ctx.lineTo(W, horizonY);
        ctx.lineTo(0, horizonY);
        ctx.closePath();
        const g = ctx.createLinearGradient(0, 0, 0, horizonY);
        const col = colors[b] ?? colors[0]!;
        g.addColorStop(0, `rgba(${col},0.45)`);
        g.addColorStop(0.6, `rgba(${col},0.12)`);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.fill();
      }
      r.drawMountains([
        { col: "#0a1f2e", amp: 0.14, lift: 0, f1: 6, f2: 15, o: 3, snow: "rgba(200,230,255,0.5)" },
        { col: "#06141f", amp: 0.08, lift: 0, f1: 12, f2: 29, o: 7 },
      ]);
      r.drawGround("#0a2a2a", "#021213");
      r.drawRoad({ asphalt: "#061a1e", edge: "#2dd4bf", center: "#10b981", shoulder: "#0b2f2b", glow: "#99f6e4" });
      r.drawHeadlights();
      r.drawTrackObjects(true);
      r.drawVignette(0.5);
    },
  },
  galaxy: {
    night: true,
    spawn: [
      { kind: "crystal", rate: 0.35, off: [0.1, 1.0] },
      { kind: "monolith", rate: 0.12, off: [0.3, 0.8] },
    ],
    draw(r) {
      const { ctx, W, H, horizonY, animTime } = r;
      ctx.fillStyle = "#04020c";
      ctx.fillRect(0, 0, W, H);
      r.drawStars(1);
      const nebulae: [string, number, number][] = [
        ["167,139,250", 0.3, 0.25],
        ["236,72,153", 0.62, 0.18],
        ["56,189,248", 0.48, 0.35],
      ];
      for (const [c, nx, ny] of nebulae) {
        const g = ctx.createRadialGradient(nx * W, ny * H, 10, nx * W, ny * H, W * 0.25);
        g.addColorStop(0, `rgba(${c},0.28)`);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.save();
      ctx.translate(W * 0.4 - curvatureAt(r.roadDist) * 20, horizonY - H * 0.12);
      ctx.rotate(animTime * 0.15);
      for (let arm = 0; arm < 3; arm += 1) {
        const a0 = (arm * TAU) / 3;
        for (let rad = 6; rad < 230; rad += 4) {
          const ang = a0 + rad * 0.035;
          ctx.fillStyle = rad < 50 ? "rgba(250,204,21,0.7)" : `rgba(192,132,252,${0.45 - rad / 600})`;
          ctx.beginPath();
          ctx.arc(Math.cos(ang) * rad * 1.4, Math.sin(ang) * rad * 0.5, 1.8 + rad / 90, 0, TAU);
          ctx.fill();
        }
      }
      ctx.restore();
      const px = W * 0.8;
      const py = H * 0.2;
      const pg = ctx.createRadialGradient(px - 15, py - 15, 5, px, py, 48);
      pg.addColorStop(0, "#fda4af");
      pg.addColorStop(1, "#7f1d1d");
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(px, py, 46, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "rgba(253,230,138,0.7)";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.ellipse(px, py, 80, 18, -0.3, 0, TAU);
      ctx.stroke();
      r.drawGround("#140a2a", "#05020c");
      r.drawRoad({ asphalt: "#120926", edge: "#e879f9", center: "#38bdf8", shoulder: null, glow: "#f0abfc" });
      r.drawTrackObjects(true);
    },
  },
  stars: {
    night: true,
    noGeometry: true,
    spawn: [],
    draw(r, speedFactor) {
      const { ctx, W, H } = r;
      ctx.fillStyle = "#03050a";
      ctx.fillRect(0, 0, W, H);
      r.drawWarpStars(speedFactor);
    },
  },
  plaid: {
    night: true,
    noGeometry: true,
    spawn: [],
    draw(r) {
      const { ctx, W, H } = r;
      ctx.fillStyle = "#040408";
      ctx.fillRect(0, 0, W, H);
      const cx = W / 2;
      const cy = H / 2;
      for (let i = 0; i < 36; i += 1) {
        const ang = (i / 36) * TAU;
        const hue = (i * 20 + Math.floor(r.roadDist * 120)) % 360;
        ctx.strokeStyle = `hsla(${hue},95%,60%,0.7)`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * 28, cy + Math.sin(ang) * 28);
        ctx.lineTo(cx + Math.cos(ang) * W, cy + Math.sin(ang) * W);
        ctx.stroke();
      }
      for (let ring = 0; ring < 10; ring += 1) {
        const t = ring / 10 + ((r.roadDist * 0.5) % (1 / 10));
        const rx = Math.pow(t, 2.2) * (W * 0.65);
        const ry = Math.pow(t, 2.2) * (H * 0.65);
        ctx.strokeStyle = `rgba(56,189,248,${t})`;
        ctx.lineWidth = 1.5 + t * 3;
        ctx.strokeRect(cx - rx, cy - ry, rx * 2, ry * 2);
      }
    },
  },
  christmas: {
    night: true,
    spawn: [
      { kind: "pine", rate: 0.9, off: [0.1, 1.5] },
      { kind: "pine", rate: 0.5, off: [0.9, 2.3], size: 0.8 },
      { kind: "cabin", rate: 0.18, off: [0.4, 1.0] },
      { kind: "snowman", rate: 0.12, off: [0.15, 0.6] },
      { kind: "lantern", rate: 0.35, off: [0.03, 0.07], side: 1 },
      { kind: "lantern", rate: 0.35, off: [0.03, 0.07], side: -1 },
    ],
    draw(r, speedFactor) {
      const { ctx, W, H, horizonY, animTime } = r;
      skyGradient(r, [
        [0, "#030a1c"],
        [0.6, "#0b1a33"],
        [1, "#1e3a5f"],
      ]);
      r.drawStars(0.9);
      r.drawMoon(W * 0.78, H * 0.16, H * 0.07, "#f1f5f9", "rgba(241,245,249,0.25)");
      r.drawMountains([
        { col: "#1e3a5f", amp: 0.22, lift: 0, f1: 5, f2: 13, o: 2, snow: "#e2e8f0" },
        { col: "#0f2740", amp: 0.14, lift: 0, f1: 9, f2: 23, o: 6, snow: "#cbd5e1" },
      ]);
      r.drawGround("#dbe6ee", "#8fa3b8");
      r.drawRoad({ asphalt: "#1f2733", edge: "#cbd5e1", center: "#fbbf24", shoulder: "#eef3f7", glow: "#fde68a" });
      // guirnaldas de luces sobre la vía
      for (let i = 10; i >= 1; i -= 1) {
        const p = i / 10 + ((r.roadDist * 0.25) % (1 / 10));
        const g = r.geoAt(p);
        const y = g.y - 70 * g.scale;
        for (let k = -4; k <= 4; k += 1) {
          const hue = ((k + 4) * 50 + Math.floor(animTime * 2) * 25) % 360;
          const flick = 0.6 + 0.4 * Math.sin(animTime * 6 + k + i);
          ctx.fillStyle = `hsla(${hue},95%,60%,${flick * p})`;
          ctx.beginPath();
          ctx.arc(g.x + (k / 4) * g.hw * 1.2, y + Math.abs(k) * 4 * g.scale, Math.max(0.8, 2.6 * g.scale), 0, TAU);
          ctx.fill();
        }
      }
      r.drawHeadlights();
      r.drawTrackObjects(true);
      r.drawParticles("rgba(255,255,255,0.9)", false, 2, speedFactor);
      r.drawVignette(0.4);
      void horizonY;
    },
  },
  rainy_city: {
    night: true,
    spawn: [
      { kind: "lantern", rate: 0.5, off: [0.03, 0.07], side: 1 },
      { kind: "lantern", rate: 0.5, off: [0.03, 0.07], side: -1 },
      { kind: "billboard", rate: 0.1, off: [0.5, 1.0] },
      { kind: "guardrail", rate: 0.8, off: [0.05, 0.05], side: -1 },
    ],
    draw(r) {
      const { ctx, W, H, horizonY } = r;
      skyGradient(r, [
        [0, "#020617"],
        [0.7, "#0b1b3a"],
        [1, "#1e3a8a"],
      ]);
      r.drawClouds(7, "rgba(80,100,140,0.35)", H * 0.06, 0.006);
      r.drawCity(horizonY + 2, 40, "#0b1120", "rgba(253,224,71,0.75)");
      r.drawGround("#0f172a", "#020617");
      r.drawRoad({ asphalt: "#111827", edge: "rgba(255,255,255,0.45)", center: "#fbbf24", shoulder: "#0b1220", glow: "#93c5fd" });
      // reflejos de las luces en el asfalto mojado
      const refl = ctx.createLinearGradient(0, horizonY, 0, H);
      refl.addColorStop(0, "rgba(253,224,71,0.18)");
      refl.addColorStop(0.5, "rgba(96,165,250,0.08)");
      refl.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = refl;
      ctx.fillRect(0, horizonY, W, H - horizonY);
      r.drawHeadlights();
      r.drawTrackObjects(true);
      r.drawFog("120,140,180", 0.14);
      r.drawVignette(0.5);
    },
  },
  city_day: {
    night: false,
    spawn: [
      { kind: "roadSign", rate: 0.08, off: [0.02, 0.06], side: 1 },
      { kind: "guardrail", rate: 0.9, off: [0.05, 0.05], side: -1 },
      { kind: "pine", rate: 0.25, off: [0.6, 1.4], size: 0.7 },
      { kind: "billboard", rate: 0.08, off: [0.5, 1.0] },
    ],
    draw(r) {
      const { H, horizonY } = r;
      skyGradient(r, [
        [0, "#1d4ed8"],
        [0.6, "#60a5fa"],
        [1, "#bae6fd"],
      ]);
      r.drawClouds(6, "rgba(255,255,255,0.55)", H * 0.1, 0.004);
      r.drawBirds(H * 0.15, 5, "#1e293b");
      r.drawCity(horizonY + 2, 34, "#475569", "rgba(255,255,255,0.5)");
      r.drawGround("#94a3b8", "#475569");
      r.drawRoad({ asphalt: "#3f4652", edge: "rgba(255,255,255,0.7)", center: "#fbbf24", shoulder: "#6b7280", glow: null });
      r.drawTrackObjects(false);
      r.drawVignette(0.2);
    },
  },
  portal: {
    night: true,
    spawn: [{ kind: "crystal", rate: 0.5, off: [0.1, 0.9] }],
    draw(r, speedFactor) {
      const { ctx, W, H } = r;
      ctx.fillStyle = "#05020d";
      ctx.fillRect(0, 0, W, H);
      r.drawStars(0.8);
      r.drawGround("#0f0720", "#05020d");
      r.drawRoad({ asphalt: "#0f0720", edge: "#f97316", center: "#00e5ff", shoulder: null, glow: "#fdba74" });
      for (let i = 12; i >= 1; i -= 1) {
        const p = i / 12 + ((r.roadDist * 0.25) % (1 / 12));
        const g = r.geoAt(p);
        ctx.save();
        const color = i % 2 === 0 ? `rgba(0,229,255,${p})` : `rgba(249,115,22,${p})`;
        ctx.strokeStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 20 * p;
        ctx.lineWidth = 2 + p * 6;
        ctx.beginPath();
        ctx.arc(g.x, g.y - 50 * g.scale, g.hw * 1.25, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
      r.drawTrackObjects(true);
      r.drawParticles("rgba(34,211,238,0.6)", true, 1, speedFactor);
    },
  },
};
