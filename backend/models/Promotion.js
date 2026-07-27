const mongoose = require("mongoose");

/**
 * Promotion Schema
 * Chương trình khuyến mãi giảm giá trực tiếp trên phòng.
 * KHÔNG sửa Room.price — giá khuyến mãi được tính động khi trả response.
 */
const promotionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Tên chương trình không được để trống"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    // ── Loại giảm giá ──────────────────────────────────────────────
    discountType: {
      type: String,
      enum: ["percent", "fixed"],
      required: [true, "Loại giảm giá không được để trống"],
    },
    // Giá trị giảm: nếu percent → 20 = 20%, nếu fixed → 300000 = 300.000đ
    discountValue: {
      type: Number,
      required: [true, "Giá trị giảm không được để trống"],
      min: [0, "Giá trị giảm phải lớn hơn 0"],
    },
    // Giới hạn số tiền giảm tối đa (chỉ áp dụng khi discountType = percent)
    maxDiscount: {
      type: Number,
      default: null,
    },
    // ── Phòng áp dụng ──────────────────────────────────────────────
    roomIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Room",
      },
    ],
    // ── Thời gian áp dụng ──────────────────────────────────────────
    startDate: {
      type: Date,
      required: [true, "Ngày bắt đầu không được để trống"],
    },
    endDate: {
      type: Date,
      required: [true, "Ngày kết thúc không được để trống"],
    },
    // ── Trạng thái ─────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["upcoming", "active", "expired", "disabled"],
      default: "upcoming",
    },
    // ── Người tạo ──────────────────────────────────────────────────
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // ── Soft Delete ────────────────────────────────────────────────
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// ── Index: tìm promotion active nhanh theo roomId + thời gian ────────────
promotionSchema.index({ roomIds: 1, status: 1, startDate: 1, endDate: 1 });
promotionSchema.index({ status: 1 });
promotionSchema.index({ deletedAt: 1 });

module.exports = mongoose.model("Promotion", promotionSchema);
