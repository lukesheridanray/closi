import { Routes, Route } from 'react-router-dom'
import '@/stores/authStore' // hydrates from localStorage on import
import SignIn from '@/pages/auth/SignIn'
import SignUp from '@/pages/auth/SignUp'
import CompanyDetails from '@/pages/auth/CompanyDetails'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'
import Dashboard from '@/pages/dashboard/Dashboard'
import Pipeline from '@/pages/pipeline/Pipeline'
import Contacts from '@/pages/contacts/Contacts'
import Tasks from '@/pages/tasks/Tasks'
import Quotes from '@/pages/quotes/Quotes'
import Contracts from '@/pages/contracts/Contracts'
import Invoices from '@/pages/invoices/Invoices'
import Settings from '@/pages/settings/Settings'

function App() {
  return (
    <Routes>
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/company-details" element={<CompanyDetails />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="quotes" element={<Quotes />} />
          <Route path="contracts" element={<Contracts />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
