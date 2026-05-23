import { create } from "zustand";

export type WorkspaceObjectType = "image" | "pdf" | "code" | "text" | "unknown";

export type WorkspaceObject = {
  id: string;
  fileName: string;
  type: WorkspaceObjectType;
  previewUrl?: string;
  summary?: string;
  createdAt: number;
};

type WorkspaceStore = {
  objects: WorkspaceObject[];
  activeObjectId: string | null;
  activeIndex: number;

  addObject: (object: WorkspaceObject) => void;
  updateObject: (id: string, patch: Partial<WorkspaceObject>) => void;
  setActiveObject: (id: string) => void;
  nextObject: () => void;
  previousObject: () => void;
};

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  objects: [],
  activeObjectId: null,
  activeIndex: 0,
  addObject: (object) =>
    set((state) => {
      const objects = [...state.objects, object];

      return {
        objects,
        activeObjectId: object.id,
        activeIndex: objects.length - 1,
      };
    }),
  updateObject: (id, patch) =>
    set((state) => {
      const index = state.objects.findIndex((object) => object.id === id);
      if (index === -1) return state;

      const objects = [...state.objects];
      objects[index] = { ...objects[index], ...patch };
      const activeObjectId =
        state.activeObjectId === id && patch.id
          ? patch.id
          : state.activeObjectId;

      return {
        objects,
        activeObjectId,
      };
    }),
  setActiveObject: (id) =>
    set((state) => {
      const index = state.objects.findIndex((object) => object.id === id);
      if (index === -1) return state;

      return {
        activeObjectId: id,
        activeIndex: index,
      };
    }),
  nextObject: () =>
    set((state) => {
      if (state.objects.length === 0) return state;

      const activeIndex = (state.activeIndex + 1) % state.objects.length;

      return {
        activeIndex,
        activeObjectId: state.objects[activeIndex].id,
      };
    }),

  previousObject: () =>
    set((state) => {
      if (state.objects.length === 0) return state;

      const activeIndex =
        (state.activeIndex - 1 + state.objects.length) % state.objects.length;

      return {
        activeIndex,
        activeObjectId: state.objects[activeIndex].id,
      };
    }),
}));
