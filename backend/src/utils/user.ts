import { Response } from "express";
import { Model } from "sequelize";
import { AuthRequest } from "../middleware/auth";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const db = require("../db/models") as {
  User: { findByPk: (id: number) => Promise<Model<UserAttributes> | null> };
};

export interface UserAttributes {
  id: number;
  username: string;
  password_hash: string;
  password_salt: string;
  kyc_status: string;
  partner_user_id: string | null;
  partner_card_id: string | null;
  partner_wallet_id: string | null;
  created_at: Date;
  updated_at: Date;
}

/** Sequelize Model – use user.dataValues for typed attribute access */
export type User = Model<UserAttributes>;

export async function getAuthenticatedUser(
  req: AuthRequest,
  res: Response,
): Promise<User | null> {
  const user = await db.User.findByPk(req.user!.userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return null;
  }
  return user;
}
