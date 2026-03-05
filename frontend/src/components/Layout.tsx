import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="text-lg font-semibold text-slate-100">
            Task Platform
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              to="/"
              className="text-slate-300 hover:text-slate-100 transition-colors"
            >
              Tasks
            </Link>
            <Link
              to="/create"
              className="text-slate-300 hover:text-slate-100 transition-colors"
            >
              Create Task
            </Link>
            {user && (
              <>
                <Link
                  to="/transactions"
                  className="text-slate-300 hover:text-slate-100 transition-colors"
                >
                  Transactions
                </Link>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-slate-400">
                    <span className="text-amber-400 font-medium">
                      ${((user.wallet?.available_balance ?? 0) / 100).toFixed(2)}
                    </span>
                    {' available'}
                  </span>
                  <span className="text-slate-500">
                    <span className="text-slate-400">
                      ${((user.wallet?.locked_balance ?? 0) / 100).toFixed(2)}
                    </span>
                    {' locked'}
                  </span>
                </div>
                <Link
                  to="/profile"
                  className="text-slate-300 hover:text-slate-100 transition-colors"
                >
                  {user.username}
                </Link>
                <button
                  onClick={logout}
                  className="text-slate-500 hover:text-red-400 text-sm transition-colors"
                >
                  Logout
                </button>
              </>
            )}
            {!user && (
              <Link
                to="/login"
                className="text-amber-400 hover:text-amber-300 font-medium"
              >
                Log in
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
