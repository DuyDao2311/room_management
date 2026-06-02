// Unit test cho dispatch — mock toàn bộ dependency (model + sendEmail)
// để không cần DB. Focus:
//  - email chỉ gửi cho recipient có .email
//  - sendEmail throw → flow không vỡ (fire-and-forget)
//  - EMAIL_ENABLED=false → skip email
//  - guest (không có _id) → skip in-app, vẫn gửi email

jest.mock("../utils/sendEmail", () => jest.fn(() => Promise.resolve()));
jest.mock("../models/Notification", () => ({
  insertMany: jest.fn((docs) =>
    Promise.resolve(docs.map((d, i) => ({ ...d, _id: `mock_${i}` }))),
  ),
  findOne: jest.fn(() => Promise.resolve(null)),
}));
jest.mock("../models/User", () => ({ find: jest.fn() }));
jest.mock("../models/Room", () => ({ findById: jest.fn() }));
jest.mock("../models/Contract", () => ({ findById: jest.fn(), find: jest.fn() }));
jest.mock("../models/Invoice", () => ({ findById: jest.fn(), find: jest.fn() }));

const sendEmail = require("../utils/sendEmail");
const Notification = require("../models/Notification");
const { dispatch } = require("../utils/notificationService");

// Helper: chờ tất cả microtask hoàn tất (fire-and-forget bọc trong .catch())
const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.EMAIL_ENABLED;
});

describe("dispatch — in-app channel", () => {
  test("tạo Notification cho mỗi recipient có _id", async () => {
    const recipients = [
      { _id: "u1", email: "a@x.com" },
      { _id: "u2", email: "b@x.com" },
    ];

    const result = await dispatch({
      recipients,
      data: { type: "INVOICE", title: "T", message: "M", invoiceId: "inv1" },
      channels: ["inapp"],
    });

    expect(Notification.insertMany).toHaveBeenCalledTimes(1);
    const docs = Notification.insertMany.mock.calls[0][0];
    expect(docs).toHaveLength(2);
    expect(docs[0]).toMatchObject({ userId: "u1", tenantId: "u1", type: "INVOICE", title: "T" });
    expect(result).toHaveLength(2);
  });

  test("recipient KHÔNG có _id (guest) → skip in-app", async () => {
    await dispatch({
      recipients: [{ email: "guest@x.com" }],
      data: { type: "APPOINTMENT", title: "T", message: "M" },
      channels: ["inapp"],
    });

    // Không có recipient hợp lệ → insertMany không được gọi.
    expect(Notification.insertMany).not.toHaveBeenCalled();
  });
});

describe("dispatch — email channel (fire-and-forget)", () => {
  test("chỉ gửi email cho recipient có .email", async () => {
    await dispatch({
      recipients: [
        { _id: "u1", email: "a@x.com" },
        { _id: "u2" }, // thiếu email
        { _id: "u3", email: "c@x.com" },
      ],
      data: { type: "INVOICE", title: "Hóa đơn", message: "Nội dung" },
      channels: ["email"],
    });

    await flushPromises();
    expect(sendEmail).toHaveBeenCalledTimes(2);
    const toList = sendEmail.mock.calls.map((c) => c[0].to);
    expect(toList).toEqual(expect.arrayContaining(["a@x.com", "c@x.com"]));
  });

  test("sendEmail throw → KHÔNG vỡ flow, vẫn return notifications", async () => {
    sendEmail.mockImplementationOnce(() => Promise.reject(new Error("SMTP down")));
    const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const result = await dispatch({
      recipients: [
        { _id: "u1", email: "fail@x.com" },
        { _id: "u2", email: "ok@x.com" },
      ],
      data: { type: "INVOICE", title: "T", message: "M" },
      channels: ["inapp", "email"],
    });

    await flushPromises();
    // dispatch trả về notifications của in-app, không bị throw vì email lỗi.
    expect(result).toHaveLength(2);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  test("EMAIL_ENABLED=false → skip email hoàn toàn", async () => {
    process.env.EMAIL_ENABLED = "false";

    await dispatch({
      recipients: [{ _id: "u1", email: "a@x.com" }],
      data: { type: "INVOICE", title: "T", message: "M" },
      channels: ["email"],
    });

    await flushPromises();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test("email subject = data.title; html/text được build từ template", async () => {
    await dispatch({
      recipients: [{ _id: "u1", email: "a@x.com" }],
      data: { type: "INVOICE", title: "💰 Đã thanh toán", message: "OK" },
      channels: ["email"],
      actionUrl: "https://app/invoices/1",
    });

    await flushPromises();
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const arg = sendEmail.mock.calls[0][0];
    expect(arg.subject).toBe("💰 Đã thanh toán");
    expect(arg.html).toContain("💰 Đã thanh toán");
    expect(arg.html).toContain("https://app/invoices/1");
    expect(arg.text).toContain("OK");
  });
});

describe("dispatch — hybrid (cả 2 channel)", () => {
  test("guest + user: in-app cho user, email cho cả 2", async () => {
    await dispatch({
      recipients: [
        { _id: "u1", email: "user@x.com" },
        { email: "guest@x.com" }, // guest — không có _id
      ],
      data: { type: "APPOINTMENT", title: "T", message: "M" },
      channels: ["inapp", "email"],
    });

    await flushPromises();
    // in-app: chỉ tạo cho user có _id
    const docs = Notification.insertMany.mock.calls[0][0];
    expect(docs).toHaveLength(1);
    expect(docs[0].userId).toBe("u1");
    // email: cả 2 đều có email
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });
});
