const MIN_PASSWORD_LENGTH = 6;

function validatePassword(plain) {
  if (typeof plain !== "string") return "Mật khẩu không hợp lệ.";
  if (plain.length < MIN_PASSWORD_LENGTH) {
    return `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`;
  }
  return null;
}

function validateEmail(email) {
  if (typeof email !== "string") return "Email không hợp lệ.";
  const trimmed = email.trim();
  if (!trimmed) return "Vui lòng nhập email.";
  if (!/^\S+@\S+\.\S+$/.test(trimmed)) return "Email không đúng định dạng.";
  return null;
}

module.exports = { validatePassword, validateEmail, MIN_PASSWORD_LENGTH };
