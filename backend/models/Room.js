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
    images: {
      type: [String],
      default: [],
    },
    district: {
      type: String,
      trim: true,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Text index để tìm kiếm
roomSchema.index({ name: "text", address: "text", description: "text" });

// Compound index: không cho phép 2 phòng cùng tên tại cùng địa chỉ
roomSchema.index({ name: 1, address: 1 }, { unique: true, collation: { locale: "vi", strength: 2 } });


module.exports = mongoose.model("Room", roomSchema);
