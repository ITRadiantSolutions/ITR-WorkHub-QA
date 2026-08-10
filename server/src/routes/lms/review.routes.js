import { Router } from "express";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import { addReview, getAllReviews } from "../../controllers/lmsReviewController.js";

const router = Router();

router.use(protect, requireModuleAccess("lms"));

router.post("/", addReview);
router.get("/", getAllReviews);

export default router;
