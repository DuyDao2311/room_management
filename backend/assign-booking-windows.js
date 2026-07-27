const mongoose = require("mongoose");
require("dotenv").config();
const Service = require("./models/Service");

// Khung giờ nhận đặt gợi ý theo tính chất từng dịch vụ — đã duyệt với thb.
// 2 dịch vụ không có trong map này ("Hỗ trợ kỹ thuật khẩn", "Đưa đón sân bay
// Nội Bài") cố ý để trống (24/7, không giới hạn) vì bản chất khẩn cấp/giờ bay
// bất định.
const BOOKING_WINDOWS = {
  "Dọn giường & thay ga gối": { start: "08:00", end: "20:00" },
  "Lau dọn sàn nhà": { start: "08:00", end: "20:00" },
  "Dọn phòng tắm/toilet": { start: "08:00", end: "20:00" },
  "Dọn bếp/tủ lạnh": { start: "08:00", end: "20:00" },
  "Đổ rác & thay túi rác": { start: "07:00", end: "21:00" },
  "Lau kính/cửa sổ/gương": { start: "08:00", end: "18:00" },
  "Hút bụi & lau nội thất": { start: "08:00", end: "20:00" },
  "Sắp xếp đồ đạc & gấp quần áo": { start: "08:00", end: "20:00" },
  "Bữa sáng mang đến phòng": { start: "06:00", end: "10:00" },
  "Giỏ quà chào đón": { start: "08:00", end: "22:00" },
  "Đầu bếp riêng nấu tại phòng": { start: "11:00", end: "21:00" },
  "Giặt ủi hơi đồ cao cấp": { start: "08:00", end: "19:00" },
  "Giặt ủi lấy-trả trong ngày": { start: "07:00", end: "18:00" },
  "Thuê thêm thiết bị": { start: "08:00", end: "20:00" },
  "Làm tóc/trang điểm tại phòng": { start: "08:00", end: "20:00" },
  "Massage thư giãn tại phòng": { start: "09:00", end: "22:00" },
  "Thuê xe máy theo ngày": { start: "06:00", end: "22:00" },
  "Tour riêng trong ngày": { start: "06:00", end: "18:00" },
};

async function assignBookingWindows() {
  let done = 0;
  let notFound = 0;

  for (const [name, window] of Object.entries(BOOKING_WINDOWS)) {
    const service = await Service.findOne({ name });
    if (!service) {
      console.log(`Không tìm thấy dịch vụ "${name}" — bỏ qua.`);
      notFound++;
      continue;
    }
    service.bookingWindowStart = window.start;
    service.bookingWindowEnd = window.end;
    await service.save();
    console.log(`Đã set "${name}": ${window.start}–${window.end}.`);
    done++;
  }

  console.log(`Hoàn tất: ${done} dịch vụ đã set khung giờ, ${notFound} không tìm thấy.`);
}

async function main() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");
    await assignBookingWindows();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
