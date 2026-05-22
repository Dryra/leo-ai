import { create } from "zustand";

export type AgentState =
  | "idle"
  | "listening"
  | "inspecting"
  | "thinking"
  | "ready"
  | "speaking";

export type AgentEmotion = "neutral" | "happy" | "sad" | "angry" | "bored";

export type AgentGesture = "none" | "wink";

export type AgentAttentionTarget =
  | "none"
  | "chatInput"
  | "sendButton"
  | "voiceButton"
  | "chatPanel"
  | "spatialObject";

type AgentStore = {
  state: AgentState;
  emotion: AgentEmotion;
  isSpeaking: boolean;
  mouthOpen: number;
  afterSpeakingState: AgentState | null;
  voiceLevel: number;
  setVoiceLevel: (value: number) => void;
  setState: (state: AgentState) => void;
  setEmotion: (emotion: AgentEmotion) => void;
  setSpeaking: (value: boolean) => void;
  setMouthOpen: (value: number) => void;
  setAfterSpeakingState: (state: AgentState | null) => void;
  gesture: AgentGesture;
  triggerGesture: (gesture: AgentGesture) => void;
  clearGesture: () => void;
  attentionTarget: AgentAttentionTarget;
  setAttentionTarget: (target: AgentAttentionTarget) => void;
  clearAttentionTarget: () => void;
  agentActivity: AgentActivity;
  setAgentActivity: (activity: AgentActivity) => void;
  clearAgentActivity: () => void;
};

type AgentActivity = {
  text: string;
  kind: "idle" | "reading" | "scanning" | "comparing" | "preparing" | "result";
};

export const useAgentStore = create<AgentStore>((set, get) => ({
  state: "idle",
  emotion: "neutral",
  isSpeaking: false,
  mouthOpen: 0,
  afterSpeakingState: null,
  voiceLevel: 0,
  setVoiceLevel: (value) => set({ voiceLevel: value }),
  setState: (state) => set({ state }),
  setEmotion: (emotion) => set({ emotion }),
  setMouthOpen: (value) => set({ mouthOpen: value }),
  setAfterSpeakingState: (state) => set({ afterSpeakingState: state }),
  gesture: "none",
  agentActivity: {
    text: "",
    kind: "idle",
  },

  setAgentActivity: (activity) =>
    set({
      agentActivity: activity,
    }),

  clearAgentActivity: () =>
    set({
      agentActivity: {
        text: "",
        kind: "idle",
      },
    }),
  // attention
  attentionTarget: "none",
  setAttentionTarget: (target) => set({ attentionTarget: target }),
  clearAttentionTarget: () => set({ attentionTarget: "none" }),
  // gestures
  triggerGesture: (gesture) => set({ gesture }),
  clearGesture: () => set({ gesture: "none" }),
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

export function getActivityKind(text: string): AgentActivity["kind"] {
  const normalized = text.toLowerCase();

  if (
    normalized.includes("read") ||
    normalized.includes("file") ||
    normalized.includes("scanning")
  ) {
    return "reading";
  }

  if (normalized.includes("compare") || normalized.includes("context")) {
    return "comparing";
  }

  if (normalized.includes("prepar") || normalized.includes("answer")) {
    return "preparing";
  }

  return "scanning";
}
