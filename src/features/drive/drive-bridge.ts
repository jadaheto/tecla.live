"use client";

import type { DriveSceneId } from "./drive-config";

/**
 * Puente entre TECLA AI y la pantalla de TECLA DRIVE. La experiencia registra
 * un controlador mientras está montada; las herramientas lo usan y devuelven
 * el resultado real. Sin controlador, las acciones solo cambian preferencias
 * y navegan a /drive.
 */
export interface DriveController {
  engineOn: () => Promise<{ ok: boolean; message: string }>;
  engineOff: () => { ok: boolean; message: string };
  setEngine: (engineId: string) => void;
  setScene: (sceneId: DriveSceneId) => void;
  getState: () => { engineOn: boolean; engineName: string; sceneLabel: string; speedKmh: number; gps: boolean };
}

let controller: DriveController | null = null;

export function registerDriveController(next: DriveController): () => void {
  controller = next;
  return () => {
    if (controller === next) controller = null;
  };
}

export function getDriveController(): DriveController | null {
  return controller;
}
