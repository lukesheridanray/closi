import { Routes, Route } from 'react-router-dom'
import '@/stores/authStore' // hydrates from localStorage on import
import SignIn from '@/pages/auth/SignIn'
import SignUp from '@/pages/auth/SignUp'
import CompanyDetails from '@/pages/auth/CompanyDetails'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import MainLayout from '@/components/layout/MainLayout'
import Dashboard from '@/pages/dashboard/Dashboard'
import PipelineBoard from '@/pages/pipeline/PipelineBoard'
import ContactList from '@/pages/contacts/ContactList'
import TaskList from '@/pages/tasks/TaskList'
import Calendar from '@/pages/calendar/Calendar'
import QuoteList from '@/pages/quotes/QuoteList'
import ContractList from '@/pages/contracts/ContractList'
import InvoiceList from '@/pages/invoices/InvoiceList'
import InventoryDashboard from '@/pages/inventory/InventoryDashboard'
import Reports from '@/pages/reports/Reports'
import OrgSettings from '@/pages/settings/OrgSettings'
import PipelineSettings from '@/pages/settings/PipelineSettings'
import IntegrationSettings from '@/pages/settings/IntegrationSettings'
import PaymentSettings from '@/pages/settings/PaymentSettings'
import TeamSettings from '@/pages/settings/TeamSettings'

function App() {
  return (
    <Routes>
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/company-details" element={<CompanyDetails />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="pipeline" element={<PipelineBoard />} />
          <Route path="contacts" element={<ContactList />} />
          <Route path="tasks" element={<TaskList />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="quotes" element={<QuoteList />} />
          <Route path="contracts" element={<ContractList />} />
          <Route path="invoices" element={<InvoiceList />} />
          <Route path="inventory" element={<InventoryDashboard />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings">
            <Route index element={<OrgSettings />} />
            <Route path="pipeline" element={<PipelineSettings />} />
            <Route path="integrations" element={<IntegrationSettings />} />
            <Route path="payments" element={<PaymentSettings />} />
            <Route path="team" element={<TeamSettings />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}

export default App
