const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  tenantId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:      { type: String, enum: ['INVOICE', 'REMINDER', 'SYSTEM'], default: 'INVOICE' },
  title:     { type: String, required: true },
  message:   { type: String, required: true },
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  isRead:    { type: Boolean, default: false },
}, { timestamps: true }); // tự thêm createdAt, updatedAt

// ─── Indexes tối ưu query ─────────────────────────────────────────────────────
notificationSchema.index({ tenantId: 1, createdAt: -1 });
notificationSchema.index({ tenantId: 1, isRead: 1 });

module.exports = mongoose.model('Notification', notificationSchema);