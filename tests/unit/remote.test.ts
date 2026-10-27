import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_ROOMS,
  ROOM_TTL_MS,
  authorizeRoom,
  createRoom,
  generateCode,
  getRoom,
  publishCommand,
  resetRoomsForTests,
  resumeOrCreateRoom,
  subscribe,
  updateState,
} from "@/lib/remote/rooms";
import { REMOTE_CODE, REMOTE_TOKEN, RemoteCommandSchema, RemoteStateSchema } from "@/lib/remote/schema";
import { describeRemoteCommand, remoteUrl } from "@/features/remote/remote-session";

describe("control remoto: contrato", () => {
  it("accepts only the known commands and rejects anything executable", () => {
    expect(RemoteCommandSchema.safeParse({ type: "play" }).success).toBe(true);
    expect(RemoteCommandSchema.safeParse({ type: "volume", delta: 10 }).success).toBe(true);
    expect(RemoteCommandSchema.safeParse({ type: "volume", delta: 500 }).success).toBe(false);
    expect(RemoteCommandSchema.safeParse({ type: "open", screen: "music" }).success).toBe(true);
    expect(RemoteCommandSchema.safeParse({ type: "open", screen: "https://evil.example" }).success).toBe(false);
    expect(RemoteCommandSchema.safeParse({ type: "open", href: "/music" }).success).toBe(false);
    expect(RemoteCommandSchema.safeParse({ type: "ask", text: "pon salsa" }).success).toBe(true);
    expect(RemoteCommandSchema.safeParse({ type: "ask", text: "x".repeat(300) }).success).toBe(false);
    expect(RemoteCommandSchema.safeParse({ type: "eval", code: "1+1" }).success).toBe(false);
    expect(RemoteCommandSchema.safeParse({ type: "style", style: "kitt" }).success).toBe(true);
  });

  it("validates the state the car publishes", () => {
    expect(
      RemoteStateSchema.safeParse({ screen: "/music", title: "Song", subtitle: null, kind: "spotify", isPlaying: true, volume: 80, style: "tecla", ambient: false }).success,
    ).toBe(true);
    expect(RemoteStateSchema.safeParse({ screen: "/music", volume: 80 }).success).toBe(false);
  });

  it("builds the phone URL and labels commands in Spanish", () => {
    expect(remoteUrl("ABC234", "https://tecla.live/")).toBe("https://tecla.live/remote/ABC234");
    expect(describeRemoteCommand({ type: "volume", delta: -10 })).toBe("Bajar volumen");
    expect(describeRemoteCommand({ type: "ask", text: "hola" })).toBe("TECLA AI: «hola»");
    expect(describeRemoteCommand({ type: "ambient", on: true })).toBe("Pantalla ambiente");
  });
});

describe("control remoto: salas", () => {
  beforeEach(() => resetRoomsForTests());

  it("generates unambiguous six-letter codes and long tokens", () => {
    const code = generateCode();
    expect(code).toMatch(REMOTE_CODE);
    expect(code).not.toMatch(/[01IO]/);
    const room = createRoom();
    expect(room?.token).toMatch(REMOTE_TOKEN);
  });

  it("authorizes only with the car token and resumes a room with it", () => {
    const now = Date.now();
    const room = createRoom(now);
    expect(room).not.toBeNull();
    if (!room) return;
    expect(authorizeRoom(room.code, room.token)).toBe(room);
    expect(authorizeRoom(room.code, "f".repeat(48))).toBeNull();
    expect(resumeOrCreateRoom(room.code, room.token, now + 1_000)).toBe(room);
    const other = resumeOrCreateRoom(room.code, "a".repeat(48), now + 1_000);
    expect(other).not.toBe(room);
    expect(other?.code).not.toBe(room.code);
  });

  it("delivers commands to subscribed cars in order and keeps the last state", () => {
    const room = createRoom();
    if (!room) throw new Error("sin sala");
    const received: number[] = [];
    const unsubscribe = subscribe(room, (envelope) => received.push(envelope.id));
    publishCommand(room, { type: "play" });
    publishCommand(room, { type: "next" });
    unsubscribe();
    publishCommand(room, { type: "pause" });
    expect(received).toEqual([1, 2]);
    updateState(room, { screen: "/", title: null, subtitle: null, kind: null, isPlaying: false, volume: 50, style: "kitt", ambient: false });
    expect(getRoom(room.code)?.state?.style).toBe("kitt");
  });

  it("expires rooms after the TTL and caps the number of rooms", () => {
    const room = createRoom(Date.now());
    if (!room) throw new Error("sin sala");
    expect(getRoom(room.code)).toBe(room);
    resetRoomsForTests();
    const stale = createRoom(Date.now() - ROOM_TTL_MS - 1);
    expect(stale && getRoom(stale.code)).toBeNull();
    resetRoomsForTests();
    for (let i = 0; i < MAX_ROOMS; i += 1) createRoom();
    expect(createRoom()).toBeNull();
  });
});
