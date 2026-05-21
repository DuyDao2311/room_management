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
  test("nhúng userName + resetUrl đã escape vào HTML, không nhúng raw", () => {
    const malicious = '<script>steal()</script>';
    const url = "https://example.com/reset/abc?evil=<x>";
    const { html, text } = passwordResetTemplate({
      userName: malicious,
      resetUrl: url,
    });

    // HTML KHÔNG được chứa raw tag — bắt buộc XSS protection
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");

    // Text version (plain) thì chứa raw — không sao vì không render HTML
    expect(text).toContain(malicious);
    expect(text).toContain(url);
  });

  test("text version có URL + cảnh báo 15 phút", () => {
    const { text } = passwordResetTemplate({
      userName: "User",
      resetUrl: "https://x.com/r/abc",
    });

    expect(text).toContain("https://x.com/r/abc");
    expect(text).toMatch(/15 phút/i);
    expect(text).toMatch(/Xin chào User/);
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

  test("text version có cảnh báo bị xâm nhập", () => {
    const { text } = passwordChangedTemplate({ userName: "User" });
    expect(text).toMatch(/xâm nhập/i);
    expect(text).toMatch(/quản trị viên/i);
  });
});
