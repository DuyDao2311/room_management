/**
 * adminRoomMap.routes.js — Routes cho Admin Room Map
 *
 * Mount tại: /api/admin/rooms
 */

const express = require("express");
const router = express.Router();
const { protect, verifyRole } = require("../middleware/auth");
const {
  getAdminRoomsMapController,
} = require("../controllers/adminRoomMap.controller");

// GET /api/admin/rooms/map — Lấy danh sách phòng cho map (admin + staff)
router.get(
  "/map",
  protect,
  verifyRole("admin", "staff"),
  getAdminRoomsMapController
);

module.exports = router;
