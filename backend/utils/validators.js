// Validation helpers dùng chung giữa các route.
// Trả về string lỗi nếu invalid, null nếu OK — tiện cho pattern:
//   const err = validatePassword(x); if (err) return res.status(400).json({ message: err });

function validatePassword(plain) {
  if (typeof plain !== "string") return "Mật khẩu không hợp lệ.";
  if (plain.length < 6) return "Mật khẩu phải có ít nhất 6 ký tự.";
  return null;
}

function validateEmail(email) {
  if (typeof email !== "string") return "Email không hợp lệ.";
  const trimmed = email.trim();
  if (!trimmed) return "Vui lòng nhập email.";
  // Regex tối giản — chỉ check shape cơ bản. Mongoose model sẽ check kỹ hơn.
  if (!/^\S+@\S+\.\S+$/.test(trimmed)) return "Email không đúng định dạng.";
  return null;
}

module.exports = { validatePassword, validateEmail };
