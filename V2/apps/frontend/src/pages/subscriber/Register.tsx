import { Link } from 'react-router-dom';
import { ResidentAuthForm } from '../../components/ResidentAuthForm';

export function Register() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-alert-600 text-2xl">
            ⚠
          </div>
          <h1 className="text-2xl font-bold text-white">Resident registration</h1>
          <p className="text-sm text-slate-400">
            Sign in with Google to create or restore your subscriber profile.
          </p>
        </div>
        <div className="card">
          <ResidentAuthForm mode="register" />
          <p className="mt-4 text-center text-xs text-slate-500">
            Already registered? <Link className="underline" to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
