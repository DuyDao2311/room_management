const mongoose = require("mongoose");
const Service = require("./models/Service");
const ServiceBooking = require("./models/ServiceBooking");
require("dotenv").config();

const OLD_SERVICE_NAME = "Dọn phòng";
const OLD_SERVICE_CATEGORY = "cleaning";

const NEW_SERVICES = [
  {
    name: "Dọn giường & thay ga gối",
    description: "Dọn dẹp giường ngủ theo 3 mức độ, từ chỉnh trang gọn gàng đến thay ga/vỏ gối và khử mùi nệm.",
    variants: [
      { label: "Nhẹ", price: 15000, description: "Chỉnh lại ga giường, gấp gối gọn gàng (không thay ga mới)" },
      { label: "Tiêu chuẩn", price: 25000, description: "Thay ga trải giường + vỏ gối mới" },
      { label: "Sâu", price: 40000, description: "Thay ga trải giường + vỏ gối mới, giặt/khử mùi nệm" },
    ],
  },
  {
    name: "Lau dọn sàn nhà",
    description: "Quét và lau sàn phòng theo 3 mức độ.",
    variants: [
      { label: "Nhẹ", price: 20000, description: "Quét sàn khô" },
      { label: "Tiêu chuẩn", price: 35000, description: "Quét + lau ướt toàn bộ sàn" },
      { label: "Sâu", price: 55000, description: "Quét + lau ướt toàn bộ sàn, tẩy vết bẩn cứng đầu, lau chân tường" },
    ],
  },
  {
    name: "Dọn phòng tắm/toilet",
    description: "Vệ sinh phòng tắm và toilet theo 3 mức độ.",
    variants: [
      { label: "Nhẹ", price: 25000, description: "Xả nước, lau sơ bồn cầu + bồn rửa" },
      { label: "Tiêu chuẩn", price: 40000, description: "Cọ rửa toàn bộ bồn cầu, bồn rửa, sàn nhà tắm" },
      { label: "Sâu", price: 65000, description: "Cọ rửa toàn bộ + tẩy cặn/ố vàng, khử khuẩn" },
    ],
  },
  {
    name: "Dọn bếp/tủ lạnh",
    description: "Dọn dẹp khu bếp theo 3 mức độ.",
    variants: [
      { label: "Nhẹ", price: 20000, description: "Rửa bát đĩa đang có sẵn (nước rửa chén thường), lau qua mặt bếp" },
      { label: "Tiêu chuẩn", price: 35000, description: "Rửa bát đĩa + lau sạch bếp gas/hồng ngoại, bồn rửa" },
      { label: "Sâu", price: 60000, description: "Rửa bát đĩa + lau sạch bếp, bồn rửa, dọn tủ lạnh mini, tẩy dầu mỡ khu bếp" },
    ],
  },
  {
    name: "Đổ rác & thay túi rác",
    description: "Xử lý rác thải trong phòng theo 3 mức độ.",
    variants: [
      { label: "Nhẹ", price: 10000, description: "Gom rác, buộc túi lại" },
      { label: "Tiêu chuẩn", price: 15000, description: "Gom rác, buộc túi lại + thay túi rác mới" },
      { label: "Sâu", price: 20000, description: "Gom rác, thay túi rác mới, lau rửa thùng rác, xịt khử mùi" },
    ],
  },
  {
    name: "Lau kính/cửa sổ/gương",
    description: "Lau chùi bề mặt kính trong phòng theo 3 mức độ.",
    variants: [
      { label: "Nhẹ", price: 15000, description: "Lau gương phòng" },
      { label: "Tiêu chuẩn", price: 25000, description: "Lau gương + lau cửa sổ, cửa kính ra vào" },
      { label: "Sâu", price: 45000, description: "Lau gương, cửa sổ, cửa kính + lau kính ban công, đánh bay vết ố lâu ngày" },
    ],
  },
  {
    name: "Hút bụi & lau nội thất",
    description: "Vệ sinh bụi bẩn trên nội thất theo 3 mức độ.",
    variants: [
      { label: "Nhẹ", price: 20000, description: "Hút bụi sàn/thảm" },
      { label: "Tiêu chuẩn", price: 35000, description: "Hút bụi sàn/thảm + lau bàn ghế, tủ, kệ" },
      { label: "Sâu", price: 60000, description: "Hút bụi sàn/thảm, lau bàn ghế tủ kệ + hút bụi nệm/sofa, rèm cửa" },
    ],
  },
  {
    name: "Sắp xếp đồ đạc & gấp quần áo",
    description: "Sắp xếp không gian và quần áo theo 3 mức độ.",
    variants: [
      { label: "Nhẹ", price: 15000, description: "Gấp quần áo đang để sẵn trên giường/ghế" },
      { label: "Tiêu chuẩn", price: 25000, description: "Gấp quần áo + sắp xếp đồ đạc gọn vào tủ/kệ" },
      { label: "Sâu", price: 40000, description: "Gấp quần áo, sắp xếp đồ đạc + phân loại đồ theo khu vực, dọn gọn toàn bộ" },
    ],
  },
];

async function retireOldService() {
  const oldService = await Service.findOne({ name: OLD_SERVICE_NAME, category: OLD_SERVICE_CATEGORY });
  if (!oldService) {
    console.log(`Không tìm thấy dịch vụ "${OLD_SERVICE_NAME}" — bỏ qua bước xóa.`);
    return;
  }

  const bookingCount = await ServiceBooking.countDocuments({ service: oldService._id });
  if (bookingCount > 0) {
    oldService.isActive = false;
    await oldService.save();
    console.log(
      `CẢNH BÁO: "${OLD_SERVICE_NAME}" đã có ${bookingCount} lượt đặt — KHÔNG xóa được (an toàn dữ liệu), chỉ tạm dừng. Cần xử lý tay nếu muốn dọn hẳn.`
    );
    return;
  }

  oldService.isActive = false;
  await oldService.save();
  await Service.findByIdAndDelete(oldService._id);
  console.log(`Đã xóa "${OLD_SERVICE_NAME}" (không có booking nào tham chiếu).`);
}

async function seedNewServices() {
  let created = 0;
  let skipped = 0;

  for (const svc of NEW_SERVICES) {
    const existing = await Service.findOne({ name: svc.name, category: "cleaning" });
    if (existing) {
      console.log(`Bỏ qua "${svc.name}" — đã tồn tại.`);
      skipped++;
      continue;
    }

    await Service.create({
      name: svc.name,
      category: "cleaning",
      description: svc.description,
      usesVariants: true,
      variants: svc.variants,
      requiresCapacityMatch: false,
    });
    console.log(`Đã tạo "${svc.name}" với ${svc.variants.length} mức độ (isActive: false — cần admin tự bật).`);
    created++;
  }

  console.log(`Hoàn tất: ${created} dịch vụ mới, ${skipped} bỏ qua (đã tồn tại).`);
}

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    await retireOldService();
    await seedNewServices();

    console.log("Seed hoàn tất");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seed();
