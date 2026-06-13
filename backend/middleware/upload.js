const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;

// Cấu hình Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Cấu hình Storage cho Multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    // Xác định resource_type (image hoặc video)
    let resource_type = "image";
    if (file.mimetype.startsWith("video/")) {
      resource_type = "video";
    }

    // Các loại định dạng cho phép
    let allowed_formats = [];
    if (resource_type === "image") {
      allowed_formats = ["jpg", "jpeg", "png", "webp"];
    } else if (resource_type === "video") {
      allowed_formats = ["mp4"];
    }

    return {
      folder: "room_management/incidents",
      resource_type: resource_type,
      allowed_formats: allowed_formats,
    };
  },
});

// Khởi tạo multer instance
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // Giới hạn kích thước file (50MB) để cho phép video
  },
});

// Middleware xử lý multiple files (5 ảnh, 1 video)
const uploadIncidentFiles = upload.fields([
  { name: "images", maxCount: 5 },
  { name: "video", maxCount: 1 }, // Frontend gửi video qua key "video" hoặc "videos" (chúng ta sẽ bắt 'videos' trong validation hoặc đổi tên)
]);

// Cấu hình field name linh hoạt
const uploadMultiple = upload.fields([
  { name: "images", maxCount: 5 },
  { name: "videos", maxCount: 1 }, // Nếu frontend gửi với key 'videos'
  { name: "afterImages", maxCount: 5 }, // Cho phép upload ảnh sau khi sửa
]);

module.exports = {
  cloudinary,
  uploadMultiple
};
