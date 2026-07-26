const express = require("express");
const router = express.Router();
const { protect, optionalAuth, verifyRole } = require("../middleware/auth");
const {
  createService,
  getServices,
  getServiceById,
  getServiceReviews,
  updateService,
  deleteService,
} = require("../controllers/serviceController");
const { searchServiceImages, importServiceImage } = require("../controllers/serviceImageController");

router.get("/images/search", protect, verifyRole("admin", "staff"), searchServiceImages);
router.post("/images/import", protect, verifyRole("admin", "staff"), importServiceImage);

// GET — public, optionalAuth để biết role (ẩn/hiện inactive)
router.get("/", optionalAuth, getServices);
router.get("/:id", optionalAuth, getServiceById);
router.get("/:id/reviews", getServiceReviews);

// Admin/Staff quản lý. Xóa cứng chỉ được phép khi dịch vụ chưa có ServiceBooking
// nào tham chiếu tới (tránh mồ côi booking) — xem serviceController.deleteService.
router.post("/", protect, verifyRole("admin", "staff"), createService);
router.put("/:id", protect, verifyRole("admin", "staff"), updateService);
router.delete("/:id", protect, verifyRole("admin", "staff"), deleteService);

module.exports = router;
