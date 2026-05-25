const Feedback = require("../models/Feedback");
const Contract = require("../models/Contract");
const Notification = require("../models/Notification");

// ─── GET /api/feedback/room/:roomId — public ──────────────────────────────────
exports.getFeedbacksByRoom = async (req, res) => {
  try {
    const { roomId } = req.params;

    const feedbacks = await Feedback.find({ room: roomId, status: "visible" })
      .populate("tenant", "name avatar")
      .populate("reply.repliedBy", "name role")
      .sort({ createdAt: -1 });

    const formatted = feedbacks.map((f) => ({
      _id: f._id,
      tenant: f.tenant,
      rating: f.rating,
      comment: f.comment,
      isAnonymous: f.isAnonymous,
      tenantName: f.isAnonymous ? "Ẩn danh" : f.tenant?.name || "Người dùng",
      tenantAvatar: f.isAnonymous ? null : (f.tenant?.avatar || null),
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

// ─── GET /api/feedback/my/:roomId — tenant ───────────────────────────────────
exports.getMyFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.findOne({
      room: req.params.roomId,
      tenant: req.user._id,
    });
    if (!feedback) return res.json(null);
    res.json(feedback);
  } catch (err) {
    console.error("getMyFeedback error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
};

// ─── GET /api/feedback/eligible/:roomId ──────────────────────────────────────
exports.checkEligibility = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "tenant") {
      return res.json({ eligible: false });
    }

    const hasContract = await Contract.findOne({
      room: req.params.roomId,
      tenant: req.user._id,
      status: { $in: ["active", "expired"] },
    });

    res.json({ eligible: !!hasContract });
  } catch (err) {
    console.error("checkEligibility error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
};

// ─── POST /api/feedback — tenant ────────────────────────────────────────────
exports.createFeedback = async (req, res) => {
  try {
    const { roomId, rating, comment, isAnonymous } = req.body;

    if (!roomId || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Thiếu thông tin hoặc đánh giá không hợp lệ." });
    }

    const hasContract = await Contract.findOne({
      room: roomId,
      tenant: req.user._id,
      status: { $in: ["active", "expired"] },
    });
    if (!hasContract) {
      return res.status(403).json({ message: "Bạn cần có hợp đồng thuê phòng mới có thể đánh giá." });
    }

    const existing = await Feedback.findOne({ room: roomId, tenant: req.user._id });
    if (existing) {
      return res.status(409).json({ message: "Bạn đã đánh giá phòng này rồi." });
    }

    const feedback = await Feedback.create({
      room: roomId,
      tenant: req.user._id,
      rating,
      comment: comment?.trim() || "",
      isAnonymous: !!isAnonymous,
    });

    res.status(201).json(feedback);
  } catch (err) {
    console.error("createFeedback error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
};

// ─── PUT /api/feedback/:id — tenant ─────────────────────────────────────────
exports.updateFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) return res.status(404).json({ message: "Không tìm thấy đánh giá." });

    // Chỉ chủ sở hữu mới được sửa
    if (feedback.tenant.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Bạn không có quyền sửa đánh giá này." });
    }

    const { rating, comment, isAnonymous } = req.body;
    if (rating !== undefined) {
      if (rating < 1 || rating > 5) return res.status(400).json({ message: "Rating không hợp lệ." });
      feedback.rating = rating;
    }
    if (comment !== undefined) feedback.comment = comment.trim();
    if (isAnonymous !== undefined) feedback.isAnonymous = !!isAnonymous;

    await feedback.save();
    res.json(feedback);
  } catch (err) {
    console.error("updateFeedback error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
};

// ─── DELETE /api/feedback/:id — tenant / admin ──────────────────────────────
exports.deleteFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) return res.status(404).json({ message: "Không tìm thấy đánh giá." });

    const isOwner = feedback.tenant.toString() === req.user._id.toString();
    const isAdminOrStaff = ["admin", "staff"].includes(req.user.role);

    if (!isOwner && !isAdminOrStaff) {
      return res.status(403).json({ message: "Bạn không có quyền xóa đánh giá này." });
    }

    await feedback.deleteOne();
    res.json({ message: "Đã xóa đánh giá thành công." });
  } catch (err) {
    console.error("deleteFeedback error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
};

// ─── PATCH /api/feedback/:id/status — admin/staff ───────────────────────────
exports.toggleFeedbackStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["visible", "hidden"].includes(status)) {
      return res.status(400).json({ message: "Trạng thái không hợp lệ." });
    }

    const feedback = await Feedback.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate("tenant", "name avatar").populate("room", "name");

    if (!feedback) return res.status(404).json({ message: "Không tìm thấy đánh giá." });
    res.json({ message: "Đã cập nhật trạng thái.", feedback });
  } catch (err) {
    console.error("toggleFeedbackStatus error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
};

// ─── PUT /api/feedback/:id/reply — admin/staff ──────────────────────────────
exports.replyToFeedback = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) {
      return res.status(400).json({ message: "Nội dung phản hồi không được để trống." });
    }

    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) return res.status(404).json({ message: "Không tìm thấy đánh giá." });

    feedback.reply = {
      text: text.trim(),
      repliedBy: req.user._id,
      repliedAt: new Date(),
    };
    await feedback.save();
    await feedback.populate("reply.repliedBy", "name role");

    res.json({
      message: "Đã phản hồi đánh giá.",
      feedback: {
        ...feedback.toObject(),
        reply: {
          text: feedback.reply.text,
          repliedAt: feedback.reply.repliedAt,
          repliedByName: feedback.reply.repliedBy?.name || "Ban quản lý",
        },
      },
    });
  } catch (err) {
    console.error("replyToFeedback error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
};

// ─── GET /api/feedback — admin/staff ────────────────────────────────────────
exports.getAllFeedbacks = async (req, res) => {
  try {
    const { status, roomId, rating, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.status = status;
    if (roomId) query.room = roomId;
    if (rating) query.rating = Number(rating);

    const skip = (Number(page) - 1) * Number(limit);
    const [feedbacks, total] = await Promise.all([
      Feedback.find(query)
        .populate("tenant", "name email avatar")
        .populate("room", "name address district")
        .populate("reply.repliedBy", "name role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Feedback.countDocuments(query),
    ]);

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