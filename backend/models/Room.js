const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Tên phòng không được để trống"],
      trim: true,
    },
    address: {
      type: String,
      required: [true, "Địa chỉ không được để trống"],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "Giá thuê không được để trống"],
      min: [0, "Giá thuê phải lớn hơn 0"],
    },
    area: {
      type: Number,
      required: [true, "Diện tích không được để trống"],
      min: [0, "Diện tích phải lớn hơn 0"],
    },
    type: {
      type: String,
      enum: ["Studio", "1 phòng ngủ", "Chung cư mini", "Phòng trọ thường"],
      default: "Studio",
    },
    status: {
      type: String,
      enum: ["available", "occupied", "maintenance"],
      default: "available",
    },
    maintenanceEndDate: {
      type: Date,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    amenities: {
      type: [String],
      default: [],
    },
    images: [{
      url: { type: String, required: true },
      isPrimary: { type: Boolean, default: false },
      order: { type: Number, default: 0 },
      createdAt: { type: Date, default: Date.now },
    }],
    district: {
      type: String,
      trim: true,
      default: "",
    },
    // ── GeoJSON location (MapBox integration) ─────────────────────────────
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0],
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // ── Feedback cache (cập nhật mỗi khi có thay đổi feedback) ──────────────
    avgRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // ── Lượt xem (tăng mỗi khi user vào trang chi tiết) ────────────────────────
    viewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // ── Rental mode ─────────────────────────────────────────────────────────
    rentalMode: {
      type: String,
      enum: ["short_term", "long_term"],
      default: "long_term",
    },
    // ── Short-term pricing ──────────────────────────────────────────────────
    hourlyPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    dailyPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    weeklyPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    monthlyPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

// ── Auto-set rentalMode based on room type ──────────────────────────────────
// Studio & 1 phòng ngủ → short_term, others → long_term
// Hook không khai báo tham số `next` — Mongoose coi đây là hook đồng bộ và tự
// chạy tiếp sau khi hàm return; khai báo `next` mà không gọi đúng cách từng
// làm treo validate() khi tạo Room trong test (xem __tests__/serviceBooking.test.js).
roomSchema.pre("validate", function () {
  const shortTermTypes = ["Studio", "1 phòng ngủ"];
  this.rentalMode = shortTermTypes.includes(this.type) ? "short_term" : "long_term";
});

// Text index để tìm kiếm
roomSchema.index({ name: "text", address: "text", description: "text" });

// Compound index: không cho phép 2 phòng cùng tên tại cùng địa chỉ
roomSchema.index({ name: 1, address: 1 }, { unique: true, collation: { locale: "vi", strength: 2 } });

// GeoSpatial index cho tìm kiếm nearby
roomSchema.index({ location: "2dsphere" });


module.exports = mongoose.model("Room", roomSchema);
