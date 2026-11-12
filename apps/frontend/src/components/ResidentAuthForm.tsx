import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ApiError, api } from '../services/api';
import { RESIDENT_ROLES, type Barangay, type ResidentRole } from '../types';
import { GoogleSignIn } from './GoogleSignIn';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

interface ResidentAuthFormProps {
  mode: 'login' | 'register';
}

export function ResidentAuthForm({ mode }: ResidentAuthFormProps) {
  const { loginResident } = useAuth();
  const navigate = useNavigate();
  const [idToken, setIdToken] = useState('');
  const [barangayId, setBarangayId] = useState('');
  const [role, setRole] = useState<ResidentRole>('RESIDENT');
  const [displayName, setDisplayName] = useState('');
  const [buildingTag, setBuildingTag] = useState('');
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode !== 'register') return;
    api.barangays
      .list()
      .then(setBarangays)
      .catch(() => setBarangays([]));
  }, [mode]);

  const handleResidentLogin = async (credential: string) => {
    if (mode === 'register' && !barangayId) {
      setError('Select your barangay before continuing with Google.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await loginResident(
        credential,
        mode === 'register'
          ? {
              barangayId,
              role,
              ...(displayName ? { displayName } : {}),
              ...(buildingTag ? { buildingTag } : {})
            }
          : {}
      );
      navigate('/resident');
    } catch (caught) {
      if (
        mode === 'login' &&
        caught instanceof ApiError &&
        caught.status === 400 &&
        caught.message.toLowerCase().includes('barangay')
      ) {
        setError('No resident account is linked to this Google account yet. Use Register to create one.');
      } else {
        setError(caught instanceof ApiError ? caught.message : 'Could not sign in.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-md border border-rose-800 bg-rose-950/60 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}

      {mode === 'register' ? (
        <>
          <div>
            <label className="label" htmlFor="barangay">
              Barangay
            </label>
            <select
              id="barangay"
              className="input"
              value={barangayId}
              onChange={(event) => setBarangayId(event.target.value)}
              required
            >
              <option value="">Select a barangay</option>
              {barangays.map((barangay) => (
                <option key={barangay.id} value={barangay.id}>
                  {barangay.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="building">
                Building tag
              </label>
              <input
                id="building"
                className="input"
                value={buildingTag}
                onChange={(event) => setBuildingTag(event.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="displayName">
              Display name
            </label>
            <input
              id="displayName"
              className="input"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Optional"
            />
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-400">
          Use the Google account linked to your resident profile. New residents should register
          first.
        </p>
      )}

      {GOOGLE_CLIENT_ID ? (
        <GoogleSignIn clientId={GOOGLE_CLIENT_ID} onCredential={handleResidentLogin} />
      ) : (
        <div className="space-y-3 rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <p className="text-xs text-slate-400">
            Google sign-in is not configured. Set <code>VITE_GOOGLE_CLIENT_ID</code> or paste a
            Google ID token to continue in development.
          </p>
          <input
            className="input"
            placeholder="Google ID token"
            value={idToken}
            onChange={(event) => setIdToken(event.target.value)}
          />
          <button
            type="button"
            className="button w-full"
            disabled={busy || !idToken}
            onClick={() => handleResidentLogin(idToken)}
          >
            {busy ? 'Signing in…' : 'Continue with token'}
          </button>
        </div>
      )}
    </div>
  );
}
