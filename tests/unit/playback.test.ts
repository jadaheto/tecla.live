import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  claimPlayback,
  registerPlaybackSource,
  startPlaybackArbiter,
  stopPlaybackArbiter,
} from "@/features/media/playback-sources";
import { getMediaController, registerBackgroundController, registerMediaController } from "@/features/media/player-bridge";
import { usePlayer } from "@/stores/player";

const radio = { pause: vi.fn(), stop: vi.fn() };
const spotify = { pause: vi.fn(), stop: vi.fn() };

function snapshot(kind: "youtube" | "drive" | "radio", isPlaying: boolean) {
  return { active: true, kind, title: null, isPlaying, positionSeconds: 0, durationSeconds: 0, canControl: true };
}

describe("playback arbiter", () => {
  beforeEach(() => {
    stopPlaybackArbiter();
    usePlayer.getState().closePlayer();
    radio.pause.mockClear();
    radio.stop.mockClear();
    spotify.pause.mockClear();
    spotify.stop.mockClear();
    registerPlaybackSource("radio", radio);
    registerPlaybackSource("spotify", spotify);
    startPlaybackArbiter();
  });

  it("pauses the radio when another source starts and stops it when the player closes", () => {
    usePlayer.getState().setCurrent({ kind: "radio", id: "r1", title: "Emisora" });
    expect(radio.pause).not.toHaveBeenCalled();
    usePlayer.getState().setCurrent({ kind: "youtube", id: "v1", title: "Video" });
    expect(radio.pause).toHaveBeenCalledTimes(1);
    expect(spotify.pause).not.toHaveBeenCalled();

    usePlayer.getState().setCurrent({ kind: "spotify", id: "spotify:track:1", title: "Canción" });
    usePlayer.getState().closePlayer();
    expect(spotify.stop).toHaveBeenCalledTimes(1);
    expect(spotify.pause).not.toHaveBeenCalled();
  });

  it("does not pause the radio when the station changes", () => {
    usePlayer.getState().setCurrent({ kind: "radio", id: "r1", title: "A" });
    usePlayer.getState().setCurrent({ kind: "radio", id: "r2", title: "B" });
    expect(radio.pause).not.toHaveBeenCalled();
    expect(radio.stop).not.toHaveBeenCalled();
  });

  it("claimPlayback pauses the other background sources and the page player, but never Drive", async () => {
    const pagePause = vi.fn(async () => ({ ok: true, message: "" }));
    const unregister = registerMediaController({
      getSnapshot: () => snapshot("youtube", true),
      play: async () => ({ ok: true, message: "" }),
      pause: pagePause,
      next: async () => ({ ok: true, message: "" }),
    });
    claimPlayback("radio");
    expect(spotify.pause).toHaveBeenCalledTimes(1);
    expect(radio.pause).not.toHaveBeenCalled();
    expect(pagePause).toHaveBeenCalledTimes(1);
    unregister();

    const drivePause = vi.fn(async () => ({ ok: true, message: "" }));
    const unregisterDrive = registerMediaController({
      getSnapshot: () => snapshot("drive", true),
      play: async () => ({ ok: true, message: "" }),
      pause: drivePause,
      next: async () => ({ ok: true, message: "" }),
    });
    claimPlayback("spotify");
    expect(drivePause).not.toHaveBeenCalled();
    unregisterDrive();
  });

  it("prefers the background controller in Drive while music is playing", () => {
    const drive = {
      getSnapshot: () => snapshot("drive", true),
      play: async () => ({ ok: true, message: "" }),
      pause: async () => ({ ok: true, message: "" }),
      next: async () => ({ ok: true, message: "" }),
    };
    const background = {
      getSnapshot: () => snapshot("radio", true),
      play: async () => ({ ok: true, message: "" }),
      pause: async () => ({ ok: true, message: "" }),
      next: async () => ({ ok: true, message: "" }),
    };
    const unregisterDrive = registerMediaController(drive);
    expect(getMediaController()).toBe(drive);
    const unregisterBackground = registerBackgroundController(background);
    expect(getMediaController()).toBe(background);
    unregisterDrive();
    expect(getMediaController()).toBe(background);
    unregisterBackground();
    expect(getMediaController()).toBeNull();
  });
});
