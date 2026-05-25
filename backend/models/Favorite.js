const mongoose = require("mongoose");

const favoriteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Người dùng không được để trống"],
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: [true, "Phòng không được để trống"],
    },
  },
  { timestamps: true }
);

// Compound index: một user chỉ có thể favorite một phòng một lần
favoriteSchema.index({ user: 1, room: 1 }, { unique: true });

module.exports = mongoose.model("Favorite", favoriteSchema);