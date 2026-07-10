import { create } from "zustand";

interface StoreState {
  count: number;
  increment: () => void;
  sidebarOpened: boolean;
  setSidebarOpened: (v: boolean) => void;
}

export const useStore = create<StoreState>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  sidebarOpened: false,
  setSidebarOpened: (v) => set({ sidebarOpened: v }),
}));
