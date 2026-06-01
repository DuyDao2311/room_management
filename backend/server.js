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
const paymentRoutes = require("./routes/payment");
const adminRoutes = require("./routes/admin");
const appointmentRoutes = require("./routes/appointments");
const chatRoutes = require("./routes/chat");
const notificationRoutes = require("./routes/notifications");
const feedbackRoutes = require("./routes/feedback");
const favoriteRoutes = require("./routes/favorites");
const { checkExpiringContracts, checkOverdueInvoices, checkDueSoonInvoices } = require("./utils/notificationService");

const app = express();

// Tin tưởng 1 layer proxy phía trước (vd: nginx, Vercel, Render).
// Bắt buộc để express-rate-limit lấy đúng client IP qua header X-Forwarded-For.
// KHÔNG đặt = true (any proxy) vì sẽ cho phép spoof IP qua header.
app.set("trust proxy", 1);

// ─── Middleware ───────────────────────────────────────────────
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://room-management-pearl.vercel.app" // Tên miền Vercel của bạn
];
const corsOptions = {
  origin: function (origin, callback) {
    // cho phép các request không có origin (như Postman hoặc mobile app) 
    // hoặc origin nằm trong danh sách cho phép
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("CORS policy: Domain này không được phép truy cập!"));
    }
  },
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

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

  // Admin/Staff join room theo role để nhận thông báo cash payment
  if (socket.user.role === "admin") {
    socket.join("admin_room");
  }
  if (socket.user.role === "staff") {
    socket.join("staff_room");
    // Join room cho từng district được phân công
    if (socket.user.managedDistricts && socket.user.managedDistricts.length > 0) {
      socket.user.managedDistricts.forEach((d) => {
        socket.join(`district_${d}`);
      });
    }
  }

  console.log(`🔌 Socket connected: ${socket.user.name} (${userId}) [${socket.user.role}]`);

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
app.use("/api/payment", paymentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/favorites", favoriteRoutes);

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

// ─── Periodic checks ───────────────────────────────────────────
// Kiểm tra hợp đồng sắp hết hạn và hóa đơn quá hạn mỗi 6 giờ
const runPeriodicChecks = async () => {
  try {
    console.log('🔍 Kiểm tra hợp đồng sắp hết hạn...');
    const expiringNotifs = await checkExpiringContracts();
    if (expiringNotifs.length > 0) {
      const io = app.get('io');
      expiringNotifs.forEach((n) => {
        io?.to(`tenant_${n.userId}`).emit('new_notification', n);
      });
      console.log(`📨 Đã gửi ${expiringNotifs.length} thông báo hợp đồng sắp hết hạn`);
    }

    console.log('🔍 Kiểm tra hóa đơn quá hạn...');
    const overdueNotifs = await checkOverdueInvoices();
    if (overdueNotifs.length > 0) {
      const io = app.get('io');
      overdueNotifs.forEach((n) => {
        io?.to(`tenant_${n.userId}`).emit('new_notification', n);
      });
      console.log(`📨 Đã gửi ${overdueNotifs.length} thông báo hóa đơn quá hạn`);
    }

    console.log('🔍 Kiểm tra hóa đơn sắp đến hạn (5 ngày)...');
    const dueSoonNotifs = await checkDueSoonInvoices();
    if (dueSoonNotifs.length > 0) {
      const io = app.get('io');
      dueSoonNotifs.forEach((n) => {
        io?.to(`tenant_${n.userId}`).emit('new_notification', n);
      });
      console.log(`📨 Đã gửi ${dueSoonNotifs.length} thông báo hóa đơn sắp đến hạn`);
    }
  } catch (err) {
    console.error('Periodic check error:', err.message);
  }
};

// Chạy lần đầu sau 10 giây
setTimeout(runPeriodicChecks, 10000);
// Sau đó chạy mỗi 6 giờ
setInterval(runPeriodicChecks, 6 * 60 * 60 * 1000);

// ─── Khởi động server ─────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✅ Server đang chạy tại http://localhost:${PORT}`);
  console.log(`🔌 Socket.io đã sẵn sàng`);
});
