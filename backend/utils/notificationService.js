const Notification = require('../models/Notification');
const User = require('../models/User');
const Room = require('../models/Room');
const Contract = require('../models/Contract');
const Invoice = require('../models/Invoice');

/** Format số tiền thủ công (tránh dùng toLocaleString gây lỗi) */
const fmt = (n) => {
  if (n == null || isNaN(n)) return '0';
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

/** Format ngày thủ công dd/mm/yyyy */
const fmtDate = (d) => {
  if (!d) return '';
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return '';
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
  } catch {
    return '';
  }
};

/**
 * Gửi thông báo đến tất cả staff/admin
 */
const notifyStaff = async (data) => {
  const { type, title, message, appointmentId, contractId, feedbackId, roomId, invoiceId } = data;
  
  const staffUsers = await User.find({ 
    role: { $in: ['admin', 'staff'] }, 
    isActive: true 
  }).select('_id');

  if (staffUsers.length === 0) return [];

  const notifications = staffUsers.map(user => ({
    userId: user._id,
    tenantId: user._id,
    type,
    title,
    message,
    appointmentId,
    contractId,
    feedbackId,
    roomId,
    invoiceId,
    isRead: false,
  }));

  return await Notification.insertMany(notifications);
};

/**
 * Gửi thông báo đến staff quản lý district cụ thể
 */
const notifyStaffByDistrict = async (district, data) => {
  const { type, title, message, appointmentId, contractId, feedbackId, roomId, invoiceId } = data;
  
  const staffUsers = await User.find({ 
    role: 'staff', 
    isActive: true,
    managedDistricts: { $in: [district] }
  }).select('_id');

  const adminUsers = await User.find({ 
    role: 'admin', 
    isActive: true 
  }).select('_id');

  const allUsers = [...staffUsers, ...adminUsers];
  const uniqueUsers = allUsers.filter((user, index, self) => 
    index === self.findIndex(u => u._id.toString() === user._id.toString())
  );

  if (uniqueUsers.length === 0) return [];

  const notifications = uniqueUsers.map(user => ({
    userId: user._id,
    tenantId: user._id,
    type,
    title,
    message,
    appointmentId,
    contractId,
    feedbackId,
    roomId,
    invoiceId,
    isRead: false,
  }));

  return await Notification.insertMany(notifications);
};

/**
 * Gửi thông báo khi có lịch hẹn mới
 */
const notifyNewAppointment = async (appointment) => {
  const district = appointment.district;
  const room = await Room.findById(appointment.room).select('name address');
  
  const title = '📅 Lịch hẹn mới cần xác nhận';
  const message = `${appointment.name} (${appointment.phone}) đặt lịch xem phòng ${room?.name || ''} vào ${appointment.date} lúc ${appointment.time}`;
  
  return await notifyStaffByDistrict(district, {
    type: 'APPOINTMENT',
    title,
    message,
    appointmentId: appointment._id,
    roomId: appointment.room,
  });
};

/**
 * Gửi thông báo khi có hợp đồng mới cần xác nhận
 */
const notifyNewContract = async (contract) => {
  const room = await Room.findById(contract.room).select('name district');
  const tenant = await User.findById(contract.tenant).select('name email');
  
  const district = room?.district;
  const title = '📄 Hợp đồng mới cần xác nhận';
  const message = `Khách thuê ${tenant?.name || ''} đăng ký hợp đồng phòng ${room?.name || ''} từ ${fmtDate(contract.startDate)} đến ${fmtDate(contract.endDate)}`;
  
  return await notifyStaffByDistrict(district, {
    type: 'CONTRACT',
    title,
    message,
    contractId: contract._id,
    roomId: contract.room,
  });
};

/**
 * Gửi thông báo khi có đánh giá phòng mới
 */
const notifyNewFeedback = async (feedback) => {
  const room = await Room.findById(feedback.room).select('name district');
  const tenant = await User.findById(feedback.tenant).select('name');
  
  const district = room?.district;
  const title = '⭐ Đánh giá phòng mới';
  const message = `${tenant?.isAnonymous ? 'Ẩn danh' : tenant?.name || 'Khách thuê'} vừa đánh giá phòng ${room?.name || ''} ${feedback.rating} sao`;
  
  return await notifyStaffByDistrict(district, {
    type: 'FEEDBACK',
    title,
    message,
    feedbackId: feedback._id,
    roomId: feedback.room,
  });
};

/**
 * Lấy district từ invoice (thông qua contract → room)
 */
const getInvoiceDistrict = async (invoice) => {
  try {
    const Contract = require('../models/Contract');
    const contract = await Contract.findById(invoice.contract).populate('room', 'district');
    return contract?.room?.district || '';
  } catch {
    return '';
  }
};

/**
 * Gửi thông báo khi hóa đơn đã được thanh toán
 */
const notifyInvoicePaid = async (invoice) => {
  const district = await getInvoiceDistrict(invoice);
  const title = '💰 Hóa đơn đã thanh toán';
  const message = `Hóa đơn ${invoice.type === 'deposit' ? 'đặt cọc' : 'dịch vụ'} phòng ${invoice.roomName} — ${invoice.representativeName} — ${fmt(invoice.totalAmount)}đ đã thanh toán`;
  
  return await notifyStaffByDistrict(district, {
    type: 'INVOICE',
    title,
    message,
    invoiceId: invoice._id,
  });
};

/**
 * Gửi thông báo khi hóa đơn quá hạn
 */
const notifyInvoiceOverdue = async (invoice) => {
  const district = await getInvoiceDistrict(invoice);
  const title = '⚠️ Hóa đơn quá hạn thanh toán';
  const message = `Hóa đơn phòng ${invoice.roomName} — ${invoice.representativeName} — ${fmt(invoice.totalAmount)}đ đã quá hạn từ ${fmtDate(invoice.dueDate)}`;
  
  return await notifyStaffByDistrict(district, {
    type: 'INVOICE',
    title,
    message,
    invoiceId: invoice._id,
  });
};

/**
 * Gửi thông báo khi hợp đồng sắp hết hạn
 */
const notifyContractExpiring = async (contract) => {
  const room = await Room.findById(contract.room).select('name district');
  const tenant = await User.findById(contract.tenant).select('name');
  
  const title = '⏰ Hợp đồng sắp hết hạn';
  const message = `Hợp đồng phòng ${room?.name || ''} — ${tenant?.name || ''} sẽ hết hạn vào ${fmtDate(contract.endDate)}`;
  
  return await notifyStaffByDistrict(room?.district || '', {
    type: 'CONTRACT',
    title,
    message,
    contractId: contract._id,
    roomId: contract.room,
  });
};

/**
 * Kiểm tra và gửi thông báo cho các hợp đồng sắp hết hạn (gọi định kỳ)
 */
const checkExpiringContracts = async () => {
  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  
  const expiringContracts = await Contract.find({
    status: 'active',
    endDate: { $gte: now, $lte: thirtyDaysLater },
  });

  const results = [];
  for (const contract of expiringContracts) {
    const existingNotif = await Notification.findOne({
      type: 'CONTRACT',
      contractId: contract._id,
      createdAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
    });
    if (!existingNotif) {
      const notifs = await notifyContractExpiring(contract);
      results.push(...notifs);
    }
  }
  return results;
};

/**
 * Kiểm tra và gửi thông báo cho các hóa đơn quá hạn (gọi định kỳ)
 */
const checkOverdueInvoices = async () => {
  const now = new Date();
  const overdueInvoices = await Invoice.find({
    status: { $in: ['unpaid', 'overdue'] },
    dueDate: { $lt: now },
  });

  const results = [];
  for (const invoice of overdueInvoices) {
    const existingNotif = await Notification.findOne({
      type: 'INVOICE',
      invoiceId: invoice._id,
      createdAt: { $gte: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) },
    });
    if (!existingNotif) {
      const notifs = await notifyInvoiceOverdue(invoice);
      results.push(...notifs);
    }
  }
  return results;
};

/**
 * Gửi thông báo qua Socket.io
 * Chỉ emit vào room cá nhân của user để tránh duplicate
 */
const sendSocketNotification = (io, eventType, notification) => {
  if (!io) return;
  io.to(`tenant_${notification.userId}`).emit(eventType, notification);
};

module.exports = {
  notifyStaff,
  notifyStaffByDistrict,
  notifyNewAppointment,
  notifyNewContract,
  notifyNewFeedback,
  notifyInvoicePaid,
  notifyInvoiceOverdue,
  notifyContractExpiring,
  checkExpiringContracts,
  checkOverdueInvoices,
  sendSocketNotification,
};