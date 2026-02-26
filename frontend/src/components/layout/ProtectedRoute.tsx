import { Navigate, Outlet } from 'react-router-dom'
import useAuthStore from '@/stores/authStore'

export default function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isHydrated = useAuthStore((s) => s.isHydrated)

  if (!isHydrated) return null

  if (!isAuthenticated) return <Navigate to="/signin" replace />

  return <Outlet />
}
