import { create } from "zustand";

type ActiveProjectState = {
  activeProjectId: string | null;
  activeProjectName: string | null;
  setActiveProject: (id: string, name: string) => void;
  clearActiveProject: () => void;
};

export const useActiveProjectStore = create<ActiveProjectState>((set) => ({
  activeProjectId: null,
  activeProjectName: null,
  setActiveProject: (id, name) =>
    set({ activeProjectId: id, activeProjectName: name }),
  clearActiveProject: () =>
    set({ activeProjectId: null, activeProjectName: null }),
}));
