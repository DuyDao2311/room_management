const Service = require("../models/Service");
const ServiceBooking = require("../models/ServiceBooking");
const { notifyTenantServiceDeactivated, sendSocketNotification } = require("../utils/notificationService");

const isStaffOrAdmin = (user) => !!user && ["admin", "staff"].includes(user.role);

const isValidCarOptions = (carOptions) =>
  Array.isArray(carOptions) &&
  carOptions.length > 0 &&
  carOptions.every((o) => o && o.label && Number(o.capacity) >= 1 && Number(o.price) >= 0);

const createService = async (req, res) => {
  try {
    const { name, category, description, price, unit, images, carOptions } = req.body;

    if (!name || !category) {
      return res.status(400).json({
        message: "Vui lòng cung cấp đầy đủ: tên, loại dịch vụ.",
      });
    }

    if (category === "transport") {
      if (!isValidCarOptions(carOptions)) {
        return res.status(400).json({
          message: "Dịch vụ đưa đón cần ít nhất 1 loại xe hợp lệ (tên, sức chứa, giá).",
        });
      }
    } else if (price == null || !unit) {
      return res.status(400).json({
        message: "Vui lòng cung cấp đầy đủ: tên, loại dịch vụ, giá, đơn vị tính.",
      });
    }

    const service = await Service.create({
      name,
      category,
      description: description || "",
      price: category === "transport" ? undefined : price,
      unit: category === "transport" ? undefined : unit,
      carOptions: category === "transport" ? carOptions : [],
      images: images || [],
      createdBy: req.user._id,
    });

    res.status(201).json(service);
  } catch (err) {
    console.error("Create service error:", err);
    res.status(400).json({ message: err.message || "Không thể tạo dịch vụ." });
  }
};

const getServices = async (req, res) => {
  try {
    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    if (!isStaffOrAdmin(req.user)) filter.isActive = true;

    const services = await Service.find(filter).sort({ createdAt: -1 });
    res.json(services);
  } catch (err) {
    console.error("Get services error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
};

const getServiceById = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ message: "Không tìm thấy dịch vụ." });

    if (!service.isActive && !isStaffOrAdmin(req.user)) {
      return res.status(404).json({ message: "Dịch vụ này hiện đã tạm ngừng kinh doanh." });
    }

    res.json(service);
  } catch (err) {
    console.error("Get service error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
};

const getServiceReviews = async (req, res) => {
  try {
    const reviews = await ServiceBooking.find({ service: req.params.id, rating: { $ne: null } })
      .populate("tenant", "name")
      .select("rating review tags createdAt tenant")
      .sort({ createdAt: -1 });

    res.json(reviews);
  } catch (err) {
    console.error("Get service reviews error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
};

const updateService = async (req, res) => {
  try {
    const { name, category, description, price, unit, images, isActive, carOptions } = req.body;

    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ message: "Không tìm thấy dịch vụ." });

    const wasActive = service.isActive;

    if (name !== undefined) service.name = name;
    if (category !== undefined) service.category = category;
    if (description !== undefined) service.description = description;
    if (price !== undefined) service.price = price;
    if (unit !== undefined) service.unit = unit;
    if (images !== undefined) service.images = images;
    if (isActive !== undefined) service.isActive = isActive;
    if (carOptions !== undefined) service.carOptions = carOptions;

    if (service.category === "transport" && !isValidCarOptions(service.carOptions)) {
      return res.status(400).json({
        message: "Dịch vụ đưa đón cần ít nhất 1 loại xe hợp lệ (tên, sức chứa, giá).",
      });
    }

    await service.save();

    // Vừa tạm ngừng dịch vụ → báo cho tenant đang có booking pending/confirmed (không tự hủy).
    // Service đã save() thành công ở trên — lỗi ở bước thông báo KHÔNG được làm hỏng response chính.
    if (wasActive && service.isActive === false) {
      try {
        const affectedBookings = await ServiceBooking.find({
          service: service._id,
          status: { $in: ["pending", "confirmed"] },
        }).populate("tenant", "name email");
        const io = req.app.get("io");
        await Promise.allSettled(
          affectedBookings.map(async (booking) => {
            try {
              const notifs = await notifyTenantServiceDeactivated(booking, service);
              if (io && notifs && notifs.length > 0) {
                notifs.forEach((n) => sendSocketNotification(io, "new_notification", n));
              }
            } catch (notifErr) {
              console.error("Notify service deactivated error:", notifErr);
            }
          })
        );
      } catch (lookupErr) {
        console.error("Lookup affected service bookings error:", lookupErr);
      }
    }

    res.json(service);
  } catch (err) {
    console.error("Update service error:", err);
    res.status(400).json({ message: err.message || "Không thể cập nhật dịch vụ." });
  }
};

module.exports = {
  createService,
  getServices,
  getServiceById,
  getServiceReviews,
  updateService,
};
