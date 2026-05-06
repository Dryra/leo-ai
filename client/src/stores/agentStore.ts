import { create } from "zustand";

export type AgentState =
  | "idle"
  | "listening"
  | "inspecting"
  | "thinking"
  | "ready"
  | "speaking";

export type AgentEmotion = "neutral" | "happy" | "sad" | "angry" | "bored";

type AgentStore = {
  state: AgentState;
  emotion: AgentEmotion;
  isSpeaking: boolean;
  mouthOpen: number;
  afterSpeakingState: AgentState | null;

  setState: (state: AgentState) => void;
  setEmotion: (emotion: AgentEmotion) => void;
  setSpeaking: (value: boolean) => void;
  setMouthOpen: (value: number) => void;
  setAfterSpeakingState: (state: AgentState | null) => void;
};

export const useAgentStore = create<AgentStore>((set, get) => ({
  state: "idle",
  emotion: "neutral",
  isSpeaking: false,
  mouthOpen: 0,
  afterSpeakingState: null,
  setState: (state) => set({ state }),
  setEmotion: (emotion) => set({ emotion }),
  setMouthOpen: (value) => set({ mouthOpen: value }),
  setAfterSpeakingState: (state) => set({ afterSpeakingState: state }),

  setSpeaking: (value) => {
    if (value) {
      set({
        isSpeaking: true,
        state: "speaking",
        mouthOpen: 0,
      });
      return;
    }

    const afterSpeakingState = get().afterSpeakingState;
    console.log("after speakign state", afterSpeakingState);
    set({
      isSpeaking: false,
      state: afterSpeakingState ?? "idle",
      afterSpeakingState: null,
      mouthOpen: 0,
    });
  },
}));
