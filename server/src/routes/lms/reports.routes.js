import { Router } from "express";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import { adminGetAllEmpReports, adminRegenerateEmpReports } from "../../controllers/lmsReportsController.js";

const requireManager = (req, res, next) => {
  if (!["manager", "admin"].includes(req.user.roles.lms)) {
    return res.status(403).json({ message: "Manager/Admin access required" });
  }
  next();
};

const router = Router();

router.use(protect, requireModuleAccess("lms"), requireManager);

router.post("/regenerate", adminRegenerateEmpReports);
router.get("/", adminGetAllEmpReports);

export default router;
