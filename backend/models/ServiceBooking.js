// backend/models/ServiceBooking.js
const mongoose = require("mongoose");

const serviceBookingSchema = new mongoose.Schema(
  {
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: [true, "Dịch vụ không được để trống"],
    },
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Khách đặt không được để trống"],
    },
    scheduledAt: {
      type: Date,
      required: [true, "Thời gian hẹn không được để trống"],
    },
    quantity: {
      type: Number,
      required: [true, "Số lượng không được để trống"],
      min: [1, "Số lượng tối thiểu là 1"],
    },
    unitPrice: {
      type: Number,
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "completed", "cancelled"],
      default: "pending",
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid"],
      default: "unpaid",
    },
    rating: {
      type: Number,
      min: [1, "Số sao tối thiểu là 1"],
      max: [5, "Số sao tối đa là 5"],
    },
    review: {
      type: String,
      trim: true,
      maxlength: [1000, "Nhận xét không được quá 1000 ký tự"],
    },
    tags: {
      type: [String],
      default: [],
    },
    note: {
      type: String,
      trim: true,
      default: "",
    },
    carType: {
      type: String,
    },
    passengerCount: {
      type: Number,
      min: [1, "Số hành khách tối thiểu là 1"],
    },
  },
  { timestamps: true }
);

// List "của tôi" — tenant xem lịch sử đặt, mới nhất trước
serviceBookingSchema.index({ tenant: 1, createdAt: -1 });

// Tính avgRating — lọc theo service + status khi cần
serviceBookingSchema.index({ service: 1, status: 1 });

module.exports = mongoose.model("ServiceBooking", serviceBookingSchema);
