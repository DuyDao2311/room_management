const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const User = require("../models/User");
const { protect } = require("../middleware/auth");
const sendEmail = require("../utils/sendEmail");
const {
  passwordResetTemplate,
  passwordChangedTemplate,
} = require("../utils/emailTemplates");
const { validateEmail, validatePassword } = require("../utils/validators");

// 5 req / 15 phút / IP — chặn attacker đơn lẻ. Bypass được nếu dùng botnet.
const sensitiveAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Bạn đã thử quá nhiều lần. Vui lòng đợi 15 phút rồi thử lại.",
  },
});

// 200 req / 15 phút cộng dồn — phòng khi attacker xoay IP để né limiter trên.
const globalAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: () => "global",
  message: {
    message: "Hệ thống đang quá tải. Vui lòng thử lại sau ít phút.",
  },
});

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

const logError = (label, err) =>
  console.error(label, { message: err?.message, code: err?.code });

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Vui lòng nhập đầy đủ thông tin." });
    }

    const emailErr = validateEmail(email);
    if (emailErr) return res.status(400).json({ message: emailErr });

    const passErr = validatePassword(password);
    if (passErr) return res.status(400).json({ message: passErr });

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Email đã được sử dụng." });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: role === "admin" ? "admin" : "tenant",
    });

    const token = signToken(user._id);

    res.status(201).json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        managedDistricts: user.managedDistricts || [],
      },
    });
  } catch (err) {
    logError("Register error:", err);
    res.status(500).json({ message: "Lỗi server. Vui lòng thử lại." });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Vui lòng nhập email và mật khẩu." });
    }

    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      return res
        .status(401)
        .json({ message: "Email hoặc mật khẩu không đúng." });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "Tài khoản đã bị khóa." });
    }

    const token = signToken(user._id);

    res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        managedDistricts: user.managedDistricts || [],
      },
    });
  } catch (err) {
    logError("Login error:", err);
    res.status(500).json({ message: "Lỗi server. Vui lòng thử lại." });
  }
});

// POST /api/auth/forgot-password
router.post(
  "/forgot-password",
  globalAuthLimiter,
  sensitiveAuthLimiter,
  async (req, res) => {
    try {
      const { email } = req.body;
      const emailErr = validateEmail(email);
      if (emailErr) return res.status(400).json({ message: emailErr });

      // Normalize trước khi query: User schema có trim + lowercase ở SAVE,
      // nhưng query không tự áp → "  TEST@x.com  " sẽ không match nếu skip.
      const normalizedEmail = email.trim().toLowerCase();
      const user = await User.findOne({ email: normalizedEmail });

      // DEVIATION (2026-05-20): không dùng same-message pattern — báo trực
      // tiếp email tồn tại hay không. Trade-off: lộ user enumeration. Chấp
      // nhận vì dự án nội bộ nhỏ; rate limit chỉ chặn được attacker 1 IP.
      if (!user || !user.isActive) {
        return res
          .status(404)
          .json({ message: `Email ${normalizedEmail} chưa được đăng ký.` });
      }

      const rawToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto
        .createHash("sha256")
        .update(rawToken)
        .digest("hex");

      user.resetPasswordToken = hashedToken;
      user.resetPasswordExpires = Date.now() + 15 * 60 * 1000;
      await user.save({ validateBeforeSave: false });

      const resetUrl = `${process.env.CLIENT_URL}/reset-password/${rawToken}`;
      const { html, text } = passwordResetTemplate({
        userName: user.name,
        resetUrl,
      });

      try {
        await sendEmail({
          to: user.email,
          subject: "Đặt lại mật khẩu - Room Management",
          html,
          text,
        });
      } catch (mailErr) {
        // Rollback bằng updateOne để bỏ qua pre-save hook + validation.
        await User.updateOne(
          { _id: user._id },
          { $unset: { resetPasswordToken: "", resetPasswordExpires: "" } },
        );
        logError("Send email error:", mailErr);
        return res
          .status(500)
          .json({ message: "Không gửi được email. Vui lòng thử lại." });
      }

      return res.json({
        message: "Hãy kiểm tra email để đặt lại mật khẩu.",
      });
    } catch (err) {
      logError("Forgot password error:", err);
      res.status(500).json({ message: "Lỗi server. Vui lòng thử lại." });
    }
  },
);

// POST /api/auth/reset-password
router.post(
  "/reset-password",
  globalAuthLimiter,
  sensitiveAuthLimiter,
  async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      if (typeof token !== "string" || !token) {
        return res.status(400).json({ message: "Thiếu token." });
      }

      const passErr = validatePassword(newPassword);
      if (passErr) return res.status(400).json({ message: passErr });

      const hashedToken = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

      const user = await User.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: Date.now() },
      }).select("+resetPasswordToken +resetPasswordExpires");

      if (!user) {
        return res
          .status(400)
          .json({ message: "Token không hợp lệ hoặc đã hết hạn." });
      }

      user.password = newPassword;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      // Email cảnh báo best-effort — không block response, không rollback được.
      sendEmail({
        to: user.email,
        subject: "Mật khẩu vừa được đổi - Room Management",
        ...passwordChangedTemplate({ userName: user.name }),
      }).catch((mailErr) =>
        logError("Send password-changed email error:", mailErr),
      );

      res.json({ message: "Đổi mật khẩu thành công." });
    } catch (err) {
      logError("Reset password error:", err);
      res.status(500).json({ message: "Lỗi server. Vui lòng thử lại." });
    }
  },
);

// GET /api/auth/me — lấy thông tin user hiện tại
router.get("/me", protect, async (req, res) => {
  res.json({
    _id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
    phone: req.user.phone,
    managedDistricts: req.user.managedDistricts || [],
  });
});

module.exports = router;
