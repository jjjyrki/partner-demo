import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { getTask, updateTask } from '../api/client';

export default function EditTaskPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState('');

  const taskId = id ? parseInt(id, 10) : NaN;

  const { data: task, isLoading, error: queryError } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => getTask(taskId),
    enabled: !isNaN(taskId),
  });

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState<{ label: string }[]>([]);
  const [rewardCents, setRewardCents] = useState('');

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? '');
      setSteps(
        (task.TaskSteps ?? []).map((s) => ({ label: s.label }))
      );
      setRewardCents((task.reward_amount / 100).toFixed(2));
    }
  }, [task]);

  const updateMutation = useMutation({
    mutationFn: (data: {
      title: string;
      description?: string;
      steps: { label: string }[];
      reward_amount: number;
    }) => updateTask(taskId, data),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      await refreshUser();
      navigate(`/tasks/${taskId}`);
    },
    onError: (err) => {
      setSubmitError(err instanceof Error ? err.message : 'Failed to update task');
    },
  });

  const addStep = () => setSteps((s) => [...s, { label: '' }]);
  const removeStep = (i: number) =>
    setSteps((s) => s.filter((_, idx) => idx !== i));
  const updateStep = (i: number, label: string) =>
    setSteps((s) =>
      s.map((step, idx) => (idx === i ? { ...step, label } : step))
    );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    const reward = Math.round(parseFloat(rewardCents) * 100);
    if (isNaN(reward) || reward <= 0) {
      setSubmitError('Reward must be a positive number');
      return;
    }
    const validSteps = steps.filter((s) => s.label.trim());
    if (validSteps.length === 0) {
      setSubmitError('Add at least one step');
      return;
    }
    updateMutation.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      steps: validSteps.map((s) => ({ label: s.label.trim() })),
      reward_amount: reward,
    });
  };

  if (isNaN(taskId)) {
    return <div className="text-red-400">Invalid task ID</div>;
  }

  if (isLoading) {
    return <div className="text-slate-400 py-8">Loading task...</div>;
  }

  if (queryError || !task) {
    return (
      <div className="text-red-400 py-4">
        {queryError instanceof Error ? queryError.message : 'Task not found'}
      </div>
    );
  }

  if (user?.id !== task.owner_user_id) {
    return (
      <div className="text-red-400 py-4">
        Only the task owner can edit this task.
      </div>
    );
  }

  if (task.status !== 'open') {
    return (
      <div className="text-red-400 py-4">
        Only open tasks can be edited.
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-100 mb-6">Edit Task</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            placeholder="Task title"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
            placeholder="Describe the task..."
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-slate-300">
              Steps (checklist items)
            </label>
            <button
              type="button"
              onClick={addStep}
              className="text-sm text-amber-400 hover:text-amber-300"
            >
              + Add step
            </button>
          </div>
          <div className="space-y-2">
            {steps.map((step, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={step.label}
                  onChange={(e) => updateStep(i, e.target.value)}
                  className="flex-1 px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder={`Step ${i + 1}`}
                />
                <button
                  type="button"
                  onClick={() => removeStep(i)}
                  disabled={steps.length === 1}
                  className="px-3 py-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Reward (USD)
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={rewardCents}
            onChange={(e) => setRewardCents(e.target.value)}
            required
            className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            placeholder="0.00"
          />
          <p className="text-xs text-slate-500 mt-1">
            Increasing reward locks more funds; decreasing releases excess.
          </p>
        </div>
        {submitError && (
          <p className="text-sm text-red-400 bg-red-950/30 px-3 py-2 rounded-lg">
            {submitError}
          </p>
        )}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="px-6 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium disabled:opacity-50"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save changes'}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/tasks/${taskId}`)}
            className="px-6 py-2.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
