import { Router, Response } from 'express';
import argon2 from 'argon2';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { getMockVirtualCard } from '../data/mockVirtualCard';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const db = require('../db/models');

const router = Router();

const patchMeSchema = z.object({
  username: z.string().min(1).max(255).optional(),
  password: z.string().min(6).optional(),
});

router.get('/me/virtual-card', authMiddleware, (req: AuthRequest, res: Response) => {
  const card = getMockVirtualCard(req.user?.username);
  res.json(card);
});

router.get('/me/transactions', authMiddleware, (_req: AuthRequest, res: Response) => {
  res.json([]);
});

router.patch('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = patchMeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
      return;
    }
    const { username, password } = parsed.data;

    const user = await db.User.findByPk(req.user!.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const updates: Record<string, unknown> = {};

    if (username !== undefined) {
      const existing = await db.User.findOne({ where: { username } });
      if (existing && existing.id !== user.id) {
        res.status(409).json({ error: 'Username already taken' });
        return;
      }
      updates.username = username;
    }

    if (password !== undefined) {
      const salt = randomBytes(32).toString('hex');
      const hash = await argon2.hash(password + salt);
      updates.password_hash = hash;
      updates.password_salt = salt;
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }

    await user.update(updates);

    res.json({
      id: user.id,
      username: user.username,
      kyc_status: user.kyc_status,
    });
  } catch (err) {
    console.error('Patch me error:', err);
    res.status(500).json({ error: 'Update failed' });
  }
});

export default router;
