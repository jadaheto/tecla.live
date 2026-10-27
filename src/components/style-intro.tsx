"use client";

import * as React from "react";
import { usePreferences } from "@/stores/preferences";
import type { VisualStyle } from "@/types";

const INTRO_MS = 2_600;
const SESSION_KEY = "tecla-style-intro";

/**
 * Cortinilla al cambiar de estilo visual (y una vez por sesión al arrancar con
 * un estilo distinto del normal). Cada estilo tiene su propia escena, dibujada
 * con SVG y CSS propios (sin imágenes de terceros): KITT con su escáner,
 * Roadster como cabina de caza, Cyberpunk con glitch y TECLA con su marca.
 */
export function StyleIntro() {
  const visualStyle = usePreferences((state) => state.visualStyle);
  const reduceMotion = usePreferences((state) => state.reduceMotion);
  const [scene, setScene] = React.useState<VisualStyle | null>(null);
  const previousRef = React.useRef<VisualStyle | null>(null);

  React.useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = visualStyle;
    let show = false;
    if (previous === null) {
      // Primer render: solo al arrancar con un estilo especial, una vez por sesión.
      try {
        if (visualStyle !== "tecla" && sessionStorage.getItem(SESSION_KEY) !== visualStyle) {
          sessionStorage.setItem(SESSION_KEY, visualStyle);
          show = true;
        }
      } catch {
        show = false;
      }
    } else if (previous !== visualStyle) {
      // La rehidratación de preferencias también pasa de «tecla» al estilo guardado: si esta
      // sesión ya mostró la escena de ese estilo, no se repite en cada carga de página.
      try {
        show = sessionStorage.getItem(SESSION_KEY) !== visualStyle;
        sessionStorage.setItem(SESSION_KEY, visualStyle);
      } catch {
        show = true;
      }
    }
    if (!show) return;
    setScene(visualStyle);
    const timer = window.setTimeout(() => setScene(null), reduceMotion ? 1_200 : INTRO_MS);
    return () => window.clearTimeout(timer);
  }, [visualStyle, reduceMotion]);

  if (!scene) return null;
  return (
    <div
      className="style-intro"
      data-scene={scene}
      role="status"
      aria-live="polite"
      onClick={() => setScene(null)}
    >
      {scene === "kitt" ? <KittScene /> : scene === "roadster" ? <RoadsterScene /> : scene === "cyberpunk" ? <CyberpunkScene /> : <TeclaScene />}
    </div>
  );
}

/** Silueta propia de un coupé bajo de los 80 con el escáner rojo en el frontal. */
function KittScene() {
  return (
    <div className="style-intro__stage">
      <svg viewBox="0 0 640 220" className="style-intro__car" aria-hidden>
        <defs>
          <linearGradient id="kitt-body" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#2a2a2e" />
            <stop offset="1" stopColor="#050505" />
          </linearGradient>
        </defs>
        <path
          className="style-intro__car-body"
          d="M28 150 L70 146 L120 112 L210 92 L330 86 L430 92 L520 110 L600 136 L612 150 L600 168 L560 170 L540 160 L470 160 L450 170 L190 170 L170 160 L100 160 L80 170 L40 168 Z"
          fill="url(#kitt-body)"
          stroke="#3a3a3f"
          strokeWidth="2"
        />
        <path d="M150 112 L215 97 L325 92 L420 97 L480 114 Z" fill="#0b0b0d" stroke="#2b2b30" strokeWidth="1.5" />
        <circle cx="140" cy="168" r="26" fill="#0a0a0a" stroke="#3d3d42" strokeWidth="4" />
        <circle cx="500" cy="168" r="26" fill="#0a0a0a" stroke="#3d3d42" strokeWidth="4" />
        <circle cx="140" cy="168" r="9" fill="#1c1c1f" />
        <circle cx="500" cy="168" r="9" fill="#1c1c1f" />
        <rect x="556" y="148" width="54" height="7" rx="3" className="style-intro__scanner-track" />
        <rect x="556" y="148" width="14" height="7" rx="3" className="style-intro__scanner-light" />
      </svg>
      <p className="style-intro__eyebrow">El auto fantástico</p>
      <p className="style-intro__title">KITT en línea</p>
      <p className="style-intro__sub">Escáner activo · sistemas nominales</p>
    </div>
  );
}

/** Cabina de caza: rejilla, retícula y contorno de un coupé en alambre rojo. */
function RoadsterScene() {
  return (
    <div className="style-intro__stage">
      <svg viewBox="0 0 640 220" className="style-intro__car style-intro__wire" aria-hidden>
        <g fill="none" stroke="#ff2b2b" strokeWidth="1.6" className="style-intro__wire-lines">
          <path d="M30 150 L80 142 L130 106 L230 84 L350 80 L450 90 L540 112 L610 140 L600 168 L40 168 Z" />
          <path d="M130 106 L180 110 L230 84" />
          <path d="M230 84 L250 110 L350 108 L350 80" />
          <path d="M350 108 L450 112 L450 90" />
          <path d="M450 112 L540 118 L540 112" />
          <path d="M80 142 L600 140" />
          <circle cx="150" cy="166" r="26" />
          <circle cx="150" cy="166" r="10" />
          <circle cx="490" cy="166" r="26" />
          <circle cx="490" cy="166" r="10" />
        </g>
        <g className="style-intro__markers" fill="#ff2b2b">
          <rect x="226" y="80" width="8" height="8" transform="rotate(45 230 84)" />
          <rect x="446" y="86" width="8" height="8" transform="rotate(45 450 90)" />
          <rect x="146" y="162" width="8" height="8" transform="rotate(45 150 166)" />
          <rect x="486" y="162" width="8" height="8" transform="rotate(45 490 166)" />
        </g>
      </svg>
      <p className="style-intro__eyebrow">◆ Roadster</p>
      <p className="style-intro__title">Cabina lista</p>
      <p className="style-intro__sub">Sistemas nominales · piloto a bordo</p>
    </div>
  );
}

function CyberpunkScene() {
  return (
    <div className="style-intro__stage">
      <p className="style-intro__glitch" data-text="CYBERPUNK 2077">
        CYBERPUNK 2077
      </p>
      <p className="style-intro__sub">Interfaz de neón cargada · bienvenido a Night City</p>
    </div>
  );
}

function TeclaScene() {
  return (
    <div className="style-intro__stage">
      <svg viewBox="0 0 64 64" className="style-intro__mark" aria-hidden>
        <path d="M17 21h30" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        <path d="M32 21v25" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        <circle cx="48" cy="47" r="6" fill="#ff5a3c" />
      </svg>
      <p className="style-intro__title">TECLA LIVE</p>
      <p className="style-intro__sub">Estilo original restaurado</p>
    </div>
  );
}
