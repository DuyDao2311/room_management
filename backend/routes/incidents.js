const express = require("express");
const router = express.Router();
const incidentController = require("../controllers/incidentController");
const { protect, verifyRole } = require("../middleware/auth");
const { uploadMultiple } = require("../middleware/upload");
const { validateIncidentCreation } = require("../middleware/incidentValidation");

// Yêu cầu đăng nhập cho tất cả các route bên dưới
router.use(protect);

// ---- API DÀNH CHO ADMIN VÀ STAFF ----
// Admin xem tất cả
router.get("/all", verifyRole("admin"), incidentController.getAllIncidents);

// Staff xem khu vực của mình
router.get("/my-district", verifyRole("staff"), incidentController.getDistrictIncidents);

// Thống kê sự cố
router.get("/stats", verifyRole("admin", "staff"), incidentController.getIncidentStats);

// Admin & Staff cập nhật trạng thái
router.put(
  "/:id/status",
  verifyRole("admin", "staff"),
  uploadMultiple, // Cho phép upload ảnh khi resolve
  incidentController.updateIncidentStatus
);

// Xem timeline sự cố
router.get("/:id/timeline", incidentController.getIncidentTimeline);

// ---- API DÀNH CHO TENANT ----
// Route lấy danh sách sự cố của tôi (tenant)
router.get("/my", incidentController.getMyIncidents);

// Route lấy chi tiết sự cố
router.get("/:id", incidentController.getIncidentById);

// Route tạo báo cáo sự cố (có upload file)
router.post(
  "/",
  uploadMultiple, // Phải đặt upload middleware trước validation để có thể nhận được dữ liệu (req.body) từ form-data
  validateIncidentCreation,
  incidentController.createIncident
);

// Route đánh giá sự cố
router.post("/:id/rate", verifyRole("tenant"), incidentController.rateIncident);

module.exports = router;
