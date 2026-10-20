"use client";

import * as React from "react";

export interface Capabilities {
  microphone: boolean;
  mediaRecorder: boolean;
  fullscreen: boolean;
  webSpeech: boolean;
}

const INITIAL: Capabilities = {
  microphone: false,
  mediaRecorder: false,
  fullscreen: false,
  webSpeech: false,
};

let clientSnapshot: Capabilities | null = null;

function getClientSnapshot(): Capabilities {
  if (!clientSnapshot) {
    clientSnapshot = {
      microphone: Boolean(navigator.mediaDevices?.getUserMedia),
      mediaRecorder: typeof window.MediaRecorder !== "undefined",
      fullscreen: Boolean(document.fullscreenEnabled),
      webSpeech: "SpeechRecognition" in window || "webkitSpeechRecognition" in window,
    };
  }
  return clientSnapshot;
}

const subscribe = () => () => {};

export function useCapabilities(): Capabilities {
  return React.useSyncExternalStore(subscribe, getClientSnapshot, () => INITIAL);
}
