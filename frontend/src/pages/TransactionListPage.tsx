import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { getTransactions } from '../api/client';

export default function TransactionListPage() {
  const { user } = useAuth();

  const { data: transactions, isLoading, error } = useQuery({
    queryKey: ['transactions'],
    queryFn: getTransactions,
    enabled: !!user,
  });

  if (!user) {
    return (
      <div className="text-center py-12 text-slate-400">
        Please log in to view your transactions.
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-100 mb-6">Transactions</h1>

      {isLoading && (
        <div className="text-slate-400 py-12 text-center">
          Loading transactions...
        </div>
      )}
      {error && (
        <div className="text-red-400 py-4 bg-red-950/30 rounded-lg px-4">
          {error instanceof Error ? error.message : 'Failed to load transactions'}
        </div>
      )}
      {transactions && transactions.length === 0 && (
        <div className="text-slate-500 py-12 text-center rounded-lg border border-dashed border-slate-700">
          No transactions
        </div>
      )}
      {transactions && transactions.length > 0 && (
        <ul className="space-y-3">
          {transactions.map((tx) => (
            <li
              key={tx.id}
              className="p-4 rounded-xl bg-slate-900/60 border border-slate-700/50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-100">{tx.description}</p>
                  <p className="text-sm text-slate-500">
                    {new Date(tx.created_at).toLocaleString()}
                  </p>
                </div>
                <span
                  className={`font-semibold ${
                    tx.amount_cents >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {tx.amount_cents >= 0 ? '+' : ''}$
                  {(tx.amount_cents / 100).toFixed(2)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
