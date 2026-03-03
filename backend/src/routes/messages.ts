import { Router, Response } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../middleware/auth';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const db = require('../db/models');

const router = Router();

const createMessageSchema = z.object({
  body: z.string().min(1).max(10000),
});

router.use(authMiddleware);

router.get('/:id/messages', async (req: AuthRequest, res: Response) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    if (isNaN(taskId)) {
      res.status(400).json({ error: 'Invalid task ID' });
      return;
    }

    const task = await db.Task.findByPk(taskId);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const messages = await db.TaskMessage.findAll({
      where: { task_id: taskId },
      include: [{ model: db.User, as: 'User', attributes: ['id', 'username'] }],
      order: [['created_at', 'ASC']],
    });
    res.json(messages);
  } catch (err) {
    console.error('List messages error:', err);
    res.status(500).json({ error: 'Failed to list messages' });
  }
});

router.post('/:id/messages', async (req: AuthRequest, res: Response) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    if (isNaN(taskId)) {
      res.status(400).json({ error: 'Invalid task ID' });
      return;
    }

    const parsed = createMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
      return;
    }
    const { body } = parsed.data;
    const userId = req.user!.userId;

    const task = await db.Task.findByPk(taskId);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const message = await db.TaskMessage.create({
      task_id: taskId,
      author_user_id: userId,
      body,
    });

    const withAuthor = await db.TaskMessage.findByPk(message.id, {
      include: [{ model: db.User, as: 'User', attributes: ['id', 'username'] }],
    });
    res.status(201).json(withAuthor);
  } catch (err) {
    console.error('Create message error:', err);
    res.status(500).json({ error: 'Failed to create message' });
  }
});

export default router;
