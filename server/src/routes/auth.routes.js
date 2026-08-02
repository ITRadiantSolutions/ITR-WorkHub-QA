import { Router } from "express";
import rateLimit from "express-rate-limit";
import { register, login, me, refresh } from "../controllers/authController.js";
import { redirectToAzure, handleAzureCallback } from "../controllers/azureAuthController.js";
import { protect } from "../middleware/authMiddleware.js";
import { validateLogin } from "../validators/authValidator.js";

const router = Router();

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50 });
router.use(authLimiter);

router.post("/register", register);
router.post("/login", validateLogin, login);
router.get("/me", protect, me);
router.post("/token/refresh", protect, refresh);

router.get("/azure", redirectToAzure);
router.get("/azure/callback", handleAzureCallback);

export default router;
