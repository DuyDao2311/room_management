const { cloudinary } = require("../middleware/upload");

const PIXABAY_API_URL = "https://pixabay.com/api/";
const ALLOWED_IMPORT_HOST = "pixabay.com";

const searchServiceImages = async (req, res) => {
  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ message: "Tính năng tìm ảnh mẫu chưa được cấu hình." });
  }

  const q = (req.query.q || "").trim();
  if (!q) {
    return res.status(400).json({ message: "Vui lòng nhập từ khóa tìm kiếm." });
  }

  try {
    const url = `${PIXABAY_API_URL}?key=${apiKey}&q=${encodeURIComponent(q)}&image_type=photo&per_page=20&safesearch=true`;
    const pixabayRes = await fetch(url);
    if (!pixabayRes.ok) {
      return res.status(502).json({ message: "Không tìm được ảnh, thử lại sau." });
    }
    const data = await pixabayRes.json();
    const results = data.hits.map((hit) => ({
      id: hit.id,
      thumbnailUrl: hit.previewURL,
      imageUrl: hit.webformatURL,
    }));
    res.json(results);
  } catch (err) {
    console.error("Search service images error:", err);
    res.status(502).json({ message: "Không tìm được ảnh, thử lại sau." });
  }
};

const importServiceImage = async (req, res) => {
  const { imageUrl } = req.body;
  if (!imageUrl) {
    return res.status(400).json({ message: "Thiếu imageUrl." });
  }

  let hostname;
  try {
    hostname = new URL(imageUrl).hostname;
  } catch {
    return res.status(400).json({ message: "imageUrl không hợp lệ." });
  }
  if (hostname !== ALLOWED_IMPORT_HOST) {
    return res.status(400).json({ message: "Chỉ chấp nhận ảnh từ Pixabay." });
  }

  try {
    const result = await cloudinary.uploader.upload(imageUrl, { folder: "room_management/services" });
    res.json({ url: result.secure_url });
  } catch (err) {
    console.error("Import service image error:", err);
    res.status(502).json({ message: "Không thể tải ảnh, thử lại sau." });
  }
};

const uploadServiceImagesHandler = async (req, res) => {
  const urls = (req.files || []).map((file) => file.path);
  res.json({ urls });
};

module.exports = { searchServiceImages, importServiceImage, uploadServiceImagesHandler };
