import { create } from "zustand";

type UiState = {
  drawerOpen: boolean;
  nameModalOpen: boolean;
  projectsRefreshKey: number;
  openDrawer: () => void;
  closeDrawer: () => void;
  openNameModal: () => void;
  closeNameModal: () => void;
  bumpProjectsRefresh: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  drawerOpen: false,
  nameModalOpen: false,
  projectsRefreshKey: 0,
  openDrawer: () => set({ drawerOpen: true }),
  closeDrawer: () => set({ drawerOpen: false }),
  openNameModal: () => set({ nameModalOpen: true }),
  closeNameModal: () => set({ nameModalOpen: false }),
  bumpProjectsRefresh: () =>
    set((s) => ({ projectsRefreshKey: s.projectsRefreshKey + 1 })),
}));
