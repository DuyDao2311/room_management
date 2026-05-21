const Feedback = require("../models/Feedback");
const Room = require("../models/Room");
const Contract = require("../models/Contract");

// ─── Hàm helper: tính lại avgRating & reviewCount cho phòng ─────────────────
async function recalcRoomRating(roomId) {
  const result = await Feedback.aggregate([
    { $match: { room: roomId, status: "visible" } },
    {
      $group: {
        _id: "$room",
        avg: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);

  const avg = result.length > 0 ? Math.round(result[0].avg * 10) / 10 : 0;
  const count = result.length > 0 ? result[0].count : 0;

  await Room.findByIdAndUpdate(roomId, { avgRating: avg, reviewCount: count });
}

// ─── Hàm helper: kiểm tra tenant có quyền đánh giá phòng không ──────────────
async function checkEligibility(tenantId, roomId) {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const contract = await Contract.findOne({
    room: roomId,
    tenant: tenantId,
    $or: [
      // Đang thuê (active)
      { status: "active" },
      // Đã thuê, kết thúc trong vòng 7 ngày
      {
        status: { $in: ["expired", "terminated"] },
        endDate: { $gte: sevenDaysAgo },
      },
    ],
  });

  return !!contract;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/feedback/room/:roomId — Public: xem feedback visible của 1 phòng
// ─────────────────────────────────────────────────────────────────────────────
exports.getFeedbacksByRoom = async (req, res) => {
  try {
    const { roomId } = req.params;

    const feedbacks = await Feedback.find({ room: roomId, status: "visible" })
      .populate("tenant", "name")
      .populate("reply.repliedBy", "name role")
      .sort({ createdAt: -1 });

    // Ẩn tên nếu isAnonymous = true
    const formatted = feedbacks.map((f) => ({
      _id: f._id,
      rating: f.rating,
      comment: f.comment,
      isAnonymous: f.isAnonymous,
      tenantName: f.isAnonymous ? "Ẩn danh" : f.tenant?.name || "Người dùng",
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
      reply: f.reply?.text
        ? {
            text: f.reply.text,
            repliedAt: f.reply.repliedAt,
            repliedByName: f.reply.repliedBy?.name || "Ban quản lý",
          }
        : null,
    }));

    // Tổng hợp phân phối sao (1-5)
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    feedbacks.forEach((f) => {
      if (distribution[f.rating] !== undefined) distribution[f.rating]++;
    });

    res.json({ feedbacks: formatted, distribution });
  } catch (err) {
    console.error("getFeedbacksByRoom error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/feedback — Tenant gửi đánh giá
// ─────────────────────────────────────────────────────────────────────────────
exports.createFeedback = async (req, res) => {
  try {
    const { roomId, rating, comment, isAnonymous } = req.body;
    const tenantId = req.user._id;

    if (!roomId || !rating) {
      return res.status(400).json({ message: "Vui lòng cung cấp phòng và số sao." });
    }

    // Kiểm tra phòng tồn tại
    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ message: "Không tìm thấy phòng." });

    // Kiểm tra quyền đánh giá
    const eligible = await checkEligibility(tenantId, roomId);
    if (!eligible) {
      return res.status(403).json({
        message:
          "Bạn chỉ có thể đánh giá phòng đang hoặc đã từng thuê (trong vòng 7 ngày sau khi kết thúc hợp đồng).",
      });
    }

    // Kiểm tra đã đánh giá chưa
    const existing = await Feedback.findOne({ room: roomId, tenant: tenantId });
    if (existing) {
      return res.status(409).json({ message: "Bạn đã đánh giá phòng này rồi." });
    }

    const feedback = await Feedback.create({
      room: roomId,
      tenant: tenantId,
      rating,
      comment: comment || "",
      isAnonymous: !!isAnonymous,
    });

    await recalcRoomRating(room._id);

    res.status(201).json(feedback);
  } catch (err) {
    console.error("createFeedback error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/feedback/:id — Tenant sửa đánh giá của mình
// ─────────────────────────────────────────────────────────────────────────────
exports.updateFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) return res.status(404).json({ message: "Không tìm thấy đánh giá." });

    // Chỉ chủ sở hữu mới được sửa
    if (feedback.tenant.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Bạn không có quyền sửa đánh giá này." });
    }

    const { rating, comment, isAnonymous } = req.body;
    if (rating !== undefined) feedback.rating = rating;
    if (comment !== undefined) feedback.comment = comment;
    if (isAnonymous !== undefined) feedback.isAnonymous = isAnonymous;

    await feedback.save();
    await recalcRoomRating(feedback.room);

    res.json(feedback);
  } catch (err) {
    console.error("updateFeedback error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/feedback/:id — Tenant xóa của mình, Admin/Staff xóa bất kỳ
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) return res.status(404).json({ message: "Không tìm thấy đánh giá." });

    const isOwner = feedback.tenant.toString() === req.user._id.toString();
    const isAdminOrStaff = ["admin", "staff"].includes(req.user.role);

    if (!isOwner && !isAdminOrStaff) {
      return res.status(403).json({ message: "Bạn không có quyền xóa đánh giá này." });
    }

    const roomId = feedback.room;
    await feedback.deleteOne();
    await recalcRoomRating(roomId);

    res.json({ message: "Xóa đánh giá thành công." });
  } catch (err) {
    console.error("deleteFeedback error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/feedback — Admin/Staff: xem tất cả feedback (có filter + phân trang)
// ─────────────────────────────────────────────────────────────────────────────
exports.getAllFeedbacks = async (req, res) => {
  try {
    const { status, roomId, rating, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (roomId) filter.room = roomId;
    if (rating) filter.rating = Number(rating);

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Feedback.countDocuments(filter);

    const feedbacks = await Feedback.find(filter)
      .populate("room", "name address")
      .populate("tenant", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({
      feedbacks,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (err) {
    console.error("getAllFeedbacks error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/feedback/:id/status — Admin/Staff: ẩn hoặc hiện feedback
// ─────────────────────────────────────────────────────────────────────────────
exports.toggleFeedbackStatus = async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) return res.status(404).json({ message: "Không tìm thấy đánh giá." });

    const { status } = req.body;
    if (!["visible", "hidden"].includes(status)) {
      return res.status(400).json({ message: "Trạng thái không hợp lệ. Dùng 'visible' hoặc 'hidden'." });
    }

    feedback.status = status;
    await feedback.save();

    // Cập nhật lại avgRating khi ẩn/hiện feedback
    await recalcRoomRating(feedback.room);

    res.json({ message: `Đã ${status === "hidden" ? "ẩn" : "hiện"} đánh giá.`, feedback });
  } catch (err) {
    console.error("toggleFeedbackStatus error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/feedback/my/:roomId — Tenant kiểm tra đã đánh giá phòng chưa
// ─────────────────────────────────────────────────────────────────────────────
exports.getMyFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.findOne({
      room: req.params.roomId,
      tenant: req.user._id,
    });
    res.json(feedback || null);
  } catch (err) {
    console.error("getMyFeedback error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/feedback/eligible/:roomId — Tenant kiểm tra có đủ điều kiện không
// ─────────────────────────────────────────────────────────────────────────────
exports.checkEligibilityRoute = async (req, res) => {
  try {
    const eligible = await checkEligibility(req.user._id, req.params.roomId);
    res.json({ eligible });
  } catch (err) {
    console.error("checkEligibilityRoute error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/feedback/:id/reply — Admin/Staff phản hồi đánh giá
// Gửi { text: "" } để xóa phản hồi
// ─────────────────────────────────────────────────────────────────────────────
exports.replyToFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) return res.status(404).json({ message: "Không tìm thấy đánh giá." });

    const { text } = req.body;

    if (!text || text.trim() === "") {
      // Xóa phản hồi
      feedback.reply = undefined;
    } else {
      feedback.reply = {
        text: text.trim(),
        repliedBy: req.user._id,
        repliedAt: new Date(),
      };
    }

    await feedback.save();

    // Populate để trả về đầy đủ thông tin
    await feedback.populate("reply.repliedBy", "name role");

    res.json({ message: "Phản hồi đã được lưu.", feedback });
  } catch (err) {
    console.error("replyToFeedback error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
};

