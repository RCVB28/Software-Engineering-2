import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, api } from '../../services/api';
import {
  RESIDENT_ROLES,
  humanize,
  type Barangay,
  type PhoneNumber,
  type ResidentProfile,
  type ResidentRole
} from '../../types';

export function Profile() {
  const [profile, setProfile] = useState<ResidentProfile | null>(null);
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [phones, setPhones] = useState<PhoneNumber[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<ResidentRole>('RESIDENT');
  const [barangayId, setBarangayId] = useState('');
  const [buildingTag, setBuildingTag] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [primary, setPrimary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [profileData, barangayData, phoneData] = await Promise.all([
        api.residents.profile(),
        api.barangays.list(),
        api.residents.phones()
      ]);
      setProfile(profileData);
      setBarangays(barangayData);
      setPhones(phoneData);
      setDisplayName(profileData.displayName ?? '');
      setRole(profileData.role);
      setBarangayId(profileData.barangayId);
      setBuildingTag(profileData.buildingTag ?? '');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load your profile.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await api.residents.updateProfile({
        displayName: displayName || null,
        role,
        barangayId,
        buildingTag: buildingTag || null
      });
      setProfile(updated);
      setNotice('Profile updated.');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not update your profile.');
    } finally {
      setBusy(false);
    }
  };

  const handleAddPhone = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const created = await api.residents.addPhone(newPhone, primary);
      setNewPhone('');
      setPrimary(false);
      setNotice(`Linked ${created.number}.`);
      setPhones(await api.residents.phones());
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not link the phone number.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemovePhone = async (phoneId: string) => {
    setError(null);
    try {
      await api.residents.removePhone(phoneId);
      setPhones(await api.residents.phones());
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not unlink the phone number.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">My Profile</h1>
        <p className="text-sm text-slate-400">
          {profile?.email ?? 'Loading…'} — keep your barangay and role accurate so you receive the
          right alerts.
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

      <form className="card grid gap-4 sm:grid-cols-2" onSubmit={handleSave}>
        <div>
          <label className="label" htmlFor="displayName">
            Display name
          </label>
          <input
            id="displayName"
            className="input"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="role">
            Role
          </label>
          <select
            id="role"
            className="input"
            value={role}
            onChange={(event) => setRole(event.target.value as ResidentRole)}
          >
            {RESIDENT_ROLES.map((item) => (
              <option key={item} value={item}>
                {humanize(item)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="barangay">
            Barangay
          </label>
          <select
            id="barangay"
            className="input"
            value={barangayId}
            onChange={(event) => setBarangayId(event.target.value)}
          >
            {barangays.map((barangay) => (
              <option key={barangay.id} value={barangay.id}>
                {barangay.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="buildingTag">
            Building tag
          </label>
          <input
            id="buildingTag"
            className="input"
            value={buildingTag}
            onChange={(event) => setBuildingTag(event.target.value)}
            placeholder="Optional"
          />
        </div>
        <div className="sm:col-span-2">
          <button className="button" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </form>

      <div className="card space-y-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Phone numbers
          </h2>
          <p className="text-xs text-slate-500">
            Alerts are delivered by SMS. At least one number is required to receive broadcasts.
          </p>
        </div>

        <ul className="space-y-2">
          {phones.length === 0 && <li className="text-sm text-slate-500">No phone numbers linked.</li>}
          {phones.map((phone) => (
            <li
              key={phone.id}
              className="flex items-center justify-between gap-3 rounded-md border border-slate-800 px-3 py-2 text-sm"
            >
              <span>
                {phone.number}
                {phone.isPrimary && <span className="ml-2 text-xs text-emerald-400">Primary</span>}
              </span>
              <button
                type="button"
                className="button-secondary py-1 text-xs"
                onClick={() => handleRemovePhone(phone.id)}
              >
                Unlink
              </button>
            </li>
          ))}
        </ul>

        <form className="flex flex-wrap items-end gap-3" onSubmit={handleAddPhone}>
          <div className="min-w-56 flex-1">
            <label className="label" htmlFor="newPhone">
              Add number (E.164)
            </label>
            <input
              id="newPhone"
              className="input"
              value={newPhone}
              onChange={(event) => setNewPhone(event.target.value)}
              placeholder="+639171234567"
              required
            />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={primary}
              onChange={(event) => setPrimary(event.target.checked)}
            />
            Primary
          </label>
          <button className="button" type="submit" disabled={busy}>
            Link number
          </button>
        </form>
      </div>
    </div>
  );
}
