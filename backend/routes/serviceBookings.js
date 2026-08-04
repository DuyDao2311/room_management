const express = require("express");
const router = express.Router();
const { protect, verifyRole, adminOnly } = require("../middleware/auth");
const {
  createServiceBooking,
  getServiceBookings,
  getServiceBookingById,
  confirmServiceBooking,
  completeServiceBooking,
  cancelServiceBooking,
  payServiceBooking,
  rateServiceBooking,
  deleteServiceBooking,
  getServiceBookingStats,
} = require("../controllers/serviceBookingController");

router.get("/stats", protect, getServiceBookingStats);
router.get("/", protect, getServiceBookings);
router.post("/", protect, verifyRole("tenant"), createServiceBooking);
router.get("/:id", protect, getServiceBookingById);

router.put("/:id/confirm", protect, verifyRole("admin", "staff"), confirmServiceBooking);
router.put("/:id/complete", protect, verifyRole("admin", "staff"), completeServiceBooking);
// Cancel: tenant can cancel own booking only while "pending" and ≥1h before scheduledAt;
// admin/staff can cancel any status except completed/cancelled, no time limit.
// Mixed policy enforced inside the controller — cannot be expressed as route middleware alone.
router.put("/:id/cancel", protect, cancelServiceBooking);
router.put("/:id/pay", protect, verifyRole("admin", "staff"), payServiceBooking);
router.put("/:id/rate", protect, verifyRole("tenant"), rateServiceBooking);

router.delete("/:id", protect, adminOnly, deleteServiceBooking);

module.exports = router;
