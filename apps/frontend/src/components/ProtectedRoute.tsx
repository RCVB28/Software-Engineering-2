import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function ProtectedRoute({ kind }: { kind: 'ADMIN' | 'RESIDENT' }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Loading session…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.kind !== kind) {
    return <Navigate to={user.kind === 'ADMIN' ? '/admin' : '/resident'} replace />;
  }
  return <Outlet />;
}
