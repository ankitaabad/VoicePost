import type { ProjectData } from "@app/shared";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type LastSelection = {
  voice_id: string;
  bgm_track: string;
  speed: number;
};

type ProjectsState = {
  projects: ProjectData[];
  lastSelection: LastSelection | null;
  addProject: (project: ProjectData) => void;
  updateProject: (project: ProjectData) => void;
  deleteProject: (id: string) => void;
  setLastSelection: (selection: LastSelection) => void;
  getProject: (id: string) => ProjectData | null;
  isProjectNameUnique: (name: string, excludeId?: string) => boolean;
};

export const useProjectsStore = create<ProjectsState>()(
  persist(
    (set, get) => ({
      projects: [],
      lastSelection: null,
      addProject: (project) =>
        set((s) => ({ projects: [project, ...s.projects] })),
      updateProject: (project) =>
        set((s) => ({
          projects: s.projects.map((p) => (p.id === project.id ? project : p)),
        })),
      deleteProject: (id) =>
        set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),
      setLastSelection: (selection) => set({ lastSelection: selection }),
      getProject: (id) => get().projects.find((p) => p.id === id) ?? null,
      isProjectNameUnique: (name, excludeId) => {
        const trimmed = name.trim().toLowerCase();
        return !get().projects.some(
          (p) => p.name.trim().toLowerCase() === trimmed && p.id !== excludeId,
        );
      },
    }),
    {
      name: "voicepost-projects",
      version: 1,
    },
  ),
);
