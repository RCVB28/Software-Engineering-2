import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './hooks/useAuth';
import { AuthProvider } from './hooks/useAuth';
import { AdminAccounts } from './pages/admin/AdminAccounts';
import { AdminHomeRedirect } from './pages/admin/AdminHomeRedirect';
import { AlertComposer } from './pages/admin/AlertComposer';
import { AlertDeliveries } from './pages/admin/AlertDeliveries';
import { AlertDetail } from './pages/admin/AlertDetail';
import { AlertHistory } from './pages/admin/AlertHistory';
import { AuditLog } from './pages/admin/AuditLog';
import { Notifications } from './pages/admin/Notifications';
import { ReportTriage } from './pages/admin/ReportTriage';
import { Login } from './pages/Login';
import { NotFound } from './pages/NotFound';
import { Announcements } from './pages/subscriber/Announcements';
import { ResidentAlertHistory } from './pages/subscriber/AlertHistory';
import { Preferences } from './pages/subscriber/Preferences';
import { Profile } from './pages/subscriber/Profile';
import { Register } from './pages/subscriber/Register';
import { ReportForm } from './pages/subscriber/ReportForm';

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-slate-400">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.kind === 'ADMIN' ? '/admin' : '/resident'} replace />;
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route element={<ProtectedRoute kind="ADMIN" />}>
          <Route path="/admin" element={<Layout variant="admin" />}>
            <Route index element={<AdminHomeRedirect />} />
            <Route path="compose" element={<AlertComposer />} />
            <Route path="history" element={<AlertHistory />} />
            <Route path="alerts/:alertId" element={<AlertDetail />} />
            <Route path="alerts/:alertId/deliveries" element={<AlertDeliveries />} />
            <Route path="reports" element={<ReportTriage />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="accounts" element={<AdminAccounts />} />
            <Route path="audit" element={<AuditLog />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute kind="RESIDENT" />}>
          <Route path="/resident" element={<Layout variant="resident" />}>
            <Route index element={<Announcements />} />
            <Route path="history" element={<ResidentAlertHistory />} />
            <Route path="report" element={<ReportForm />} />
            <Route path="profile" element={<Profile />} />
            <Route path="preferences" element={<Preferences />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}
