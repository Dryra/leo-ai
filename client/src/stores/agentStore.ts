import { create } from "zustand";

export type AgentState = "idle" | "listening" | "thinking" | "speaking";
export type AgentEmotion = "neutral" | "happy" | "sad" | "angry" | "bored";

type AgentStore = {
  state: AgentState;
  emotion: AgentEmotion;
  isSpeaking: boolean;
  mouthOpen: number;
  setState: (state: AgentState) => void;
  setEmotion: (emotion: AgentEmotion) => void;
  setSpeaking: (value: boolean) => void;
  setMouthOpen: (value: number) => void;
};

export const useAgentStore = create<AgentStore>((set) => ({
  state: "idle",
  emotion: "neutral",
  isSpeaking: false,
  mouthOpen: 0,

  setState: (state) => set({ state }),
  setEmotion: (emotion) => set({ emotion }),
  setMouthOpen: (value) => set({ mouthOpen: value }),

  setSpeaking: (value) =>
    set({
      isSpeaking: value,
      state: value ? "speaking" : "idle",
      mouthOpen: value ? 0 : 0,
    }),
}));
