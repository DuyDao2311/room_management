/**
 * Migration: Chuyển đổi dữ liệu images cũ (mảng String)
 * sang Object { url, isPrimary, order, createdAt }.
 * 
 * Script này chạy tự động mỗi khi backend khởi động (idempotent).
 * Nếu images đã ở dạng Object mới, sẽ bỏ qua.
 */
const Room = require("../models/Room");

const migrateRoomImages = async () => {
  try {
    // Tìm phòng mà images chứa String (dữ liệu cũ) hoặc images rỗng
    const rooms = await Room.find().lean();
    let migratedCount = 0;

    for (const room of rooms) {
      if (!room.images || room.images.length === 0) continue;

      // Kiểm tra xem images[0] có phải String hay không
      const firstImg = room.images[0];
      if (typeof firstImg === "string") {
        // Đây là dữ liệu cũ → chuyển đổi
        const newImages = room.images
          .filter((url) => typeof url === "string" && url.trim())
          .map((url, idx) => ({
            url: url.trim(),
            isPrimary: idx === 0,
            order: idx,
            createdAt: new Date(),
          }));

        await Room.updateOne(
          { _id: room._id },
          { $set: { images: newImages } }
        );
        migratedCount++;
      }
      // Nếu images[0] là Object → đã migration rồi, bỏ qua
    }

    if (migratedCount > 0) {
      console.log(`✅ [Migration] Đã chuyển đổi images cho ${migratedCount} phòng.`);
    }
  } catch (err) {
    console.error("❌ [Migration] Lỗi chuyển đổi images:", err.message);
  }
};

module.exports = migrateRoomImages;
