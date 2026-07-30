const express = require("express");
const router = express.Router();
const { protect, optionalAuth, verifyRole, adminOnly } = require("../middleware/auth");
const {
  createService,
  getServices,
  getServiceById,
  getServiceReviews,
  updateService,
  deleteService,
} = require("../controllers/serviceController");
const { uploadServiceImagesHandler } = require("../controllers/serviceImageController");
const { uploadServiceImages } = require("../middleware/upload");

router.post("/images/upload", protect, verifyRole("admin", "staff"), uploadServiceImages, uploadServiceImagesHandler);

// GET — public, optionalAuth để biết role (ẩn/hiện inactive)
router.get("/", optionalAuth, getServices);
router.get("/:id", optionalAuth, getServiceById);
router.get("/:id/reviews", getServiceReviews);

// Admin/Staff quản lý. Riêng xóa cứng chỉ Admin — cùng nguyên tắc với xóa phòng
// và xóa booking. Điều kiện dữ liệu (chưa có ServiceBooking tham chiếu, dịch vụ
// đang tạm dừng) vẫn kiểm tra thêm trong serviceController.deleteService.
router.post("/", protect, verifyRole("admin", "staff"), createService);
router.put("/:id", protect, verifyRole("admin", "staff"), updateService);
router.delete("/:id", protect, adminOnly, deleteService);

module.exports = router;
