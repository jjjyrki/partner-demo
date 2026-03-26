import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { u54ApiService } from "../services/u54ApiService";
import { shouldSkipPartnerApiCall } from "../utils/partnerApi";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const db = require("../db/models");

const router = Router();

async function ensurePartnerWalletId(user: {
  partner_user_id: string | null;
  partner_wallet_id: string | null;
  update: (data: { partner_wallet_id: string }) => Promise<unknown>;
}): Promise<string | undefined> {
  if (user.partner_wallet_id) {
    return user.partner_wallet_id;
  }
  if (!user.partner_user_id || shouldSkipPartnerApiCall()) {
    return undefined;
  }
  try {
    let cursor: string | undefined;
    do {
      const response = await u54ApiService.getUserWallets(100, cursor);
      const matchingWallet = response.wallets?.find(
        (w) => w.userId === user.partner_user_id,
      );
      if (matchingWallet?.id) {
        await user.update({ partner_wallet_id: matchingWallet.id });
        return matchingWallet.id;
      }
      cursor = response.cursor;
    } while (cursor);
  } catch (err) {
    console.error("Failed to fetch partner wallet:", err);
  }
  return undefined;
}

router.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await db.User.findByPk(req.user!.userId, {
      include: [{ model: db.Wallet, as: "Wallet", required: false }],
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const wallet = user.Wallet || user.get?.("Wallet");
    if (!wallet) {
      res.status(404).json({ error: "Wallet not found" });
      return;
    }
    const wallet_id = await ensurePartnerWalletId(user);
    res.json({
      available_balance: wallet.available_balance,
      locked_balance: wallet.locked_balance,
      status: wallet.status,
      wallet_id: wallet_id ?? undefined,
    });
  } catch (err) {
    console.error("Get wallet error:", err);
    res.status(500).json({ error: "Failed to fetch wallet" });
  }
});

router.get(
  "/transactions",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      if (shouldSkipPartnerApiCall()) {
        res.status(503).json({ error: "Partner service is not configured" });
        return;
      }

      const walletType = req.query.walletType as string | undefined;
      if (!walletType || !["USER", "PARTNER"].includes(walletType)) {
        res.status(400).json({
          error: "walletType query parameter required (USER or PARTNER)",
        });
        return;
      }

      let walletId: string | undefined;

      if (walletType === "USER") {
        const user = await db.User.findByPk(req.user!.userId);
        if (!user) {
          res.status(404).json({ error: "User not found" });
          return;
        }
        walletId = await ensurePartnerWalletId(user);
        if (!walletId) {
          res.status(400).json({
            error: "Link your partner account to view user wallet transactions",
          });
          return;
        }
      } else {
        walletId = process.env.U54_PARTNER_WALLET_ID;
        if (!walletId) {
          res.status(400).json({
            error: "Partner wallet is not configured",
          });
          return;
        }
      }

      const { transactions } = await u54ApiService.getTransactions(walletId);
      res.json(transactions);
    } catch (err) {
      console.error("Get transactions error:", err);
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  },
);

router.get(
  "/transactions/:id",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      if (shouldSkipPartnerApiCall()) {
        res.status(503).json({ error: "Partner service is not configured" });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: "Transaction ID is required" });
        return;
      }

      const transaction = await u54ApiService.getTransaction(id);
      res.json(transaction);
    } catch (err) {
      console.error("Get transaction error:", err);
      res.status(500).json({ error: "Failed to fetch transaction" });
    }
  },
);

export default router;
