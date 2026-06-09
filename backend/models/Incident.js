const mongoose = require("mongoose");

const incidentSchema = new mongoose.Schema(
  {
    ticketCode: {
      type: String,
      required: true,
      unique: true,
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
    contract: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contract",
      required: true,
    },
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedStaff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    district: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    priority: {
      type: String,
      required: true,
      enum: ["Thấp", "Bình thường", "Cao", "Khẩn cấp"],
      default: "Bình thường",
    },
    description: {
      type: String,
      required: true,
    },
    contactPhone: {
      type: String,
      required: true,
    },
    availableTime: {
      type: String,
      required: true,
    },
    images: {
      type: [String],
      default: [],
    },
    videos: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      required: true,
      enum: ["pending", "assigned", "in_progress", "resolved", "closed", "rejected"],
      default: "pending",
    },
    resolutionNote: {
      type: String,
      default: "",
    },
    repairCost: {
      type: Number,
      default: 0,
    },
    afterImages: {
      type: [String],
      default: [],
    },
    costPayer: {
      type: String,
      enum: ["tenant", "landlord", "none"],
      default: "none",
    },
    repairInvoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      default: null,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    ratingComment: {
      type: String,
    },
    ratedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Tạo ticketCode tự động trước khi lưu nếu chưa có
incidentSchema.pre("validate", async function () {
  if (!this.ticketCode) {
    // Tìm mã ticket lớn nhất hiện tại
    const lastIncident = await this.constructor.findOne({}, "ticketCode").sort({ ticketCode: -1 });
    let nextNumber = 1;
    
    if (lastIncident && lastIncident.ticketCode) {
      // SC-000001 -> lấy số 000001
      const lastNumberStr = lastIncident.ticketCode.split("-")[1];
      if (lastNumberStr && !isNaN(parseInt(lastNumberStr))) {
        nextNumber = parseInt(lastNumberStr) + 1;
      }
    }
    
    this.ticketCode = `SC-${nextNumber.toString().padStart(6, "0")}`;
  }
});

module.exports = mongoose.model("Incident", incidentSchema);
