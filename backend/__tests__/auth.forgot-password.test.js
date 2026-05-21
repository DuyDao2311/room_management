// Integration tests cho forgot-password / reset-password flow.
// Dùng mongodb-memory-server → không động vào DB thật.
// Mock sendEmail → không gọi Gmail thật.

process.env.JWT_SECRET = "test-jwt-secret";
process.env.JWT_EXPIRES_IN = "1h";
process.env.CLIENT_URL = "http://localhost:5173";
process.env.EMAIL_USER = "test@example.com";
process.env.EMAIL_PASS = "test-password";

// Mock sendEmail TRƯỚC khi require route → route sẽ dùng bản mock.
jest.mock("../utils/sendEmail", () => jest.fn().mockResolvedValue());

// Mock rate limiter pass-through để test business logic không bị throttle.
// Rate limit chưa có test riêng — TODO nếu sau này cần.
jest.mock("express-rate-limit", () => () => (req, res, next) => next());

const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const crypto = require("crypto");
const { MongoMemoryServer } = require("mongodb-memory-server");

const sendEmail = require("../utils/sendEmail");
const User = require("../models/User");
const authRoutes = require("../routes/auth");

let mongoServer;
let app;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  sendEmail.mockClear();
  sendEmail.mockResolvedValue(); // reset implementation sau mỗi test (vd test
  // rollback dùng mockRejectedValueOnce có thể leak qua test sau nếu không reset)
});

// Helper: tạo user test có sẵn trong DB.
async function createTestUser(overrides = {}) {
  return User.create({
    name: "Test User",
    email: "test@example.com",
    password: "oldpass123",
    role: "tenant",
    isActive: true,
    ...overrides,
  });
}

// Helper: flush pending microtasks. Cần khi route có fire-and-forget promise
// (vd email cảnh báo sau reset-password) — phải đợi promise đó settle trước
// khi assert mock được gọi, tránh race condition giữa các tests.
const flushMicrotasks = () => new Promise((r) => setImmediate(r));

describe("POST /api/auth/forgot-password", () => {
  test("email tồn tại + active → 200, lưu token, gửi email", async () => {
    await createTestUser();

    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "test@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/kiểm tra email/i);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "test@example.com",
        subject: expect.stringMatching(/đặt lại mật khẩu/i),
      }),
    );

    const user = await User.findOne({ email: "test@example.com" }).select(
      "+resetPasswordToken +resetPasswordExpires",
    );
    expect(user.resetPasswordToken).toBeTruthy();
    expect(user.resetPasswordToken).toHaveLength(64);
    expect(user.resetPasswordExpires.getTime()).toBeGreaterThan(Date.now());
  });

  test("email không tồn tại → 404, response chứa email (DEVIATION leak)", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "unknown@example.com" });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/chưa được đăng ký/i);
    expect(res.body.message).toContain("unknown@example.com");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test("email format sai → 400 với message 'định dạng'", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "khong-co-cham" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/định dạng/i);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test("email là chuỗi rỗng → 400 với message 'vui lòng nhập'", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/vui lòng nhập/i);
  });

  test("field email không có trong body → 400 với message 'không hợp lệ'", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/không hợp lệ/i);
  });

  test("email không phải string (NoSQL injection) → 400", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: { $ne: null } });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/không hợp lệ/i);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test("email có khoảng trắng + hoa thường lẫn lộn → normalize và match đúng", async () => {
    await createTestUser({ email: "test@example.com" });

    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "  TEST@example.com  " });

    expect(res.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  test("user bị isActive: false → 404 (treat như không tồn tại)", async () => {
    await createTestUser({ isActive: false });

    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "test@example.com" });

    expect(res.status).toBe(404);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test("multi-user trong DB: gửi đúng email cho user request", async () => {
    await createTestUser({ name: "Alice", email: "alice@example.com" });
    await createTestUser({ name: "Bob", email: "bob@example.com" });

    await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "bob@example.com" });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "bob@example.com" }),
    );
  });

  test("nếu sendEmail throw → rollback token + 500", async () => {
    await createTestUser();
    sendEmail.mockRejectedValueOnce(new Error("SMTP down"));

    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "test@example.com" });

    expect(res.status).toBe(500);

    const user = await User.findOne({ email: "test@example.com" }).select(
      "+resetPasswordToken +resetPasswordExpires",
    );
    expect(user.resetPasswordToken).toBeUndefined();
    expect(user.resetPasswordExpires).toBeUndefined();
  });
});

describe("POST /api/auth/reset-password", () => {
  // Helper: setup user với token reset hợp lệ. Trả về { rawToken, user }.
  async function setupValidResetToken(overrides = {}) {
    const user = await createTestUser(overrides);
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save({ validateBeforeSave: false });
    return { rawToken, user };
  }

  test("token đúng + password ≥ 6 ký tự → 200, đổi password, xóa token, gửi email cảnh báo", async () => {
    const { rawToken, user } = await setupValidResetToken();

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: rawToken, newPassword: "newpass123" });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/thành công/i);

    const updated = await User.findById(user._id).select(
      "+password +resetPasswordToken +resetPasswordExpires",
    );
    expect(updated.resetPasswordToken).toBeUndefined();
    expect(updated.resetPasswordExpires).toBeUndefined();
    const isMatch = await updated.comparePassword("newpass123");
    expect(isMatch).toBe(true);

    // Email "password đã đổi" gửi fire-and-forget → đợi microtask flush.
    await flushMicrotasks();
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "test@example.com",
        subject: expect.stringMatching(/vừa được đổi/i),
      }),
    );
  });

  test("password đúng 6 ký tự (boundary) → 200", async () => {
    const { rawToken } = await setupValidResetToken();

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: rawToken, newPassword: "abcdef" });

    expect(res.status).toBe(200);
    await flushMicrotasks();
  });

  test("token sai → 400", async () => {
    await setupValidResetToken();

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "x".repeat(64), newPassword: "newpass123" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/không hợp lệ/i);
  });

  test("token hết hạn → 400", async () => {
    const { rawToken, user } = await setupValidResetToken();
    await User.updateOne(
      { _id: user._id },
      { $set: { resetPasswordExpires: new Date(Date.now() - 1000) } },
    );

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: rawToken, newPassword: "newpass123" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/hết hạn/i);
  });

  test("token đã dùng 1 lần → lần 2 fail (single-use)", async () => {
    const { rawToken } = await setupValidResetToken();

    const first = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: rawToken, newPassword: "newpass123" });
    expect(first.status).toBe(200);
    await flushMicrotasks(); // đợi notification email gửi xong

    const second = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: rawToken, newPassword: "anothernewpass" });
    expect(second.status).toBe(400);
  });

  test("password < 6 ký tự → 400", async () => {
    const { rawToken } = await setupValidResetToken();

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: rawToken, newPassword: "abc" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/6 ký tự/i);
  });

  test("token là object (NoSQL injection) → 400", async () => {
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: { $ne: null }, newPassword: "newpass123" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/thiếu token/i);
  });

  test("token rỗng → 400", async () => {
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ newPassword: "newpass123" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/thiếu token/i);
  });

  test("newPassword rỗng → 400", async () => {
    const { rawToken } = await setupValidResetToken();

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: rawToken });

    expect(res.status).toBe(400);
  });
});
