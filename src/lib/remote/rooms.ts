import { randomBytes } from "node:crypto";
import type { RemoteCommand, RemoteState } from "./schema";

/**
 * Salas del control remoto, en memoria del servidor. Una sala vive mientras
 * el auto la mantenga abierta (expira sola tras 3 horas sin actividad). El
 * código corto se muestra en el QR; el token largo solo lo conoce el auto y
 * autoriza recibir órdenes y publicar su estado. Una instancia: con varias
 * réplicas habría que moverlo a PostgreSQL o Redis (igual que el rate limit).
 */
export interface RemoteEnvelope {
  id: number;
  command: RemoteCommand;
  at: number;
}

export type RemoteListener = (envelope: RemoteEnvelope) => void;

export interface RemoteRoom {
  code: string;
  token: string;
  createdAt: number;
  touchedAt: number;
  state: RemoteState | null;
  stateAt: number | null;
  listeners: Set<RemoteListener>;
  sequence: number;
}

export const ROOM_TTL_MS = 3 * 60 * 60 * 1_000;
export const MAX_ROOMS = 400;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

interface RoomStore {
  rooms: Map<string, RemoteRoom>;
}

const globalStore = globalThis as unknown as { __teclaRemoteRooms?: RoomStore };

function store(): RoomStore {
  if (!globalStore.__teclaRemoteRooms) globalStore.__teclaRemoteRooms = { rooms: new Map() };
  return globalStore.__teclaRemoteRooms;
}

export function generateCode(random: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < 6; i += 1) code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)] ?? "A";
  return code;
}

function generateToken(): string {
  return randomBytes(24).toString("hex");
}

export function sweepRooms(now = Date.now()): void {
  const { rooms } = store();
  for (const [code, room] of rooms) {
    if (now - room.touchedAt > ROOM_TTL_MS) rooms.delete(code);
  }
}

export function createRoom(now = Date.now()): RemoteRoom | null {
  sweepRooms(now);
  const { rooms } = store();
  if (rooms.size >= MAX_ROOMS) return null;
  let code = generateCode();
  let attempts = 0;
  while (rooms.has(code) && attempts < 20) {
    code = generateCode();
    attempts += 1;
  }
  if (rooms.has(code)) return null;
  const room: RemoteRoom = {
    code,
    token: generateToken(),
    createdAt: now,
    touchedAt: now,
    state: null,
    stateAt: null,
    listeners: new Set(),
    sequence: 0,
  };
  rooms.set(code, room);
  return room;
}

export function getRoom(code: string): RemoteRoom | null {
  const room = store().rooms.get(code) ?? null;
  if (!room) return null;
  if (Date.now() - room.touchedAt > ROOM_TTL_MS) {
    store().rooms.delete(code);
    return null;
  }
  return room;
}

/** Reutiliza la sala si el auto presenta el token correcto; si no, crea otra. */
export function resumeOrCreateRoom(code: string | undefined, token: string | undefined, now = Date.now()): RemoteRoom | null {
  if (code && token) {
    const existing = getRoom(code);
    if (existing && existing.token === token) {
      existing.touchedAt = now;
      return existing;
    }
  }
  return createRoom(now);
}

export function authorizeRoom(code: string, token: string): RemoteRoom | null {
  const room = getRoom(code);
  if (!room || room.token !== token) return null;
  return room;
}

export function publishCommand(room: RemoteRoom, command: RemoteCommand, now = Date.now()): RemoteEnvelope {
  room.sequence += 1;
  room.touchedAt = now;
  const envelope: RemoteEnvelope = { id: room.sequence, command, at: now };
  for (const listener of room.listeners) {
    try {
      listener(envelope);
    } catch {
      // Un oyente roto no debe tumbar a los demás.
    }
  }
  return envelope;
}

export function subscribe(room: RemoteRoom, listener: RemoteListener): () => void {
  room.listeners.add(listener);
  room.touchedAt = Date.now();
  return () => {
    room.listeners.delete(listener);
  };
}

export function updateState(room: RemoteRoom, state: RemoteState, now = Date.now()): void {
  room.state = state;
  room.stateAt = now;
  room.touchedAt = now;
}

export function closeRoom(code: string): void {
  store().rooms.delete(code);
}

export function resetRoomsForTests(): void {
  store().rooms.clear();
}
