import type { AiPersona, VisualStyle } from "@/types";

/**
 * Personalidad efectiva de TECLA AI. El estilo visual «El auto fantástico»
 * activa la personalidad KITT por encima de la elegida en Ajustes: el
 * asistente habla como el ordenador de a bordo de la serie (sereno, preciso,
 * algo orgulloso de sus sistemas y con humor seco).
 */
export type EffectivePersona = AiPersona | "kitt";

export function effectivePersona(input: { aiPersona: AiPersona; visualStyle: VisualStyle }): EffectivePersona {
  return input.visualStyle === "kitt" ? "kitt" : input.aiPersona;
}

/** Tratamiento formal (de usted) para Jarvis y KITT; de tú para el copiloto. */
export function isFormalPersona(persona: EffectivePersona): boolean {
  return persona !== "copiloto";
}
