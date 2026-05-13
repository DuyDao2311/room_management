const jwt  = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Middleware xác thực JWT cho Socket.io.
 * Token lấy từ socket.handshake.auth.token
 * Dùng chung JWT_SECRET với HTTP auth middleware.
 */
const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Unauthorized: Không có token."));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user || !user.isActive) {
      return next(new Error("Unauthorized: Tài khoản không hợp lệ."));
    }

    // Gán user vào socket để dùng trong các event handler
    socket.user = user;
    next();
  } catch (err) {
    return next(new Error("Unauthorized: Token không hợp lệ hoặc đã hết hạn."));
  }
};

module.exports = socketAuth;
