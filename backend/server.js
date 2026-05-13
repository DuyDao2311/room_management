require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const connectDB = require("./config/db");
const socketAuth = require("./middleware/socketAuth");

// Routes
const authRoutes = require("./routes/auth");
const roomRoutes = require("./routes/rooms");
const contractRoutes = require("./routes/contracts");
const invoiceRoutes = require("./routes/invoices");
const adminRoutes = require("./routes/admin");
const appointmentRoutes = require("./routes/appointments");
const chatRoutes = require("./routes/chat");
const notificationRoutes = require("./routes/notifications");

const app = express();

// ─── Middleware ───────────────────────────────────────────────
const corsOptions = {
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Kết nối DB ──────────────────────────────────────────────
connectDB();

// ─── HTTP Server + Socket.io ─────────────────────────────────
const server = http.createServer(app);
const io = new Server(server, {
  cors: corsOptions,
});

// Socket.io middleware: xác thực JWT
io.use(socketAuth);

// Socket.io connection handler
io.on("connection", (socket) => {
  const userId = socket.user._id.toString();
  // Mỗi user join vào room riêng để nhận thông báo cá nhân
  socket.join(`tenant_${userId}`);
  console.log(`🔌 Socket connected: ${socket.user.name} (${userId})`);

  socket.on("disconnect", () => {
    console.log(`❌ Socket disconnected: ${socket.user.name} (${userId})`);
  });
});

// Lưu io instance để dùng trong controllers qua req.app.get('io')
app.set("io", io);

// ─── API Routes ───────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/contracts", contractRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/notifications", notificationRoutes);

// ─── Health check ─────────────────────────────────────────────
app.get("/api/health", (_, res) => res.json({ status: "OK", timestamp: new Date() }));

// ─── Global error handler ─────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error("Unhandled error:", err.stack);
  res.status(err.status || 500).json({
    message: err.message || "Lỗi server không xác định.",
  });
});

// ─── 404 handler ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.url} không tồn tại.` });
});

// ─── Khởi động server ─────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✅ Server đang chạy tại http://localhost:${PORT}`);
  console.log(`🔌 Socket.io đã sẵn sàng`);
});