const incidentService = require("../services/incident.service");

const createIncident = async (req, res) => {
  try {
    const tenantId = req.user._id.toString();
    const data = req.body;
    const files = req.files;

    const incident = await incidentService.createIncident(tenantId, data, files);

    return res.status(201).json({
      success: true,
      message: "Tạo báo cáo sự cố thành công",
      data: incident,
    });
  } catch (error) {
    if (["Hợp đồng không tồn tại.", "Bạn không có quyền báo cáo sự cố cho hợp đồng này.", "Hợp đồng này không còn hiệu lực.", "Phòng không tồn tại.", "Phòng không khớp với hợp đồng."].includes(error.message)) {
      return res.status(403).json({ message: error.message });
    }
    console.error("Create Incident Error:", error);
    return res.status(500).json({ message: "Lỗi server khi tạo báo cáo sự cố.", error: error.message });
  }
};

const getMyIncidents = async (req, res) => {
  try {
    const tenantId = req.user._id.toString();
    const incidents = await incidentService.getMyIncidents(tenantId);
    
    return res.status(200).json({
      success: true,
      data: incidents,
    });
  } catch (error) {
    console.error("Get My Incidents Error:", error);
    return res.status(500).json({ message: "Lỗi server khi lấy danh sách báo cáo.", error: error.message });
  }
};

const getIncidentById = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const userRole = req.user.role;
    const incidentId = req.params.id;
    
    const incident = await incidentService.getIncidentById(incidentId, userId, userRole);
    
    return res.status(200).json({
      success: true,
      data: incident,
    });
  } catch (error) {
    if (error.message === "Không tìm thấy báo cáo sự cố." || error.message === "Bạn không có quyền xem báo cáo này.") {
      return res.status(403).json({ message: error.message });
    }
    console.error("Get Incident By Id Error:", error);
    return res.status(500).json({ message: "Lỗi server khi lấy chi tiết báo cáo.", error: error.message });
  }
};

const getAllIncidents = async (req, res) => {
  try {
    const query = req.query;
    const result = await incidentService.getAllIncidents(query);
    
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Get All Incidents Error:", error);
    return res.status(500).json({ message: "Lỗi server khi lấy danh sách sự cố.", error: error.message });
  }
};

const getDistrictIncidents = async (req, res) => {
  try {
    const query = req.query;
    const userDistricts = req.user.managedDistricts || [];
    
    const result = await incidentService.getDistrictIncidents(userDistricts, query);
    
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Get District Incidents Error:", error);
    return res.status(500).json({ message: "Lỗi server khi lấy danh sách sự cố.", error: error.message });
  }
};

const updateIncidentStatus = async (req, res) => {
  try {
    const incidentId = req.params.id;
    const { status } = req.body;
    const userId = req.user._id.toString();
    const userRole = req.user.role;
    
    const data = req.body;
    const files = req.files;

    const incident = await incidentService.updateIncidentStatus(incidentId, status, userId, userRole, data, files);

    return res.status(200).json({
      success: true,
      message: "Cập nhật trạng thái thành công",
      data: incident,
    });
  } catch (error) {
    console.error("Update Incident Status Error:", error);
    if (error.message.includes("Không thể chuyển trạng thái") || error.message.includes("Bạn không có quyền")) {
       return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "Lỗi server khi cập nhật trạng thái sự cố.", error: error.message });
  }
};

const getIncidentTimeline = async (req, res) => {
  try {
    const incidentId = req.params.id;
    const timeline = await incidentService.getIncidentTimeline(incidentId);
    
    return res.status(200).json({
      success: true,
      data: timeline,
    });
  } catch (error) {
    console.error("Get Incident Timeline Error:", error);
    return res.status(500).json({ message: "Lỗi server khi lấy lịch sử sự cố.", error: error.message });
  }
};

const rateIncident = async (req, res) => {
  try {
    const incidentId = req.params.id;
    const tenantId = req.user._id.toString();
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Đánh giá sao phải từ 1 đến 5." });
    }

    const incident = await incidentService.rateIncident(incidentId, tenantId, rating, comment);

    return res.status(200).json({
      success: true,
      message: "Đánh giá sự cố thành công",
      data: incident,
    });
  } catch (error) {
    console.error("Rate Incident Error:", error);
    if (error.message.includes("Không tìm thấy") || error.message.includes("Bạn không có quyền") || error.message.includes("trạng thái") || error.message.includes("đã được đánh giá")) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "Lỗi server khi đánh giá sự cố.", error: error.message });
  }
};

const getIncidentStats = async (req, res) => {
  try {
    const userRole = req.user.role;
    const userDistricts = req.user.managedDistricts || [];
    
    const stats = await incidentService.getIncidentStats(userRole, userDistricts);
    
    return res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Get Incident Stats Error:", error);
    return res.status(500).json({ message: "Lỗi server khi lấy thống kê sự cố.", error: error.message });
  }
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
