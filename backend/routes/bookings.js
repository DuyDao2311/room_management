const express = require("express");
const router = express.Router();
const { protect, verifyRole, adminOnly } = require("../middleware/auth");
const {
  createBooking,
  getBookings,
  getBookingById,
  confirmBooking,
  checkInBooking,
  checkOutBooking,
  cancelBooking,
  payBooking,
  deleteBooking,
  getBookingStats,
} = require("../controllers/bookingController");

// ── Stats (must be before /:id) ──────────────────────────────────────────────
// GET /api/bookings/stats — admin/staff dashboard stats
router.get("/stats", protect, verifyRole("admin", "staff"), getBookingStats);

// ── CRUD ──────────────────────────────────────────────────────────────────────
// GET /api/bookings — list (role-filtered in controller)
router.get("/", protect, getBookings);

// POST /api/bookings — tenant creates booking
router.post("/", protect, createBooking);

// GET /api/bookings/:id — detail
router.get("/:id", protect, getBookingById);

// ── Status transitions (admin/staff only) ─────────────────────────────────────
// PUT /api/bookings/:id/confirm
router.put("/:id/confirm", protect, verifyRole("admin", "staff"), confirmBooking);

// PUT /api/bookings/:id/checkin
router.put("/:id/checkin", protect, verifyRole("admin", "staff"), checkInBooking);

// PUT /api/bookings/:id/checkout
router.put("/:id/checkout", protect, verifyRole("admin", "staff"), checkOutBooking);

// PUT /api/bookings/:id/cancel — admin/staff can cancel
router.put("/:id/cancel", protect, verifyRole("admin", "staff"), cancelBooking);

// PUT /api/bookings/:id/pay — mark as paid (tenant or admin)
router.put("/:id/pay", protect, payBooking);

// DELETE /api/bookings/:id — admin only
router.delete("/:id", protect, adminOnly, deleteBooking);

module.exports = router;
