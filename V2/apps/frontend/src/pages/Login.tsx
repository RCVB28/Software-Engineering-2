import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ResidentAuthForm } from '../components/ResidentAuthForm';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../services/api';

export function Login() {
  const { user, loginAdmin } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'admin' | 'resident'>('admin');
  const [email, setEmail] = useState('superadmin@example.com');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleAdminLogin = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const loggedIn = await loginAdmin(email.trim(), password);
      navigate(loggedIn.kind === 'ADMIN' ? '/admin' : '/resident');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-alert-600 text-2xl">
            ⚠
          </div>
          <h1 className="text-2xl font-bold text-white">Emergency Alert Platform</h1>
          <p className="text-sm text-slate-400">Localized broadcast and reporting</p>
        </div>

        <div className="card">
          <div className="mb-5 flex rounded-lg bg-slate-950 p-1 text-sm">
            <button
              type="button"
              className={`flex-1 rounded-md px-3 py-2 font-semibold ${
                mode === 'admin' ? 'bg-slate-800 text-white' : 'text-slate-400'
              }`}
              onClick={() => setMode('admin')}
            >
              Administrator
            </button>
            <button
              type="button"
              className={`flex-1 rounded-md px-3 py-2 font-semibold ${
                mode === 'resident' ? 'bg-slate-800 text-white' : 'text-slate-400'
              }`}
              onClick={() => setMode('resident')}
            >
              Resident
            </button>
          </div>

          {mode === 'admin' ? (
            <>
              {error && (
                <p className="mb-4 rounded-md border border-rose-800 bg-rose-950/60 px-3 py-2 text-sm text-rose-200">
                  {error}
                </p>
              )}
              <form className="space-y-4" onSubmit={handleAdminLogin}>
                <div>
                  <label className="label" htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    className="input"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label" htmlFor="password">
                    Password
                  </label>
                  <input
                    id="password"
                    className="input"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </div>
                <button className="button w-full" type="submit" disabled={busy}>
                  {busy ? 'Signing in…' : 'Sign in'}
                </button>
                <p className="text-xs text-slate-500">
                  Demo: superadmin@example.com / mayor@example.com / captain@example.com — password
                  Password123!
                </p>
              </form>
            </>
          ) : (
            <>
              <ResidentAuthForm mode="login" />
              <p className="mt-4 text-center text-xs text-slate-500">
                New resident? <Link className="underline" to="/register">Create your subscriber account</Link>
              </p>
            </>
          )}
        </div>
        {user && (
          <p className="mt-4 text-center text-xs text-slate-500">
            Already signed in as {user.email ?? user.displayName}.
          </p>
        )}
      </div>
    </div>
  );
}
