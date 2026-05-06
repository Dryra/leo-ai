// client/src/stores/spatialObjectStore.ts
import { create } from "zustand";

export type SpatialObjectKind = "image" | "pdf" | "text";

export type SpatialObject = {
  id: string;
  kind: SpatialObjectKind;
  fileName: string;
  mimeType: string;
  previewUrl?: string;
  textPreview?: string;
  summary?: string;
  detectedType?: string;
  suggestedActions?: string[];
  status: "empty" | "uploading" | "inspecting" | "thinking" | "ready" | "error";
};

type SpatialObjectStore = {
  object: SpatialObject | null;
  setObject: (object: SpatialObject | null) => void;
  patchObject: (patch: Partial<SpatialObject>) => void;
};

export const useSpatialObjectStore = create<SpatialObjectStore>((set) => ({
  object: null,
  setObject: (object) => set({ object }),
  patchObject: (patch) =>
    set((state) => ({
      object: state.object ? { ...state.object, ...patch } : null,
    })),
}));
