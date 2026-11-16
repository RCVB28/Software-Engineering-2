import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const baseLink = 'rounded-md px-3 py-2 text-sm font-medium transition';
const inactive = 'text-slate-400 hover:bg-slate-800 hover:text-slate-100';
const active = 'bg-slate-800 text-white';

export function Layout({ variant }: { variant: 'admin' | 'resident' }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const links =
    variant === 'admin'
      ? [
          { to: '/admin', label: 'Compose Alert', end: true },
          { to: '/admin/reports', label: 'Report Triage' },
          ...(user?.role === 'SUPERADMIN' ? [{ to: '/admin/accounts', label: 'Accounts' }] : []),
          { to: '/admin/audit', label: 'Audit Log' }
        ]
      : [
          { to: '/resident', label: 'Announcements', end: true },
          { to: '/resident/report', label: 'Submit Report' },
          { to: '/resident/profile', label: 'Profile' },
          { to: '/resident/preferences', label: 'Consent & Alerts' }
        ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-alert-600 text-lg">
              ⚠
            </span>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                {variant === 'admin' ? 'Admin Console' : 'Resident Portal'}
              </p>
              <p className="text-lg font-bold text-white">Emergency Alert Platform</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="text-right">
              <p className="font-semibold text-slate-100">{user?.displayName ?? user?.email}</p>
              <p className="text-xs text-slate-400">{user?.role}</p>
            </div>
            <button className="button-secondary" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl flex-wrap gap-1 px-4 pb-3">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={'end' in link ? link.end : false}
              className={({ isActive }) => `${baseLink} ${isActive ? active : inactive}`}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
