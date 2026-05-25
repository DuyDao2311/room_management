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
const { emailVerificationTemplate, emailVerifiedTemplate } = require("../utils/emailVerificationTemplate");
const { validateEmail, validatePassword } = require("../utils/validators");

const sensitiveAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Bạn đã thử quá nhiều lần. Vui lòng đợi 15 phút rồi thử lại." },
});

const globalAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: () => "global",
  message: { message: "Hệ thống đang quá tải. Vui lòng thử lại sau ít phút." },
});

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

const logError = (label, err) =>
  console.error(label, { message: err?.message, code: err?.code });

const formatUser = (u) => ({
  _id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  phone: u.phone,
  dob: u.dob,
  gender: u.gender,
  occupation: u.occupation,
  address: u.address,
  idCard: u.idCard,
  idCardDate: u.idCardDate,
  avatar: u.avatar,
  managedDistricts: u.managedDistricts || [],
  isEmailVerified: u.isEmailVerified || false,
});

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin." });

    const { error: emailErr, normalized: normalizedEmail } = validateEmail(email);
    if (emailErr) return res.status(400).json({ message: emailErr });

    const passErr = validatePassword(password);
    if (passErr) return res.status(400).json({ message: passErr });

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) return res.status(400).json({ message: "Email đã được sử dụng." });

    const user = await User.create({
      name,
      email: normalizedEmail,
      password,
      role: role === "admin" ? "admin" : "tenant",
    });

    res.status(201).json({ token: signToken(user._id), user: formatUser(user) });
  } catch (err) {
    logError("Register error:", err);
    res.status(500).json({ message: "Lỗi server. Vui lòng thử lại." });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Vui lòng nhập email và mật khẩu." });

    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ message: "Email hoặc mật khẩu không đúng." });

    if (!user.isActive)
      return res.status(403).json({ message: "Tài khoản đã bị khóa." });

    res.json({ token: signToken(user._id), user: formatUser(user) });
  } catch (err) {
    logError("Login error:", err);
    res.status(500).json({ message: "Lỗi server. Vui lòng thử lại." });
  }
});

// POST /api/auth/forgot-password
router.post("/forgot-password", globalAuthLimiter, sensitiveAuthLimiter, async (req, res) => {
  try {
    const { error: emailErr, normalized: normalizedEmail } = validateEmail(req.body.email);
    if (emailErr) return res.status(400).json({ message: emailErr });

    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !user.isActive)
      return res.status(404).json({ message: `Email ${normalizedEmail} chưa được đăng ký.` });

    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${rawToken}`;
    const { html, text } = passwordResetTemplate({ userName: user.name, resetUrl, requestedAt: new Date() });

    try {
      await sendEmail({ to: user.email, subject: "Đặt lại mật khẩu - Room Management", html, text });
    } catch (mailErr) {
      await User.updateOne(
        { _id: user._id },
        { $unset: { resetPasswordToken: "", resetPasswordExpires: "" } },
      );
      logError("Send email error:", mailErr);
      return res.status(500).json({ message: "Không gửi được email. Vui lòng thử lại." });
    }

    return res.json({ message: "Hãy kiểm tra email để đặt lại mật khẩu." });
  } catch (err) {
    logError("Forgot password error:", err);
    res.status(500).json({ message: "Lỗi server. Vui lòng thử lại." });
  }
});

// POST /api/auth/reset-password
router.post("/reset-password", globalAuthLimiter, sensitiveAuthLimiter, async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (typeof token !== "string" || !token)
      return res.status(400).json({ message: "Thiếu token." });

    const passErr = validatePassword(newPassword);
    if (passErr) return res.status(400).json({ message: passErr });

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    }).select("+resetPasswordToken +resetPasswordExpires");

    if (!user)
      return res.status(400).json({ message: "Token không hợp lệ hoặc đã hết hạn." });

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    sendEmail({
      to: user.email,
      subject: "Mật khẩu vừa được đổi - Room Management",
      ...passwordChangedTemplate({ userName: user.name }),
    }).catch((mailErr) => logError("Send password-changed email error:", mailErr));

    res.json({ message: "Đổi mật khẩu thành công." });
  } catch (err) {
    logError("Reset password error:", err);
    res.status(500).json({ message: "Lỗi server. Vui lòng thử lại." });
  }
});

// PUT /api/auth/change-password
router.put("/change-password", protect, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword)
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin." });

    if (newPassword !== confirmPassword)
      return res.status(400).json({ message: "Mật khẩu xác nhận không khớp." });

    const passErr = validatePassword(newPassword);
    if (passErr) return res.status(400).json({ message: passErr });

    // Lấy user kèm password
    const user = await User.findById(req.user._id).select("+password");
    if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng." });

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) return res.status(400).json({ message: "Mật khẩu hiện tại không đúng." });

    user.password = newPassword;
    await user.save();

    res.json({ message: "Đổi mật khẩu thành công." });
  } catch (err) {
    logError("Change password error:", err);
    res.status(500).json({ message: "Lỗi server. Vui lòng thử lại." });
  }
});

// GET /api/auth/sessions
router.get("/sessions", protect, async (req, res) => {
  try {
    // Lấy IP thực của client
    const ip =
      (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
      req.socket?.remoteAddress ||
      req.ip ||
      "";

    // Detect browser & OS từ User-Agent
    const ua = req.headers["user-agent"] || "";
    let browser = "Trình duyệt không xác định";
    let device = "Thiết bị không xác định";

    if (/Edg\//.test(ua)) browser = "Microsoft Edge";
    else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = "Google Chrome";
    else if (/Firefox\//.test(ua)) browser = "Mozilla Firefox";
    else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = "Safari";
    else if (/OPR\/|Opera\//.test(ua)) browser = "Opera";

    if (/Windows NT 11\.0|Windows NT 10\.0/.test(ua)) device = "Windows";
    else if (/Macintosh/.test(ua)) device = "macOS";
    else if (/iPhone/.test(ua)) device = "iPhone";
    else if (/Android/.test(ua)) device = "Android";
    else if (/Linux/.test(ua)) device = "Linux";

    // Gọi IP geolocation (free, không cần API key)
    let location = "Việt Nam";
    const isLocalIp =
      !ip || ip === "::1" || ip === "127.0.0.1" || ip.startsWith("192.168.") || ip.startsWith("10.");

    if (!isLocalIp) {
      try {
        const https = require("https");
        const geoData = await new Promise((resolve, reject) => {
          https.get(`https://ip-api.com/json/${ip}?fields=city,country&lang=vi`, (geoRes) => {
            let data = "";
            geoRes.on("data", (chunk) => { data += chunk; });
            geoRes.on("end", () => {
              try { resolve(JSON.parse(data)); }
              catch { resolve({}); }
            });
          }).on("error", reject);
        });
        if (geoData && geoData.city) {
          location = `${geoData.city}, ${geoData.country || "Việt Nam"}`;
        }
      } catch {
        // fallback
      }
    }

    const sessions = [
      {
        id: "current-session",
        device,
        browser,
        location,
        lastActive: "Đang hoạt động",
        isCurrent: true,
      },
    ];
    res.json({ sessions });
  } catch (err) {
    logError("Get sessions error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
});

// DELETE /api/auth/sessions/:id
router.delete("/sessions/:id", protect, async (req, res) => {
  try {
    // Mô phỏng: không cho đăng xuất session hiện tại
    if (req.params.id === "current-session")
      return res.status(400).json({ message: "Không thể đăng xuất thiết bị hiện tại." });

    res.json({ message: "Đã đăng xuất thiết bị." });
  } catch (err) {
    logError("Logout session error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
});

// POST /api/auth/send-verification
router.post("/send-verification", protect, async (req, res) => {
  try {
    const user = req.user;

    if (user.isEmailVerified) {
      return res.status(400).json({ message: "Email của bạn đã được xác minh." });
    }

    // Sinh token xác minh
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

    user.emailVerificationToken = hashedToken;
    user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24h
    await user.save({ validateBeforeSave: false });

    const verificationUrl = `${process.env.CLIENT_URL}/verify-email/${rawToken}`;
    const { html, text } = emailVerificationTemplate({ userName: user.name, verificationUrl });

    try {
      await sendEmail({
        to: user.email,
        subject: "Xác minh email - Room Management",
        html,
        text,
      });
    } catch (mailErr) {
      await User.updateOne(
        { _id: user._id },
        { $unset: { emailVerificationToken: "", emailVerificationExpires: "" } },
      );
      logError("Send verification email error:", mailErr);
      return res.status(500).json({ message: "Không gửi được email. Vui lòng thử lại." });
    }

    res.json({ message: "Mã xác minh đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư." });
  } catch (err) {
    logError("Send verification error:", err);
    res.status(500).json({ message: "Lỗi server. Vui lòng thử lại." });
  }
});

// GET /api/auth/verify-email/:token
router.get("/verify-email/:token", async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) return res.status(400).json({ message: "Thiếu token xác minh." });

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Tìm user có token (kể cả đã hết hạn)
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
    }).select("+emailVerificationToken +emailVerificationExpires");

    if (!user) {
      console.log("[verify-email] Token not found or already consumed.");
      return res.status(400).json({ message: "Liên kết xác minh không hợp lệ hoặc đã được sử dụng." });
    }

    // Nếu email chưa verified và token còn hạn → verify
    if (!user.isEmailVerified && user.emailVerificationExpires > Date.now()) {
      user.isEmailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      await user.save({ validateBeforeSave: false });

      sendEmail({
        to: user.email,
        subject: "Email đã được xác minh - Room Management",
        ...emailVerifiedTemplate({ userName: user.name }),
      }).catch((mailErr) => logError("Send email-verified email error:", mailErr));
    }

    // Tạo JWT để frontend lưu vào sessionStorage (cho tab mới)
    const newToken = signToken(user._id);

    res.json({
      message: user.isEmailVerified ? "Email này đã được xác minh trước đó!" : "Xác minh email thành công!",
      token: newToken,
      user: formatUser(user),
      redirect: `${process.env.CLIENT_URL}/profile/security?verified=true`,
    });
  } catch (err) {
    logError("Verify email error:", err);
    res.status(500).json({ message: "Lỗi server. Vui lòng thử lại." });
  }
});

// GET /api/auth/me
router.get("/me", protect, async (req, res) => {
  res.json(formatUser(req.user));
});

// PUT /api/auth/profile — cập nhật thông tin cá nhân
router.put("/profile", protect, async (req, res) => {
  try {
    const allowed = ["name", "phone", "dob", "gender", "occupation", "address", "idCard", "idCardDate", "avatar"];
    const user = req.user;

    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        if (field === "name" && !req.body[field].trim())
          return res.status(400).json({ message: "Tên không được để trống." });
        user[field] = typeof req.body[field] === "string" ? req.body[field].trim() : req.body[field];
      }
    }

    await user.save();
    res.json({ message: "Cập nhật thông tin thành công.", user: formatUser(user) });
  } catch (err) {
    logError("Update profile error:", err);
    res.status(500).json({ message: "Lỗi server. Vui lòng thử lại." });
  }
});

module.exports = router;