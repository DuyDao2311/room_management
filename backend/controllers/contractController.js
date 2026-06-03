/**
 * contractController.js
 * Controller xử lý chức năng chữ ký điện tử hợp đồng
 *
 * POST /api/contracts/:id/sign
 * ─ Admin (owner) gửi signatureA  → isSignedByOwner = true
 * ─ Tenant       gửi signatureB  → isSignedByTenant = true
 * ─ Nếu cả hai đã ký              → status = "active", signedAt = now
 */

const Contract = require("../models/Contract");
const Room = require("../models/Room");
const Invoice = require("../models/Invoice");

/**
 * POST /api/contracts/:id/sign
 *
 * Body: { signatureA?: string, signatureB?: string }
 *
 * Quy tắc:
 *  - signatureA chỉ admin được gửi (owner)
 *  - signatureB chỉ tenant của hợp đồng được gửi (hoặc admin thay mặt)
 *  - Không cho phép ghi đè chữ ký đã ký (cần xóa trước)
 */
const signContract = async (req, res) => {
  try {
    const { id } = req.params;
    const { signatureA, signatureB } = req.body;

    // ── 1. Kiểm tra hợp đồng tồn tại ──────────────────────────────
    const contract = await Contract.findById(id)
      .populate("room", "name address price")
      .populate("tenant", "name email");

    if (!contract) {
      return res.status(404).json({ message: "Không tìm thấy hợp đồng." });
    }

    // ── 2. Kiểm tra hợp đồng có ở trạng thái hợp lệ để ký ────────
    if (contract.status === "terminated" || contract.status === "expired") {
      return res.status(400).json({
        message: "Hợp đồng đã chấm dứt hoặc hết hạn, không thể ký.",
      });
    }

    // ── 3. Validate: phải gửi ít nhất một chữ ký ─────────────────
    if (!signatureA && !signatureB) {
      return res.status(400).json({
        message: "Vui lòng cung cấp ít nhất một chữ ký (signatureA hoặc signatureB).",
      });
    }

    // ── 4. Validate định dạng base64 (kiểm tra nhanh) ────────────
    const isValidBase64 = (str) =>
      typeof str === "string" && str.startsWith("data:image/png;base64,");

    if (signatureA && !isValidBase64(signatureA)) {
      return res.status(400).json({ message: "signatureA không đúng định dạng base64 PNG." });
    }
    if (signatureB && !isValidBase64(signatureB)) {
      return res.status(400).json({ message: "signatureB không đúng định dạng base64 PNG." });
    }

    // ── 5. Xây dựng object cập nhật ────────────────────────────────
    const update = {};

    // Xử lý chữ ký Bên A (chủ trọ / admin)
    if (signatureA) {
      if (contract.isSignedByOwner) {
        return res.status(400).json({
          message: "Bên A đã ký rồi. Vui lòng xóa chữ ký cũ trước khi ký lại.",
        });
      }
      update.signatureA = signatureA;
      update.isSignedByOwner = true;
    }

    // Xử lý chữ ký Bên B (khách thuê)
    if (signatureB) {
      if (contract.isSignedByTenant) {
        return res.status(400).json({
          message: "Bên B đã ký rồi. Vui lòng xóa chữ ký cũ trước khi ký lại.",
        });
      }
      update.signatureB = signatureB;
      update.isSignedByTenant = true;
    }

    // ── 6. Kiểm tra nếu cả hai bên đã ký → kích hoạt hợp đồng ────
    const ownerSigned  = signatureA ? true : contract.isSignedByOwner;
    const tenantSigned = signatureB ? true : contract.isSignedByTenant;

    if (ownerSigned && tenantSigned) {
      update.signedAt = new Date();

      // Chỉ chuyển trạng thái nếu đang ở pending
      if (contract.status === "pending") {
        // Nếu là hợp đồng gia hạn (có parentContract)
        if (contract.parentContract) {
          const parentContract = await Contract.findById(contract.parentContract);
          const now = new Date();
          // Nếu hợp đồng chính vẫn active VÀ ngày bắt đầu HĐ gia hạn chưa tới
          if (parentContract && parentContract.status === "active" && new Date(contract.startDate) > now) {
            update.status = "renewal"; // Chờ kích hoạt khi đến ngày
          } else {
            // HĐ chính đã hết hạn hoặc ngày bắt đầu đã qua → active ngay
            update.status = "active";
            // Chuyển HĐ chính sang renewed nếu vẫn active
            if (parentContract && parentContract.status === "active") {
              await Contract.findByIdAndUpdate(parentContract._id, { status: "renewed" });
            }
          }
        } else {
          update.status = "active";
        }
      }
    }

    // ── 7. Lưu vào DB ──────────────────────────────────────────────
    const updated = await Contract.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true }
    )
      .populate("room", "name address price area type")
      .populate("tenant", "name email");

    // ── 8. Nếu vừa active (hợp đồng mới, không phải gia hạn) → cập nhật phòng + tạo hóa đơn cọc
    if (update.status === "active" && !contract.parentContract) {
      await Room.findByIdAndUpdate(updated.room._id, { status: "occupied" });

      const hasDeposit = await Invoice.findOne({
        contract: updated._id,
        type: "deposit",
      });

      if (!hasDeposit) {
        await Invoice.create({
          contract:            updated._id,
          type:                "deposit",
          representativeName:  updated.representativeName,
          representativePhone: updated.representativePhone,
          roomName:            updated.room.name,
          rentAmount:          updated.monthlyRent,
          depositAmount:       updated.depositAmount || updated.monthlyRent,
          dueDate:             new Date(Date.now() + 86400000), // Hạn thanh toán: hiện tại + 1 ngày
          notes:               "Hóa đơn đặt cọc tự động khi cả hai bên ký hợp đồng.",
          createdBy:           req.user._id,
        });
      }
    }

    // ── 9. Trả response ────────────────────────────────────────────
    return res.json({
      message: update.status === "active"
        ? "Cả hai bên đã ký! Hợp đồng chính thức có hiệu lực."
        : update.status === "renewal"
          ? "Cả hai bên đã ký! Hợp đồng gia hạn đang chờ đến ngày có hiệu lực."
          : "Lưu chữ ký thành công.",
      contract: updated,
      // Alias cho phép frontend dùng trực tiếp response.data
      ...updated.toObject(),
    });
  } catch (err) {
    console.error("signContract error:", err);
    return res.status(500).json({ message: err.message || "Lỗi server." });
  }
};

/**
 * DELETE /api/contracts/:id/sign
 * Xóa chữ ký (cho phép ký lại)
 *
 * Body: { side: "A" | "B" }  – bên nào cần xóa
 * Chỉ admin mới được xóa chữ ký Bên A
 */
const clearSignature = async (req, res) => {
  try {
    const { id } = req.params;
    const { side } = req.body; // "A" hoặc "B"

    if (!["A", "B"].includes(side)) {
      return res.status(400).json({ message: "Tham số side phải là 'A' hoặc 'B'." });
    }

    const contract = await Contract.findById(id);
    if (!contract) {
      return res.status(404).json({ message: "Không tìm thấy hợp đồng." });
    }

    const update = {};
    if (side === "A") {
      update.signatureA     = "";
      update.isSignedByOwner = false;
    } else {
      update.signatureB      = "";
      update.isSignedByTenant = false;
    }

    // Nếu xóa chữ ký thì reset signedAt (chưa đủ 2 bên)
    update.signedAt = null;

    const updated = await Contract.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true }
    )
      .populate("room", "name address price area type")
      .populate("tenant", "name email");

    return res.json({
      message: `Đã xóa chữ ký Bên ${side}.`,
      contract: updated,
      ...updated.toObject(),
    });
  } catch (err) {
    console.error("clearSignature error:", err);
    return res.status(500).json({ message: err.message || "Lỗi server." });
  }
};

module.exports = { signContract, clearSignature };
