process.env.JWT_SECRET = "test-jwt-secret";

const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const User = require("../models/User");
const serviceRoutes = require("../routes/services");
const { createUser, tokenFor } = require("./testHelpers");

let mongoServer;
let app;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  app = express();
  app.use(express.json());
  app.use("/api/services", serviceRoutes);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
});

describe("GET /api/services/images/search", () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.PIXABAY_API_KEY;

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.PIXABAY_API_KEY;
    else process.env.PIXABAY_API_KEY = originalKey;
  });

  test("tenant không được tìm ảnh → 403", async () => {
    process.env.PIXABAY_API_KEY = "fake-key";
    const tenant = await createUser("tenant");
    const res = await request(app)
      .get("/api/services/images/search?q=giuong")
      .set("Authorization", `Bearer ${tokenFor(tenant)}`);
    expect(res.status).toBe(403);
  });

  test("thiếu PIXABAY_API_KEY → 503", async () => {
    delete process.env.PIXABAY_API_KEY;
    const admin = await createUser("admin");
    const res = await request(app)
      .get("/api/services/images/search?q=giuong")
      .set("Authorization", `Bearer ${tokenFor(admin)}`);
    expect(res.status).toBe(503);
  });

  test("thiếu q → 400", async () => {
    process.env.PIXABAY_API_KEY = "fake-key";
    const admin = await createUser("admin");
    const res = await request(app)
      .get("/api/services/images/search")
      .set("Authorization", `Bearer ${tokenFor(admin)}`);
    expect(res.status).toBe(400);
  });

  test("tìm ảnh thành công trả về danh sách rút gọn", async () => {
    process.env.PIXABAY_API_KEY = "fake-key";
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        hits: [
          { id: 1, previewURL: "https://pixabay.com/thumb1.jpg", webformatURL: "https://pixabay.com/full1.jpg" },
        ],
      }),
    });
    const admin = await createUser("admin");
    const res = await request(app)
      .get("/api/services/images/search?q=giuong")
      .set("Authorization", `Bearer ${tokenFor(admin)}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 1, thumbnailUrl: "https://pixabay.com/thumb1.jpg", imageUrl: "https://pixabay.com/full1.jpg" }]);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("q=giuong"));
  });

  test("Pixabay lỗi → 502", async () => {
    process.env.PIXABAY_API_KEY = "fake-key";
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    const admin = await createUser("admin");
    const res = await request(app)
      .get("/api/services/images/search?q=giuong")
      .set("Authorization", `Bearer ${tokenFor(admin)}`);
    expect(res.status).toBe(502);
  });
});
