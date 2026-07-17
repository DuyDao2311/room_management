process.env.JWT_SECRET = "test-jwt-secret";

const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const User = require("../models/User");
const Service = require("../models/Service");
const ServiceBooking = require("../models/ServiceBooking");
const Contract = require("../models/Contract");
const Booking = require("../models/Booking");
const serviceBookingRoutes = require("../routes/serviceBookings");
const { createUser, tokenFor } = require("./testHelpers");

let mongoServer;
let app;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  app = express();
  app.use(express.json());
  app.use("/api/service-bookings", serviceBookingRoutes);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Service.deleteMany({});
  await ServiceBooking.deleteMany({});
  await Contract.deleteMany({});
  await Booking.deleteMany({});
  await require("../models/Room").deleteMany({});
});

async function createActiveService(overrides = {}) {
  return Service.create({
    name: "Dọn phòng",
    category: "cleaning",
    price: 100000,
    unit: "lần",
    isActive: true,
    ...overrides,
  });
}

async function createActiveContract(tenant) {
  const room = await require("../models/Room").create({
    name: "Phòng test", address: "123 Test", price: 3000000, area: 20,
  });
  return Contract.create({
    room: room._id, tenant: tenant._id,
    startDate: new Date(), endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    monthlyRent: 3000000, status: "active",
  });
}

async function createCheckedInBooking(tenant) {
  const room = await require("../models/Room").create({
    name: "Phòng ngắn hạn test", address: "456 Test", price: 500000, area: 18,
  });
  return Booking.create({
    room: room._id, tenant: tenant._id,
    bookingType: "day",
    checkInDateTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
    checkOutDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
    unitPrice: 500000, totalAmount: 500000,
    status: "checked_in",
  });
}

const futureDate = (hoursFromNow) => new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);

async function createBooking(overrides = {}) {
  return ServiceBooking.create({
    quantity: 1,
    unitPrice: 100000,
    totalAmount: 100000,
    scheduledAt: futureDate(48),
    ...overrides,
  });
}

describe("POST /api/service-bookings", () => {
  test("tenant đặt dịch vụ thành công, backend tự tính totalAmount", async () => {
    const tenant = await createUser("tenant");
    await createActiveContract(tenant);
    const service = await createActiveService({ price: 100000 });

    const res = await request(app)
      .post("/api/service-bookings")
      .set("Authorization", `Bearer ${tokenFor(tenant)}`)
      .send({ serviceId: service._id, scheduledAt: futureDate(48), quantity: 3 });

    expect(res.status).toBe(201);
    expect(res.body.unitPrice).toBe(100000);
    expect(res.body.totalAmount).toBe(300000);
    expect(res.body.status).toBe("pending");
    expect(res.body.paymentStatus).toBe("unpaid");
  });

  test("gửi totalAmount từ client → bị bỏ qua, backend tự tính lại", async () => {
    const tenant = await createUser("tenant");
    await createActiveContract(tenant);
    const service = await createActiveService({ price: 100000 });

    const res = await request(app)
      .post("/api/service-bookings")
      .set("Authorization", `Bearer ${tokenFor(tenant)}`)
      .send({
        serviceId: service._id,
        scheduledAt: futureDate(48),
        quantity: 2,
        totalAmount: 1, // cố tình gửi sai, phải bị bỏ qua
      });

    expect(res.status).toBe(201);
    expect(res.body.totalAmount).toBe(200000);
  });

  test("admin không được tự đặt dịch vụ (chỉ tenant) → 403", async () => {
    const admin = await createUser("admin");
    const service = await createActiveService();

    const res = await request(app)
      .post("/api/service-bookings")
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .send({ serviceId: service._id, scheduledAt: futureDate(48), quantity: 1 });

    expect(res.status).toBe(403);
  });

  test("đặt dịch vụ đã inactive → 404", async () => {
    const tenant = await createUser("tenant");
    const service = await createActiveService({ isActive: false });

    const res = await request(app)
      .post("/api/service-bookings")
      .set("Authorization", `Bearer ${tokenFor(tenant)}`)
      .send({ serviceId: service._id, scheduledAt: futureDate(48), quantity: 1 });

    expect(res.status).toBe(404);
  });

  test("đặt dịch vụ với scheduledAt ở quá khứ → 400", async () => {
    const tenant = await createUser("tenant");
    const service = await createActiveService();

    const res = await request(app)
      .post("/api/service-bookings")
      .set("Authorization", `Bearer ${tokenFor(tenant)}`)
      .send({ serviceId: service._id, scheduledAt: futureDate(-1), quantity: 1 });

    expect(res.status).toBe(400);
  });

  test("đặt dịch vụ chỉ trước 30 phút (chưa đủ 1 tiếng) → 400", async () => {
    const tenant = await createUser("tenant");
    await createActiveContract(tenant);
    const service = await createActiveService();

    const res = await request(app)
      .post("/api/service-bookings")
      .set("Authorization", `Bearer ${tokenFor(tenant)}`)
      .send({ serviceId: service._id, scheduledAt: futureDate(0.5), quantity: 1 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Thời gian hẹn phải cách hiện tại ít nhất 1 giờ.");
  });

  test("tenant không có hợp đồng active → 403", async () => {
    const tenant = await createUser("tenant");
    const service = await createActiveService();

    const res = await request(app)
      .post("/api/service-bookings")
      .set("Authorization", `Bearer ${tokenFor(tenant)}`)
      .send({ serviceId: service._id, scheduledAt: futureDate(48), quantity: 1 });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Bạn cần đang thuê phòng để đặt dịch vụ này.");
  });

  test("tenant có Booking ngắn hạn đang checked_in (không có Contract dài hạn) → vẫn đặt được", async () => {
    const tenant = await createUser("tenant");
    await createCheckedInBooking(tenant);
    const service = await createActiveService();

    const res = await request(app)
      .post("/api/service-bookings")
      .set("Authorization", `Bearer ${tokenFor(tenant)}`)
      .send({ serviceId: service._id, scheduledAt: futureDate(48), quantity: 1 });

    expect(res.status).toBe(201);
  });
});

describe("GET /api/service-bookings", () => {
  test("tenant chỉ thấy booking của mình", async () => {
    const tenantA = await createUser("tenant");
    const tenantB = await createUser("tenant");
    const service = await createActiveService();

    await createBooking({ service: service._id, tenant: tenantA._id });
    await createBooking({ service: service._id, tenant: tenantB._id });

    const res = await request(app)
      .get("/api/service-bookings")
      .set("Authorization", `Bearer ${tokenFor(tenantA)}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  test("admin thấy tất cả booking", async () => {
    const admin = await createUser("admin");
    const tenantA = await createUser("tenant");
    const tenantB = await createUser("tenant");
    const service = await createActiveService();

    await createBooking({ service: service._id, tenant: tenantA._id });
    await createBooking({ service: service._id, tenant: tenantB._id });

    const res = await request(app)
      .get("/api/service-bookings")
      .set("Authorization", `Bearer ${tokenFor(admin)}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});

describe("GET /api/service-bookings/:id", () => {
  test("tenant xem booking của tenant khác → 403", async () => {
    const tenantA = await createUser("tenant");
    const tenantB = await createUser("tenant");
    const service = await createActiveService();
    const booking = await createBooking({ service: service._id, tenant: tenantB._id });

    const res = await request(app)
      .get(`/api/service-bookings/${booking._id}`)
      .set("Authorization", `Bearer ${tokenFor(tenantA)}`);

    expect(res.status).toBe(403);
  });
});

const Notification = require("../models/Notification");

describe("PUT /api/service-bookings/:id/confirm", () => {
  test("admin confirm booking pending → 200 + tạo Notification", async () => {
    const admin = await createUser("admin");
    const tenant = await createUser("tenant");
    const service = await createActiveService();
    const booking = await createBooking({ service: service._id, tenant: tenant._id });

    const res = await request(app)
      .put(`/api/service-bookings/${booking._id}/confirm`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("confirmed");

    const notif = await Notification.findOne({ userId: tenant._id, type: "SERVICE" });
    expect(notif).toBeTruthy();
  });

  test("confirm booking đã confirmed → 400", async () => {
    const admin = await createUser("admin");
    const tenant = await createUser("tenant");
    const service = await createActiveService();
    const booking = await createBooking({ service: service._id, tenant: tenant._id, status: "confirmed" });

    const res = await request(app)
      .put(`/api/service-bookings/${booking._id}/confirm`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`);

    expect(res.status).toBe(400);
  });

  test("tenant không được confirm → 403", async () => {
    const tenant = await createUser("tenant");
    const service = await createActiveService();
    const booking = await createBooking({ service: service._id, tenant: tenant._id });

    const res = await request(app)
      .put(`/api/service-bookings/${booking._id}/confirm`)
      .set("Authorization", `Bearer ${tokenFor(tenant)}`);

    expect(res.status).toBe(403);
  });
});

describe("PUT /api/service-bookings/:id/complete", () => {
  test("admin complete booking confirmed → 200", async () => {
    const admin = await createUser("admin");
    const tenant = await createUser("tenant");
    const service = await createActiveService();
    const booking = await createBooking({ service: service._id, tenant: tenant._id, status: "confirmed" });

    const res = await request(app)
      .put(`/api/service-bookings/${booking._id}/complete`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("completed");
  });

  test("complete booking đang pending (chưa confirm) → 400", async () => {
    const admin = await createUser("admin");
    const tenant = await createUser("tenant");
    const service = await createActiveService();
    const booking = await createBooking({ service: service._id, tenant: tenant._id });

    const res = await request(app)
      .put(`/api/service-bookings/${booking._id}/complete`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`);

    expect(res.status).toBe(400);
  });
});

describe("PUT /api/service-bookings/:id/cancel", () => {
  test("tenant hủy booking pending, còn > 1h → 200", async () => {
    const tenant = await createUser("tenant");
    const service = await createActiveService();
    const booking = await createBooking({ service: service._id, tenant: tenant._id });

    const res = await request(app)
      .put(`/api/service-bookings/${booking._id}/cancel`)
      .set("Authorization", `Bearer ${tokenFor(tenant)}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("cancelled");
  });

  test("tenant hủy booking pending nhưng còn < 1h → 400", async () => {
    const tenant = await createUser("tenant");
    const service = await createActiveService();
    const booking = await createBooking({ service: service._id, tenant: tenant._id, scheduledAt: futureDate(0.5) });

    const res = await request(app)
      .put(`/api/service-bookings/${booking._id}/cancel`)
      .set("Authorization", `Bearer ${tokenFor(tenant)}`);

    expect(res.status).toBe(400);
  });

  test("tenant hủy booking đã confirmed → 400 (chỉ hủy được lúc pending)", async () => {
    const tenant = await createUser("tenant");
    const service = await createActiveService();
    const booking = await createBooking({ service: service._id, tenant: tenant._id, status: "confirmed" });

    const res = await request(app)
      .put(`/api/service-bookings/${booking._id}/cancel`)
      .set("Authorization", `Bearer ${tokenFor(tenant)}`);

    expect(res.status).toBe(400);
  });

  test("admin hủy booking đã confirmed, không bị giới hạn thời gian → 200", async () => {
    const admin = await createUser("admin");
    const tenant = await createUser("tenant");
    const service = await createActiveService();
    const booking = await createBooking({ service: service._id, tenant: tenant._id, scheduledAt: futureDate(0.1), status: "confirmed" });

    const res = await request(app)
      .put(`/api/service-bookings/${booking._id}/cancel`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("cancelled");
  });

  test("tenant khác không được hủy booking không phải của mình → 403", async () => {
    const tenantA = await createUser("tenant");
    const tenantB = await createUser("tenant");
    const service = await createActiveService();
    const booking = await createBooking({ service: service._id, tenant: tenantB._id });

    const res = await request(app)
      .put(`/api/service-bookings/${booking._id}/cancel`)
      .set("Authorization", `Bearer ${tokenFor(tenantA)}`);

    expect(res.status).toBe(403);
  });
});

describe("PUT /api/service-bookings/:id/pay", () => {
  test("admin đánh dấu paid → 200", async () => {
    const admin = await createUser("admin");
    const tenant = await createUser("tenant");
    const service = await createActiveService();
    const booking = await createBooking({ service: service._id, tenant: tenant._id });

    const res = await request(app)
      .put(`/api/service-bookings/${booking._id}/pay`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`);

    expect(res.status).toBe(200);
    expect(res.body.paymentStatus).toBe("paid");
  });

  test("tenant không được tự đánh dấu paid → 403", async () => {
    const tenant = await createUser("tenant");
    const service = await createActiveService();
    const booking = await createBooking({ service: service._id, tenant: tenant._id });

    const res = await request(app)
      .put(`/api/service-bookings/${booking._id}/pay`)
      .set("Authorization", `Bearer ${tokenFor(tenant)}`);

    expect(res.status).toBe(403);
  });

  test("đánh dấu paid booking đã cancelled → 400", async () => {
    const admin = await createUser("admin");
    const tenant = await createUser("tenant");
    const service = await createActiveService();
    const booking = await createBooking({ service: service._id, tenant: tenant._id, status: "cancelled" });

    const res = await request(app)
      .put(`/api/service-bookings/${booking._id}/pay`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`);

    expect(res.status).toBe(400);
  });
});

describe("PUT /api/service-bookings/:id/rate", () => {
  test("tenant chấm sao booking completed → 200 + Service.avgRating cập nhật + lưu tags hợp lệ, lọc tag lạ", async () => {
    const tenant = await createUser("tenant");
    const service = await createActiveService();
    const booking = await createBooking({ service: service._id, tenant: tenant._id, scheduledAt: futureDate(-2), status: "completed" });

    const res = await request(app)
      .put(`/api/service-bookings/${booking._id}/rate`)
      .set("Authorization", `Bearer ${tokenFor(tenant)}`)
      .send({ rating: 5, review: "Rất tốt", tags: ["Sạch sẽ", "Đúng giờ", "Tag không tồn tại"] });

    expect(res.status).toBe(200);
    expect(res.body.rating).toBe(5);
    expect(res.body.tags).toEqual(["Sạch sẽ", "Đúng giờ"]);

    const updatedService = await Service.findById(service._id);
    expect(updatedService.avgRating).toBe(5);
    expect(updatedService.ratingCount).toBe(1);
  });

  test("avgRating là trung bình của nhiều booking đã rate", async () => {
    const tenant = await createUser("tenant");
    const service = await createActiveService();
    const bookingA = await createBooking({ service: service._id, tenant: tenant._id, scheduledAt: futureDate(-2), status: "completed", rating: 3 });
    const bookingB = await createBooking({ service: service._id, tenant: tenant._id, scheduledAt: futureDate(-2), status: "completed" });

    await request(app)
      .put(`/api/service-bookings/${bookingB._id}/rate`)
      .set("Authorization", `Bearer ${tokenFor(tenant)}`)
      .send({ rating: 5 });

    const updatedService = await Service.findById(service._id);
    expect(updatedService.avgRating).toBe(4); // (3+5)/2
    expect(updatedService.ratingCount).toBe(2);
  });

  test("chấm sao booking chưa completed → 400", async () => {
    const tenant = await createUser("tenant");
    const service = await createActiveService();
    const booking = await createBooking({ service: service._id, tenant: tenant._id, status: "pending" });

    const res = await request(app)
      .put(`/api/service-bookings/${booking._id}/rate`)
      .set("Authorization", `Bearer ${tokenFor(tenant)}`)
      .send({ rating: 5 });

    expect(res.status).toBe(400);
  });

  test("chấm sao 2 lần → lần 2 bị 400", async () => {
    const tenant = await createUser("tenant");
    const service = await createActiveService();
    const booking = await createBooking({ service: service._id, tenant: tenant._id, scheduledAt: futureDate(-2), status: "completed", rating: 4 });

    const res = await request(app)
      .put(`/api/service-bookings/${booking._id}/rate`)
      .set("Authorization", `Bearer ${tokenFor(tenant)}`)
      .send({ rating: 1 });

    expect(res.status).toBe(400);
  });

  test("rating ngoài khoảng 1-5 → 400", async () => {
    const tenant = await createUser("tenant");
    const service = await createActiveService();
    const booking = await createBooking({ service: service._id, tenant: tenant._id, scheduledAt: futureDate(-2), status: "completed" });

    const res = await request(app)
      .put(`/api/service-bookings/${booking._id}/rate`)
      .set("Authorization", `Bearer ${tokenFor(tenant)}`)
      .send({ rating: 6 });

    expect(res.status).toBe(400);
  });

  test("review dài quá 1000 ký tự → 400 (không phải 500)", async () => {
    const tenant = await createUser("tenant");
    const service = await createActiveService();
    const booking = await createBooking({ service: service._id, tenant: tenant._id, scheduledAt: futureDate(-2), status: "completed" });

    const res = await request(app)
      .put(`/api/service-bookings/${booking._id}/rate`)
      .set("Authorization", `Bearer ${tokenFor(tenant)}`)
      .send({ rating: 5, review: "a".repeat(1001) });

    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/service-bookings/:id", () => {
  test("admin xóa thành công", async () => {
    const admin = await createUser("admin");
    const tenant = await createUser("tenant");
    const service = await createActiveService();
    const booking = await createBooking({ service: service._id, tenant: tenant._id });

    const res = await request(app)
      .delete(`/api/service-bookings/${booking._id}`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`);

    expect(res.status).toBe(200);
    expect(await ServiceBooking.findById(booking._id)).toBeNull();
  });

  test("staff không được xóa (chỉ admin) → 403", async () => {
    const staff = await createUser("staff");
    const tenant = await createUser("tenant");
    const service = await createActiveService();
    const booking = await createBooking({ service: service._id, tenant: tenant._id });

    const res = await request(app)
      .delete(`/api/service-bookings/${booking._id}`)
      .set("Authorization", `Bearer ${tokenFor(staff)}`);

    expect(res.status).toBe(403);
  });

  test("xóa 1 booking đã rate → avgRating của service được tính lại từ booking còn lại", async () => {
    const admin = await createUser("admin");
    const tenant = await createUser("tenant");
    const service = await createActiveService();
    const bookingA = await createBooking({ service: service._id, tenant: tenant._id, scheduledAt: futureDate(-2), status: "completed", rating: 3 });
    await createBooking({ service: service._id, tenant: tenant._id, scheduledAt: futureDate(-2), status: "completed", rating: 5 });
    await Service.findByIdAndUpdate(service._id, { avgRating: 4, ratingCount: 2 });

    const res = await request(app)
      .delete(`/api/service-bookings/${bookingA._id}`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`);

    expect(res.status).toBe(200);

    const updatedService = await Service.findById(service._id);
    expect(updatedService.avgRating).toBe(5);
    expect(updatedService.ratingCount).toBe(1);
  });
});

describe("ServiceBooking model — selectedVariant/matchQuantity", () => {
  test("lưu selectedVariant + matchQuantity cho booking dùng variants", async () => {
    const tenant = await createUser("tenant");
    const service = await createActiveService({
      category: "transport",
      usesVariants: true,
      requiresCapacityMatch: true,
      capacityFieldLabel: "Số hành khách",
      variants: [{ label: "4 chỗ", capacity: 4, price: 200000 }],
    });

    const booking = await ServiceBooking.create({
      service: service._id,
      tenant: tenant._id,
      scheduledAt: futureDate(48),
      quantity: 1,
      unitPrice: 200000,
      totalAmount: 200000,
      selectedVariant: "4 chỗ",
      matchQuantity: 3,
    });

    expect(booking.selectedVariant).toBe("4 chỗ");
    expect(booking.matchQuantity).toBe(3);
  });

  test("matchQuantity < 1 → lỗi validation", async () => {
    const tenant = await createUser("tenant");
    const service = await createActiveService();

    await expect(
      ServiceBooking.create({
        service: service._id,
        tenant: tenant._id,
        scheduledAt: futureDate(48),
        quantity: 1,
        unitPrice: 100000,
        totalAmount: 100000,
        matchQuantity: 0,
      })
    ).rejects.toThrow();
  });
});

describe("POST /api/service-bookings — dịch vụ usesVariants, requiresCapacityMatch=true (vd xe)", () => {
  const VARIANTS = [
    { label: "4 chỗ", capacity: 4, price: 200000 },
    { label: "7 chỗ", capacity: 7, price: 300000 },
  ];

  async function createCapacityMatchService(overrides = {}) {
    return createActiveService({
      category: "transport", usesVariants: true, requiresCapacityMatch: true,
      capacityFieldLabel: "Số hành khách", variants: VARIANTS, ...overrides,
    });
  }

  test("chọn đúng variant nhỏ nhất đủ đáp ứng → 201, totalAmount đúng giá, quantity=1", async () => {
    const tenant = await createUser("tenant");
    await createActiveContract(tenant);
    const service = await createCapacityMatchService();

    const res = await request(app)
      .post("/api/service-bookings")
      .set("Authorization", `Bearer ${tokenFor(tenant)}`)
      .send({ serviceId: service._id, scheduledAt: futureDate(48), selectedVariant: "4 chỗ", matchQuantity: 3 });

    expect(res.status).toBe(201);
    expect(res.body.selectedVariant).toBe("4 chỗ");
    expect(res.body.matchQuantity).toBe(3);
    expect(res.body.unitPrice).toBe(200000);
    expect(res.body.totalAmount).toBe(200000);
    expect(res.body.quantity).toBe(1);
  });

  test("matchQuantity vượt capacity của variant đã chọn → 400", async () => {
    const tenant = await createUser("tenant");
    await createActiveContract(tenant);
    const service = await createCapacityMatchService();

    const res = await request(app)
      .post("/api/service-bookings")
      .set("Authorization", `Bearer ${tokenFor(tenant)}`)
      .send({ serviceId: service._id, scheduledAt: futureDate(48), selectedVariant: "4 chỗ", matchQuantity: 6 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/tối đa 4/);
  });

  test("chọn variant to hơn mức cần (né UI, gọi thẳng API) → 400 kèm gợi ý đúng", async () => {
    const tenant = await createUser("tenant");
    await createActiveContract(tenant);
    const service = await createCapacityMatchService();

    const res = await request(app)
      .post("/api/service-bookings")
      .set("Authorization", `Bearer ${tokenFor(tenant)}`)
      .send({ serviceId: service._id, scheduledAt: futureDate(48), selectedVariant: "7 chỗ", matchQuantity: 3 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/"4 chỗ"/);
  });

  test("matchQuantity vượt capacity lớn nhất trong variants → 400", async () => {
    const tenant = await createUser("tenant");
    await createActiveContract(tenant);
    const service = await createCapacityMatchService();

    const res = await request(app)
      .post("/api/service-bookings")
      .set("Authorization", `Bearer ${tokenFor(tenant)}`)
      .send({ serviceId: service._id, scheduledAt: futureDate(48), selectedVariant: "7 chỗ", matchQuantity: 10 });

    expect(res.status).toBe(400);
  });

  test("thiếu selectedVariant hoặc matchQuantity → 400", async () => {
    const tenant = await createUser("tenant");
    await createActiveContract(tenant);
    const service = await createCapacityMatchService();

    const res = await request(app)
      .post("/api/service-bookings")
      .set("Authorization", `Bearer ${tokenFor(tenant)}`)
      .send({ serviceId: service._id, scheduledAt: futureDate(48), matchQuantity: 3 });

    expect(res.status).toBe(400);
  });

  test("lựa chọn không tồn tại trong variants → 400", async () => {
    const tenant = await createUser("tenant");
    await createActiveContract(tenant);
    const service = await createCapacityMatchService();

    const res = await request(app)
      .post("/api/service-bookings")
      .set("Authorization", `Bearer ${tokenFor(tenant)}`)
      .send({ serviceId: service._id, scheduledAt: futureDate(48), selectedVariant: "16 chỗ", matchQuantity: 3 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Lựa chọn không hợp lệ.");
  });
});

describe("POST /api/service-bookings — dịch vụ usesVariants, requiresCapacityMatch=false (vd spa gói giờ)", () => {
  async function createFreeChoiceVariantService(overrides = {}) {
    return createActiveService({
      category: "spa", usesVariants: true, requiresCapacityMatch: false,
      variants: [{ label: "60 phút", price: 300000 }, { label: "90 phút", price: 450000 }],
      ...overrides,
    });
  }

  test("chọn tự do 1 variant, quantity mặc định → 201, totalAmount = giá variant", async () => {
    const tenant = await createUser("tenant");
    await createActiveContract(tenant);
    const service = await createFreeChoiceVariantService();

    const res = await request(app)
      .post("/api/service-bookings")
      .set("Authorization", `Bearer ${tokenFor(tenant)}`)
      .send({ serviceId: service._id, scheduledAt: futureDate(48), selectedVariant: "90 phút", quantity: 1 });

    expect(res.status).toBe(201);
    expect(res.body.selectedVariant).toBe("90 phút");
    expect(res.body.matchQuantity).toBeUndefined();
    expect(res.body.unitPrice).toBe(450000);
    expect(res.body.totalAmount).toBe(450000);
  });

  test("quantity=2 → totalAmount nhân đôi giá variant", async () => {
    const tenant = await createUser("tenant");
    await createActiveContract(tenant);
    const service = await createFreeChoiceVariantService();

    const res = await request(app)
      .post("/api/service-bookings")
      .set("Authorization", `Bearer ${tokenFor(tenant)}`)
      .send({ serviceId: service._id, scheduledAt: futureDate(48), selectedVariant: "60 phút", quantity: 2 });

    expect(res.status).toBe(201);
    expect(res.body.totalAmount).toBe(600000);
  });

  test("thiếu selectedVariant → 400", async () => {
    const tenant = await createUser("tenant");
    await createActiveContract(tenant);
    const service = await createFreeChoiceVariantService();

    const res = await request(app)
      .post("/api/service-bookings")
      .set("Authorization", `Bearer ${tokenFor(tenant)}`)
      .send({ serviceId: service._id, scheduledAt: futureDate(48), quantity: 1 });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/service-bookings — regression dịch vụ không phải transport", () => {
  test("thiếu quantity → 400", async () => {
    const tenant = await createUser("tenant");
    await createActiveContract(tenant);
    const service = await createActiveService();

    const res = await request(app)
      .post("/api/service-bookings")
      .set("Authorization", `Bearer ${tokenFor(tenant)}`)
      .send({ serviceId: service._id, scheduledAt: futureDate(48) });

    expect(res.status).toBe(400);
  });

  test("quantity < 1 → 400", async () => {
    const tenant = await createUser("tenant");
    await createActiveContract(tenant);
    const service = await createActiveService();

    const res = await request(app)
      .post("/api/service-bookings")
      .set("Authorization", `Bearer ${tokenFor(tenant)}`)
      .send({ serviceId: service._id, scheduledAt: futureDate(48), quantity: 0 });

    expect(res.status).toBe(400);
  });
});
