const { cloudinary } = require("../middleware/upload");
const { GoogleGenAI } = require("@google/genai");

const genaiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
    // Pixabay mặc định coi query là tiếng Anh (lang=en) nếu không truyền lang —
    // admin gõ tiếng Việt sẽ ra kết quả không liên quan nếu thiếu tham số này.
    const url = `${PIXABAY_API_URL}?key=${apiKey}&q=${encodeURIComponent(q)}&image_type=photo&per_page=20&safesearch=true&lang=vi`;
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

const generateServiceImage = async (req, res) => {
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ message: "Tính năng AI tạo ảnh chưa được cấu hình." });
  }

  const prompt = (req.body.prompt || "").trim();
  if (!prompt) {
    return res.status(400).json({ message: "Thiếu mô tả ảnh cần tạo." });
  }

  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), 30000)
    );
    const genPromise = genaiClient.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: prompt,
    });
    const response = await Promise.race([genPromise, timeoutPromise]);

    const imagePart = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
    if (!imagePart) {
      return res.status(502).json({ message: "AI không tạo được ảnh, thử mô tả khác." });
    }

    const dataUri = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
    const result = await cloudinary.uploader.upload(dataUri, { folder: "room_management/services" });
    res.json({ url: result.secure_url });
  } catch (err) {
    console.error("Generate service image error:", err);
    res.status(502).json({ message: "Không tạo được ảnh, thử lại sau." });
  }
};

module.exports = { searchServiceImages, importServiceImage, uploadServiceImagesHandler, generateServiceImage };
