import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { patchMe, getVirtualCard } from '../api/client';
import VirtualCard from '../components/VirtualCard';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState(user?.username ?? '');

  useEffect(() => {
    if (user?.username) setUsername(user.username);
  }, [user?.username]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const virtualCardQuery = useQuery({
    queryKey: ['virtual-card'],
    queryFn: getVirtualCard,
    enabled: !!user,
  });

  const patchMutation = useMutation({
    mutationFn: patchMe,
    onSuccess: async () => {
      await refreshUser();
      setSuccess('Profile updated');
      setPassword('');
      setConfirmPassword('');
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: ['virtual-card'] });
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Update failed');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (password && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password && password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    const updates: { username?: string; password?: string } = {};
    if (username.trim() !== user?.username) updates.username = username.trim();
    if (password) updates.password = password;
    if (Object.keys(updates).length === 0) {
      setError('No changes to save');
      return;
    }
    patchMutation.mutate(updates);
  };

  if (!user) {
    return (
      <div className="text-center py-12 text-slate-400">
        Please log in to view your profile.
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-slate-100 mb-6">Profile</h1>

      <div className="mb-8 p-4 rounded-xl bg-slate-900/60 border border-slate-700/50">
        <h2 className="text-sm font-medium text-slate-400 mb-2">Account</h2>
        <div className="flex items-center gap-2 mb-2">
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${
              user.kyc_status === 'approved'
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-amber-500/20 text-amber-400'
            }`}
          >
            KYC: {user.kyc_status}
          </span>
        </div>
        {user.wallet && (
          <div className="text-slate-300 text-sm space-y-1">
            <p>
              Available:{' '}
              <span className="text-amber-400 font-medium">
                ${(user.wallet.available_balance / 100).toFixed(2)}
              </span>
            </p>
            <p>
              Locked:{' '}
              <span className="text-slate-400">
                ${(user.wallet.locked_balance / 100).toFixed(2)}
              </span>
            </p>
          </div>
        )}
      </div>

      <div className="mb-8 p-4 rounded-xl bg-slate-900/60 border border-slate-700/50">
        <h2 className="text-sm font-medium text-slate-400 mb-3">Virtual card</h2>
        {virtualCardQuery.isLoading && (
          <p className="text-slate-400 text-sm">Loading card...</p>
        )}
        {virtualCardQuery.isError && (
          <p className="text-red-400 text-sm">Failed to load card</p>
        )}
        {virtualCardQuery.data && (
          <VirtualCard card={virtualCardQuery.data} />
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Username
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            New password (leave blank to keep current)
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            placeholder="Min 6 characters"
          />
        </div>
        {password && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Confirm new password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        )}
        {success && (
          <p className="text-sm text-emerald-400 bg-emerald-950/30 px-3 py-2 rounded-lg">
            {success}
          </p>
        )}
        {error && (
          <p className="text-sm text-red-400 bg-red-950/30 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={patchMutation.isPending}
          className="px-6 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium disabled:opacity-50"
        >
          {patchMutation.isPending ? 'Saving...' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
