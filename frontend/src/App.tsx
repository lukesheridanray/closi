import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import '@/stores/authStore' // hydrates from localStorage on import

// Auth pages (not lazy - needed immediately)
import SignIn from '@/pages/auth/SignIn'
import SignUp from '@/pages/auth/SignUp'
import CompanyDetails from '@/pages/auth/CompanyDetails'

// Layout (not lazy - wraps all pages)
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import MainLayout from '@/components/layout/MainLayout'

// Lazy-loaded page components
const Dashboard = lazy(() => import('@/pages/dashboard/Dashboard'))
const Pipeline = lazy(() => import('@/pages/pipeline/Pipeline'))
const AccountList = lazy(() => import('@/pages/accounts/AccountList'))
const AccountDetail = lazy(() => import('@/pages/accounts/AccountDetail'))
const BillingHub = lazy(() => import('@/pages/billing/BillingHub'))
const TasksAndCalendar = lazy(() => import('@/pages/tasks/TasksAndCalendar'))
const OrgSettings = lazy(() => import('@/pages/settings/OrgSettings'))
const PaymentSettings = lazy(() => import('@/pages/settings/PaymentSettings'))
const IntegrationSettings = lazy(() => import('@/pages/settings/IntegrationSettings'))
const TeamSettings = lazy(() => import('@/pages/settings/TeamSettings'))
const ProductCatalog = lazy(() => import('@/pages/settings/ProductCatalog'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/company-details" element={<CompanyDetails />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route index element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
          <Route path="pipeline" element={<Suspense fallback={<PageLoader />}><Pipeline /></Suspense>} />
          <Route path="accounts" element={<Suspense fallback={<PageLoader />}><AccountList /></Suspense>} />
          <Route path="accounts/:id" element={<Suspense fallback={<PageLoader />}><AccountDetail /></Suspense>} />
          <Route path="billing" element={<Suspense fallback={<PageLoader />}><BillingHub /></Suspense>} />
          <Route path="tasks" element={<Suspense fallback={<PageLoader />}><TasksAndCalendar /></Suspense>} />
          <Route path="settings">
            <Route index element={<Suspense fallback={<PageLoader />}><OrgSettings /></Suspense>} />
            <Route path="integrations" element={<Suspense fallback={<PageLoader />}><IntegrationSettings /></Suspense>} />
            <Route path="payments" element={<Suspense fallback={<PageLoader />}><PaymentSettings /></Suspense>} />
            <Route path="team" element={<Suspense fallback={<PageLoader />}><TeamSettings /></Suspense>} />
            <Route path="products" element={<Suspense fallback={<PageLoader />}><ProductCatalog /></Suspense>} />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}

export default App
