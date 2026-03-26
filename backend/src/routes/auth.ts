import { Router, Request, Response } from "express";
import argon2 from "argon2";
import { z } from "zod";
import { randomBytes } from "crypto";
import { createToken, authMiddleware, AuthRequest } from "../middleware/auth";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const db = require("../db/models");

const router = Router();

const registerSchema = z.object({
  username: z.string().min(1).max(255),
  password: z.string().min(6),
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

router.post("/register", async (req: Request, res: Response) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }
    const { username, password } = parsed.data;

    const existing = await db.User.findOne({ where: { username } });
    if (existing) {
      res.status(409).json({ error: "Username already taken" });
      return;
    }

    const salt = randomBytes(32).toString("hex");
    const hash = await argon2.hash(password + salt);

    const user = await db.User.create({
      username,
      password_hash: hash,
      password_salt: salt,
      kyc_status: "approved",
    });

    await db.Wallet.create({
      user_id: user.id,
      available_balance: 1000, // $10 signup bonus (amounts in cents)
      locked_balance: 0,
      status: "active",
    });

    const token = createToken({ userId: user.id, username: user.username });
    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        kyc_status: user.kyc_status,
        partner_user_id: user.partner_user_id,
        partner_card_id: user.partner_card_id,
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/login", async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }
    const { username, password } = parsed.data;

    const user = await db.User.findOne({ where: { username } });
    if (!user) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    const valid = await argon2.verify(
      user.password_hash,
      password + user.password_salt,
    );
    if (!valid) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    const token = createToken({ userId: user.id, username: user.username });
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        kyc_status: user.kyc_status,
        partner_user_id: user.partner_user_id,
        partner_card_id: user.partner_card_id,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

router.get("/me", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await db.User.findByPk(req.user!.userId, {
      include: [{ model: db.Wallet, as: "Wallet", required: false }],
      attributes: { exclude: ["password_hash", "password_salt"] },
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const wallet = user.Wallet || user.get?.("Wallet");
    res.json({
      id: user.id,
      username: user.username,
      kyc_status: user.kyc_status,
      partner_user_id: user.partner_user_id,
      partner_card_id: user.partner_card_id,
      wallet: wallet
        ? {
            available_balance: wallet.available_balance,
            locked_balance: wallet.locked_balance,
            status: wallet.status,
          }
        : null,
    });
  } catch (err) {
    console.error("Me error:", err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

export default router;
