process.env.JWT_SECRET = "test-jwt-secret";

const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const User = require("../models/User");

jest.mock("../middleware/upload", () => ({
  cloudinary: { uploader: { upload: jest.fn() } },
  uploadServiceImages: (req, res, next) => next(),
}));

const mockGenerateContent = jest.fn();
jest.mock("@google/genai", () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent: mockGenerateContent },
  })),
}));

const serviceRoutes = require("../routes/services");
const { createUser, tokenFor } = require("./testHelpers");
const { cloudinary } = require("../middleware/upload");

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

describe("POST /api/services/images/import", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("tenant không được import ảnh → 403", async () => {
    const tenant = await createUser("tenant");
    const res = await request(app)
      .post("/api/services/images/import")
      .set("Authorization", `Bearer ${tokenFor(tenant)}`)
      .send({ imageUrl: "https://pixabay.com/full1.jpg" });
    expect(res.status).toBe(403);
  });

  test("thiếu imageUrl → 400", async () => {
    const admin = await createUser("admin");
    const res = await request(app)
      .post("/api/services/images/import")
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test("imageUrl không phải domain pixabay.com → 400", async () => {
    const admin = await createUser("admin");
    const res = await request(app)
      .post("/api/services/images/import")
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .send({ imageUrl: "https://evil.example.com/a.jpg" });
    expect(res.status).toBe(400);
  });

  test("import thành công trả về url Cloudinary", async () => {
    cloudinary.uploader.upload.mockResolvedValue({ secure_url: "https://res.cloudinary.com/demo/services/a.jpg" });
    const admin = await createUser("admin");
    const res = await request(app)
      .post("/api/services/images/import")
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .send({ imageUrl: "https://pixabay.com/full1.jpg" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ url: "https://res.cloudinary.com/demo/services/a.jpg" });
    expect(cloudinary.uploader.upload).toHaveBeenCalledWith(
      "https://pixabay.com/full1.jpg",
      { folder: "room_management/services" }
    );
  });

  test("Cloudinary lỗi → 502", async () => {
    cloudinary.uploader.upload.mockRejectedValue(new Error("cloudinary down"));
    const admin = await createUser("admin");
    const res = await request(app)
      .post("/api/services/images/import")
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .send({ imageUrl: "https://pixabay.com/full1.jpg" });
    expect(res.status).toBe(502);
  });
});

const { uploadServiceImagesHandler } = require("../controllers/serviceImageController");

describe("uploadServiceImagesHandler", () => {
  test("map req.files sang mảng URL", async () => {
    const req = {
      files: [
        { path: "https://res.cloudinary.com/demo/services/a.jpg" },
        { path: "https://res.cloudinary.com/demo/services/b.jpg" },
      ],
    };
    const res = { json: jest.fn() };
    await uploadServiceImagesHandler(req, res);
    expect(res.json).toHaveBeenCalledWith({
      urls: ["https://res.cloudinary.com/demo/services/a.jpg", "https://res.cloudinary.com/demo/services/b.jpg"],
    });
  });

  test("không có file nào → mảng rỗng", async () => {
    const req = { files: [] };
    const res = { json: jest.fn() };
    await uploadServiceImagesHandler(req, res);
    expect(res.json).toHaveBeenCalledWith({ urls: [] });
  });
});

describe("POST /api/services/images/upload", () => {
  test("tenant không được upload ảnh → 403", async () => {
    const tenant = await createUser("tenant");
    const res = await request(app)
      .post("/api/services/images/upload")
      .set("Authorization", `Bearer ${tokenFor(tenant)}`);
    expect(res.status).toBe(403);
  });

  test("admin không đính kèm file → trả về mảng rỗng", async () => {
    const admin = await createUser("admin");
    const res = await request(app)
      .post("/api/services/images/upload")
      .set("Authorization", `Bearer ${tokenFor(admin)}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ urls: [] });
  });
});

describe("POST /api/services/images/generate", () => {
  const originalKey = process.env.GEMINI_API_KEY;

  afterEach(() => {
    jest.clearAllMocks();
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  });

  test("tenant không được tạo ảnh AI → 403", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    const tenant = await createUser("tenant");
    const res = await request(app)
      .post("/api/services/images/generate")
      .set("Authorization", `Bearer ${tokenFor(tenant)}`)
      .send({ prompt: "ảnh giường ngủ" });
    expect(res.status).toBe(403);
  });

  test("thiếu GEMINI_API_KEY → 503", async () => {
    delete process.env.GEMINI_API_KEY;
    const admin = await createUser("admin");
    const res = await request(app)
      .post("/api/services/images/generate")
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .send({ prompt: "ảnh giường ngủ" });
    expect(res.status).toBe(503);
  });

  test("thiếu prompt → 400", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    const admin = await createUser("admin");
    const res = await request(app)
      .post("/api/services/images/generate")
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test("Gemini không trả ảnh (bị chặn/an toàn) → 502", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    mockGenerateContent.mockResolvedValue({
      candidates: [{ content: { parts: [{ text: "Xin lỗi, tôi không thể tạo ảnh này." }] } }],
    });
    const admin = await createUser("admin");
    const res = await request(app)
      .post("/api/services/images/generate")
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .send({ prompt: "ảnh giường ngủ" });
    expect(res.status).toBe(502);
  });

  test("tạo ảnh thành công → upload Cloudinary, trả url", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    mockGenerateContent.mockResolvedValue({
      candidates: [
        { content: { parts: [{ inlineData: { mimeType: "image/png", data: "ZmFrZWJhc2U2NA==" } }] } },
      ],
    });
    cloudinary.uploader.upload.mockResolvedValue({ secure_url: "https://res.cloudinary.com/demo/services/ai1.jpg" });
    const admin = await createUser("admin");
    const res = await request(app)
      .post("/api/services/images/generate")
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .send({ prompt: "ảnh giường ngủ khách sạn" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ url: "https://res.cloudinary.com/demo/services/ai1.jpg" });
    expect(cloudinary.uploader.upload).toHaveBeenCalledWith(
      "data:image/png;base64,ZmFrZWJhc2U2NA==",
      { folder: "room_management/services" }
    );
  });

  test("Gemini lỗi → 502", async () => {
    process.env.GEMINI_API_KEY = "fake-key";
    mockGenerateContent.mockRejectedValue(new Error("gemini down"));
    const admin = await createUser("admin");
    const res = await request(app)
      .post("/api/services/images/generate")
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .send({ prompt: "ảnh giường ngủ" });
    expect(res.status).toBe(502);
  });
});
