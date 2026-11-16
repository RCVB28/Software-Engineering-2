import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 text-center">
      <h1 className="text-4xl font-bold text-white">404</h1>
      <p className="text-slate-400">This page does not exist.</p>
      <Link className="button" to="/">
        Return home
      </Link>
    </div>
  );
}
