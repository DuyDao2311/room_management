// Unit tests cho emailTemplates — focus XSS protection (escapeHtml).

const {
  passwordResetTemplate,
  passwordChangedTemplate,
  notificationEmailTemplate,
  escapeHtml,
} = require("../utils/emailTemplates");

describe("escapeHtml", () => {
  test("escape các ký tự HTML đặc biệt", () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;",
    );
    expect(escapeHtml("a & b")).toBe("a &amp; b");
    expect(escapeHtml("it's")).toBe("it&#39;s");
  });

  test("escape & trước < và > (tránh double-escape)", () => {
    // Nếu escape < trước, kết quả &lt; sẽ bị & ở bước sau bắt thành &amp;lt;
    expect(escapeHtml("<&>")).toBe("&lt;&amp;&gt;");
  });

  test("input không phải string vẫn xử lý được (coerce)", () => {
    expect(escapeHtml(123)).toBe("123");
    expect(escapeHtml(null)).toBe("null");
  });
});

describe("passwordResetTemplate", () => {
  test("escape userName trong HTML, không render raw script", () => {
    const malicious = '<script>steal()</script>';
    const { html } = passwordResetTemplate({
      userName: malicious,
      resetUrl: "https://example.com/r/abc",
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  test("text version chứa URL + userName (không cần escape)", () => {
    const { text } = passwordResetTemplate({
      userName: "Alice",
      resetUrl: "https://x.com/r/abc",
    });

    expect(text).toContain("https://x.com/r/abc");
    expect(text).toContain("Alice");
  });
});

describe("notificationEmailTemplate", () => {
  test("escape heading + message khỏi XSS trong HTML", () => {
    const { html } = notificationEmailTemplate({
      heading: "<script>alert(1)</script>",
      message: "<img src=x onerror=alert(1)>",
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img");
  });

  test("text version chứa heading + message raw (không cần escape)", () => {
    const { text } = notificationEmailTemplate({
      heading: "💰 Hóa đơn đã thanh toán",
      message: "Hóa đơn phòng A101 — 1.500.000đ đã thanh toán",
    });
    expect(text).toContain("💰 Hóa đơn đã thanh toán");
    expect(text).toContain("1.500.000đ");
  });

  test("không có actionUrl → KHÔNG render nút 'Xem chi tiết'", () => {
    const { html, text } = notificationEmailTemplate({
      heading: "Test",
      message: "Body",
    });
    expect(html).not.toContain("Xem chi tiết");
    expect(text).not.toContain("Xem chi tiết");
  });

  test("có actionUrl → render link + label trong cả html lẫn text", () => {
    const { html, text } = notificationEmailTemplate({
      heading: "Test",
      message: "Body",
      actionUrl: "https://app.example.com/invoices/abc",
      actionLabel: "Mở hóa đơn",
    });
    expect(html).toContain("https://app.example.com/invoices/abc");
    expect(html).toContain("Mở hóa đơn");
    expect(text).toContain("Mở hóa đơn: https://app.example.com/invoices/abc");
  });

  test("actionUrl chứa ký tự nguy hiểm → bị escape trong HTML", () => {
    const { html } = notificationEmailTemplate({
      heading: "Test",
      message: "Body",
      actionUrl: 'javascript:alert(1)"<>',
    });
    // Không cho phép href thoát ra ngoài attribute
    expect(html).not.toContain('"<>');
    expect(html).toContain("&quot;&lt;&gt;");
  });
});

describe("passwordChangedTemplate", () => {
  test("escape userName trong HTML", () => {
    const { html } = passwordChangedTemplate({
      userName: '<img src=x onerror=alert(1)>',
    });

    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  test("text version có cảnh báo bị xâm nhập + chứa userName", () => {
    const { text } = passwordChangedTemplate({ userName: "Alice" });

    expect(text).toContain("Alice");
    expect(text).toMatch(/xâm nhập/i);
  });
});
