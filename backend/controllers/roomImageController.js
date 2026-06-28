const Room = require("../models/Room");

// ── Helpers ────────────────────────────────────────────────────────
const isValidUrl = (str) => {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

// ── 1. Thêm 1 ảnh ──────────────────────────────────────────────────
// POST /api/rooms/:id/images
const addImageUrl = async (req, res) => {
  try {
    const { url } = req.body;

    if (!url || !isValidUrl(url)) {
      return res.status(400).json({ success: false, message: "URL không hợp lệ. Phải bắt đầu bằng http:// hoặc https://" });
    }

    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: "Không tìm thấy phòng." });

    // Kiểm tra trùng URL
    const duplicate = room.images.find((img) => img.url === url.trim());
    if (duplicate) {
      return res.status(409).json({ success: false, message: "URL ảnh đã tồn tại trong phòng này." });
    }

    // Tính order lớn nhất
    const maxOrder = room.images.length > 0
      ? Math.max(...room.images.map((img) => img.order)) + 1
      : 0;

    // Nếu là ảnh đầu tiên → đặt isPrimary
    const isPrimary = room.images.length === 0;

    room.images.push({
      url: url.trim(),
      isPrimary,
      order: maxOrder,
    });

    await room.save();

    res.status(201).json({
      success: true,
      message: "Thêm ảnh thành công.",
      data: room.images[room.images.length - 1],
    });
  } catch (err) {
    console.error("Add image error:", err);
    res.status(500).json({ success: false, message: "Lỗi server." });
  }
};

// ── 2. Thêm nhiều ảnh ──────────────────────────────────────────────
// POST /api/rooms/:id/images/bulk
const addBulkImageUrls = async (req, res) => {
  try {
    const { urls } = req.body;

    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ success: false, message: "Cần cung cấp mảng urls." });
    }

    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: "Không tìm thấy phòng." });

    // Lấy danh sách URL hiện có
    const existingUrls = new Set(room.images.map((img) => img.url));

    // Validate và lọc trùng
    const validUrls = [];
    const invalidUrls = [];
    const duplicateUrls = [];

    urls.forEach((url) => {
      const trimmed = (url || "").trim();
      if (!trimmed) return;
      if (!isValidUrl(trimmed)) {
        invalidUrls.push(trimmed);
      } else if (existingUrls.has(trimmed) || validUrls.includes(trimmed)) {
        duplicateUrls.push(trimmed);
      } else {
        validUrls.push(trimmed);
      }
    });

    if (validUrls.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Không có URL hợp lệ nào để thêm.",
        invalidUrls,
        duplicateUrls,
      });
    }

    let maxOrder = room.images.length > 0
      ? Math.max(...room.images.map((img) => img.order))
      : -1;

    const hasPrimary = room.images.some((img) => img.isPrimary);

    validUrls.forEach((url, idx) => {
      room.images.push({
        url,
        isPrimary: !hasPrimary && idx === 0,
        order: ++maxOrder,
      });
    });

    await room.save();

    res.status(201).json({
      success: true,
      message: `Đã thêm ${validUrls.length} ảnh thành công.`,
      data: {
        added: validUrls.length,
        invalidUrls,
        duplicateUrls,
        images: room.images,
      },
    });
  } catch (err) {
    console.error("Add bulk images error:", err);
    res.status(500).json({ success: false, message: "Lỗi server." });
  }
};

// ── 3. Xóa ảnh ─────────────────────────────────────────────────────
// DELETE /api/rooms/:id/images/:imageId
const removeImage = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: "Không tìm thấy phòng." });

    const imageIdx = room.images.findIndex(
      (img) => img._id.toString() === req.params.imageId
    );
    if (imageIdx === -1) {
      return res.status(404).json({ success: false, message: "Không tìm thấy ảnh." });
    }

    const wasRemoved = room.images[imageIdx];
    room.images.splice(imageIdx, 1);

    // Nếu ảnh vừa xóa là ảnh đại diện → gán cho ảnh đầu tiên (theo order)
    if (wasRemoved.isPrimary && room.images.length > 0) {
      // Sắp xếp theo order rồi đặt ảnh đầu tiên làm primary
      room.images.sort((a, b) => a.order - b.order);
      room.images[0].isPrimary = true;
    }

    await room.save();

    res.json({
      success: true,
      message: "Xóa ảnh thành công.",
      data: room.images,
    });
  } catch (err) {
    console.error("Remove image error:", err);
    res.status(500).json({ success: false, message: "Lỗi server." });
  }
};

// ── 4. Đặt ảnh đại diện ────────────────────────────────────────────
// PUT /api/rooms/:id/images/:imageId/primary
const setPrimaryImage = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: "Không tìm thấy phòng." });

    const target = room.images.find(
      (img) => img._id.toString() === req.params.imageId
    );
    if (!target) {
      return res.status(404).json({ success: false, message: "Không tìm thấy ảnh." });
    }

    // Reset tất cả isPrimary = false
    room.images.forEach((img) => {
      img.isPrimary = false;
    });

    // Đặt ảnh được chọn = true
    target.isPrimary = true;

    await room.save();

    res.json({
      success: true,
      message: "Đã đặt ảnh đại diện thành công.",
      data: room.images,
    });
  } catch (err) {
    console.error("Set primary image error:", err);
    res.status(500).json({ success: false, message: "Lỗi server." });
  }
};

// ── 5. Sắp xếp ảnh ─────────────────────────────────────────────────
// PUT /api/rooms/:id/images/reorder
const reorderImages = async (req, res) => {
  try {
    const { imageIds } = req.body;

    if (!Array.isArray(imageIds) || imageIds.length === 0) {
      return res.status(400).json({ success: false, message: "Cần cung cấp mảng imageIds." });
    }

    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: "Không tìm thấy phòng." });

    // Cập nhật order theo thứ tự mảng imageIds
    imageIds.forEach((id, index) => {
      const img = room.images.find((i) => i._id.toString() === id);
      if (img) {
        img.order = index;
      }
    });

    await room.save();

    // Trả về images đã sort theo order mới
    const sorted = [...room.images].sort((a, b) => a.order - b.order);

    res.json({
      success: true,
      message: "Sắp xếp ảnh thành công.",
      data: sorted,
    });
  } catch (err) {
    console.error("Reorder images error:", err);
    res.status(500).json({ success: false, message: "Lỗi server." });
  }
};

module.exports = {
  addImageUrl,
  addBulkImageUrls,
  removeImage,
  setPrimaryImage,
  reorderImages,
};
