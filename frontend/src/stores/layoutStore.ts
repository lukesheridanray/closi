import { create } from 'zustand'

interface LayoutState {
  sidebarPanelOpen: boolean
  toggleSidebarPanel: () => void
}

const useLayoutStore = create<LayoutState>((set) => ({
  sidebarPanelOpen: true,

  toggleSidebarPanel: () =>
    set((state) => ({ sidebarPanelOpen: !state.sidebarPanelOpen })),
}))

export default useLayoutStore
