const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Xác thực JWT token
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

// Chỉ admin mới được phép
const adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res
      .status(403)
      .json({ message: "Chỉ quản trị viên mới có quyền thực hiện thao tác này." });
  }
  next();
};

module.exports = { protect, adminOnly };
