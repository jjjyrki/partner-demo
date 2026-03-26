import { Router, Response } from "express";
import argon2 from "argon2";
import { z } from "zod";
import { randomBytes } from "crypto";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { u54ApiService } from "../services/u54ApiService";
import { shouldSkipPartnerApiCall } from "../utils/partnerApi";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const db = require("../db/models");

const router = Router();

const patchMeSchema = z.object({
  username: z.string().min(1).max(255).optional(),
  password: z.string().min(6).optional(),
});

const updateKycSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dob: z.string().min(1),
  country: z.string().min(1),
  tpin: z.string().regex(/^\d{10}$/, "TPIN must be exactly 10 digits"),
});

const createPartnerUserSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dob: z.string().min(1),
  country: z.string().min(1),
  phoneNumber: z.string().min(1),
  email: z.string().email(),
  tpin: z
    .string()
    .regex(/^\d{10}$/, "TPIN must be exactly 10 digits")
    .optional(),
});

const updatePartnerUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  dob: z.string().min(1).optional(),
  country: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phoneNumber: z.string().min(1).optional(),
  tpin: z
    .string()
    .regex(/^\d{10}$/, "TPIN must be exactly 10 digits")
    .optional(),
});

function normalizeDateInput(value: string) {
  return value.includes("T") ? value.split("T")[0] : value;
}

router.get(
  "/me/card",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const user = await db.User.findByPk(req.user!.userId);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      if (!user.partner_user_id) {
        res.status(404).json({ error: "Partner user not linked" });
        return;
      }

      if (!user.partner_card_id) {
        res.status(404).json({ error: "Card not created" });
        return;
      }

      if (shouldSkipPartnerApiCall()) {
        res.status(503).json({ error: "Partner service is not configured" });
        return;
      }

      const partnerUser = await u54ApiService.getUser(user.partner_user_id);
      if (partnerUser.kycStatus !== "approved") {
        res.status(403).json({ error: "KYC approval required" });
        return;
      }

      const cardResponse = await u54ApiService.getCard(user.partner_card_id);
      const card =
        cardResponse &&
        typeof cardResponse === "object" &&
        "data" in cardResponse
          ? (cardResponse as { data: unknown }).data
          : cardResponse;

      res.json({ card_id: user.partner_card_id, card });
    } catch (err) {
      console.error("Get card error:", err);
      res.status(502).json({ error: "Failed to fetch card" });
    }
  },
);

router.get(
  "/me/partner-user",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const user = await db.User.findByPk(req.user!.userId);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      if (!user.partner_user_id) {
        res.status(404).json({ error: "Partner user not linked" });
        return;
      }

      if (shouldSkipPartnerApiCall()) {
        res.status(503).json({ error: "Partner service is not configured" });
        return;
      }

      const partnerUser = await u54ApiService.getUser(user.partner_user_id);
      res.json({
        partner_user_id: user.partner_user_id,
        partner_user: partnerUser,
      });
    } catch (err) {
      console.error("Get partner user error:", err);
      res.status(502).json({ error: "Failed to fetch partner user" });
    }
  },
);

router.patch("/me", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = patchMeSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }
    const { username, password } = parsed.data;

    const user = await db.User.findByPk(req.user!.userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const updates: Record<string, unknown> = {};

    if (username !== undefined) {
      const existing = await db.User.findOne({ where: { username } });
      if (existing && existing.id !== user.id) {
        res.status(409).json({ error: "Username already taken" });
        return;
      }
      updates.username = username;
    }

    if (password !== undefined) {
      const salt = randomBytes(32).toString("hex");
      const hash = await argon2.hash(password + salt);
      updates.password_hash = hash;
      updates.password_salt = salt;
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No valid fields to update" });
      return;
    }

    await user.update(updates);

    res.json({
      id: user.id,
      username: user.username,
      kyc_status: user.kyc_status,
      partner_user_id: user.partner_user_id,
    });
  } catch (err) {
    console.error("Patch me error:", err);
    res.status(500).json({ error: "Update failed" });
  }
});

router.patch(
  "/me/kyc",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const parsed = updateKycSchema.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: "Invalid input", details: parsed.error.flatten() });
        return;
      }

      const user = await db.User.findByPk(req.user!.userId);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      if (!user.partner_user_id) {
        res.status(404).json({ error: "Partner user not linked" });
        return;
      }

      if (shouldSkipPartnerApiCall()) {
        res.status(503).json({ error: "Partner service is not configured" });
        return;
      }

      const response = await u54ApiService.updateUserKycDetails(
        user.partner_user_id,
        parsed.data,
      );

      res.json(response.data);
    } catch (err) {
      console.error("Update kyc error:", err);
      res.status(502).json({ error: "Failed to update kyc" });
    }
  },
);

router.post(
  "/me/create-partner-user",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const parsed = createPartnerUserSchema.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: "Invalid input", details: parsed.error.flatten() });
        return;
      }

      const user = await db.User.findByPk(req.user!.userId);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      if (user.partner_user_id) {
        res.status(409).json({
          error: "Partner user already linked",
          partner_user_id: user.partner_user_id,
        });
        return;
      }

      if (shouldSkipPartnerApiCall()) {
        res.status(503).json({ error: "Partner service is not configured" });
        return;
      }

      const createUserResponse = await u54ApiService.createUser({
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        dob: parsed.data.dob,
        country: parsed.data.country,
        phoneNumber: parsed.data.phoneNumber,
        email: parsed.data.email,
        tpin: parsed.data.tpin,
      });

      const partnerUserIdFromResponse = createUserResponse.userId;

      if (!partnerUserIdFromResponse) {
        res.status(502).json({ error: "Partner API did not return userId" });
        return;
      }

      await user.update({ partner_user_id: partnerUserIdFromResponse });

      try {
        const { wallets } = await u54ApiService.getUserWallets();
        const firstWallet = wallets?.[0];
        if (firstWallet?.id) {
          await user.update({ partner_wallet_id: firstWallet.id });
        }
      } catch (walletErr) {
        console.error("Failed to fetch and persist partner wallet:", walletErr);
      }

      res.status(201).json({
        partner_user_id: partnerUserIdFromResponse,
        partner_user: createUserResponse,
      });
    } catch (err) {
      console.error("Create partner user error:", err);
      res.status(502).json({ error: "Failed to create partner user" });
    }
  },
);

router.patch(
  "/me/partner-user",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const parsed = updatePartnerUserSchema.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: "Invalid input", details: parsed.error.flatten() });
        return;
      }

      const user = await db.User.findByPk(req.user!.userId);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      if (!user.partner_user_id) {
        res.status(404).json({ error: "Partner user not linked" });
        return;
      }

      if (shouldSkipPartnerApiCall()) {
        res.status(503).json({ error: "Partner service is not configured" });
        return;
      }

      const { firstName, lastName, dob, country, tpin, ...contactFields } =
        parsed.data;
      const updatePayload = Object.fromEntries(
        Object.entries(contactFields).filter(
          ([, value]) => value !== undefined,
        ),
      );

      let hasAppliedUpdate = false;

      if (Object.keys(updatePayload).length > 0) {
        await u54ApiService.updateUser(user.partner_user_id, updatePayload);
        hasAppliedUpdate = true;
      }

      const shouldUpdateKyc =
        firstName !== undefined ||
        lastName !== undefined ||
        dob !== undefined ||
        country !== undefined ||
        tpin !== undefined;

      if (shouldUpdateKyc) {
        const currentPartnerUser = await u54ApiService.getUser(
          user.partner_user_id,
        );
        const resolvedTpin = tpin ?? currentPartnerUser.tpin;
        if (!resolvedTpin) {
          res.status(400).json({
            error: "TPIN is required to update KYC profile details",
          });
          return;
        }
        const kycPayload = {
          firstName: firstName ?? currentPartnerUser.firstName,
          lastName: lastName ?? currentPartnerUser.lastName,
          dob: normalizeDateInput(dob ?? currentPartnerUser.dob),
          country: country ?? currentPartnerUser.country,
          tpin: resolvedTpin,
        };

        try {
          await u54ApiService.updateUserKycDetails(
            user.partner_user_id,
            kycPayload,
          );
        } catch (kycUpdateError) {
          console.error("Partner TPIN KYC update failed", {
            partnerUserId: user.partner_user_id,
            payload: {
              firstName: kycPayload.firstName,
              lastName: kycPayload.lastName,
              dob: kycPayload.dob,
              country: kycPayload.country,
              tpinLength: kycPayload.tpin.length,
            },
            error:
              kycUpdateError instanceof Error
                ? kycUpdateError.message
                : String(kycUpdateError),
          });
          throw kycUpdateError;
        }
        hasAppliedUpdate = true;
      }

      if (!hasAppliedUpdate) {
        res.status(400).json({ error: "No valid fields to update" });
        return;
      }
      const partnerUser = await u54ApiService.getUser(user.partner_user_id);

      res.json({
        partner_user_id: user.partner_user_id,
        partner_user: partnerUser,
      });
    } catch (err) {
      console.error("Update partner user error:", err);
      res.status(502).json({ error: "Failed to update partner user" });
    }
  },
);

export default router;
