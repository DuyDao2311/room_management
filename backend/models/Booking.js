const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: [true, "Phòng không được để trống"],
    },
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Người thuê không được để trống"],
    },
    bookingType: {
      type: String,
      enum: ["hour", "day", "week", "month"],
      required: [true, "Loại thuê không được để trống"],
    },
    checkInDateTime: {
      type: Date,
      required: [true, "Thời gian nhận phòng không được để trống"],
    },
    checkOutDateTime: {
      type: Date,
      required: [true, "Thời gian trả phòng không được để trống"],
    },
    totalHours: {
      type: Number,
      default: 0,
    },
    totalDays: {
      type: Number,
      default: 0,
    },
    totalWeeks: {
      type: Number,
      default: 0,
    },
    totalMonths: {
      type: Number,
      default: 0,
    },
    unitPrice: {
      type: Number,
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "refunded"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      enum: ["MoMo", "VNPay", "Cash"],
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "checked_in", "checked_out", "cancelled"],
      default: "pending",
    },
    note: {
      type: String,
      trim: true,
      default: "",
    },
    guests: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  { timestamps: true }
);

// Index for availability check — fast overlap queries
bookingSchema.index({ room: 1, status: 1, checkInDateTime: 1, checkOutDateTime: 1 });

// Index for tenant's bookings list
bookingSchema.index({ tenant: 1, createdAt: -1 });

module.exports = mongoose.model("Booking", bookingSchema);
