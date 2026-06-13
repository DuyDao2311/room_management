const jwt = require("jsonwebtoken");
const User = require("../models/User");

// ─── Xác thực JWT token ──────────────────────────────────────────────────────
const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res
        .status(401)
        .json({ message: "Không có quyền truy cập. Vui lòng đăng nhập." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user || !user.isActive) {
      return res
        .status(401)
        .json({ message: "Tài khoản không tồn tại hoặc đã bị vô hiệu hóa." });
    }

    req.user = user;
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ message: "Token không hợp lệ hoặc đã hết hạn." });
  }
};

// ─── Optional Auth — dùng cho route public nhưng muốn biết user nếu có ───────
/**
 * Giống `protect` nhưng KHÔNG reject request khi không có token.
 * - Có token hợp lệ → req.user = user document
 * - Không có token hoặc token lỗi → req.user = undefined, tiếp tục bình thường
 *
 * Use case: GET /api/rooms/map — guest xem available rooms, admin/staff xem theo role.
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) return next(); // Không có token → tiếp tục như guest

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (user && user.isActive) {
      req.user = user;
    }
    next();
  } catch {
    // Token lỗi/hết hạn → bỏ qua, coi như guest
    next();
  }
};

// ─── Chỉ admin mới được phép ─────────────────────────────────────────────────
const adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res
      .status(403)
      .json({ message: "Chỉ quản trị viên mới có quyền thực hiện thao tác này." });
  }
  next();
};

// ─── Kiểm tra role linh hoạt ─────────────────────────────────────────────────
/**
 * verifyRole("admin", "staff")
 * Cho phép các role được liệt kê truy cập route.
 */
const verifyRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền thực hiện thao tác này." });
    }
    next();
  };
};

// ─── Inject district filter tự động ──────────────────────────────────────────
/**
 * Middleware tự động tạo req.districtFilter dựa trên role:
 * - Admin: {} (không filter, thấy tất cả)
 * - Staff: { district: { $in: user.managedDistricts } }
 *
 * Controller sẽ merge req.districtFilter vào query.
 * Phải dùng SAU protect và verifyRole.
 */
const injectDistrictFilter = (req, res, next) => {
  if (req.user.role === "admin") {
    req.districtFilter = {};
    return next();
  }

  // Staff: phải có managedDistricts
  if (
    !req.user.managedDistricts ||
    req.user.managedDistricts.length === 0
  ) {
    return res.status(403).json({
      message: "Bạn chưa được phân công khu vực quản lý. Vui lòng liên hệ quản trị viên.",
    });
  }

  req.districtFilter = {
    district: { $in: req.user.managedDistricts },
  };
  next();
};

// ─── Kiểm tra quyền thao tác trên district cụ thể ───────────────────────────
/**
 * Middleware kiểm tra district trong req.body hoặc req.query có nằm
 * trong managedDistricts của staff không.
 *
 * - Admin: bypass (luôn cho phép)
 * - Staff: kiểm tra district ∈ managedDistricts
 *
 * Dùng cho các route tạo/sửa dữ liệu cần chỉ định district.
 */
const checkDistrictPermission = (req, res, next) => {
  // Admin bypass
  if (req.user.role === "admin") {
    return next();
  }

  // Lấy district từ body hoặc query
  const district = req.body.district || req.query.district;

  if (!district) {
    return res.status(400).json({
      message: "Vui lòng chỉ định khu vực (district).",
    });
  }

  if (
    !req.user.managedDistricts ||
    !req.user.managedDistricts.includes(district)
  ) {
    return res.status(403).json({
      message: "Bạn không có quyền thao tác trên khu vực này.",
    });
  }

  next();
};

// ─── Hàm kiểm tra quyền khu vực (Dùng trong Controller) ─────────────────────
/**
 * Hàm kiểm tra xem user có quyền truy cập district này không.
 * Có thể tái sử dụng cho Invoice, Contract, Appointment...
 * Trả về true nếu hợp lệ, false nếu không.
 */
const checkUserDistrictPermission = (user, district) => {
  if (user.role === "admin") return true;
  if (user.role === "staff") {
    return user.managedDistricts && user.managedDistricts.includes(district);
  }
  return false;
};

module.exports = {
  protect,
  optionalAuth,
  adminOnly,
  verifyRole,
  injectDistrictFilter,
  checkDistrictPermission,
  checkUserDistrictPermission,
};
