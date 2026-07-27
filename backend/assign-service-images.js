const mongoose = require("mongoose");
require("dotenv").config();
const Service = require("./models/Service");
const { cloudinary } = require("./middleware/upload");

const PIXABAY_API_URL = "https://pixabay.com/api/";

// Ảnh đã tự tay xem qua (không chỉ tin auto-pick) trước khi chọn — mỗi URL đúng
// với tên dịch vụ.
const CURATED_IMAGES = {
  "Dọn giường & thay ga gối":
    "https://pixabay.com/get/ge16debfbe13dd32c3240cbced5ad2ffdb62ee042f9b0eec74119e4c9d0e33fff0c1008fd9a55142956094de063c339b315978b08777ad6202a6260d7db4cdadd_640.jpg",
  "Lau dọn sàn nhà":
    "https://pixabay.com/get/g24030b0b10859930044584af4718ba43f26604e80030406d93c9710a1018cc37b2da087de617cccc6a32934d3874202d846428246672294d2644a50d2e13e291_640.jpg",
  "Dọn phòng tắm/toilet":
    "https://pixabay.com/get/g0253e0669ee99dfa8b6bf2f9035e68aa74fa06ba23514958cc1a84b45b534751927f3ed393c43c9aed422a9a9d9aabd2_640.jpg",
  "Dọn bếp/tủ lạnh":
    "https://pixabay.com/get/g5810a924a01d7fe0aba3bf943ebd2b42e697ad3633acd5f23e27f93b5fd75690a3bd22a529c148f426d0caa6cba7f4d00e414640996a0539484556e7e26b8496_640.jpg",
  "Đổ rác & thay túi rác":
    "https://pixabay.com/get/g6277ee586f14d8a3f95efe833153a4d28d99a6591c84f4fc7e183d7928f557a19711cbace3fb1160ba83ccb5b94e9725452fc439d3f8f4854093bef600a66562_640.jpg",
  "Lau kính/cửa sổ/gương":
    "https://pixabay.com/get/gcf2b44814d0565bc61c1938c95f8f2edb8b397855c78f6254233ad61e11365d320dc76a311548ee4950f1c36546467a888273b8fd0b5f6794f96e2ad8de524e2_640.jpg",
  "Hút bụi & lau nội thất":
    "https://pixabay.com/get/g315fa337f020b9f473662ad0a0cf8d7e5b4ac82c0dac68945344591f1eb072466045bbae68bb222b7ac3215107eede96_640.jpg",
  "Sắp xếp đồ đạc & gấp quần áo":
    "https://pixabay.com/get/g9505cf8098f86d7cc3f26078e4f81ac27647cfe088132d323f8da5118bbdf3b3098d7cb12586808b3bd7186de0fa4343d6679a3f4d3aa924b4792d7deb00e4b1_640.jpg",
  "Rửa xe máy":
    "https://pixabay.com/get/g57151070d7c8c10b1b13d835758331de3dad51ec0b0e78ff14a42e2c59504268aeb24038856d8ad3157b789ab3e1a235c38f2887665c6cfb0de0e6c4a78c1228_640.jpg",
};

// Fallback cho dịch vụ mới không nằm trong CURATED_IMAGES ở trên — tự search
// Pixabay. Tên dịch vụ hay ghép nhiều ý bằng "&"/"/" khiến search ra 0 kết quả,
// nên chỉ lấy phần trước dấu ghép đầu tiên.
function simplifyQuery(name) {
  return name.split(/[&/]/)[0].trim();
}

async function findImageUrl(query) {
  const apiKey = process.env.PIXABAY_API_KEY;
  const simplified = simplifyQuery(query);
  const url = `${PIXABAY_API_URL}?key=${apiKey}&q=${encodeURIComponent(simplified)}&image_type=photo&per_page=3&safesearch=true&lang=vi`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Pixabay trả về ${res.status}`);
  }
  const data = await res.json();
  return data.hits?.[0]?.webformatURL || null;
}

async function assignImages() {
  if (!process.env.PIXABAY_API_KEY) {
    console.error("Thiếu PIXABAY_API_KEY trong .env — dừng lại.");
    process.exit(1);
  }

  // Xử lý dịch vụ chưa có ảnh, HOẶC dịch vụ có tên nằm trong CURATED_IMAGES —
  // 2 dịch vụ "Lau dọn sàn nhà"/"Rửa xe máy" đã bị gán nhầm ảnh (Pixabay tự
  // chọn top-1 sai hoàn toàn ở lần chạy trước), cần ghi đè lại dù đã có ảnh.
  const curatedNames = Object.keys(CURATED_IMAGES);
  const services = await Service.find({
    $or: [{ name: { $in: curatedNames } }, { images: { $size: 0 } }],
  });
  console.log(`Xử lý ${services.length} dịch vụ (thiếu ảnh hoặc cần ghi đè ảnh sai).`);

  let done = 0;
  let skipped = 0;

  for (const service of services) {
    try {
      const imageUrl = CURATED_IMAGES[service.name] || (await findImageUrl(service.name));
      if (!imageUrl) {
        console.log(`Bỏ qua "${service.name}" — Pixabay không tìm được ảnh phù hợp.`);
        skipped++;
        continue;
      }

      const result = await cloudinary.uploader.upload(imageUrl, { folder: "room_management/services" });
      service.images = [result.secure_url];
      await service.save();
      console.log(`Đã gán ảnh cho "${service.name}".`);
      done++;
    } catch (err) {
      console.log(`Lỗi khi xử lý "${service.name}": ${err.message} — bỏ qua, tiếp tục dịch vụ tiếp theo.`);
      skipped++;
    }
  }

  console.log(`Hoàn tất: ${done} dịch vụ được gán ảnh, ${skipped} bỏ qua.`);
}

async function main() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");
    await assignImages();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
