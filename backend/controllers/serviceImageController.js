const uploadServiceImagesHandler = async (req, res) => {
  const urls = (req.files || []).map((file) => file.path);
  res.json({ urls });
};

module.exports = { uploadServiceImagesHandler };
