export const MAX_SPEED = 140;
export const AUTO_TARGET_SPEED = 100;

export const DRIVE_SCENES = [
  {
    id: "orbit",
    label: "Órbita",
    subtitle: "Un horizonte profundo, sin carretera ni ruido exterior.",
    accent: "#5eead4",
    swatch: "from-[#102a43] via-[#0f766e] to-[#05070c]",
  },
  {
    id: "coast",
    label: "Costa",
    subtitle: "Luz cálida, agua en calma y una línea de horizonte infinita.",
    accent: "#ffb86b",
    swatch: "from-[#3b1f3f] via-[#c25b4b] to-[#102a43]",
  },
  {
    id: "canyon",
    label: "Cañón",
    subtitle: "Capas de piedra, estrellas y el pulso de un camino lejano.",
    accent: "#f59e0b",
    swatch: "from-[#2a1215] via-[#9a3412] to-[#09070b]",
  },
] as const;

export const DRIVE_SOUNDS = [
  {
    id: "wind",
    label: "Viento",
    subtitle: "Solo aire y rodadura. La opción más silenciosa.",
    color: "#b8f3e7",
  },
  {
    id: "electric",
    label: "Eléctrico",
    subtitle: "Un pulso limpio de vehículo eléctrico, hecho con ondas.",
    color: "#5eead4",
  },
  {
    id: "v8",
    label: "V8 sintético",
    subtitle: "Un rugido cálido creado con osciladores, sin samples.",
    color: "#ff9a6b",
  },
  {
    id: "warp",
    label: "Hiperespacio",
    subtitle: "Una deriva de ciencia ficción para cruzar la noche.",
    color: "#c4b5fd",
  },
] as const;

export type DriveSceneId = (typeof DRIVE_SCENES)[number]["id"];
export type DriveSoundId = (typeof DRIVE_SOUNDS)[number]["id"];

export interface DriveInputs {
  accelerating: boolean;
  braking: boolean;
  autoPilot: boolean;
}

export interface DriveStep {
  speed: number;
  autoPilot: boolean;
}

export function clampSpeed(value: number): number {
  return Math.min(MAX_SPEED, Math.max(0, value));
}

/**
 * Simulación determinista y estacionaria. No usa GPS ni pretende representar
 * la velocidad real del vehículo.
 */
export function stepDriveSpeed(
  current: number,
  inputs: DriveInputs,
  deltaSeconds: number,
): DriveStep {
  const dt = Math.min(0.1, Math.max(0, deltaSeconds));
  let speed = clampSpeed(current);
  let autoPilot = inputs.autoPilot;

  if (autoPilot) {
    speed += 26 * dt;
    if (speed >= AUTO_TARGET_SPEED) {
      speed = AUTO_TARGET_SPEED;
      autoPilot = false;
    }
  } else if (inputs.braking) {
    speed -= 34 * dt;
  } else if (inputs.accelerating) {
    speed += 20 * dt;
  } else {
    speed -= 5 * dt;
  }

  return { speed: clampSpeed(speed), autoPilot };
}

export function speedRatio(speed: number): number {
  return clampSpeed(speed) / MAX_SPEED;
}

export function formatSpeed(speed: number): string {
  return String(Math.round(clampSpeed(speed)));
}

export function findSound(id: DriveSoundId) {
  return DRIVE_SOUNDS.find((sound) => sound.id === id) ?? DRIVE_SOUNDS[1];
}

export function findScene(id: DriveSceneId) {
  return DRIVE_SCENES.find((scene) => scene.id === id) ?? DRIVE_SCENES[0];
}
