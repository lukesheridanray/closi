import { create } from 'zustand'

interface LayoutState {
  sidebarCollapsed: boolean
  mobileDrawerOpen: boolean
  toggleSidebar: () => void
  setMobileDrawerOpen: (open: boolean) => void
}

const useLayoutStore = create<LayoutState>((set) => ({
  sidebarCollapsed: false,
  mobileDrawerOpen: false,

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setMobileDrawerOpen: (open) =>
    set({ mobileDrawerOpen: open }),
}))

export default useLayoutStore
