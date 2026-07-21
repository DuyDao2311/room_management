const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Tên dịch vụ không được để trống"],
      trim: true,
    },
    category: {
      type: String,
      enum: ["cleaning", "food", "laundry", "transport", "spa", "maintenance"],
      required: [true, "Loại dịch vụ không được để trống"],
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    price: {
      type: Number,
      required: function () { return !this.usesVariants; },
      min: [0, "Giá dịch vụ không được âm"],
    },
    unit: {
      type: String,
      required: function () { return !this.usesVariants; },
      trim: true,
    },
    usesVariants: {
      type: Boolean,
      default: false,
    },
    variants: {
      type: [{
        label: { type: String, required: true, trim: true },
        price: { type: Number, required: true, min: 0 },
        capacity: { type: Number, min: 1 },
      }],
      default: [],
    },
    requiresCapacityMatch: {
      type: Boolean,
      default: false,
    },
    capacityFieldLabel: {
      type: String,
      trim: true,
      default: "",
    },
    images: {
      type: [String],
      default: [],
    },
    avgRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    ratingCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Index cho trang browse — lọc theo category, chỉ lấy active
serviceSchema.index({ category: 1, isActive: 1 });

module.exports = mongoose.model("Service", serviceSchema);
