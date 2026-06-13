const Notification = require("../models/Notification");
const User = require("../models/User");
const Room = require("../models/Room");
const Contract = require("../models/Contract");
const Invoice = require("../models/Invoice");
const sendEmail = require("./sendEmail");
const { notificationEmailTemplate } = require("./emailTemplates");

/** Format số tiền thủ công (tránh dùng toLocaleString gây lỗi) */
const fmt = (n) => {
  if (n == null || isNaN(n)) return "0";
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

/** Format ngày thủ công dd/mm/yyyy */
const fmtDate = (d) => {
  if (!d) return "";
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return "";
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
  } catch {
    return "";
  }
};

// ─── Dispatcher đa kênh ──────────────────────────────────────────────────────
/**
 * Hàm trung tâm gửi notification qua nhiều kênh.
 * - `inapp`: tạo Notification doc + insertMany (chỉ với recipients có `_id`)
 * - `email`: với mỗi recipient có `.email`, gọi sendEmail FIRE-AND-FORGET
 *   (không await — lỗi gửi mail KHÔNG chặn request, KHÔNG vỡ in-app flow)
 *
 * Lý do tách dispatch: gom logic gửi vào 1 chỗ. Nâng cấp lên queue sau này
 * (kiến trúc C) chỉ cần đổi ruột hàm này, không sửa rải rác các hàm notify*.
 *
 * @param {Object}   opts
 * @param {Array}    opts.recipients  [{ _id?, email?, name? }, ...]
 * @param {Object}   opts.data        { type, title, message, appointmentId?, contractId?, ... }
 * @param {string[]} [opts.channels]  Default ['inapp', 'email']
 * @param {string|null} [opts.actionUrl]  Link "Xem chi tiết" cho email (optional)
 * @returns {Promise<Array>}          Mảng Notification docs đã tạo (cho caller emit socket)
 */
const dispatch = async ({
  recipients,
  data,
  channels = ["inapp", "email"],
  actionUrl = null,
}) => {
  let notifications = [];

  // ── Kênh in-app ──────────────────────────────────────────────
  if (channels.includes("inapp")) {
    // Chỉ tạo notification cho recipient có _id (user đã có tài khoản).
    // Khách vãng lai (chỉ có email) → bỏ qua kênh inapp.
    const inAppRecipients = recipients.filter((r) => r && r._id);
    if (inAppRecipients.length > 0) {
      const docs = inAppRecipients.map((r) => ({
        userId: r._id,
        tenantId: r._id,
        type: data.type,
        title: data.title,
        message: data.message,
        appointmentId: data.appointmentId,
        contractId: data.contractId,
        feedbackId: data.feedbackId,
        roomId: data.roomId,
        invoiceId: data.invoiceId,
        incidentId: data.incidentId,
        isRead: false,
      }));
      notifications = await Notification.insertMany(docs);
    }
  }

  // ── Kênh email (fire-and-forget) ─────────────────────────────
  // EMAIL_ENABLED=false để tắt gửi mail khi dev/test (tránh spam Gmail quota).
  if (channels.includes("email") && process.env.EMAIL_ENABLED !== "false") {
    const { html, text } = notificationEmailTemplate({
      heading: data.title,
      message: data.message,
      actionUrl,
    });

    // ⚠️ KHÔNG thêm `await` — fire-and-forget cố ý.
    // Await sẽ làm request chờ Gmail 1-3s và lỗi SMTP sẽ phá response.
    recipients.forEach((r) => {
      if (r && r.email) {
        sendEmail({ to: r.email, subject: data.title, html, text }).catch(
          (err) => {
            console.error(`[email] gửi đến ${r.email} thất bại:`, err.message);
          },
        );
      }
    });
  }

  return notifications;
};

// ─── Staff/admin notify (đi qua dispatcher → tự động có email) ───────────────
const notifyStaff = async (data) => {
  const staffUsers = await User.find({
    role: { $in: ["admin", "staff"] },
    isActive: true,
  }).select("_id email name");

  if (staffUsers.length === 0) return [];
  return dispatch({
    recipients: staffUsers,
    data,
    channels: ["inapp", "email"],
    actionUrl: data.actionUrl,
  });
};

const notifyStaffByDistrict = async (district, data) => {
  const staffUsers = await User.find({
    role: "staff",
    isActive: true,
    managedDistricts: { $in: [district] },
  }).select("_id email name");

  const adminUsers = await User.find({
    role: "admin",
    isActive: true,
  }).select("_id email name");

  const allUsers = [...staffUsers, ...adminUsers];
  const uniqueUsers = allUsers.filter(
    (user, index, self) =>
      index === self.findIndex((u) => u._id.toString() === user._id.toString()),
  );

  if (uniqueUsers.length === 0) return [];
  return dispatch({
    recipients: uniqueUsers,
    data,
    channels: ["inapp", "email"],
    actionUrl: data.actionUrl,
  });
};

// ─── Notify hàm cũ (giữ nguyên signature) ────────────────────────────────────
const notifyNewAppointment = async (appointment) => {
  const district = appointment.district;
  const room = await Room.findById(appointment.room).select("name address");

  const title = "📅 Lịch hẹn mới cần xác nhận";
  const message = `${appointment.name} (${appointment.phone}) đặt lịch xem phòng ${room?.name || ""} vào ${fmtDate(appointment.date)} lúc ${appointment.time}`;

  return await notifyStaffByDistrict(district, {
    type: "APPOINTMENT",
    title,
    message,
    appointmentId: appointment._id,
    roomId: appointment.room,
    actionUrl: buildFrontendUrl(`/admin/appointments/${appointment._id}`),
  });
};

const notifyNewContract = async (contract) => {
  const room = await Room.findById(contract.room).select("name district");
  const tenant = await User.findById(contract.tenant).select("name email");

  const district = room?.district;
  const title = "📄 Hợp đồng mới cần xác nhận";
  const message = `Khách thuê ${tenant?.name || ""} đăng ký hợp đồng phòng ${room?.name || ""} từ ${fmtDate(contract.startDate)} đến ${fmtDate(contract.endDate)}`;

  return await notifyStaffByDistrict(district, {
    type: "CONTRACT",
    title,
    message,
    contractId: contract._id,
    roomId: contract.room,
    actionUrl: buildFrontendUrl("/admin/contracts"),
  });
};

const notifyNewIncident = async (incident) => {
  const room = await Room.findById(incident.room).select("name district");
  const tenant = await User.findById(incident.tenant).select("name");

  const district = room?.district;
  const title = "🛠️ Báo cáo sự cố mới";
  const message = `Khách thuê ${tenant?.name || ""} báo cáo sự cố (${incident.category}) tại phòng ${room?.name || ""}. Mức độ: ${incident.priority}.`;

  return await notifyStaffByDistrict(district, {
    type: "INCIDENT",
    title,
    message,
    incidentId: incident._id,
    roomId: incident.room,
    actionUrl: buildFrontendUrl("/admin/incidents"),
  });
};

const notifyStaffIncidentRated = async (incident) => {
  const room = await Room.findById(incident.room).select("name district");
  const tenant = await User.findById(incident.tenant).select("name");

  const district = room?.district;
  const title = "⭐ Khách thuê đã đánh giá sự cố";
  const message = `Khách thuê ${tenant?.name || ""} đã đánh giá ${incident.rating} sao cho sự cố tại phòng ${room?.name || ""}.`;

  return await notifyStaffByDistrict(district, {
    type: "INCIDENT",
    title,
    message,
    incidentId: incident._id,
    roomId: incident.room,
    actionUrl: buildFrontendUrl("/admin/incidents"),
  });
};

const getInvoiceDistrict = async (invoice) => {
  try {
    const contract = await Contract.findById(invoice.contract).populate(
      "room",
      "district",
    );
    return contract?.room?.district || "";
  } catch {
    return "";
  }
};

const notifyInvoicePaid = async (invoice) => {
  const district = await getInvoiceDistrict(invoice);
  const title = "💰 Hóa đơn đã thanh toán";
  const message = `Hóa đơn ${invoice.type === "deposit" ? "đặt cọc" : "dịch vụ"} phòng ${invoice.roomName} — ${invoice.representativeName} — ${fmt(invoice.totalAmount)}đ đã thanh toán`;

  return await notifyStaffByDistrict(district, {
    type: "INVOICE",
    title,
    message,
    invoiceId: invoice._id,
    actionUrl: buildFrontendUrl("/admin/invoices"),
  });
};

const notifyInvoiceOverdue = async (invoice) => {
  const district = await getInvoiceDistrict(invoice);
  const title = "⚠️ Hóa đơn quá hạn thanh toán";
  const message = `Hóa đơn phòng ${invoice.roomName} — ${invoice.representativeName} — ${fmt(invoice.totalAmount)}đ đã quá hạn từ ${fmtDate(invoice.dueDate)}`;

  return await notifyStaffByDistrict(district, {
    type: "INVOICE",
    title,
    message,
    invoiceId: invoice._id,
    actionUrl: buildFrontendUrl("/admin/invoices"),
  });
};

const notifyContractExpiring = async (contract) => {
  const room = await Room.findById(contract.room).select("name district");
  const tenant = await User.findById(contract.tenant).select("name");

  const title = "⏰ Hợp đồng sắp hết hạn";
  const message = `Hợp đồng phòng ${room?.name || ""} — ${tenant?.name || ""} sẽ hết hạn vào ${fmtDate(contract.endDate)}`;

  return await notifyStaffByDistrict(room?.district || "", {
    type: "CONTRACT",
    title,
    message,
    contractId: contract._id,
    roomId: contract.room,
    actionUrl: buildFrontendUrl("/admin/contracts"),
  });
};

// ─── Tenant notify (mới) ─────────────────────────────────────────────────────
// Helper xây actionUrl tới frontend nếu có FRONTEND_URL trong env.
const buildFrontendUrl = (path) => {
  const base = process.env.FRONTEND_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, "")}${path}`;
};

/** Hóa đơn sắp đến hạn (5 ngày trước dueDate) → email + in-app cho tenant. */
const notifyTenantInvoiceDue = async (invoice) => {
  const tenant = await User.findById(invoice.tenantId).select("_id email name");
  if (!tenant) return [];

  const title = "🔔 Hóa đơn sắp đến hạn thanh toán";
  const message = `Kính gửi Quý khách,\n\nHóa đơn phòng ${invoice.roomName} của Quý khách (${fmt(invoice.totalAmount)}đ) sẽ đến hạn vào ngày ${fmtDate(invoice.dueDate)}. Vui lòng hoàn tất thanh toán đúng hạn để tránh phí phạt phát sinh.\n\nTrân trọng,\nĐội ngũ Phòng Trọ DTT`;

  return dispatch({
    recipients: [{ _id: tenant._id, email: tenant.email, name: tenant.name }],
    data: {
      // Dùng 'REMINDER' để dedup tách biệt với INVOICE (overdue/paid) trên cùng invoiceId.
      type: "REMINDER",
      title,
      message,
      invoiceId: invoice._id,
    },
    channels: ["inapp", "email"],
    actionUrl: buildFrontendUrl("/my-invoices"),
  });
};

/** Hóa đơn quá hạn → email + in-app cho tenant. */
const notifyTenantInvoiceOverdue = async (invoice) => {
  const tenant = await User.findById(invoice.tenantId).select("_id email name");
  if (!tenant) return [];

  const title = "⚠️ Hóa đơn của Quý khách đã quá hạn";
  const message = `Kính gửi Quý khách,\n\nHóa đơn phòng ${invoice.roomName} của Quý khách (${fmt(invoice.totalAmount)}đ) đã quá hạn từ ngày ${fmtDate(invoice.dueDate)}. Chúng tôi xin nhắc nhở Quý khách hoàn tất thanh toán trong thời gian sớm nhất để tránh phát sinh thêm chi phí.\n\nTrân trọng,\nĐội ngũ Phòng Trọ DTT`;

  return dispatch({
    recipients: [{ _id: tenant._id, email: tenant.email, name: tenant.name }],
    data: {
      type: "INVOICE",
      title,
      message,
      invoiceId: invoice._id,
    },
    channels: ["inapp", "email"],
    actionUrl: buildFrontendUrl("/my-invoices"),
  });
};

/** Hợp đồng sắp hết hạn → email + in-app cho tenant. */
const notifyTenantContractExpiring = async (contract) => {
  const populated = await Contract.findById(contract._id)
    .populate("tenant", "_id email name")
    .populate("room", "name");
  const tenant = populated?.tenant;
  if (!tenant) return [];

  const title = "⏰ Hợp đồng của Quý khách sắp hết hạn";
  const message = `Kính gửi Quý khách,\n\nHợp đồng thuê phòng ${populated.room?.name || ""} của Quý khách sẽ hết hạn vào ngày ${fmtDate(populated.endDate)}. Vui lòng liên hệ với chúng tôi để gia hạn nếu Quý khách có nhu cầu tiếp tục thuê.\n\nTrân trọng,\nĐội ngũ Phòng Trọ DTT`;

  return dispatch({
    recipients: [{ _id: tenant._id, email: tenant.email, name: tenant.name }],
    data: {
      type: "CONTRACT",
      title,
      message,
      contractId: populated._id,
      roomId: populated.room?._id,
    },
    channels: ["inapp", "email"],
    actionUrl: buildFrontendUrl("/my-room"),
  });
};

/** Hợp đồng được duyệt (pending → active) → email + in-app cho tenant. */
const notifyTenantContractApproved = async (contract) => {
  const populated = await Contract.findById(contract._id)
    .populate("tenant", "_id email name")
    .populate("room", "name");
  const tenant = populated?.tenant;
  if (!tenant) return [];

  const title = "✅ Hợp đồng đã được phê duyệt";
  const message = `Kính gửi Quý khách,\n\nHợp đồng thuê phòng ${populated.room?.name || ""} của Quý khách đã được phê duyệt thành công. Vui lòng hoàn tất thanh toán tiền cọc và tháng đầu để chính thức bắt đầu hợp đồng.\n\nTrân trọng,\nĐội ngũ Phòng Trọ DTT`;

  return dispatch({
    recipients: [{ _id: tenant._id, email: tenant.email, name: tenant.name }],
    data: {
      type: "CONTRACT",
      title,
      message,
      contractId: populated._id,
      roomId: populated.room?._id,
    },
    channels: ["inapp", "email"],
    actionUrl: buildFrontendUrl("/my-room"),
  });
};

/**
 * Hợp đồng chấm dứt/hết hạn (active → terminated|expired) → email + in-app cho tenant.
 * @param {Object} contract - Contract doc
 * @param {Object} opts
 * @param {'terminated'|'expired'} opts.reason - Lý do kết thúc (quyết định title + nội dung)
 */
const notifyTenantContractEnded = async (contract, { reason } = {}) => {
  const populated = await Contract.findById(contract._id)
    .populate("tenant", "_id email name")
    .populate("room", "name");
  const tenant = populated?.tenant;
  if (!tenant) return [];

  const roomName = populated.room?.name || "";
  const isExpired = reason === "expired";

  const title = isExpired
    ? "⏳ Hợp đồng thuê phòng đã hết hạn"
    : "❌ Thông báo chấm dứt hợp đồng thuê phòng";
  const message = isExpired
    ? `Kính gửi Quý khách,\n\nHợp đồng thuê phòng ${roomName} của Quý khách đã chính thức hết hạn vào ngày ${fmtDate(populated.endDate)}. Nếu Quý khách có nhu cầu tiếp tục thuê, vui lòng liên hệ với chúng tôi để gia hạn.\n\nTrân trọng,\nĐội ngũ Phòng Trọ DTT`
    : `Kính gửi Quý khách,\n\nHợp đồng thuê phòng ${roomName} của Quý khách đã được chấm dứt. Vui lòng liên hệ với chúng tôi để hoàn tất các thủ tục thanh toán cuối kỳ và hoàn trả tiền cọc theo quy định.\n\nTrân trọng,\nĐội ngũ Phòng Trọ DTT`;

  return dispatch({
    recipients: [{ _id: tenant._id, email: tenant.email, name: tenant.name }],
    data: {
      type: "CONTRACT",
      title,
      message,
      contractId: populated._id,
      roomId: populated.room?._id,
    },
    channels: ["inapp", "email"],
    actionUrl: buildFrontendUrl("/my-room"),
  });
};

/** Admin "Gửi hoá đơn" → email + in-app cho tenant biết hoá đơn mới cần thanh toán. */
const notifyTenantInvoiceSent = async (invoice) => {
  const contract = await Contract.findById(invoice.contract).populate(
    "tenant",
    "_id email name",
  );
  const tenant = contract?.tenant;
  if (!tenant) return [];

  let loaiInvoice = "";
  if (invoice.type === "deposit") loaiInvoice = "tiền cọc";
  else if (invoice.type === "repair") loaiInvoice = "chi phí sửa chữa";
  else loaiInvoice = `dịch vụ tháng ${invoice.month}/${invoice.year}`;
  
  const title = `🧾 Hoá đơn mới — ${invoice.roomName}`;
  const dueText = invoice.dueDate ? ` Hạn thanh toán: ${fmtDate(invoice.dueDate)}.` : "";
  const message = `Kính gửi Quý khách,\n\nHoá đơn ${loaiInvoice} phòng ${invoice.roomName} của Quý khách (${fmt(invoice.totalAmount)}đ) vừa được phát hành.${dueText} Vui lòng truy cập hệ thống để xem chi tiết và hoàn tất thanh toán đúng hạn.\n\nTrân trọng,\nĐội ngũ Phòng Trọ DTT`;

  return dispatch({
    recipients: [{ _id: tenant._id, email: tenant.email, name: tenant.name }],
    data: {
      type: "INVOICE",
      title,
      message,
      invoiceId: invoice._id,
    },
    channels: ["inapp", "email"],
    actionUrl: buildFrontendUrl("/my-invoices"),
  });
};

/**
 * Hoá đơn được xác nhận đã thanh toán → email + in-app cho tenant (như một biên lai).
 * Dùng cho mọi luồng paid: tiền mặt (collectCash / payInvoiceWithCash) + online (MoMo/VNPay).
 */
const notifyTenantInvoicePaid = async (invoice) => {
  const tenant = await User.findById(invoice.tenantId).select("_id email name");
  if (!tenant) return [];

  let loaiInvoice = "";
  if (invoice.type === "deposit") loaiInvoice = "tiền cọc";
  else if (invoice.type === "repair") loaiInvoice = "chi phí sửa chữa";
  else loaiInvoice = `dịch vụ tháng ${invoice.month}/${invoice.year}`;
  const methodLabel = { Cash: "tiền mặt", MoMo: "MoMo", VNPay: "VNPay" };
  const phuongThuc = invoice.paymentMethod
    ? ` qua ${methodLabel[invoice.paymentMethod] || invoice.paymentMethod}`
    : "";
  const title = `✅ Xác nhận thanh toán thành công — ${invoice.roomName}`;
  const message = `Kính gửi Quý khách,\n\nHoá đơn ${loaiInvoice} phòng ${invoice.roomName} của Quý khách (${fmt(invoice.totalAmount)}đ) đã được xác nhận thanh toán${phuongThuc} thành công. Cảm ơn Quý khách đã hoàn tất thanh toán.\n\nTrân trọng,\nĐội ngũ Phòng Trọ DTT`;

  return dispatch({
    recipients: [{ _id: tenant._id, email: tenant.email, name: tenant.name }],
    data: {
      type: "INVOICE",
      title,
      message,
      invoiceId: invoice._id,
    },
    channels: ["inapp", "email"],
    actionUrl: buildFrontendUrl("/my-invoices"),
  });
};

/** Thông báo sự cố cập nhật trạng thái cho tenant */
const notifyTenantIncidentStatus = async (incident, status, note) => {
  const room = await Room.findById(incident.room).select("name");
  const tenant = await User.findById(incident.tenant).select("_id email name");
  if (!tenant) return [];

  let statusText = status;
  let title = "🛠️ Cập nhật trạng thái sự cố";
  
  switch(status) {
    case "assigned":
      statusText = "đã được tiếp nhận";
      title = "🛠️ Sự cố đã được tiếp nhận";
      break;
    case "in_progress":
      statusText = "đang được xử lý";
      title = "🛠️ Sự cố đang được xử lý";
      break;
    case "resolved":
      statusText = "đã được xử lý xong";
      title = "✅ Sự cố đã xử lý xong";
      break;
    case "rejected":
      statusText = "đã bị từ chối";
      title = "❌ Sự cố bị từ chối";
      break;
  }

  const noteMsg = note ? `\nGhi chú: ${note}` : "";
  const message = `Kính gửi Quý khách,\n\nSự cố tại phòng ${room?.name || ""} ${statusText}.${noteMsg}\n\nTrân trọng,\nĐội ngũ Phòng Trọ DTT`;

  return dispatch({
    recipients: [{ _id: tenant._id, email: tenant.email, name: tenant.name }],
    data: {
      type: "INCIDENT",
      title,
      message,
      incidentId: incident._id,
      roomId: incident.room,
    },
    channels: ["inapp", "email"],
    actionUrl: buildFrontendUrl("/my-room"),
  });
};

/**
 * Lịch hẹn được duyệt (status='confirmed') → email cho khách (có thể là guest).
 * @param {Object} appointment - Appointment doc
 * @param {Object} opts
 * @param {boolean} opts.isReconfirm - true nếu chuyển từ 'cancelled' → 'confirmed' (kích hoạt lại sau khi từng hủy)
 */
const notifyTenantAppointmentConfirmed = async (
  appointment,
  { isReconfirm = false } = {},
) => {
  if (!appointment.email && !appointment.user) return [];

  const room = await Room.findById(appointment.room).select("name address");
  const title = isReconfirm
    ? "🔁 Xác nhận lại lịch hẹn xem phòng"
    : "✅ Lịch hẹn xem phòng đã được xác nhận";
  const baseInfo = `Lịch hẹn xem phòng ${room?.name || ""} của Quý khách vào ngày ${fmtDate(appointment.date)} lúc ${appointment.time}`;
  const message = isReconfirm
    ? `Kính gửi Quý khách,\n\n${baseInfo} đã được khôi phục. Chúng tôi xin lỗi vì sự thay đổi trước đó và mong Quý khách thông cảm.\n\nTrân trọng,\nĐội ngũ Phòng Trọ DTT`
    : `Kính gửi Quý khách,\n\n${baseInfo} đã được xác nhận thành công. Vui lòng có mặt đúng thời gian đã hẹn.\n\nTrân trọng,\nĐội ngũ Phòng Trọ DTT`;

  // Khách có user account → email + in-app. Guest (no user) → chỉ email.
  const hasUser = !!appointment.user;
  const channels = hasUser ? ["inapp", "email"] : ["email"];
  const recipient = hasUser
    ? {
      _id: appointment.user,
      email: appointment.email || null,
      name: appointment.name,
    }
    : { email: appointment.email, name: appointment.name };

  return dispatch({
    recipients: [recipient],
    data: {
      type: "APPOINTMENT",
      title,
      message,
      appointmentId: appointment._id,
      roomId: appointment.room,
    },
    channels,
  });
};

/** Lịch hẹn bị hủy (status='cancelled' từ 'confirmed') → email cho khách. */
const notifyTenantAppointmentCancelled = async (appointment) => {
  if (!appointment.email && !appointment.user) return [];

  const room = await Room.findById(appointment.room).select("name address");
  const title = "❌ Thông báo hủy lịch hẹn xem phòng";
  const message = `Kính gửi Quý khách,\n\nChúng tôi xin thông báo lịch hẹn xem phòng ${room?.name || ""} ngày ${fmtDate(appointment.date)} lúc ${appointment.time} đã bị hủy. Chúng tôi xin lỗi vì sự bất tiện này. Để đặt lịch mới, Quý khách vui lòng truy cập website.\n\nTrân trọng,\nĐội ngũ Phòng Trọ DTT`;

  // Khách có user account → email + in-app. Guest (no user) → chỉ email.
  const hasUser = !!appointment.user;
  const channels = hasUser ? ["inapp", "email"] : ["email"];
  const recipient = hasUser
    ? { _id: appointment.user, email: appointment.email || null, name: appointment.name }
    : { email: appointment.email, name: appointment.name };

  return dispatch({
    recipients: [recipient],
    data: {
      type: "APPOINTMENT",
      title,
      message,
      appointmentId: appointment._id,
      roomId: appointment.room,
    },
    channels,
  });
};

// ─── Cron periodic checks ────────────────────────────────────────────────────
/**
 * Hợp đồng sắp hết hạn — staff + tenant.
 * Dedup: cùng contractId trong 1 ngày → skip cả staff lẫn tenant.
 */
const checkExpiringContracts = async () => {
  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const expiringContracts = await Contract.find({
    status: "active",
    endDate: { $gte: now, $lte: thirtyDaysLater },
    extensionStatus: { $in: ["none", null] },
  });

  const results = [];
  for (const contract of expiringContracts) {
    const existingNotif = await Notification.findOne({
      type: "CONTRACT",
      contractId: contract._id,
      createdAt: { $gte: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000) },
    });
    if (!existingNotif) {
      const staffNotifs = await notifyContractExpiring(contract);
      const tenantNotifs = await notifyTenantContractExpiring(contract);
      results.push(...staffNotifs, ...tenantNotifs);
    }
  }
  return results;
};

/**
 * Hóa đơn quá hạn — staff + tenant.
 * Dedup: cùng invoiceId + type INVOICE trong 3 ngày → skip cả 2 phía.
 */
const checkOverdueInvoices = async () => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const overdueInvoices = await Invoice.find({
    status: { $in: ["unpaid", "overdue"] },
    dueDate: { $lt: startOfToday },
    sentAt: { $ne: null },
    tenantId: { $ne: null },
  });

  const results = [];
  for (const invoice of overdueInvoices) {
    if (invoice.status === "unpaid") {
      invoice.status = "overdue";
      await invoice.save();
    }

    const existingNotif = await Notification.findOne({
      type: "INVOICE",
      invoiceId: invoice._id,
      createdAt: { $gte: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000) },
    });
    if (!existingNotif) {
      const staffNotifs = await notifyInvoiceOverdue(invoice);
      const tenantNotifs = await notifyTenantInvoiceOverdue(invoice);
      results.push(...staffNotifs, ...tenantNotifs);
    }
  }
  return results;
};

/**
 * Hóa đơn sắp đến hạn (5 ngày trước dueDate) — chỉ tenant.
 * Dedup: cùng invoiceId + type REMINDER trong 6 ngày → skip.
 * Tách type REMINDER khỏi INVOICE để dedup overdue (type INVOICE) không xung đột.
 */
const checkDueSoonInvoices = async () => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const fiveDaysLater = new Date(startOfToday.getTime() + 3 * 24 * 60 * 60 * 1000);

  const dueSoon = await Invoice.find({
    status: "unpaid",
    dueDate: { $gte: startOfToday, $lte: fiveDaysLater },
    sentAt: { $ne: null },
    tenantId: { $ne: null },
  });

  const results = [];
  for (const invoice of dueSoon) {
    const existingNotif = await Notification.findOne({
      type: "REMINDER",
      invoiceId: invoice._id,
      createdAt: { $gte: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000) },
    });
    if (!existingNotif) {
      const tenantNotifs = await notifyTenantInvoiceDue(invoice);
      results.push(...tenantNotifs);
    }
  }
  return results;
};

// ─── Socket helper (giữ nguyên) ──────────────────────────────────────────────
const sendSocketNotification = (io, eventType, notification) => {
  if (!io) return;
  io.to(`tenant_${notification.userId}`).emit(eventType, notification);
};

// ─── Extension notification helpers ──────────────────────────────────────────

/** Admin gửi yêu cầu gia hạn → email + in-app cho tenant. */
const notifyTenantExtensionRequest = async (contract) => {
  const populated = await Contract.findById(contract._id)
    .populate("tenant", "_id email name")
    .populate("room", "name");
  const tenant = populated?.tenant;
  if (!tenant) return [];

  const title = "📋 Yêu cầu gia hạn hợp đồng";
  const noteSection = populated.extensionNote
    ? `\n\nThông tin từ chủ trọ:\n${populated.extensionNote}`
    : "";
  const message = `Kính gửi Quý khách,\n\nHợp đồng thuê phòng ${populated.room?.name || ""} của Quý khách sắp hết hạn vào ngày ${fmtDate(populated.endDate)}. Chủ trọ muốn hỏi ý kiến Quý khách về việc gia hạn hợp đồng.${noteSection}\n\nVui lòng đăng nhập ứng dụng để phản hồi.\n\nTrân trọng,\nĐội ngũ Phòng Trọ DTT`;

  return dispatch({
    recipients: [{ _id: tenant._id, email: tenant.email, name: tenant.name }],
    data: {
      type: "CONTRACT",
      title,
      message,
      contractId: populated._id,
      roomId: populated.room?._id,
    },
    channels: ["inapp", "email"],
    actionUrl: buildFrontendUrl("/my-room"),
  });
};

/** Tenant đồng ý gia hạn → thông báo admin/staff. */
const notifyAdminTenantAgreedExtension = async (contract) => {
  const room = await Room.findById(contract.room).select("name district");
  const tenant = await User.findById(contract.tenant).select("name");

  const title = "✅ Khách thuê đồng ý gia hạn hợp đồng";
  const message = `Khách thuê ${tenant?.name || ""} — phòng ${room?.name || ""} đã đồng ý gia hạn hợp đồng${contract.extensionRequestedMonths ? ` (${contract.extensionRequestedMonths} tháng)` : ""}. Vui lòng tạo hợp đồng gia hạn.`;

  return await notifyStaffByDistrict(room?.district || "", {
    type: "CONTRACT",
    title,
    message,
    contractId: contract._id,
    roomId: contract.room,
    actionUrl: buildFrontendUrl("/admin/contracts"),
  });
};

/** Tenant từ chối gia hạn → thông báo admin/staff. */
const notifyAdminTenantDeclinedExtension = async (contract) => {
  const room = await Room.findById(contract.room).select("name district");
  const tenant = await User.findById(contract.tenant).select("name");

  const title = "❌ Khách thuê từ chối gia hạn hợp đồng";
  const message = `Khách thuê ${tenant?.name || ""} — phòng ${room?.name || ""} đã từ chối gia hạn hợp đồng. Hợp đồng sẽ tự động chấm dứt khi hết hạn.`;

  return await notifyStaffByDistrict(room?.district || "", {
    type: "CONTRACT",
    title,
    message,
    contractId: contract._id,
    roomId: contract.room,
    actionUrl: buildFrontendUrl("/admin/contracts"),
  });
};

/** Admin tạo hợp đồng gia hạn → thông báo tenant ký. */
const notifyTenantExtensionCreated = async (newContract) => {
  const populated = await Contract.findById(newContract._id)
    .populate("tenant", "_id email name")
    .populate("room", "name");
  const tenant = populated?.tenant;
  if (!tenant) return [];

  const title = "📝 Hợp đồng gia hạn đã được tạo — Vui lòng ký xác nhận";
  const message = `Kính gửi Quý khách,\n\nChủ trọ đã tạo hợp đồng gia hạn cho phòng ${populated.room?.name || ""} (từ ${fmtDate(populated.startDate)} đến ${fmtDate(populated.endDate)}, giá thuê ${fmt(populated.monthlyRent)}đ/tháng). Vui lòng đăng nhập ứng dụng để xem chi tiết và ký xác nhận.\n\nTrân trọng,\nĐội ngũ Phòng Trọ DTT`;

  return dispatch({
    recipients: [{ _id: tenant._id, email: tenant.email, name: tenant.name }],
    data: {
      type: "CONTRACT",
      title,
      message,
      contractId: populated._id,
      roomId: populated.room?._id,
    },
    channels: ["inapp", "email"],
    actionUrl: buildFrontendUrl("/my-room"),
  });
};

module.exports = {
  // Dispatcher (export để test)
  dispatch,
  // Staff
  notifyStaff,
  notifyStaffByDistrict,
  notifyNewAppointment,
  notifyNewContract,
  notifyNewIncident,
  notifyStaffIncidentRated,
  notifyInvoicePaid,
  notifyInvoiceOverdue,
  notifyContractExpiring,
  // Tenant
  notifyTenantInvoiceDue,
  notifyTenantInvoiceOverdue,
  notifyTenantContractExpiring,
  notifyTenantContractApproved,
  notifyTenantContractEnded,
  notifyTenantInvoiceSent,
  notifyTenantInvoicePaid,
  notifyTenantAppointmentConfirmed,
  notifyTenantAppointmentCancelled,
  notifyTenantIncidentStatus,
  // Extension
  notifyTenantExtensionRequest,
  notifyAdminTenantAgreedExtension,
  notifyAdminTenantDeclinedExtension,
  notifyTenantExtensionCreated,
  // Cron
  checkExpiringContracts,
  checkOverdueInvoices,
  checkDueSoonInvoices,
  // Socket
  sendSocketNotification,
};
