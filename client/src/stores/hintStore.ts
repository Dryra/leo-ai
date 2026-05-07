import { create } from "zustand";

export const PREDEFINED_HINTS = [
  "Hold Space bar to start the voice chat.",
  "LEO can generate images, edit and read files.",
  "Drop an image, PDF, or text file into the workspace.",
  "Ask LEO to summarize, explain, or improve an uploaded object.",
  "Use the chat panel for quick follow-up questions.",
  "Toggle the ambient audio from the bottom-left controls.",
];

type HintStore = {
  hint: string;
  hintIndex: number;
  setHint: (hint: string) => void;
  showNextHint: () => void;
  clearHint: () => void;
};

export const useHintStore = create<HintStore>((set) => ({
  hint: PREDEFINED_HINTS[0],
  hintIndex: 0,
  setHint: (hint) => set({ hint }),
  showNextHint: () =>
    set((state) => {
      const hintIndex = (state.hintIndex + 1) % PREDEFINED_HINTS.length;

      return {
        hintIndex,
        hint: PREDEFINED_HINTS[hintIndex],
      };
    }),
  clearHint: () =>
    set((state) => ({
      hint: PREDEFINED_HINTS[state.hintIndex],
    })),
}));
