const mongoose = require("mongoose");

// ─── Sub-schema: chỉ số điện / nước ──────────────────────────────────────────
const meterSchema = new mongoose.Schema(
  {
    oldReading: { type: Number, required: true, min: 0 },
    newReading: { type: Number, required: true, min: 0 },
    usage: { type: Number, default: 0 },   // tự tính = newReading - oldReading
    rate: { type: Number, required: true, min: 0 }, // đơn giá (VNĐ/kWh hoặc VNĐ/m³)
    amount: { type: Number, default: 0 },   // tự tính = usage * rate
  },
  { _id: false }
);

// ─── Sub-schema: phí phụ (wifi, vệ sinh, …) ─────────────────────────────────
const extraFeeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

// ─── Schema chính ─────────────────────────────────────────────────────────────
const invoiceSchema = new mongoose.Schema(
  {
    // ── Liên kết ──────────────────────────────────────────────────────────────
    contract: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contract",
      required: true,
      index: true,
    },

    // ── Loại hóa đơn ─────────────────────────────────────────────────────────
    type: {
      type: String,
      enum: ["deposit", "service", "repair"],
      required: true,
    },

    // ── Snapshot (lưu để không phụ thuộc vào dữ liệu gốc thay đổi sau này) ──
    representativeName: { type: String, required: true, trim: true },
    representativePhone: { type: String, trim: true, default: "" },
    roomName: { type: String, required: true, trim: true },
    rentAmount: { type: Number, required: true, min: 0 },

    // ── Chỉ dùng cho hóa đơn "deposit" ───────────────────────────────────────
    depositAmount: { type: Number, default: 0, min: 0 },

    // ── Chỉ dùng cho hóa đơn "repair" ────────────────────────────────────────
    repairAmount: { type: Number, default: 0, min: 0 },
    incidentId: { type: mongoose.Schema.Types.ObjectId, ref: "Incident" },

    // ── Chỉ dùng cho hóa đơn "service" ───────────────────────────────────────
    month: { type: Number, min: 1, max: 12 },   // 1-12
    year: { type: Number, min: 2000 },
    electricity: { type: meterSchema },
    water: { type: meterSchema },
    extraFees: { type: [extraFeeSchema], default: [] },

    // ── Tổng tiền (hệ thống tự tính, client KHÔNG được gửi) ──────────────────
    totalAmount: { type: Number, default: 0, min: 0 },

    // ── Trạng thái ────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["unpaid", "pending", "paid", "overdue"],
      default: "unpaid",
    },

    // ── Phương thức thanh toán ─────────────────────────────────────────────────
    paymentMethod: {
      type: String,
      enum: ["MoMo", "VNPay", "Cash"],
      default: null,
    },

    // ── Người xác nhận thu tiền (staff/admin) ─────────────────────────────────
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    dueDate: { type: Date },   // hạn thanh toán
    paidAt: { type: Date },   // set tự động khi status = "paid"
    sentAt: { type: Date },   // thời điểm gửi hoá đơn cho tenant

    // ── Tenant (snapshot để truy vấn nhanh, không cần populate contract) ──────
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // ── Ghi chú ───────────────────────────────────────────────────────────────
    notes: { type: String, trim: true, default: "" },

    // ── Người tạo ─────────────────────────────────────────────────────────────
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// ─── Index tối ưu query ───────────────────────────────────────────────────────
// Đảm bảo mỗi hợp đồng chỉ có 1 hóa đơn service cho mỗi (tháng + năm)
invoiceSchema.index(
  { contract: 1, type: 1, month: 1, year: 1 },
  { unique: true, partialFilterExpression: { type: "service" } }
);
// Tìm nhanh theo trạng thái
invoiceSchema.index({ status: 1, dueDate: 1 });

// ─── Middleware: tự động tính toán trước khi lưu ──────────────────────────────
invoiceSchema.pre("save", function () {
  // 1. Tính chỉ số điện/nước (nếu có)
  if (this.electricity) {
    const usage = Math.max(0, this.electricity.newReading - this.electricity.oldReading);
    this.electricity.usage = usage;
    this.electricity.amount = usage * this.electricity.rate;
  }
  if (this.water) {
    const usage = Math.max(0, this.water.newReading - this.water.oldReading);
    this.water.usage = usage;
    this.water.amount = usage * this.water.rate;
  }

  // 2. Tính totalAmount theo loại hóa đơn
  if (this.type === "deposit") {
    // tiền cọc + tiền phòng tháng đầu
    this.totalAmount = (this.depositAmount || 0) + (this.rentAmount || 0);
  } else if (this.type === "service") {
    const elec = this.electricity?.amount || 0;
    const wtr = this.water?.amount || 0;
    const extraTotal = (this.extraFees || []).reduce((sum, f) => sum + f.amount, 0);
    this.totalAmount = (this.rentAmount || 0) + elec + wtr + extraTotal;
  } else if (this.type === "repair") {
    this.totalAmount = this.repairAmount || 0;
  }

  // 3. Ghi nhận thời điểm thanh toán
  if (this.status === "paid" && !this.paidAt) {
    this.paidAt = new Date();
  }
  if (this.status !== "paid") {
    this.paidAt = undefined;
  }

  // 4. Tự chuyển sang overdue nếu quá hạn mà chưa trả
  //    Và ngược lại, nếu đang overdue mà được dời hạn thì chuyển lại thành unpaid
  //    (Không chuyển overdue khi đang pending — đang chờ thu tiền mặt)
  if (this.status === "unpaid" || this.status === "overdue") {
    if (this.dueDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(this.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      
      if (today > dueDate) {
        this.status = "overdue";
      } else {
        this.status = "unpaid";
      }
    }
  }
});

module.exports = mongoose.model("Invoice", invoiceSchema);
