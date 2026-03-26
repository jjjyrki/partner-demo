import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { u54ApiService } from "../services/u54ApiService";
import { shouldSkipPartnerApiCall } from "../utils/partnerApi";
import { getAuthenticatedUser } from "../utils/user";
import { BillingAddress } from "../types/cards";

const router = Router();

router.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    const { partner_user_id, partner_card_id } = user.dataValues;
    if (!partner_user_id) {
      res.status(404).json({ error: "Partner user not linked" });
      return;
    }

    if (!partner_card_id) {
      res.status(404).json({ error: "Card not created" });
      return;
    }

    if (shouldSkipPartnerApiCall()) {
      res.status(503).json({ error: "Partner service is not configured" });
      return;
    }

    const partnerUser = await u54ApiService.getUser(partner_user_id);
    if (partnerUser.kycStatus !== "approved") {
      res.status(403).json({ error: "KYC approval required" });
      return;
    }

    const card = await u54ApiService.getCard(partner_card_id);
    res.json({ card_id: partner_card_id, card });
  } catch (err) {
    console.error("Get card error:", err);
    res.status(502).json({ error: "Failed to fetch card" });
  }
});

router.post("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    const { partner_user_id, partner_card_id } = user.dataValues;
    if (!partner_user_id) {
      res.status(404).json({ error: "Partner user not linked" });
      return;
    }

    if (partner_card_id) {
      res.status(409).json({
        error: "Card already linked",
        card_id: partner_card_id,
      });
      return;
    }

    if (shouldSkipPartnerApiCall()) {
      res.status(503).json({ error: "Partner service is not configured" });
      return;
    }

    const partnerUser = await u54ApiService.getUser(partner_user_id);
    if (partnerUser.kycStatus !== "approved") {
      res.status(403).json({ error: "KYC approval required" });
      return;
    }

    const { billingAddress }: { billingAddress: BillingAddress } =
      req.body ?? {};

    if (!billingAddress) {
      res.status(400).json({
        error: "Billing address required",
      });
      return;
    }

    const addressLine1 = billingAddress.addressLine1.trim();
    const addressLine2 = billingAddress.addressLine2?.trim();
    const city = billingAddress.city.trim();
    const postalCode = billingAddress.postalCode?.trim();
    const country = billingAddress.country.trim();

    if (!addressLine1 || !city || !country) {
      res.status(400).json({
        error:
          "Billing address required: addressLine1, city, and country must be provided",
      });
      return;
    }

    const createCardResponse = await u54ApiService.createCard({
      userId: partner_user_id,
      cardType: "VIRTUAL",
      billingAddress: {
        addressLine1,
        addressLine2,
        postalCode,
        city,
        country,
      },
    });

    const createdCard = createCardResponse;
    if (!createdCard?.id) {
      res.status(502).json({ error: "Partner API did not return card id" });
      return;
    }

    await user.update({ partner_card_id: createdCard.id });

    res.status(201).json({
      card_id: createdCard.id,
      card: createdCard,
    });
  } catch (err) {
    console.error("Create card error:", err);
    res.status(502).json({ error: "Failed to create card" });
  }
});

router.patch(
  "/freeze",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const user = await getAuthenticatedUser(req, res);
      if (!user) {
        return;
      }

      const { partner_card_id } = user.dataValues;
      if (!partner_card_id) {
        res.status(404).json({ error: "Card not created" });
        return;
      }

      if (shouldSkipPartnerApiCall()) {
        res.status(503).json({ error: "Partner service is not configured" });
        return;
      }

      const response = await u54ApiService.freezeCard(partner_card_id);
      res.json(response);
    } catch (err) {
      console.error("Freeze card error:", err);
      res.status(502).json({ error: "Failed to freeze card" });
    }
  },
);

router.patch(
  "/unfreeze",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const user = await getAuthenticatedUser(req, res);
      if (!user) {
        return;
      }

      const { partner_card_id } = user.dataValues;
      if (!partner_card_id) {
        res.status(404).json({ error: "Card not created" });
        return;
      }

      if (shouldSkipPartnerApiCall()) {
        res.status(503).json({ error: "Partner service is not configured" });
        return;
      }

      const response = await u54ApiService.unfreezeCard(partner_card_id);
      res.json(response);
    } catch (err) {
      console.error("Unfreeze card error:", err);
      res.status(502).json({ error: "Failed to unfreeze card" });
    }
  },
);

router.patch(
  "/stop",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const user = await getAuthenticatedUser(req, res);
      if (!user) {
        return;
      }

      const { partner_card_id } = user.dataValues;
      if (!partner_card_id) {
        res.status(404).json({ error: "Card not created" });
        return;
      }

      if (shouldSkipPartnerApiCall()) {
        res.status(503).json({ error: "Partner service is not configured" });
        return;
      }

      const response = await u54ApiService.stopCard(partner_card_id);
      res.json(response);
    } catch (err) {
      console.error("Stop card error:", err);
      res.status(502).json({ error: "Failed to stop card" });
    }
  },
);

router.get(
  "/public-key",
  authMiddleware,
  async (_req: AuthRequest, res: Response) => {
    try {
      if (shouldSkipPartnerApiCall()) {
        res.status(503).json({ error: "Partner service is not configured" });
        return;
      }

      const { publicKey } = await u54ApiService.getCardPublicKey();
      res.json({ data: { publicKey } });
    } catch (err) {
      console.error("Get card public key error:", err);
      res.status(502).json({ error: "Failed to fetch card public key" });
    }
  },
);

router.get("/pan", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    const { partner_card_id } = user.dataValues;
    if (!partner_card_id) {
      res.status(404).json({ error: "Card not created" });
      return;
    }

    const sessionId = req.headers["x-session-id"];
    if (typeof sessionId !== "string" || !sessionId) {
      res.status(400).json({ error: "x-session-id header required" });
      return;
    }

    if (shouldSkipPartnerApiCall()) {
      res.status(503).json({ error: "Partner service is not configured" });
      return;
    }

    const data = await u54ApiService.getEncryptedPAN(
      partner_card_id,
      sessionId,
    );
    res.json({ data });
  } catch (err) {
    console.error("Get encrypted PAN error:", err);
    res.status(502).json({ error: "Failed to fetch encrypted PAN" });
  }
});

router.get("/cvv", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    const { partner_card_id } = user.dataValues;
    if (!partner_card_id) {
      res.status(404).json({ error: "Card not created" });
      return;
    }

    const sessionId = req.headers["x-session-id"];
    if (typeof sessionId !== "string" || !sessionId) {
      res.status(400).json({ error: "x-session-id header required" });
      return;
    }

    if (shouldSkipPartnerApiCall()) {
      res.status(503).json({ error: "Partner service is not configured" });
      return;
    }

    const data = await u54ApiService.getEncryptedCVV(
      partner_card_id,
      sessionId,
    );
    res.json({ data });
  } catch (err) {
    console.error("Get encrypted CVV error:", err);
    res.status(502).json({ error: "Failed to fetch encrypted CVV" });
  }
});

export default router;
