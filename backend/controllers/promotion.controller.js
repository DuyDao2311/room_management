/**
 * Promotion Controller
 * Chỉ xử lý request/response — business logic nằm trong PromotionService.
 */

const promotionService = require("../services/promotion.service");

// POST /api/promotions — Tạo Promotion
async function createPromotion(req, res) {
  try {
    const promotion = await promotionService.createPromotion(req.body, req.user._id);
    res.status(201).json({
      success: true,
      message: "Tạo chương trình khuyến mãi thành công.",
      data: promotion,
    });
  } catch (err) {
    const statusCode = err.message.includes("không tìm thấy") ? 404 : 400;
    res.status(statusCode).json({
      success: false,
      message: err.message,
    });
  }
}

// GET /api/promotions — Danh sách Promotion
async function getPromotionList(req, res) {
  try {
    const result = await promotionService.getPromotionList(req.query);
    res.json({
      success: true,
      message: "Lấy danh sách khuyến mãi thành công.",
      ...result,
    });
  } catch (err) {
    console.error("Get promotion list error:", err);
    res.status(500).json({ success: false, message: "Lỗi server." });
  }
}

// GET /api/promotions/:id — Chi tiết Promotion
async function getPromotionDetail(req, res) {
  try {
    const promotion = await promotionService.getPromotionDetail(req.params.id);
    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy chương trình khuyến mãi.",
      });
    }
    res.json({
      success: true,
      message: "Lấy chi tiết khuyến mãi thành công.",
      data: promotion,
    });
  } catch (err) {
    console.error("Get promotion detail error:", err);
    res.status(500).json({ success: false, message: "Lỗi server." });
  }
}

// PUT /api/promotions/:id — Chỉnh sửa Promotion
async function updatePromotion(req, res) {
  try {
    const promotion = await promotionService.updatePromotion(req.params.id, req.body);
    res.json({
      success: true,
      message: "Cập nhật chương trình khuyến mãi thành công.",
      data: promotion,
    });
  } catch (err) {
    const statusCode = err.message.includes("Không tìm thấy") ? 404 : 400;
    res.status(statusCode).json({
      success: false,
      message: err.message,
    });
  }
}

// PATCH /api/promotions/:id/status — Đổi trạng thái
async function changeStatus(req, res) {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Trạng thái mới không được để trống.",
      });
    }
    const promotion = await promotionService.changeStatus(req.params.id, status);
    res.json({
      success: true,
      message: `Đổi trạng thái thành "${status}" thành công.`,
      data: promotion,
    });
  } catch (err) {
    const statusCode = err.message.includes("Không tìm thấy") ? 404 : 400;
    res.status(statusCode).json({
      success: false,
      message: err.message,
    });
  }
}

// DELETE /api/promotions/:id — Soft Delete
async function deletePromotion(req, res) {
  try {
    await promotionService.deletePromotion(req.params.id);
    res.json({
      success: true,
      message: "Xóa chương trình khuyến mãi thành công.",
    });
  } catch (err) {
    const statusCode = err.message.includes("Không tìm thấy") ? 404 : 400;
    res.status(statusCode).json({
      success: false,
      message: err.message,
    });
  }
}

module.exports = {
  createPromotion,
  getPromotionList,
  getPromotionDetail,
  updatePromotion,
  changeStatus,
  deletePromotion,
};
