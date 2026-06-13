const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  // Người nhận thông báo (có thể là tenant, staff, hoặc admin)
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Alias cho tenantId để tương thích ngược
  tenantId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type:      { 
    type: String, 
    enum: ['INVOICE', 'REMINDER', 'SYSTEM', 'APPOINTMENT', 'CONTRACT', 'FEEDBACK', 'INCIDENT'], 
    default: 'INVOICE' 
  },
  title:     { type: String, required: true },
  message:   { type: String, required: true },
  // Các trường tham chiếu tùy theo loại thông báo
  invoiceId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
  contractId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Contract' },
  feedbackId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Feedback' },
  roomId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
  incidentId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Incident' },
  isRead:    { type: Boolean, default: false },
}, { timestamps: true });

// ─── Indexes tối ưu query ─────────────────────────────────────────────────────
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ tenantId: 1, createdAt: -1 });
notificationSchema.index({ tenantId: 1, isRead: 1 });

// ─── Pre-save hook: đồng bộ tenantId với userId ───────────────────────────────
notificationSchema.pre('save', function() {
  if (this.isModified('userId') && !this.tenantId) {
    this.tenantId = this.userId;
  }
  if (this.isModified('tenantId') && !this.userId) {
    this.userId = this.tenantId;
  }
});

module.exports = mongoose.model('Notification', notificationSchema);