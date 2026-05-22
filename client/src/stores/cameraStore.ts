import { create } from "zustand";

type CameraModeStore = {
  freeCameraEnabled: boolean;
  setFreeCameraEnabled: (enabled: boolean) => void;
  toggleFreeCamera: () => void;
};

export const useCameraStore = create<CameraModeStore>((set) => ({
  freeCameraEnabled: false,
  setFreeCameraEnabled: (enabled) => set({ freeCameraEnabled: enabled }),
  toggleFreeCamera: () =>
    set((state) => ({ freeCameraEnabled: !state.freeCameraEnabled })),
}));
