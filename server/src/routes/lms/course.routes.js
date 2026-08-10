import { Router } from "express";
import multer from "multer";
import { protect, requireModuleAccess } from "../../middleware/authMiddleware.js";
import {
  getPublishedCourses,
  getAllCoursesAdmin,
  getCreatorCourses,
  getCoursesByIds,
  getCourseById,
  createCourse,
  editCourse,
  removeCourse,
  getCourseLecture,
  createLecture,
  editLecture,
  removeLecture,
} from "../../controllers/lmsCourseController.js";
import {
  adminCreateAssessment,
  adminListAssessmentsByCourse,
  adminUpdateAssessment,
  adminDeleteAssessment,
} from "../../controllers/lmsAssessmentController.js";
import { getCourseReviews } from "../../controllers/lmsReviewController.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

const router = Router();

router.use(protect, requireModuleAccess("lms"));

router.get("/published", getPublishedCourses);
router.get("/admin", getAllCoursesAdmin);
router.get("/mine", getCreatorCourses);
router.get("/by-ids", getCoursesByIds);

router.put("/assessments/:assessmentId", adminUpdateAssessment);
router.delete("/assessments/:assessmentId", adminDeleteAssessment);

router.patch("/lectures/:lectureId", upload.fields([{ name: "pdfFiles", maxCount: 10 }, { name: "videoFiles", maxCount: 10 }]), editLecture);
router.delete("/lectures/:lectureId", removeLecture);

router.get("/:courseId/assessments", adminListAssessmentsByCourse);
router.post("/:courseId/assessments", adminCreateAssessment);
router.get("/:courseId/lectures", getCourseLecture);
router.post("/:courseId/lectures", upload.fields([{ name: "pdfFiles", maxCount: 10 }, { name: "videoFiles", maxCount: 10 }]), createLecture);
router.get("/:courseId/reviews", getCourseReviews);

router.get("/:courseId", getCourseById);
router.post("/", upload.single("thumbnail"), createCourse);
router.patch("/:courseId", upload.single("thumbnail"), editCourse);
router.delete("/:courseId", removeCourse);

export default router;
