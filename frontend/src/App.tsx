import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { AppLayout } from './components/layout/AppLayout'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { EmployeeCreatePage } from './pages/EmployeeCreatePage'
import { EmployeeDetailsPage } from './pages/EmployeeDetailsPage'
import { EmployeeListPage } from './pages/EmployeeListPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route index element={<HomePage />} />
                <Route path="employees" element={<EmployeeListPage />} />
                <Route path="employees/new" element={<EmployeeCreatePage />} />
                <Route path="employees/:employeeId" element={<EmployeeDetailsPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
