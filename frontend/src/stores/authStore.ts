import { create } from 'zustand'
import type { User, Organization } from '@/types/auth'

interface AuthState {
  user: User | null
  organization: Organization | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isHydrated: boolean
}

interface AuthActions {
  setAuth: (data: {
    user: User
    organization: Organization
    access_token: string
    refresh_token: string
  }) => void
  logout: () => void
  loadFromStorage: () => void
  updateOrganization: (organization: Organization) => void
}

const useAuthStore = create<AuthState & AuthActions>((set) => ({
  user: null,
  organization: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isHydrated: false,

  setAuth: (data) => {
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    localStorage.setItem('user', JSON.stringify(data.user))
    localStorage.setItem('organization', JSON.stringify(data.organization))

    set({
      user: data.user,
      organization: data.organization,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      isAuthenticated: true,
      isHydrated: true,
    })
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    localStorage.removeItem('organization')

    set({
      user: null,
      organization: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    })
  },

  loadFromStorage: () => {
    const accessToken = localStorage.getItem('access_token')
    const refreshToken = localStorage.getItem('refresh_token')
    const userStr = localStorage.getItem('user')
    const orgStr = localStorage.getItem('organization')

    if (accessToken && refreshToken && userStr) {
      try {
        const user = JSON.parse(userStr) as User
        const organization = orgStr ? (JSON.parse(orgStr) as Organization) : null

        set({
          user,
          organization,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isHydrated: true,
        })
      } catch {
        // Corrupted storage data, clear everything
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        localStorage.removeItem('user')
        localStorage.removeItem('organization')
        set({ isHydrated: true })
      }
    } else {
      set({ isHydrated: true })
    }
  },

  updateOrganization: (organization) => {
    localStorage.setItem('organization', JSON.stringify(organization))
    set({ organization })
  },
}))

// Hydrate from localStorage synchronously on store creation
// so auth state is ready before any component renders
useAuthStore.getState().loadFromStorage()

export default useAuthStore
