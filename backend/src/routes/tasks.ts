import { Router, Response } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import * as walletService from '../services/walletService';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const db = require('../db/models');

const router = Router();

const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  steps: z.array(z.object({ label: z.string().min(1).max(500) })).min(1),
  reward_amount: z.number().int().positive(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  steps: z.array(z.object({ label: z.string().min(1).max(500) })).min(1).optional(),
  reward_amount: z.number().int().positive().optional(),
});

const submitSchema = z.object({
  completed_step_ids: z.array(z.number().int().positive()),
});

router.use(authMiddleware);

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = createTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
      return;
    }
    const { title, description, steps, reward_amount } = parsed.data;
    const userId = req.user!.userId;

    const transaction = await db.sequelize.transaction();
    try {
      await walletService.lockFunds(userId, reward_amount, transaction);

      const task = await db.Task.create(
        {
          owner_user_id: userId,
          title,
          description: description || null,
          reward_amount,
          status: 'open',
        },
        { transaction }
      );

      await db.TaskStep.bulkCreate(
        steps.map((s, i) => ({
          task_id: task.id,
          step_order: i + 1,
          label: s.label,
        })),
        { transaction }
      );

      await transaction.commit();

      const taskWithSteps = await db.Task.findByPk(task.id, {
        include: [{ model: db.TaskStep, as: 'TaskSteps' }],
      });
      res.status(201).json(taskWithSteps);
    } catch (err) {
      await transaction.rollback();
      if (err instanceof Error && err.message === 'Insufficient available balance') {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }
  } catch (err) {
    console.error('Create task error:', err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const where: Record<string, unknown> = {};
    if (status) {
      const validStatuses = ['open', 'in_review', 'completed', 'cancelled'];
      if (validStatuses.includes(status)) {
        where.status = status;
      }
    }

    const tasks = await db.Task.findAll({
      where,
      include: [
        { model: db.User, as: 'User', attributes: ['id', 'username'] },
        { model: db.TaskStep, as: 'TaskSteps' },
      ],
      order: [['created_at', 'DESC']],
    });
    res.json(tasks);
  } catch (err) {
    console.error('List tasks error:', err);
    res.status(500).json({ error: 'Failed to list tasks' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid task ID' });
      return;
    }

    const task = await db.Task.findByPk(id, {
      include: [
        { model: db.User, as: 'User', attributes: ['id', 'username'] },
        { model: db.TaskStep, as: 'TaskSteps' },
        {
          model: db.TaskSubmission,
          as: 'TaskSubmission',
          include: [{ model: db.User, as: 'User', attributes: ['id', 'username'] }],
        },
      ],
      order: [[{ model: db.TaskStep, as: 'TaskSteps' }, 'step_order', 'ASC']],
    });
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    res.json(task);
  } catch (err) {
    console.error('Get task error:', err);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid task ID' });
      return;
    }

    const parsed = updateTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
      return;
    }

    const userId = req.user!.userId;
    const task = await db.Task.findByPk(id, { include: [{ model: db.TaskStep, as: 'TaskSteps' }] });
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    if (task.owner_user_id !== userId) {
      res.status(403).json({ error: 'Only the task owner can update this task' });
      return;
    }
    if (task.status !== 'open') {
      res.status(400).json({ error: 'Only open tasks can be updated' });
      return;
    }

    const { title, description, steps, reward_amount } = parsed.data;
    const oldReward = task.reward_amount;
    const newReward = reward_amount ?? oldReward;

    const transaction = await db.sequelize.transaction();
    try {
      if (newReward > oldReward) {
        await walletService.lockFunds(userId, newReward - oldReward, transaction);
      } else if (newReward < oldReward) {
        await walletService.unlockFunds(userId, oldReward - newReward, transaction);
      }

      await task.update(
        {
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
          ...(reward_amount !== undefined && { reward_amount }),
        },
        { transaction }
      );

      if (steps !== undefined) {
        await db.TaskStep.destroy({ where: { task_id: id }, transaction });
        await db.TaskStep.bulkCreate(
          steps.map((s, i) => ({ task_id: id, step_order: i + 1, label: s.label })),
          { transaction }
        );
      }

      await transaction.commit();

      const updated = await db.Task.findByPk(id, {
        include: [{ model: db.TaskStep, as: 'TaskSteps' }],
      });
      res.json(updated);
    } catch (err) {
      await transaction.rollback();
      if (err instanceof Error && err.message === 'Insufficient available balance') {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }
  } catch (err) {
    console.error('Update task error:', err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid task ID' });
      return;
    }

    const userId = req.user!.userId;
    const task = await db.Task.findByPk(id);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    if (task.owner_user_id !== userId) {
      res.status(403).json({ error: 'Only the task owner can cancel this task' });
      return;
    }
    if (task.status !== 'open') {
      res.status(400).json({ error: 'Only open tasks can be cancelled' });
      return;
    }

    const transaction = await db.sequelize.transaction();
    try {
      await walletService.unlockFunds(userId, task.reward_amount, transaction);
      await task.update({ status: 'cancelled' }, { transaction });
      await transaction.commit();
      res.json({ message: 'Task cancelled' });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.error('Delete task error:', err);
    res.status(500).json({ error: 'Failed to cancel task' });
  }
});

router.post('/:id/submit', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid task ID' });
      return;
    }

    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
      return;
    }
    const { completed_step_ids } = parsed.data;
    const userId = req.user!.userId;

    const task = await db.Task.findByPk(id, { include: [{ model: db.TaskStep, as: 'TaskSteps' }] });
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    if (task.status !== 'open') {
      res.status(400).json({ error: 'Task is not open for submission' });
      return;
    }
    if (task.owner_user_id === userId) {
      res.status(400).json({ error: 'Task owner cannot submit their own task' });
      return;
    }

    const stepIds = (task.TaskSteps || []).map((s: { id: number }) => s.id);
    const completedSet = new Set(completed_step_ids);
    const allCompleted = stepIds.length > 0 && stepIds.every((sid: number) => completedSet.has(sid));
    if (!allCompleted) {
      res.status(400).json({
        error: 'completed_step_ids must include every task step ID',
        required_step_ids: stepIds,
      });
      return;
    }

    const [submission] = await db.TaskSubmission.findOrCreate({
      where: { task_id: id },
      defaults: {
        task_id: id,
        completer_user_id: userId,
        completed_step_ids,
        submitted_at: new Date(),
      },
    });

    if (submission.completer_user_id !== userId) {
      res.status(409).json({ error: 'Task already has a submission from another user' });
      return;
    }

    await task.update({ status: 'in_review' });

    const updated = await db.Task.findByPk(id, {
      include: [
        { model: db.TaskStep, as: 'TaskSteps' },
        { model: db.TaskSubmission, as: 'TaskSubmission' },
      ],
    });
    res.json(updated);
  } catch (err) {
    console.error('Submit task error:', err);
    res.status(500).json({ error: 'Failed to submit task' });
  }
});

router.post('/:id/approve', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid task ID' });
      return;
    }

    const userId = req.user!.userId;
    const task = await db.Task.findByPk(id, {
      include: [{ model: db.TaskSubmission, as: 'TaskSubmission' }],
    });
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    if (task.owner_user_id !== userId) {
      res.status(403).json({ error: 'Only the task owner can approve' });
      return;
    }
    if (task.status !== 'in_review') {
      res.status(400).json({ error: 'Task must be in_review to approve' });
      return;
    }

    const submission = task.TaskSubmission || task.get?.('TaskSubmission');
    if (!submission) {
      res.status(400).json({ error: 'No submission to approve' });
      return;
    }

    const transaction = await db.sequelize.transaction();
    try {
      await walletService.transferPayout(
        task.owner_user_id,
        submission.completer_user_id,
        task.reward_amount,
        transaction
      );
      await submission.update({ approved_at: new Date() }, { transaction });
      await task.update(
        { status: 'completed', completed_at: new Date() },
        { transaction }
      );
      await transaction.commit();

      const updated = await db.Task.findByPk(id, {
        include: [
          { model: db.TaskStep, as: 'TaskSteps' },
          { model: db.TaskSubmission, as: 'TaskSubmission' },
        ],
      });
      res.json(updated);
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.error('Approve task error:', err);
    res.status(500).json({ error: 'Failed to approve task' });
  }
});

export default router;
