const mongoose = require("mongoose");

const contractSchema = new mongoose.Schema(
  {
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: [true, "Phòng không được để trống"],
    },
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Khách thuê không được để trống"],
    },
    startDate: {
      type: Date,
      required: [true, "Ngày bắt đầu không được để trống"],
    },
    endDate: {
      type: Date,
      required: [true, "Ngày kết thúc không được để trống"],
    },
    monthlyRent: {
      type: Number,
      required: [true, "Tiền thuê hàng tháng không được để trống"],
      min: 0,
    },
    depositAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ["pending", "active", "expired", "terminated", "renewal", "renewed"],
      default: "pending",
    },
    representativeName: { type: String, default: "" },
    representativePhone: { type: String, default: "" },
    representativeIdCard: { type: String, default: "" },
    representativeDob: { type: String, default: "" },
    coResidents: [
      {
        name: { type: String },
        phone: { type: String },
        idCard: { type: String },
        dob: { type: String }
      }
    ],
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // ── Gia hạn hợp đồng ──────────────────────────────────────────
    /** Hợp đồng gốc (nếu đây là hợp đồng gia hạn) */
    parentContract: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contract",
      default: null,
    },
    /** Trạng thái luồng gia hạn */
    extensionStatus: {
      type: String,
      enum: ["none", "sent_to_tenant", "tenant_agreed", "tenant_declined", "extended"],
      default: "none",
    },
    /** Số tháng tenant muốn gia hạn */
    extensionRequestedMonths: {
      type: Number,
      default: null,
    },
    /** Ghi chú của admin khi gửi yêu cầu gia hạn (VD: thay đổi giá, dịch vụ) */
    extensionNote: {
      type: String,
      default: "",
    },

    // ── Chữ ký điện tử ────────────────────────────────────────────
    /** Chữ ký Bên A (chủ trọ) – lưu dưới dạng base64 PNG */
    signatureA: {
      type: String,
      default: "",
    },
    /** Chữ ký Bên B (khách thuê) – lưu dưới dạng base64 PNG */
    signatureB: {
      type: String,
      default: "",
    },
    /** Thời điểm cả hai bên hoàn tất ký */
    signedAt: {
      type: Date,
      default: null,
    },
    /** Bên A (chủ trọ/admin) đã ký chưa */
    isSignedByOwner: {
      type: Boolean,
      default: false,
    },
    /** Bên B (khách thuê) đã ký chưa */
    isSignedByTenant: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Validate: endDate phải sau startDate
contractSchema.pre("save", function () {
  if (this.endDate <= this.startDate) {
    throw new Error("Ngày kết thúc phải sau ngày bắt đầu");
  }
});

module.exports = mongoose.model("Contract", contractSchema);
