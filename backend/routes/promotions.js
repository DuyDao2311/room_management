const express = require("express");
const router = express.Router();
const { protect, verifyRole } = require("../middleware/auth");
const {
  createPromotion,
  getPromotionList,
  getPromotionDetail,
  updatePromotion,
  changeStatus,
  deletePromotion,
} = require("../controllers/promotion.controller");

// ── Tất cả routes yêu cầu đăng nhập + role admin hoặc staff ────────────────

// GET /api/promotions — Danh sách Promotion (pagination, search, filter)
router.get("/", protect, verifyRole("admin", "staff"), getPromotionList);

// GET /api/promotions/:id — Chi tiết Promotion
router.get("/:id", protect, verifyRole("admin", "staff"), getPromotionDetail);

// POST /api/promotions — Tạo Promotion mới
router.post("/", protect, verifyRole("admin", "staff"), createPromotion);

// PUT /api/promotions/:id — Chỉnh sửa Promotion
router.put("/:id", protect, verifyRole("admin", "staff"), updatePromotion);

// PATCH /api/promotions/:id/status — Đổi trạng thái
router.patch("/:id/status", protect, verifyRole("admin", "staff"), changeStatus);

// DELETE /api/promotions/:id — Soft Delete
router.delete("/:id", protect, verifyRole("admin", "staff"), deletePromotion);

module.exports = router;
