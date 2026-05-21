const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { MIN_PASSWORD_LENGTH } = require("../utils/validators");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Tên không được để trống"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email không được để trống"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Email không hợp lệ"],
    },
    password: {
      type: String,
      required: [true, "Mật khẩu không được để trống"],
      minlength: [
        MIN_PASSWORD_LENGTH,
        `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự`,
      ],
      select: false, // không trả về password khi query
    },
    role: {
      type: String,
      enum: ["admin", "staff", "tenant"],
      default: "tenant",
    },
    managedDistricts: {
      type: [String],
      default: [],
    },
    phone: {
      type: String,
      trim: true,
    },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

// Hash password trước khi lưu
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// So sánh password
userSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model("User", userSchema);
