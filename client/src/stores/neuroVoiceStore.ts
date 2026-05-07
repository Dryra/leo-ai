// client/src/stores/neuroVoiceStore.ts
import { create } from "zustand";

export type NeuroVoiceState =
  | "idle"
  | "userSpeaking"
  | "silence"
  | "thinking"
  | "agentSpeaking";

type NeuroVoiceStore = {
  enabled: boolean;
  state: NeuroVoiceState;
  audioLevel: number;
  setEnabled: (enabled: boolean) => void;
  setState: (state: NeuroVoiceState) => void;
  setAudioLevel: (level: number) => void;
};

export const useNeuroVoiceStore = create<NeuroVoiceStore>((set) => ({
  enabled: false,
  state: "idle",
  audioLevel: 0,
  setEnabled: (enabled) => set({ enabled }),
  setState: (state) => set({ state }),
  setAudioLevel: (audioLevel) => set({ audioLevel }),
}));
