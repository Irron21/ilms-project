const express = require("express");
const router = express.Router();
const kpiController = require("../controllers/kpiController");
const aiController = require("../controllers/aiController");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const verifyToken = require("../middleware/authMiddleware");
const cache = require("../middleware/cacheMiddleware");

router.post(
  "/upload",
  verifyToken,
  upload.single("kpiReport"),
  kpiController.uploadKPIReport,
);
router.get(
  "/months",
  verifyToken,
  cache(300),
  kpiController.getAvailableMonths,
);
router.get(
  "/dashboard",
  verifyToken,
  cache(300),
  kpiController.getDashboardData,
);
router.post("/delete", verifyToken, kpiController.deleteReport);
router.post("/analyze", verifyToken, aiController.analyzeKPI);
router.get("/reports/history", verifyToken, aiController.getReportHistory);
router.delete("/reports/history/:id", verifyToken, aiController.deleteAIReport);

module.exports = router;
