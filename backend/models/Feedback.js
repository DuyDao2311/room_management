const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema(
  {
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: [true, "Phòng không được để trống"],
      index: true,
    },
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Khách thuê không được để trống"],
      index: true,
    },
    rating: {
      type: Number,
      required: [true, "Số sao không được để trống"],
      min: [1, "Số sao tối thiểu là 1"],
      max: [5, "Số sao tối đa là 5"],
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [1000, "Nhận xét không được quá 1000 ký tự"],
      default: "",
    },
    // true = hiển thị "Ẩn danh" thay tên thật
    isAnonymous: {
      type: Boolean,
      default: false,
    },
    // Admin/Staff có thể ẩn review vi phạm mà không xóa
    status: {
      type: String,
      enum: ["visible", "hidden"],
      default: "visible",
    },
    // Phản hồi từ Admin/Staff
    reply: {
      text: { type: String, trim: true, maxlength: [1000, "Phản hồi không quá 1000 ký tự"] },
      repliedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      repliedAt: { type: Date },
    },

  },
  { timestamps: true }
);

// Ràng buộc: mỗi tenant chỉ được đánh giá 1 lần cho 1 phòng
feedbackSchema.index({ room: 1, tenant: 1 }, { unique: true });

module.exports = mongoose.model("Feedback", feedbackSchema);
