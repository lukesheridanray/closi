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
const BillingOps = lazy(() => import('@/pages/billing/BillingOps'))
const PipelineBoard = lazy(() => import('@/pages/pipeline/PipelineBoard'))
const ContactList = lazy(() => import('@/pages/contacts/ContactList'))
const AddLead = lazy(() => import('@/pages/contacts/AddLead'))
const TaskList = lazy(() => import('@/pages/tasks/TaskList'))
const Calendar = lazy(() => import('@/pages/calendar/Calendar'))
const QuoteList = lazy(() => import('@/pages/quotes/QuoteList'))
const ContractList = lazy(() => import('@/pages/contracts/ContractList'))
const InvoiceList = lazy(() => import('@/pages/invoices/InvoiceList'))
const InventoryDashboard = lazy(() => import('@/pages/inventory/InventoryDashboard'))
const Reports = lazy(() => import('@/pages/reports/Reports'))
const OrgSettings = lazy(() => import('@/pages/settings/OrgSettings'))
const PipelineSettings = lazy(() => import('@/pages/settings/PipelineSettings'))
const IntegrationSettings = lazy(() => import('@/pages/settings/IntegrationSettings'))
const PaymentSettings = lazy(() => import('@/pages/settings/PaymentSettings'))
const TeamSettings = lazy(() => import('@/pages/settings/TeamSettings'))

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
          <Route path="billing" element={<Suspense fallback={<PageLoader />}><BillingOps /></Suspense>} />
          <Route path="pipeline" element={<Suspense fallback={<PageLoader />}><PipelineBoard /></Suspense>} />
          <Route path="contacts" element={<Suspense fallback={<PageLoader />}><ContactList /></Suspense>} />
          <Route path="contacts/new" element={<Suspense fallback={<PageLoader />}><AddLead /></Suspense>} />
          <Route path="tasks" element={<Suspense fallback={<PageLoader />}><TaskList /></Suspense>} />
          <Route path="calendar" element={<Suspense fallback={<PageLoader />}><Calendar /></Suspense>} />
          <Route path="quotes" element={<Suspense fallback={<PageLoader />}><QuoteList /></Suspense>} />
          <Route path="contracts" element={<Suspense fallback={<PageLoader />}><ContractList /></Suspense>} />
          <Route path="invoices" element={<Suspense fallback={<PageLoader />}><InvoiceList /></Suspense>} />
          <Route path="inventory" element={<Suspense fallback={<PageLoader />}><InventoryDashboard /></Suspense>} />
          <Route path="reports" element={<Suspense fallback={<PageLoader />}><Reports /></Suspense>} />
          <Route path="settings">
            <Route index element={<Suspense fallback={<PageLoader />}><OrgSettings /></Suspense>} />
            <Route path="pipeline" element={<Suspense fallback={<PageLoader />}><PipelineSettings /></Suspense>} />
            <Route path="integrations" element={<Suspense fallback={<PageLoader />}><IntegrationSettings /></Suspense>} />
            <Route path="payments" element={<Suspense fallback={<PageLoader />}><PaymentSettings /></Suspense>} />
            <Route path="team" element={<Suspense fallback={<PageLoader />}><TeamSettings /></Suspense>} />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}

export default App
