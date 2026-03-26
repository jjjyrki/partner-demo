import { z } from "zod";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { u54ApiService } from "../services/u54ApiService";
import { shouldSkipPartnerApiCall } from "../utils/partnerApi";
import { Router, Response } from "express";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const db = require("../db/models");

const router = Router();

const startKycSessionSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dob: z.string().min(1),
  country: z.string().min(1),
  tpin: z.string().regex(/^\d{10}$/, "TPIN must be exactly 10 digits"),
});

router.post(
  "/session",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      if (shouldSkipPartnerApiCall()) {
        res.status(503).json({ error: "Partner service is not configured" });
        return;
      }

      const parsed = startKycSessionSchema.safeParse(req.body);
      if (!parsed.success) {
        console.error("Invalid input", parsed.error.flatten());
        res
          .status(400)
          .json({ error: "Invalid input", details: parsed.error.flatten() });
        return;
      }

      const user = await db.User.findByPk(req.user!.userId);
      if (!user) {
        console.error("User not found");
        res.status(404).json({ error: "User not found" });
        return;
      }

      if (!user.partner_user_id) {
        console.error("Partner user not linked");
        res.status(404).json({ error: "Partner user not linked" });
        return;
      }

      const response = await u54ApiService.createKycSession({
        userId: user.partner_user_id,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        dob: parsed.data.dob,
        country: parsed.data.country,
        tpin: parsed.data.tpin,
      });

      res.json(response);
    } catch (err) {
      console.error("Start kyc session error:", err);
      res.status(502).json({ error: "Failed to start kyc session" });
    }
  },
);

export default router;
