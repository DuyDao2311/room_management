// Unit tests cho emailTemplates — focus XSS protection (escapeHtml).

const {
  passwordResetTemplate,
  passwordChangedTemplate,
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
