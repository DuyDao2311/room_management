const express = require("express");
const router = express.Router();
const { protect, verifyRole, injectDistrictFilter } = require("../middleware/auth");
const { globalSearch } = require("../controllers/searchController");

// ─── Tìm kiếm toàn cục ───────────────────────────────────────────────────────
// GET /api/search?q=keyword
// Chỉ admin và staff mới được truy cập
router.get(
  "/",
  protect,
  verifyRole("admin", "staff"),
  injectDistrictFilter,
  globalSearch
);

module.exports = router;
