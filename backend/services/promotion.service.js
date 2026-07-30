/**
 * Promotion Service — Toàn bộ business logic cho module Promotion
 *
 * NGUYÊN TẮC QUAN TRỌNG:
 * - KHÔNG bao giờ update Room.price
 * - Giá khuyến mãi được tính ĐỘNG khi trả response
 * - Giá gốc của Room luôn được giữ nguyên
 */

const Promotion = require("../models/Promotion");
const Room = require("../models/Room");

// ── Helper: Tính trạng thái tự động dựa trên thời gian ─────────────────────
function computeStatus(startDate, endDate) {
  const now = new Date();
  
  const endOfDay = new Date(endDate);
  endOfDay.setHours(23, 59, 59, 999);
  
  const startOfDay = new Date(startDate);
  startOfDay.setHours(0, 0, 0, 0);

  if (now < startOfDay) return "upcoming";
  if (now > endOfDay) return "expired";
  return "active";
}

// ── Tính giá sau khuyến mãi cho 1 room ─────────────────────────────────────
/**
 * @param {number} originalPrice - Giá gốc của phòng
 * @param {object} promotion - Document promotion
 * @returns {{ originalPrice, discountedPrice, discountAmount, discountPercent, isPromotion, promotionName, promotionEndDate, remainingPromotionDays }}
 */
function calculateDiscountPrice(originalPrice, promotion, roomObj) {
  if (!promotion || !originalPrice || originalPrice <= 0) {
    return {
      originalPrice: originalPrice || 0,
      discountedPrice: originalPrice || 0,
      discountAmount: 0,
      discountPercent: 0,
      isPromotion: false,
    };
  }

  let discountAmount = 0;

  if (promotion.discountType === "percent") {
    discountAmount = Math.floor((originalPrice * promotion.discountValue) / 100);
    // Áp dụng giới hạn maxDiscount nếu có
    if (promotion.maxDiscount && discountAmount > promotion.maxDiscount) {
      discountAmount = promotion.maxDiscount;
    }
  } else {
    // fixed
    discountAmount = promotion.discountValue;
  }

  // Đảm bảo discountAmount không vượt quá giá gốc
  if (discountAmount > originalPrice) {
    discountAmount = originalPrice;
  }

  const discountedPrice = originalPrice - discountAmount;
  const discountPercent =
    promotion.discountType === "percent"
      ? promotion.discountValue
      : Math.round((discountAmount / originalPrice) * 100);

  // Tính số ngày còn lại
  const now = new Date();
  const endDate = new Date(promotion.endDate);
  const remainingMs = endDate.getTime() - now.getTime();
  const remainingDays = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));

  const result = {
    originalPrice,
    discountedPrice,
    discountAmount,
    discountPercent,
    isPromotion: true,
    promotionName: promotion.name,
    promotionEndDate: promotion.endDate,
    remainingPromotionDays: remainingDays,
  };

  // ── Tính giá khuyến mãi cho thuê ngắn hạn (hourly, daily, weekly, monthly) ──
  if (roomObj) {
    const applyDiscount = (price) => {
      if (!price || price <= 0) return price || 0;
      if (promotion.discountType === "percent") {
        let amt = Math.floor((price * promotion.discountValue) / 100);
        // maxDiscount áp dụng theo tỷ lệ so với giá gốc tháng
        if (promotion.maxDiscount && originalPrice > 0) {
          const maxRatio = promotion.maxDiscount / originalPrice;
          const maxForThis = Math.floor(price * maxRatio);
          if (amt > maxForThis) amt = maxForThis;
        }
        if (amt > price) amt = price;
        return price - amt;
      } else {
        // fixed: áp dụng theo tỷ lệ so với giá gốc tháng
        if (originalPrice > 0) {
          const ratio = promotion.discountValue / originalPrice;
          const fixedAmt = Math.floor(price * ratio);
          return Math.max(0, price - fixedAmt);
        }
        return price;
      }
    };

    result.originalHourlyPrice = roomObj.hourlyPrice || 0;
    result.discountedHourlyPrice = applyDiscount(roomObj.hourlyPrice);
    result.originalDailyPrice = roomObj.dailyPrice || 0;
    result.discountedDailyPrice = applyDiscount(roomObj.dailyPrice);
    result.originalWeeklyPrice = roomObj.weeklyPrice || 0;
    result.discountedWeeklyPrice = applyDiscount(roomObj.weeklyPrice);
    result.originalMonthlyPrice = roomObj.monthlyPrice || 0;
    result.discountedMonthlyPrice = applyDiscount(roomObj.monthlyPrice);
  }

  return result;
}

// ── Validate ngày bắt đầu < ngày kết thúc ──────────────────────────────────
function validatePromotionDate(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return "Ngày không hợp lệ.";
  }
  if (start >= end) {
    return "Ngày bắt đầu phải trước ngày kết thúc.";
  }
  return null;
}

// ── Kiểm tra trùng thời gian promotion trên cùng 1 room ────────────────────
/**
 * Một Room KHÔNG được có 2 Promotion Active/Upcoming trùng thời gian.
 * @param {string[]} roomIds - Mảng ObjectId rooms
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {string|null} excludePromotionId - Bỏ qua promotion đang edit
 * @returns {Promise<{hasConflict: boolean, conflictRooms: object[]}>}
 */
async function checkRoomConflict(roomIds, startDate, endDate, excludePromotionId = null) {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const query = {
    roomIds: { $in: roomIds },
    deletedAt: null,
    status: { $in: ["upcoming", "active"] },
    // Thời gian chồng chéo:
    startDate: { $lte: end },
    endDate: { $gte: start },
  };

  if (excludePromotionId) {
    query._id = { $ne: excludePromotionId };
  }

  const conflicts = await Promotion.find(query).populate("roomIds", "name").lean();

  if (conflicts.length === 0) {
    return { hasConflict: false, conflictRooms: [] };
  }

  // Tìm room nào bị trùng
  const conflictDetails = [];
  for (const promo of conflicts) {
    const overlappingRoomIds = promo.roomIds
      .filter((r) => roomIds.includes(r._id.toString()))
      .map((r) => ({ roomId: r._id, roomName: r.name, promotionName: promo.name }));
    conflictDetails.push(...overlappingRoomIds);
  }

  return { hasConflict: true, conflictRooms: conflictDetails };
}

// ── Tạo Promotion ──────────────────────────────────────────────────────────
async function createPromotion(data, userId) {
  const {
    name, description, discountType, discountValue, maxDiscount,
    roomIds, startDate, endDate,
  } = data;

  // Validate required fields
  if (!name || !name.trim()) throw new Error("Tên chương trình không được để trống.");
  if (!discountType) throw new Error("Loại giảm giá không được để trống.");
  if (!discountValue || discountValue <= 0) throw new Error("Giá trị giảm phải lớn hơn 0.");
  if (discountType === "percent" && discountValue > 100) {
    throw new Error("Giảm giá theo % không được vượt quá 100%.");
  }
  if (!roomIds || roomIds.length === 0) {
    throw new Error("Phải chọn ít nhất 1 phòng áp dụng.");
  }

  // Validate ngày
  const dateError = validatePromotionDate(startDate, endDate);
  if (dateError) throw new Error(dateError);

  // Kiểm tra room tồn tại
  const rooms = await Room.find({ _id: { $in: roomIds } }).select("_id");
  if (rooms.length !== roomIds.length) {
    throw new Error("Một số phòng không tồn tại trong hệ thống.");
  }

  // Kiểm tra trùng thời gian
  const { hasConflict, conflictRooms } = await checkRoomConflict(roomIds, startDate, endDate);
  if (hasConflict) {
    const detail = conflictRooms
      .map((c) => `"${c.roomName}" (trùng với "${c.promotionName}")`)
      .join(", ");
    throw new Error(`Các phòng sau đã có khuyến mãi trong khoảng thời gian này: ${detail}`);
  }

  const parsedStartDate = new Date(startDate);
  parsedStartDate.setHours(0, 0, 0, 0);
  const parsedEndDate = new Date(endDate);
  parsedEndDate.setHours(23, 59, 59, 999);

  // Tính status tự động
  const status = computeStatus(parsedStartDate, parsedEndDate);

  const promotion = await Promotion.create({
    name: name.trim(),
    description: description || "",
    discountType,
    discountValue,
    maxDiscount: discountType === "percent" ? maxDiscount || null : null,
    roomIds,
    startDate: parsedStartDate,
    endDate: parsedEndDate,
    status,
    createdBy: userId,
  });

  return promotion;
}

// ── Cập nhật Promotion ─────────────────────────────────────────────────────
async function updatePromotion(id, data) {
  const promotion = await Promotion.findOne({ _id: id, deletedAt: null });
  if (!promotion) throw new Error("Không tìm thấy chương trình khuyến mãi.");

  const {
    name, description, discountType, discountValue, maxDiscount,
    roomIds, startDate, endDate,
  } = data;

  // Validate
  if (name !== undefined && (!name || !name.trim())) {
    throw new Error("Tên chương trình không được để trống.");
  }
  const finalDiscountType = discountType || promotion.discountType;
  const finalDiscountValue = discountValue !== undefined ? discountValue : promotion.discountValue;
  if (finalDiscountValue <= 0) throw new Error("Giá trị giảm phải lớn hơn 0.");
  if (finalDiscountType === "percent" && finalDiscountValue > 100) {
    throw new Error("Giảm giá theo % không được vượt quá 100%.");
  }

  const finalStartDate = startDate || promotion.startDate;
  const finalEndDate = endDate || promotion.endDate;
  const dateError = validatePromotionDate(finalStartDate, finalEndDate);
  if (dateError) throw new Error(dateError);

  const finalRoomIds = roomIds || promotion.roomIds.map((r) => r.toString());
  if (finalRoomIds.length === 0) {
    throw new Error("Phải chọn ít nhất 1 phòng áp dụng.");
  }

  // Kiểm tra trùng thời gian (loại trừ chính promotion này)
  const { hasConflict, conflictRooms } = await checkRoomConflict(
    finalRoomIds, finalStartDate, finalEndDate, id
  );
  if (hasConflict) {
    const detail = conflictRooms
      .map((c) => `"${c.roomName}" (trùng với "${c.promotionName}")`)
      .join(", ");
    throw new Error(`Các phòng sau đã có khuyến mãi trong khoảng thời gian này: ${detail}`);
  }

  const parsedStartDate = new Date(finalStartDate);
  parsedStartDate.setHours(0, 0, 0, 0);
  const parsedEndDate = new Date(finalEndDate);
  parsedEndDate.setHours(23, 59, 59, 999);

  if (name !== undefined) promotion.name = name.trim();
  if (description !== undefined) promotion.description = description;
  if (discountType !== undefined) promotion.discountType = discountType;
  if (discountValue !== undefined) promotion.discountValue = discountValue;
  if (discountType === "percent" || promotion.discountType === "percent") {
    promotion.maxDiscount = maxDiscount !== undefined ? maxDiscount : promotion.maxDiscount;
  } else {
    promotion.maxDiscount = null;
  }
  if (roomIds !== undefined) promotion.roomIds = roomIds;
  if (startDate !== undefined || endDate !== undefined) {
    promotion.startDate = parsedStartDate;
    promotion.endDate = parsedEndDate;
  }

  // Cập nhật status tự động
  if (promotion.status !== "disabled") {
    promotion.status = computeStatus(promotion.startDate, promotion.endDate);
  }

  await promotion.save();
  return promotion;
}

// ── Soft Delete ─────────────────────────────────────────────────────────────
async function deletePromotion(id) {
  const promotion = await Promotion.findOne({ _id: id, deletedAt: null });
  if (!promotion) throw new Error("Không tìm thấy chương trình khuyến mãi.");

  promotion.deletedAt = new Date();
  promotion.status = "disabled";
  await promotion.save();
  return promotion;
}

// ── Đổi trạng thái ─────────────────────────────────────────────────────────
async function changeStatus(id, newStatus) {
  const validStatuses = ["upcoming", "active", "expired", "disabled"];
  if (!validStatuses.includes(newStatus)) {
    throw new Error(`Trạng thái "${newStatus}" không hợp lệ.`);
  }

  const promotion = await Promotion.findOne({ _id: id, deletedAt: null });
  if (!promotion) throw new Error("Không tìm thấy chương trình khuyến mãi.");

  promotion.status = newStatus;
  await promotion.save();
  return promotion;
}

// ── Danh sách Promotion (có pagination, search, filter, sort) ───────────────
async function getPromotionList(query = {}) {
  const {
    page = 1, limit = 10, search, status, sort = "-createdAt",
  } = query;

  const filter = { deletedAt: null };

  // Search theo tên
  if (search) {
    filter.name = { $regex: search, $options: "i" };
  }

  // Filter theo status
  if (status) {
    filter.status = status;
  }

  const skip = (Number(page) - 1) * Number(limit);
  const total = await Promotion.countDocuments(filter);

  const promotions = await Promotion.find(filter)
    .populate("roomIds", "name price")
    .populate("createdBy", "name")
    .sort(sort)
    .skip(skip)
    .limit(Number(limit))
    .lean();

  // Tự động cập nhật status dựa trên thời gian cho mỗi promotion
  const now = new Date();
  for (const promo of promotions) {
    const computedStatus = computeStatus(promo.startDate, promo.endDate);
    if (promo.status !== "disabled" && promo.status !== computedStatus) {
      // Cập nhật trong DB (fire-and-forget)
      Promotion.updateOne({ _id: promo._id }, { status: computedStatus }).catch(() => {});
      promo.status = computedStatus;
    }
  }

  return {
    data: promotions,
    total,
    page: Number(page),
    totalPages: Math.ceil(total / Number(limit)),
  };
}

// ── Chi tiết Promotion ─────────────────────────────────────────────────────
async function getPromotionDetail(id) {
  const promotion = await Promotion.findOne({ _id: id, deletedAt: null })
    .populate("roomIds", "name price address type status images")
    .populate("createdBy", "name")
    .lean();

  if (!promotion) return null;

  // Cập nhật status nếu cần
  const computedStatus = computeStatus(promotion.startDate, promotion.endDate);
  if (promotion.status !== "disabled" && promotion.status !== computedStatus) {
    Promotion.updateOne({ _id: promotion._id }, { status: computedStatus }).catch(() => {});
    promotion.status = computedStatus;
  }

  return promotion;
}

// ── Lấy promotion active cho 1 room ────────────────────────────────────────
/**
 * Tìm promotion đang active (status = active, thời gian hợp lệ) cho 1 roomId.
 * Nếu có nhiều → ưu tiên cái giảm nhiều nhất (sẽ chỉ có 1 vì đã validate conflict).
 */
async function getActivePromotionForRoom(roomId) {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const promotion = await Promotion.findOne({
    roomIds: roomId,
    deletedAt: null,
    status: "active",
    startDate: { $lte: endOfDay },
    endDate: { $gte: startOfDay },
  }).lean();

  return promotion;
}

// ── Lấy promotion active cho nhiều rooms (batch) ───────────────────────────
/**
 * @param {string[]} roomIds - Mảng ObjectId
 * @returns {Promise<Map<string, object>>} Map<roomId, promotion>
 */
async function getActivePromotionsForRooms(roomIds) {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const promotions = await Promotion.find({
    roomIds: { $in: roomIds },
    deletedAt: null,
    status: "active",
    startDate: { $lte: endOfDay },
    endDate: { $gte: startOfDay },
  }).lean();

  // Build map: roomId → promotion (1 room chỉ có 1 promotion active do validate)
  const map = new Map();
  for (const promo of promotions) {
    for (const rid of promo.roomIds) {
      const key = rid.toString();
      if (roomIds.includes(key) || roomIds.some((r) => r.toString() === key)) {
        map.set(key, promo);
      }
    }
  }

  return map;
}

// ── Gắn thông tin promotion vào 1 room object (mutation) ────────────────────
/**
 * Gộp thông tin pricing trực tiếp vào room object.
 * Frontend sẽ nhận room object đã có thêm các field promotion.
 */
async function attachPromotionToRoom(room) {
  if (!room) return room;
  const roomObj = room.toObject ? room.toObject() : { ...room };
  const promo = await getActivePromotionForRoom(roomObj._id);
  const pricing = calculateDiscountPrice(roomObj.price, promo, roomObj);
  return { ...roomObj, ...pricing };
}

// ── Gắn thông tin promotion vào nhiều rooms (batch, hiệu suất cao) ──────────
async function attachPromotionToRooms(rooms) {
  if (!rooms || rooms.length === 0) return [];

  const roomIds = rooms.map((r) => (r._id ? r._id.toString() : r.toString()));
  const promoMap = await getActivePromotionsForRooms(roomIds);

  return rooms.map((room) => {
    const roomObj = room.toObject ? room.toObject() : { ...room };
    const promo = promoMap.get(roomObj._id.toString()) || null;
    const pricing = calculateDiscountPrice(roomObj.price, promo, roomObj);
    return { ...roomObj, ...pricing };
  });
}

module.exports = {
  createPromotion,
  updatePromotion,
  deletePromotion,
  changeStatus,
  getPromotionList,
  getPromotionDetail,
  validatePromotionDate,
  checkRoomConflict,
  calculateDiscountPrice,
  getActivePromotionForRoom,
  getActivePromotionsForRooms,
  attachPromotionToRoom,
  attachPromotionToRooms,
  computeStatus,
};
