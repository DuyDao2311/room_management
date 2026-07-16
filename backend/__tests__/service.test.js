process.env.JWT_SECRET = "test-jwt-secret";

const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const User = require("../models/User");
const Service = require("../models/Service");
const ServiceBooking = require("../models/ServiceBooking");
const Notification = require("../models/Notification");
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
  await Service.deleteMany({});
  await ServiceBooking.deleteMany({});
  await Notification.deleteMany({});
});

const VALID_SERVICE = {
  name: "Dọn phòng",
  category: "cleaning",
  price: 100000,
  unit: "lần",
};

describe("POST /api/services", () => {
  test("admin tạo dịch vụ thành công", async () => {
    const admin = await createUser("admin");
    const res = await request(app)
      .post("/api/services")
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .send(VALID_SERVICE);

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Dọn phòng");
    expect(res.body.isActive).toBe(true);
    expect(res.body.avgRating).toBe(0);
  });

  test("tenant không được tạo dịch vụ → 403", async () => {
    const tenant = await createUser("tenant");
    const res = await request(app)
      .post("/api/services")
      .set("Authorization", `Bearer ${tokenFor(tenant)}`)
      .send(VALID_SERVICE);

    expect(res.status).toBe(403);
  });

  test("thiếu field bắt buộc → 400", async () => {
    const admin = await createUser("admin");
    const res = await request(app)
      .post("/api/services")
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .send({ name: "Thiếu giá" });

    expect(res.status).toBe(400);
  });

  test("tạo dịch vụ với đơn vị tính tự do (không thuộc enum cũ) vẫn thành công", async () => {
    const admin = await createUser("admin");
    const res = await request(app)
      .post("/api/services")
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .send({ ...VALID_SERVICE, unit: "kg" });

    expect(res.status).toBe(201);
    expect(res.body.unit).toBe("kg");
  });
});

describe("GET /api/services", () => {
  test("guest chỉ thấy dịch vụ isActive:true", async () => {
    await Service.create({ ...VALID_SERVICE, name: "Active", isActive: true });
    await Service.create({ ...VALID_SERVICE, name: "Inactive", isActive: false });

    const res = await request(app).get("/api/services");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("Active");
  });

  test("admin thấy cả dịch vụ inactive", async () => {
    const admin = await createUser("admin");
    await Service.create({ ...VALID_SERVICE, name: "Active", isActive: true });
    await Service.create({ ...VALID_SERVICE, name: "Inactive", isActive: false });

    const res = await request(app)
      .get("/api/services")
      .set("Authorization", `Bearer ${tokenFor(admin)}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  test("filter theo category", async () => {
    await Service.create({ ...VALID_SERVICE, name: "Dọn phòng", category: "cleaning" });
    await Service.create({ ...VALID_SERVICE, name: "Đưa đón", category: "transport" });

    const res = await request(app).get("/api/services?category=transport");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("Đưa đón");
  });
});

describe("GET /api/services/:id", () => {
  test("guest xem dịch vụ inactive → 404 (ẩn khỏi public), message rõ ràng", async () => {
    const service = await Service.create({ ...VALID_SERVICE, isActive: false });

    const res = await request(app).get(`/api/services/${service._id}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Dịch vụ này hiện đã tạm ngừng kinh doanh.");
  });

  test("admin xem dịch vụ inactive → 200", async () => {
    const admin = await createUser("admin");
    const service = await Service.create({ ...VALID_SERVICE, isActive: false });

    const res = await request(app)
      .get(`/api/services/${service._id}`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`);

    expect(res.status).toBe(200);
  });
});

describe("PUT /api/services/:id", () => {
  test("staff sửa giá dịch vụ", async () => {
    const staff = await createUser("staff");
    const service = await Service.create(VALID_SERVICE);

    const res = await request(app)
      .put(`/api/services/${service._id}`)
      .set("Authorization", `Bearer ${tokenFor(staff)}`)
      .send({ price: 150000 });

    expect(res.status).toBe(200);
    expect(res.body.price).toBe(150000);
  });

  test("tạm ngừng dịch vụ (isActive true→false) → báo cho tenant có booking pending/confirmed, không đụng completed/cancelled/dịch vụ khác", async () => {
    const admin = await createUser("admin");
    const tenantPending = await createUser("tenant");
    const tenantConfirmed = await createUser("tenant");
    const tenantCompleted = await createUser("tenant");
    const tenantCancelled = await createUser("tenant");
    const tenantOtherService = await createUser("tenant");
    const service = await Service.create(VALID_SERVICE);
    const otherService = await Service.create({ ...VALID_SERVICE, name: "Dịch vụ khác" });

    await ServiceBooking.create({
      service: service._id, tenant: tenantPending._id, scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      quantity: 1, unitPrice: 100000, totalAmount: 100000, status: "pending",
    });
    await ServiceBooking.create({
      service: service._id, tenant: tenantConfirmed._id, scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      quantity: 1, unitPrice: 100000, totalAmount: 100000, status: "confirmed",
    });
    await ServiceBooking.create({
      service: service._id, tenant: tenantCompleted._id, scheduledAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      quantity: 1, unitPrice: 100000, totalAmount: 100000, status: "completed",
    });
    await ServiceBooking.create({
      service: service._id, tenant: tenantCancelled._id, scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      quantity: 1, unitPrice: 100000, totalAmount: 100000, status: "cancelled",
    });
    await ServiceBooking.create({
      service: otherService._id, tenant: tenantOtherService._id, scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      quantity: 1, unitPrice: 100000, totalAmount: 100000, status: "pending",
    });

    const res = await request(app)
      .put(`/api/services/${service._id}`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);

    const notifPending = await Notification.findOne({ userId: tenantPending._id, type: "SERVICE" });
    const notifConfirmed = await Notification.findOne({ userId: tenantConfirmed._id, type: "SERVICE" });
    const notifCompleted = await Notification.findOne({ userId: tenantCompleted._id, type: "SERVICE" });
    const notifCancelled = await Notification.findOne({ userId: tenantCancelled._id, type: "SERVICE" });
    const notifOtherService = await Notification.findOne({ userId: tenantOtherService._id, type: "SERVICE" });

    expect(notifPending).toBeTruthy();
    expect(notifConfirmed).toBeTruthy();
    expect(notifCompleted).toBeNull();
    expect(notifCancelled).toBeNull();
    expect(notifOtherService).toBeNull();
  });

  test("sửa dịch vụ nhưng không đổi isActive → không gửi thông báo", async () => {
    const admin = await createUser("admin");
    const tenant = await createUser("tenant");
    const service = await Service.create(VALID_SERVICE);
    await ServiceBooking.create({
      service: service._id, tenant: tenant._id, scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      quantity: 1, unitPrice: 100000, totalAmount: 100000, status: "pending",
    });

    const res = await request(app)
      .put(`/api/services/${service._id}`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .send({ price: 200000 });

    expect(res.status).toBe(200);
    const notif = await Notification.findOne({ userId: tenant._id, type: "SERVICE" });
    expect(notif).toBeNull();
  });
});

describe("GET /api/services/:id/reviews", () => {
  test("trả review công khai, KHÔNG có email/phone của tenant", async () => {
    const tenant = await createUser("tenant");
    const service = await Service.create(VALID_SERVICE);
    await ServiceBooking.create({
      service: service._id, tenant: tenant._id,
      quantity: 1, unitPrice: 100000, totalAmount: 100000,
      scheduledAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      status: "completed", rating: 5, review: "Tuyệt vời", tags: ["Sạch sẽ"],
    });

    const res = await request(app).get(`/api/services/${service._id}/reviews`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].rating).toBe(5);
    expect(res.body[0].tags).toEqual(["Sạch sẽ"]);
    expect(res.body[0].tenant.name).toBeTruthy();
    expect(res.body[0].tenant.email).toBeUndefined();
    expect(res.body[0].tenant.phone).toBeUndefined();
  });

  test("booking chưa rating → không xuất hiện trong danh sách review", async () => {
    const tenant = await createUser("tenant");
    const service = await Service.create(VALID_SERVICE);
    await ServiceBooking.create({
      service: service._id, tenant: tenant._id,
      quantity: 1, unitPrice: 100000, totalAmount: 100000,
      scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      status: "pending",
    });

    const res = await request(app).get(`/api/services/${service._id}/reviews`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});

describe("DELETE /api/services/:id", () => {
  test("admin xóa dịch vụ chưa có booking → 200, xóa thật khỏi DB", async () => {
    const admin = await createUser("admin");
    const service = await Service.create(VALID_SERVICE);

    const res = await request(app)
      .delete(`/api/services/${service._id}`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`);

    expect(res.status).toBe(200);
    const found = await Service.findById(service._id);
    expect(found).toBeNull();
  });

  test("dịch vụ đã có booking → 409, không xóa", async () => {
    const admin = await createUser("admin");
    const tenant = await createUser("tenant");
    const service = await Service.create(VALID_SERVICE);
    await ServiceBooking.create({
      service: service._id, tenant: tenant._id,
      scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      quantity: 1, unitPrice: 100000, totalAmount: 100000,
    });

    const res = await request(app)
      .delete(`/api/services/${service._id}`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/1 lượt đặt/);
    const found = await Service.findById(service._id);
    expect(found).not.toBeNull();
  });

  test("tenant không được xóa dịch vụ → 403", async () => {
    const tenant = await createUser("tenant");
    const service = await Service.create(VALID_SERVICE);

    const res = await request(app)
      .delete(`/api/services/${service._id}`)
      .set("Authorization", `Bearer ${tokenFor(tenant)}`);

    expect(res.status).toBe(403);
  });

  test("id không tồn tại → 404", async () => {
    const admin = await createUser("admin");
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .delete(`/api/services/${fakeId}`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`);

    expect(res.status).toBe(404);
  });
});

