const MIN_PASSWORD_LENGTH = 6;

function validatePassword(plain) {
  if (typeof plain !== "string") return "Mật khẩu không hợp lệ.";
  if (plain.length < MIN_PASSWORD_LENGTH) {
    return `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`;
  }
  return null;
}

// Trả về cả lỗi (nếu có) lẫn dạng đã chuẩn hóa (trim + lowercase). Caller
// dùng `normalized` cho query/save → tránh phải tự normalize ở mỗi route.
function validateEmail(email) {
  if (typeof email !== "string") return { error: "Email không hợp lệ." };
  const normalized = email.trim().toLowerCase();
  if (!normalized) return { error: "Vui lòng nhập email." };
  if (!/^\S+@\S+\.\S+$/.test(normalized)) {
    return { error: "Email không đúng định dạng." };
  }
  return { error: null, normalized };
}

module.exports = { validatePassword, validateEmail, MIN_PASSWORD_LENGTH };
