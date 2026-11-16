import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { ApiError, api } from '../../services/api';
import {
  ADMIN_ROLES,
  humanize,
  type AdminRole,
  type Administrator,
  type Barangay
} from '../../types';

export function AdminAccounts() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<Administrator[]>([]);
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AdminRole>('HIGH_LEVEL');
  const [barangayId, setBarangayId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isSuperAdmin = user?.role === 'SUPERADMIN';

  const load = async () => {
    if (!isSuperAdmin) return;
    try {
      const [adminList, barangayList] = await Promise.all([
        api.admins.list(),
        api.barangays.list()
      ]);
      setAdmins(adminList);
      setBarangays(barangayList);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load administrators.');
    }
  };

  useEffect(() => {
    load();
  }, [isSuperAdmin]);

  if (!isSuperAdmin) {
    return (
      <div className="card">
        <h1 className="text-lg font-bold text-white">Administrator accounts</h1>
        <p className="mt-2 text-sm text-slate-400">
          Only SUPERADMIN accounts can manage administrator accounts.
        </p>
      </div>
    );
  }

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api.admins.create({
        email: email.trim(),
        password,
        role,
        ...(displayName ? { displayName } : {}),
        ...(barangayId ? { barangayId } : {})
      });
      setNotice(`Created ${email}.`);
      setEmail('');
      setPassword('');
      setDisplayName('');
      setBarangayId('');
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not create the account.');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (admin: Administrator) => {
    setError(null);
    try {
      await api.admins.update(admin.id, { isActive: !admin.isActive });
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not update the account.');
    }
  };

  const barangayName = (id: string | null) =>
    id ? barangays.find((barangay) => barangay.id === id)?.name ?? id : 'City-wide';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Administrator Accounts</h1>
        <p className="text-sm text-slate-400">
          Create and deactivate accounts. LOW_LEVEL admins must be assigned to a barangay.
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-rose-800 bg-rose-950/60 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-md border border-emerald-800 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-200">
          {notice}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <form className="card space-y-4" onSubmit={handleCreate}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            New administrator
          </h2>
          <div>
            <label className="label" htmlFor="new-email">
              Email
            </label>
            <input
              id="new-email"
              className="input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="new-password">
              Password
            </label>
            <input
              id="new-password"
              className="input"
              type="password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="new-name">
              Display name
            </label>
            <input
              id="new-name"
              className="input"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="label" htmlFor="new-role">
              Role
            </label>
            <select
              id="new-role"
              className="input"
              value={role}
              onChange={(event) => setRole(event.target.value as AdminRole)}
            >
              {ADMIN_ROLES.map((item) => (
                <option key={item} value={item}>
                  {humanize(item)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="new-barangay">
              Barangay {role === 'LOW_LEVEL' ? '(required)' : '(optional)'}
            </label>
            <select
              id="new-barangay"
              className="input"
              value={barangayId}
              onChange={(event) => setBarangayId(event.target.value)}
              required={role === 'LOW_LEVEL'}
            >
              <option value="">City-wide</option>
              {barangays.map((barangay) => (
                <option key={barangay.id} value={barangay.id}>
                  {barangay.name}
                </option>
              ))}
            </select>
          </div>
          <button className="button w-full" type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </form>

        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Barangay</th>
                <th className="px-3 py-2">Active</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin.id} className="border-b border-slate-800/60">
                  <td className="px-3 py-2">
                    <p className="font-semibold text-slate-200">{admin.email}</p>
                    <p className="text-xs text-slate-500">{admin.displayName ?? '—'}</p>
                  </td>
                  <td className="px-3 py-2">{humanize(admin.role)}</td>
                  <td className="px-3 py-2 text-xs text-slate-400">
                    {barangayName(admin.barangayId)}
                  </td>
                  <td className="px-3 py-2">{admin.isActive ? 'Yes' : 'No'}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className="button-secondary py-1 text-xs"
                      onClick={() => toggleActive(admin)}
                      disabled={admin.email === user?.email}
                    >
                      {admin.isActive ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
