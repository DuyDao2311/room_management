const mongoose = require("mongoose");

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Payment Model - Lưu lịch sử giao dịch thanh toán hóa đơn phòng trọ
 *
 * Mỗi lần tenant thanh toán (qua Momo / VNPay hoặc tiền mặt) sẽ tạo
 * ra 1 bản ghi Payment. Invoice chỉ lưu trạng thái cuối (paid/unpaid),
 * còn Payment lưu toàn bộ lịch sử chi tiết giao dịch.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const paymentSchema = new mongoose.Schema(
  {
    // ── Liên kết hóa đơn & hợp đồng ────────────────────────────────────────
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      required: true,
      index: true,
    },
    contract: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contract",
      index: true,
    },

    // ── Người thanh toán (tenant) ────────────────────────────────────────────
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // ── Phương thức thanh toán ───────────────────────────────────────────────
    paymentMethod: {
      type: String,
      enum: ["momo", "vnpay", "cash"],
      required: true,
    },

    // ── Số tiền giao dịch (VNĐ) ─────────────────────────────────────────────
    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    // ── Trạng thái giao dịch ────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["pending", "success", "failed", "refunded"],
      default: "pending",
    },

    // ── Dữ liệu từ Momo gateway ─────────────────────────────────────────────
    momo: {
      orderId: { type: String },   // orderId trả về từ Momo
      requestId: { type: String },
      transId: { type: String },   // Momo transaction ID
      resultCode: { type: Number },   // 0 = thành công
      message: { type: String },
      payType: { type: String },   // web / qr / app
    },

    // ── Dữ liệu từ VNPay gateway ────────────────────────────────────────────
    vnpay: {
      txnRef: { type: String },   // vnp_TxnRef
      transactionNo: { type: String },   // vnp_TransactionNo
      bankCode: { type: String },   // vnp_BankCode
      responseCode: { type: String },   // 00 = thành công
      orderInfo: { type: String },
      bankTranNo: { type: String },
    },

    // ── Thanh toán tiền mặt (admin/staff xác nhận) ──────────────────────────
    cash: {
      receivedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      note: { type: String, trim: true },
    },

    // ── Thông tin bổ sung ────────────────────────────────────────────────────
    paidAt: { type: Date },           // thời điểm giao dịch hoàn tất
    note: { type: String, trim: true, default: "" },
  },
  {
    timestamps: true,  // createdAt (lúc tạo giao dịch), updatedAt
  }
);

// ─── Indexes ─────────────────────────────────────────────────────────────────
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ "momo.orderId": 1 }, { sparse: true });
paymentSchema.index({ "vnpay.txnRef": 1 }, { sparse: true });
// TTL index: tự động xóa bản ghi "pending" sau 1 tiếng nếu không được cập nhật
// (tức là người dùng đóng tab, không hoàn thành thanh toán)
paymentSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 3600, // 1 tiếng
    partialFilterExpression: { status: "pending" },
  }
);

// ─── Middleware: ghi thời điểm thành công ────────────────────────────────────
paymentSchema.pre("save", function () {
  if (this.status === "success" && !this.paidAt) {
    this.paidAt = new Date();
  }
});

module.exports = mongoose.model("Payment", paymentSchema);
