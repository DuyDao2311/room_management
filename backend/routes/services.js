const express = require("express");
const router = express.Router();
const { protect, optionalAuth, verifyRole } = require("../middleware/auth");
const {
  createService,
  getServices,
  getServiceById,
  getServiceReviews,
  updateService,
} = require("../controllers/serviceController");

// GET — public, optionalAuth để biết role (ẩn/hiện inactive)
router.get("/", optionalAuth, getServices);
router.get("/:id", optionalAuth, getServiceById);
router.get("/:id/reviews", getServiceReviews);

// Admin/Staff quản lý. Không có xóa cứng — dùng PUT { isActive: false } để ẩn dịch vụ
// (tránh mồ côi ServiceBooking đã tham chiếu tới dịch vụ đã xóa).
router.post("/", protect, verifyRole("admin", "staff"), createService);
router.put("/:id", protect, verifyRole("admin", "staff"), updateService);

module.exports = router;
