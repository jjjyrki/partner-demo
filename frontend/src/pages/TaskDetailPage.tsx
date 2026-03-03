import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import {
  getTask,
  submitTask,
  approveTask,
  cancelTask,
  getMessages,
  postMessage,
} from '../api/client';

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
      className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status] ?? 'bg-slate-500/20'}`}
    >
      {status.replace('_', ' ')}
    </span>
  );
}

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [messageBody, setMessageBody] = useState('');

  const taskId = id ? parseInt(id, 10) : NaN;

  const { data: task, isLoading, error } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => getTask(taskId),
    enabled: !isNaN(taskId),
  });

  const { data: messages, refetch: refetchMessages } = useQuery({
    queryKey: ['messages', taskId],
    queryFn: () => getMessages(taskId),
    enabled: !isNaN(taskId),
  });

  const submitMutation = useMutation({
    mutationFn: () => {
      const stepIds = (task?.TaskSteps ?? []).map((s) => s.id);
      return submitTask(taskId, stepIds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => approveTask(taskId),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      await refreshUser();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelTask(taskId),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      await refreshUser();
      navigate('/');
    },
  });

  const postMutation = useMutation({
    mutationFn: (body: string) => postMessage(taskId, body),
    onSuccess: () => {
      refetchMessages();
      setMessageBody('');
    },
  });

  const handleSubmitMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const body = messageBody.trim();
    if (body) postMutation.mutate(body);
  };

  if (isNaN(taskId)) {
    return (
      <div className="text-red-400">Invalid task ID</div>
    );
  }

  if (isLoading) {
    return <div className="text-slate-400 py-8">Loading task...</div>;
  }

  if (error || !task) {
    return (
      <div className="text-red-400 py-4">
        {error instanceof Error ? error.message : 'Task not found'}
      </div>
    );
  }

  const isOwner = user?.id === task.owner_user_id;
  const canEdit = isOwner && task.status === 'open';
  const canSubmit =
    user &&
    !isOwner &&
    task.status === 'open' &&
    (task.TaskSteps?.length ?? 0) > 0;
  const canApprove = isOwner && task.status === 'in_review';
  const canCancel = isOwner && task.status === 'open';

  return (
    <div className="space-y-8">
      {/* Task details */}
      <div className="rounded-xl bg-slate-900/60 border border-slate-700/50 p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">{task.title}</h1>
            <p className="text-slate-500 mt-1">
              by {task.User?.username ?? 'Unknown'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {statusBadge(task.status)}
            <span className="text-xl font-semibold text-amber-400">
              {formatCents(task.reward_amount)}
            </span>
          </div>
        </div>
        {task.description && (
          <p className="text-slate-400 mb-6 whitespace-pre-wrap">
            {task.description}
          </p>
        )}
        {task.TaskSteps && task.TaskSteps.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-slate-400 mb-2">Steps</h3>
            <ul className="space-y-1">
              {task.TaskSteps.map((step) => (
                <li
                  key={step.id}
                  className="flex items-center gap-2 text-slate-300"
                >
                  <span className="text-slate-500">•</span>
                  {step.label}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Link
              to={`/tasks/${taskId}/edit`}
              className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-medium"
            >
              Edit task
            </Link>
          )}
          {canSubmit && (
            <button
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium disabled:opacity-50"
            >
              {submitMutation.isPending ? 'Submitting...' : 'Submit completion'}
            </button>
          )}
          {canApprove && (
            <button
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium disabled:opacity-50"
            >
              {approveMutation.isPending ? 'Approving...' : 'Approve & payout'}
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              className="px-4 py-2 rounded-lg bg-red-600/80 hover:bg-red-600 text-white font-medium disabled:opacity-50"
            >
              {cancelMutation.isPending ? 'Cancelling...' : 'Cancel task'}
            </button>
          )}
        </div>
        {task.TaskSubmission && (
          <div className="mt-4 p-3 rounded-lg bg-slate-800/50 text-sm text-slate-400">
            Submitted by {task.TaskSubmission.User?.username ?? 'Unknown'} on{' '}
            {new Date(task.TaskSubmission.submitted_at).toLocaleString()}
          </div>
        )}
      </div>

      {/* Chat */}
      <div className="rounded-xl bg-slate-900/60 border border-slate-700/50 overflow-hidden">
        <h2 className="px-6 py-4 border-b border-slate-700/50 text-lg font-semibold text-slate-100">
          Task Chat
        </h2>
        <div className="p-4 space-y-4 max-h-80 overflow-y-auto">
          {messages && messages.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-4">
              No messages yet. Start the conversation!
            </p>
          )}
          {messages?.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.author_user_id === user?.id ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  msg.author_user_id === user?.id
                    ? 'bg-amber-600/30 text-slate-100'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                <p className="text-xs text-slate-500 mb-0.5">
                  {msg.User?.username ?? 'Unknown'}
                </p>
                <p className="whitespace-pre-wrap">{msg.body}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {new Date(msg.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
        {user && (
          <form
            onSubmit={handleSubmitMessage}
            className="p-4 border-t border-slate-700/50"
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="submit"
                disabled={!messageBody.trim() || postMutation.isPending}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
