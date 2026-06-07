const mongoose = require("mongoose");

const incidentTimelineSchema = new mongoose.Schema(
  {
    incident: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Incident",
      required: true,
    },
    status: {
      type: String,
      enum: ["created", "pending", "assigned", "in_progress", "resolved", "closed", "rejected"],
      required: true,
    },
    note: {
      type: String,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, // Ai là người thay đổi trạng thái này (có thể là admin, staff, hoặc tenant lúc tạo)
    },
  },
  {
    timestamps: true, // Tự động có createdAt
  }
);

module.exports = mongoose.model("IncidentTimeline", incidentTimelineSchema);
