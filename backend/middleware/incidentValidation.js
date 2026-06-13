const validateIncidentCreation = (req, res, next) => {
  const { roomId, contractId, category, priority, description, contactPhone, availableTime } = req.body;

  if (!roomId || !contractId) {
    return res.status(400).json({ message: "Vui lòng cung cấp roomId và contractId." });
  }

  if (!category) {
    return res.status(400).json({ message: "Vui lòng chọn loại sự cố." });
  }

  if (!description || description.trim().length === 0) {
    return res.status(400).json({ message: "Vui lòng nhập mô tả sự cố." });
  }

  if (!contactPhone) {
    return res.status(400).json({ message: "Vui lòng cung cấp số điện thoại liên hệ." });
  }

  if (!availableTime) {
    return res.status(400).json({ message: "Vui lòng cung cấp thời gian có thể hỗ trợ." });
  }

  // Nếu validate pass, đi tiếp
  next();
};

module.exports = {
  validateIncidentCreation,
};
