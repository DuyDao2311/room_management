const Incident = require("../models/Incident");
const IncidentTimeline = require("../models/IncidentTimeline");
const Room = require("../models/Room");
const Contract = require("../models/Contract");
const User = require("../models/User");
const notificationService = require("../utils/notificationService");

const getRootStartDate = async (contractId) => {
  let currentContract = await Contract.findById(contractId);
  if (!currentContract) return new Date();

  let rootStartDate = currentContract.startDate;

  while (currentContract && currentContract.parentContract) {
    currentContract = await Contract.findById(currentContract.parentContract);
    if (currentContract) {
      rootStartDate = currentContract.startDate;
    }
  }
  return rootStartDate;
};

const createIncident = async (tenantId, data, files) => {
  const { roomId, contractId, category, priority, description, contactPhone, availableTime } = data;

  // 1. Kiểm tra Contract có hợp lệ và thuộc về tenant này không
  const contract = await Contract.findById(contractId);
  if (!contract) {
    throw new Error("Hợp đồng không tồn tại.");
  }

  if (contract.tenant.toString() !== tenantId) {
    throw new Error("Bạn không có quyền báo cáo sự cố cho hợp đồng này.");
  }

  if (contract.status !== "active") {
    throw new Error("Hợp đồng này không còn hiệu lực.");
  }

  // 2. Kiểm tra Room
  const room = await Room.findById(roomId);
  if (!room) {
    throw new Error("Phòng không tồn tại.");
  }

  if (contract.room.toString() !== room._id.toString()) {
    throw new Error("Phòng không khớp với hợp đồng.");
  }

  // 3. Xử lý URLs từ Cloudinary (req.files)
  let imageUrls = [];
  let videoUrls = [];

  if (files) {
    if (files.images) {
      imageUrls = files.images.map(file => file.path); // path từ CloudinaryStorage là URL đầy đủ
    }
    if (files.videos) {
      videoUrls = files.videos.map(file => file.path);
    }
  }

  // 4. Auto-assign Staff theo district
  const district = room.district || "Chưa xác định";
  let assignedStaffId = null;

  if (district !== "Chưa xác định") {
    const staff = await User.findOne({
      role: "staff",
      managedDistricts: district,
      isActive: true,
    });

    if (staff) {
      assignedStaffId = staff._id;
    }
  }

  // 5. Tạo và lưu Incident
  const incident = new Incident({
    room: roomId,
    contract: contractId,
    tenant: tenantId,
    assignedStaff: assignedStaffId,
    district: district,
    category,
    priority: priority || "Bình thường",
    description,
    contactPhone,
    availableTime,
    images: imageUrls,
    videos: videoUrls,
    status: assignedStaffId ? "assigned" : "pending",
  });

  await incident.save();

  // 6. Lưu Timeline
  await IncidentTimeline.create({
    incident: incident._id,
    status: "created",
    note: "Sự cố được báo cáo bởi người thuê.",
    createdBy: tenantId,
  });

  if (assignedStaffId) {
    await IncidentTimeline.create({
      incident: incident._id,
      status: "assigned",
      note: "Hệ thống tự động phân công nhân viên xử lý.",
      createdBy: assignedStaffId,
    });
  }

  // 7. Gửi thông báo
  await notificationService.notifyNewIncident(incident);

  return incident;
};

const getMyIncidents = async (tenantId) => {
  const incidents = await Incident.find({ tenant: tenantId })
    .populate("room", "name roomNumber")
    .populate("contract", "startDate endDate status")
    .populate("assignedStaff", "name phone email avatar")
    .sort({ createdAt: -1 });

  const incidentsObj = await Promise.all(incidents.map(async (inc) => {
    const obj = inc.toObject();
    if (inc.contract) {
      const startDate = await getRootStartDate(inc.contract._id);
      const now = new Date();
      obj.monthsRented = (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth());
    }
    return obj;
  }));
  return incidentsObj;
};

const getIncidentById = async (incidentId, userId, userRole) => {
  const incident = await Incident.findById(incidentId)
    .populate("room", "name roomNumber district")
    .populate("contract", "startDate endDate status")
    .populate("tenant", "name phone email")
    .populate("assignedStaff", "name phone email avatar");

  if (!incident) {
    throw new Error("Không tìm thấy báo cáo sự cố.");
  }

  // Kiểm tra quyền (nếu là tenant)
  if (userRole === "tenant" && incident.tenant._id.toString() !== userId.toString()) {
    throw new Error("Bạn không có quyền xem báo cáo này.");
  }

  const incidentObj = incident.toObject();

  if (incident.contract) {
    const startDate = await getRootStartDate(incident.contract._id);
    const now = new Date();
    incidentObj.monthsRented = (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth());
  }

  return incidentObj;
};

const getAllIncidents = async (query = {}) => {
  const { page = 1, limit = 9, search, category, priority, status } = query;
  const skip = (page - 1) * limit;

  let filter = {};

  if (category) filter.category = category;
  if (priority) filter.priority = priority;
  if (status) filter.status = status;

  if (search) {
    const searchRegex = new RegExp(search, "i");
    const rooms = await Room.find({ name: searchRegex }).select("_id");
    const roomIds = rooms.map(r => r._id);

    filter.$or = [
      { ticketCode: searchRegex },
      { room: { $in: roomIds } }
    ];
  }

  const incidents = await Incident.find(filter)
    .populate("room", "name roomNumber district")
    .populate("contract", "startDate endDate status")
    .populate("tenant", "name phone email")
    .populate("assignedStaff", "name phone email avatar")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const incidentsObj = await Promise.all(incidents.map(async (inc) => {
    const obj = inc.toObject();
    if (inc.contract) {
      const startDate = await getRootStartDate(inc.contract._id);
      const now = new Date();
      obj.monthsRented = (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth());
    }
    return obj;
  }));

  const total = await Incident.countDocuments(filter);

  return {
    incidents: incidentsObj,
    totalPages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    totalIncidents: total
  };
};

const getDistrictIncidents = async (districts, query = {}) => {
  const { page = 1, limit = 9, search, category, priority, status } = query;
  const skip = (page - 1) * limit;

  let filter = { district: { $in: districts } };

  if (category) filter.category = category;
  if (priority) filter.priority = priority;
  if (status) filter.status = status;

  if (search) {
    const searchRegex = new RegExp(search, "i");
    const rooms = await Room.find({ name: searchRegex }).select("_id");
    const roomIds = rooms.map(r => r._id);

    filter.$or = [
      { ticketCode: searchRegex },
      { room: { $in: roomIds } }
    ];
  }

  const incidents = await Incident.find(filter)
    .populate("room", "name roomNumber district")
    .populate("contract", "startDate endDate status")
    .populate("tenant", "name phone email")
    .populate("assignedStaff", "name phone email avatar")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const incidentsObj = await Promise.all(incidents.map(async (inc) => {
    const obj = inc.toObject();
    if (inc.contract) {
      const startDate = await getRootStartDate(inc.contract._id);
      const now = new Date();
      obj.monthsRented = (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth());
    }
    return obj;
  }));

  const total = await Incident.countDocuments(filter);

  return {
    incidents: incidentsObj,
    totalPages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    totalIncidents: total
  };
};

const updateIncidentStatus = async (incidentId, status, userId, userRole, data = {}, files = null) => {
  const incident = await Incident.findById(incidentId).populate("contract room tenant");
  if (!incident) throw new Error("Không tìm thấy báo cáo sự cố.");

  if (userRole === "staff") {
    // Staff chỉ được cập nhật incident trong district của mình
    const staff = await User.findById(userId);
    if (!staff.managedDistricts.includes(incident.district)) {
      throw new Error("Bạn không có quyền cập nhật sự cố ở khu vực này.");
    }
  }

  const validTransitions = {
    "pending": ["assigned", "rejected"],
    "assigned": ["in_progress", "rejected"],
    "in_progress": ["resolved"],
    "resolved": ["closed"],
    "closed": [],
    "rejected": []
  };

  if (!validTransitions[incident.status].includes(status)) {
    throw new Error(`Không thể chuyển trạng thái từ ${incident.status} sang ${status}.`);
  }

  let note = data.note || "";

  if (status === "assigned" && !incident.assignedStaff) {
    incident.assignedStaff = userId;
  }

  if (status === "resolved") {
    incident.resolutionNote = data.resolutionNote || "";
    incident.repairCost = data.repairCost || 0;

    if (files && files.afterImages) {
      incident.afterImages = files.afterImages.map(file => file.path);
    }

    // --- XỬ LÝ CHI PHÍ ---
    const contract = incident.contract;
    if (contract && incident.repairCost > 0) {
      const startDate = await getRootStartDate(contract._id);
      const now = new Date();
      // Tính số tháng gần đúng
      const monthsDiff = (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth());

      let finalCostPayer = "none";
      if (monthsDiff < 3) {
        finalCostPayer = "landlord";
      } else {
        finalCostPayer = data.costPayer === "tenant" ? "tenant" : "landlord";
      }

      incident.costPayer = finalCostPayer;

      if (finalCostPayer === "landlord") {
        // Tạo Expense
        const Expense = require("../models/Expense");
        await Expense.create({
          amount: incident.repairCost,
          category: "repair",
          description: `Chi phí sửa chữa sự cố ${incident.ticketCode}`,
          incident: incident._id,
          createdBy: userId,
        });
        note += " (F4 đã chịu chi phí bảo trì)";
      } else if (finalCostPayer === "tenant") {
        // Tạo Invoice
        const Invoice = require("../models/Invoice");
        let tenantName = "Khách thuê";
        if (incident.tenant && incident.tenant.name) tenantName = incident.tenant.name;

        const repairInvoice = await Invoice.create({
          type: "repair",
          contract: contract._id,
          tenantId: incident.tenant ? incident.tenant._id : null,
          representativeName: contract.representativeName || tenantName,
          roomName: incident.room ? incident.room.name : "N/A",
          rentAmount: 0, // Bat buoc bang 0 vi day la hoa don sua chua
          repairAmount: incident.repairCost,
          incidentId: incident._id,
          createdBy: userId,
          dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          sentAt: new Date()
        });
        incident.repairInvoice = repairInvoice._id;
        note += " (Đã tạo hóa đơn sửa chữa cho khách thuê)";

        // Gửi thông báo & email cho khách thuê về hóa đơn mới
        await notificationService.notifyTenantInvoiceSent(repairInvoice);
      }
    }
  }

  incident.status = status;
  await incident.save();

  await IncidentTimeline.create({
    incident: incidentId,
    status,
    note,
    createdBy: userId,
  });

  // Notify tenant
  await notificationService.notifyTenantIncidentStatus(incident, status, note);

  return incident;
};

const getIncidentTimeline = async (incidentId) => {
  return await IncidentTimeline.find({ incident: incidentId })
    .populate("createdBy", "name role avatar")
    .sort({ createdAt: 1 });
};

const rateIncident = async (incidentId, tenantId, rating, comment) => {
  const incident = await Incident.findById(incidentId);
  if (!incident) throw new Error("Không tìm thấy báo cáo sự cố.");

  if (incident.tenant.toString() !== tenantId) {
    throw new Error("Bạn không có quyền đánh giá sự cố này.");
  }

  if (incident.status !== "resolved" && incident.status !== "closed") {
    throw new Error("Sự cố phải ở trạng thái đã giải quyết hoặc đóng mới có thể đánh giá.");
  }

  if (incident.rating) {
    throw new Error("Sự cố này đã được đánh giá.");
  }

  incident.rating = rating;
  if (comment) incident.ratingComment = comment;
  incident.ratedAt = new Date();

  await incident.save();

  await IncidentTimeline.create({
    incident: incidentId,
    status: incident.status,
    note: `Người thuê đã đánh giá ${rating} sao. ${comment ? `Nhận xét: ${comment}` : ''}`,
    createdBy: tenantId,
  });

  // Gửi thông báo cho admin/staff
  await notificationService.notifyStaffIncidentRated(incident);

  return incident;
};

const getIncidentStats = async (userRole, userDistricts = []) => {
  let filter = {};
  if (userRole === "staff") {
    filter.district = { $in: userDistricts };
  }

  const stats = await Incident.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        inProgress: {
          $sum: {
            $cond: [{ $in: ["$status", ["pending", "assigned", "in_progress"]] }, 1, 0]
          }
        },
        completed: {
          $sum: {
            $cond: [{ $in: ["$status", ["resolved", "closed"]] }, 1, 0]
          }
        },
        totalCost: {
          $sum: {
            $cond: [{ $eq: ["$costPayer", "landlord"] }, "$repairCost", 0]
          }
        }
      }
    }
  ]);

  if (stats.length === 0) {
    return { total: 0, inProgress: 0, completed: 0, totalCost: 0 };
  }

  return {
    total: stats[0].total,
    inProgress: stats[0].inProgress,
    completed: stats[0].completed,
    totalCost: stats[0].totalCost || 0
  };
};

module.exports = {
  createIncident,
  getMyIncidents,
  getIncidentById,
  getAllIncidents,
  getDistrictIncidents,
  updateIncidentStatus,
  getIncidentTimeline,
  rateIncident,
  getIncidentStats
};
