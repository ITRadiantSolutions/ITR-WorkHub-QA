import { Router } from "express";
import rateLimit from "express-rate-limit";
import { register, login, me } from "../controllers/authController.js";
import { redirectToAzure, handleAzureCallback } from "../controllers/azureAuthController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50 });
router.use(authLimiter);

router.post("/register", register);
router.post("/login", login);
router.get("/me", protect, me);

router.get("/azure", redirectToAzure);
router.get("/azure/callback", handleAzureCallback);

export default router;
