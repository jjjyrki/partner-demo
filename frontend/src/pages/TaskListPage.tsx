import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getTasks } from '../api/client';

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_review', label: 'In Review' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    open: 'bg-emerald-500/20 text-emerald-400',
    in_review: 'bg-amber-500/20 text-amber-400',
    completed: 'bg-slate-500/20 text-slate-400',
    cancelled: 'bg-red-500/20 text-red-400',
  };
  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status] ?? 'bg-slate-500/20 text-slate-400'}`}
    >
      {status.replace('_', ' ')}
    </span>
  );
}

export default function TaskListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') ?? '';

  const { data: tasks, isLoading, error } = useQuery({
    queryKey: ['tasks', status],
    queryFn: () => getTasks(status || undefined),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Tasks</h1>
        <div className="flex gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() =>
                setSearchParams(opt.value ? { status: opt.value } : {})
              }
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                (status === opt.value) || (!status && !opt.value)
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="text-slate-400 py-12 text-center">Loading tasks...</div>
      )}
      {error && (
        <div className="text-red-400 py-4 bg-red-950/30 rounded-lg px-4">
          {error instanceof Error ? error.message : 'Failed to load tasks'}
        </div>
      )}
      {tasks && tasks.length === 0 && (
        <div className="text-slate-500 py-12 text-center rounded-lg border border-dashed border-slate-700">
          No tasks found. Create one to get started!
        </div>
      )}
      {tasks && tasks.length > 0 && (
        <ul className="space-y-3">
          {tasks.map((task) => (
            <li key={task.id}>
              <Link
                to={`/tasks/${task.id}`}
                className="block p-4 rounded-xl bg-slate-900/60 border border-slate-700/50 hover:border-slate-600 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold text-slate-100 truncate">
                      {task.title}
                    </h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                      by {task.User?.username ?? 'Unknown'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {statusBadge(task.status)}
                    <span className="font-semibold text-amber-400">
                      {formatCents(task.reward_amount)}
                    </span>
                  </div>
                </div>
                {task.description && (
                  <p className="text-sm text-slate-400 mt-2 line-clamp-2">
                    {task.description}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
