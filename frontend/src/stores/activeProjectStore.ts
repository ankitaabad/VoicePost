import { create } from "zustand";
import { persist } from "zustand/middleware";

type ActiveProjectState = {
  activeProjectId: string | null;
  activeProjectName: string | null;
  setActiveProject: (id: string, name: string) => void;
  clearActiveProject: () => void;
};

export const useActiveProjectStore = create<ActiveProjectState>()(
  persist(
    (set) => ({
      activeProjectId: null,
      activeProjectName: null,
      setActiveProject: (id, name) =>
        set({ activeProjectId: id, activeProjectName: name }),
      clearActiveProject: () =>
        set({ activeProjectId: null, activeProjectName: null }),
    }),
    {
      name: "voicepost-active-project",
      version: 1,
    },
  ),
);
