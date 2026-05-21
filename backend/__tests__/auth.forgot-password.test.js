// Integration tests cho forgot-password / reset-password flow.
// Dùng mongodb-memory-server → không động vào DB thật.
// Mock sendEmail → không gọi Gmail thật.

process.env.JWT_SECRET = "test-jwt-secret";
process.env.JWT_EXPIRES_IN = "1h";
process.env.CLIENT_URL = "http://localhost:5173";
process.env.EMAIL_USER = "test@example.com";
process.env.EMAIL_PASS = "test-password";

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

const TEST_EMAIL = "test@example.com";
const VALID_PASSWORD = "newpass123";

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
  // Reset implementation (rollback test dùng mockRejectedValueOnce có thể leak).
  sendEmail.mockResolvedValue();
});

async function createTestUser(overrides = {}) {
  return User.create({
    name: "Test User",
    email: TEST_EMAIL,
    password: "oldpass123",
    role: "tenant",
    isActive: true,
    ...overrides,
  });
}

// HTTP helpers — giảm boilerplate request(app).post(...).send(...).
const postForgot = (body) =>
  request(app).post("/api/auth/forgot-password").send(body);
const postReset = (body) =>
  request(app).post("/api/auth/reset-password").send(body);

// Đợi tick I/O kế tiếp — cần khi route fire-and-forget (vd email cảnh báo
// sau reset). `setImmediate` queue chạy SAU mọi microtask hiện tại,
// đủ để await `sendEmail(...)` của fire-and-forget settle.
const flushPendingIO = () => new Promise((r) => setImmediate(r));

describe("POST /api/auth/forgot-password", () => {
  test("email tồn tại + active → 200, lưu token, gửi email", async () => {
    await createTestUser();

    const res = await postForgot({ email: TEST_EMAIL });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/kiểm tra email/i);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: TEST_EMAIL,
        subject: expect.stringMatching(/đặt lại mật khẩu/i),
      }),
    );

    const user = await User.findOne({ email: TEST_EMAIL }).select(
      "+resetPasswordToken +resetPasswordExpires",
    );
    expect(user.resetPasswordToken).toBeTruthy();
    expect(user.resetPasswordToken).toHaveLength(64);
    expect(user.resetPasswordExpires.getTime()).toBeGreaterThan(Date.now());
  });

  test("email không tồn tại → 404, response chứa email (DEVIATION leak)", async () => {
    const res = await postForgot({ email: "unknown@example.com" });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/chưa được đăng ký/i);
    expect(res.body.message).toContain("unknown@example.com");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test.each([
    ["format sai", { email: "khong-co-cham" }, /định dạng/i],
    ["chuỗi rỗng", { email: "" }, /vui lòng nhập/i],
    ["field thiếu", {}, /không hợp lệ/i],
    ["NoSQL injection", { email: { $ne: null } }, /không hợp lệ/i],
  ])("validation: %s → 400", async (_label, body, msgRe) => {
    const res = await postForgot(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(msgRe);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test("email có khoảng trắng + hoa thường lẫn lộn → normalize và match đúng", async () => {
    await createTestUser({ email: TEST_EMAIL });

    const res = await postForgot({ email: "  TEST@example.com  " });

    expect(res.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  test("user bị isActive: false → 404 (treat như không tồn tại)", async () => {
    await createTestUser({ isActive: false });

    const res = await postForgot({ email: TEST_EMAIL });

    expect(res.status).toBe(404);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test("multi-user trong DB: gửi đúng email cho user request", async () => {
    await Promise.all([
      createTestUser({ name: "Alice", email: "alice@example.com" }),
      createTestUser({ name: "Bob", email: "bob@example.com" }),
    ]);

    await postForgot({ email: "bob@example.com" });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "bob@example.com" }),
    );
  });

  test("nếu sendEmail throw → rollback token + 500", async () => {
    await createTestUser();
    sendEmail.mockRejectedValueOnce(new Error("SMTP down"));

    const res = await postForgot({ email: TEST_EMAIL });

    expect(res.status).toBe(500);

    const user = await User.findOne({ email: TEST_EMAIL }).select(
      "+resetPasswordToken +resetPasswordExpires",
    );
    expect(user.resetPasswordToken).toBeUndefined();
    expect(user.resetPasswordExpires).toBeUndefined();
  });
});

describe("POST /api/auth/reset-password", () => {
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

  test("token đúng + password đủ → 200, đổi password, xóa token, gửi email cảnh báo", async () => {
    const { rawToken, user } = await setupValidResetToken();

    const res = await postReset({
      token: rawToken,
      newPassword: VALID_PASSWORD,
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/thành công/i);

    const updated = await User.findById(user._id).select(
      "+password +resetPasswordToken +resetPasswordExpires",
    );
    expect(updated.resetPasswordToken).toBeUndefined();
    expect(updated.resetPasswordExpires).toBeUndefined();
    expect(await updated.comparePassword(VALID_PASSWORD)).toBe(true);

    // Email cảnh báo fire-and-forget → đợi I/O tick trước khi assert.
    await flushPendingIO();
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: TEST_EMAIL,
        subject: expect.stringMatching(/vừa được đổi/i),
      }),
    );
  });

  test("password đúng 6 ký tự (boundary) → 200", async () => {
    const { rawToken } = await setupValidResetToken();

    const res = await postReset({ token: rawToken, newPassword: "abcdef" });

    expect(res.status).toBe(200);
    await flushPendingIO();
  });

  test("token sai → 400", async () => {
    await setupValidResetToken();

    const res = await postReset({
      token: "x".repeat(64),
      newPassword: VALID_PASSWORD,
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/không hợp lệ/i);
  });

  test("token hết hạn → 400", async () => {
    const { rawToken, user } = await setupValidResetToken();
    await User.updateOne(
      { _id: user._id },
      { $set: { resetPasswordExpires: new Date(Date.now() - 1000) } },
    );

    const res = await postReset({
      token: rawToken,
      newPassword: VALID_PASSWORD,
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/hết hạn/i);
  });

  test("token đã dùng 1 lần → lần 2 fail (single-use)", async () => {
    const { rawToken } = await setupValidResetToken();

    const first = await postReset({
      token: rawToken,
      newPassword: VALID_PASSWORD,
    });
    expect(first.status).toBe(200);

    const second = await postReset({
      token: rawToken,
      newPassword: "anothernewpass",
    });
    expect(second.status).toBe(400);
  });

  test("password < 6 ký tự → 400", async () => {
    const { rawToken } = await setupValidResetToken();

    const res = await postReset({ token: rawToken, newPassword: "abc" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/6 ký tự/i);
  });

  test("token là object (NoSQL injection) → 400", async () => {
    const res = await postReset({
      token: { $ne: null },
      newPassword: VALID_PASSWORD,
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/thiếu token/i);
  });

  test("token rỗng → 400", async () => {
    const res = await postReset({ newPassword: VALID_PASSWORD });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/thiếu token/i);
  });

  test("newPassword rỗng → 400", async () => {
    const { rawToken } = await setupValidResetToken();

    const res = await postReset({ token: rawToken });

    expect(res.status).toBe(400);
  });
});
