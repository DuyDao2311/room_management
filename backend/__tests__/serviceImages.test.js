process.env.JWT_SECRET = "test-jwt-secret";

const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const User = require("../models/User");
const serviceRoutes = require("../routes/services");
const { createUser, tokenFor } = require("./testHelpers");
const { uploadServiceImagesHandler } = require("../controllers/serviceImageController");

jest.mock("../middleware/upload", () => ({
  uploadServiceImages: (req, res, next) => next(),
}));

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
