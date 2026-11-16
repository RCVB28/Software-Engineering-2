import { Navigate } from 'react-router-dom';

export function AdminHomeRedirect() {
  return <Navigate to="/admin/compose" replace />;
}
