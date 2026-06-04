const User = require("../models/User");
const Room = require("../models/Room");

// ─────────────────────────────────────────────────────────────────────────────
// 1. Lấy danh sách nhân viên (staff)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/admin/staff
 * Quyền: admin only
 */
const getStaffList = async (req, res) => {
  try {
    const staffList = await User.find({ role: "staff" })
      .select("-password")
      .sort({ createdAt: -1 });

    res.json(staffList);
  } catch (err) {
    console.error("Get staff list error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. Đổi role cho user (admin only)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * PUT /api/admin/users/:id/role
 * Body: { role: "staff" | "tenant" }
 * Quyền: admin only
 *
 * Lưu ý:
 * - Không cho phép đổi role của admin
 * - Khi chuyển staff → tenant: tự xóa managedDistricts
 * - Khi chuyển tenant → staff: managedDistricts mặc định rỗng
 */
const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;

    if (!["staff", "tenant"].includes(role)) {
      return res.status(400).json({
        message: "Vai trò không hợp lệ. Chỉ được chuyển giữa 'staff' và 'tenant'.",
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    // Không cho phép thay đổi role của admin
    if (user.role === "admin") {
      return res.status(400).json({
        message: "Không thể thay đổi vai trò của quản trị viên.",
      });
    }

    // Không cho phép đổi role chính mình
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        message: "Không thể thay đổi vai trò của chính mình.",
      });
    }

    user.role = role;

    // Khi thu hồi quyền staff → tenant: xóa managedDistricts
    if (role === "tenant") {
      user.managedDistricts = [];
    }

    await user.save();

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      managedDistricts: user.managedDistricts,
      isActive: user.isActive,
      createdAt: user.createdAt,
    });
  } catch (err) {
    console.error("Update user role error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. Setup khu vực quản lý cho staff (admin only)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * PUT /api/admin/users/:id/districts
 * Body: { managedDistricts: ["Hà Đông", "Long Biên"] }
 * Quyền: admin only
 */
const updateManagedDistricts = async (req, res) => {
  try {
    const { managedDistricts } = req.body;

    if (!Array.isArray(managedDistricts)) {
      return res.status(400).json({
        message: "managedDistricts phải là một mảng.",
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    if (user.role !== "staff") {
      return res.status(400).json({
        message: "Chỉ có thể phân khu vực cho nhân viên (staff).",
      });
    }

    // Validate: kiểm tra districts có tồn tại trong hệ thống
    const validDistricts = await Room.distinct("district", {
      district: { $ne: "" },
    });
    const invalidDistricts = managedDistricts.filter(
      (d) => !validDistricts.includes(d)
    );
    if (invalidDistricts.length > 0) {
      return res.status(400).json({
        message: `Các khu vực không tồn tại trong hệ thống: ${invalidDistricts.join(", ")}`,
      });
    }

    user.managedDistricts = managedDistricts;
    await user.save();

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      managedDistricts: user.managedDistricts,
      isActive: user.isActive,
    });
  } catch (err) {
    console.error("Update managed districts error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. Lấy danh sách districts có sẵn (dynamic từ Room)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/admin/districts
 * Quyền: admin only
 * Trả về: ["Hà Đông", "Long Biên", "Thanh Xuân", ...]
 */
const getAvailableDistricts = async (req, res) => {
  try {
    const districts = await Room.distinct("district", {
      district: { $ne: "" },
    });

    // Sắp xếp theo alphabet
    districts.sort((a, b) => a.localeCompare(b, "vi"));

    res.json(districts);
  } catch (err) {
    console.error("Get districts error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. Tạo người dùng mới (admin only)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * POST /api/admin/users
 * Body: { name, email, password, role }
 * Quyền: admin only
 */
const createUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin (tên, email, mật khẩu)." });
    }

    if (role && !["admin", "staff", "tenant"].includes(role)) {
      return res.status(400).json({ message: "Vai trò không hợp lệ." });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "Email này đã được sử dụng." });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: role || "tenant",
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      managedDistricts: user.managedDistricts,
      isActive: user.isActive,
      createdAt: user.createdAt,
    });
  } catch (err) {
    console.error("Create user error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. Xóa người dùng (admin only)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * DELETE /api/admin/users/:id
 * Quyền: admin only
 */
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    if (user.role === "admin") {
      return res.status(400).json({ message: "Không thể xóa quản trị viên." });
    }

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: "Không thể tự xóa chính mình." });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "Xóa người dùng thành công." });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
};

module.exports = {
  getStaffList,
  updateUserRole,
  updateManagedDistricts,
  getAvailableDistricts,
  createUser,
  deleteUser,
};
