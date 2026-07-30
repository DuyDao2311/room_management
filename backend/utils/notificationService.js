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
        serviceBookingId: data.serviceBookingId,
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

/** Khách yêu cầu thanh toán tiền mặt → in-app + email cho staff/admin quản lý khu vực. */
const notifyStaffCashPaymentRequest = async (invoice) => {
  const district = await getInvoiceDistrict(invoice);
  const title = "💵 Khách yêu cầu thanh toán tiền mặt";
  const message = `Khách ${invoice.representativeName} — phòng ${invoice.roomName} (${fmt(invoice.totalAmount)}đ) yêu cầu thanh toán bằng tiền mặt. Vui lòng liên hệ để thu tiền.`;

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
  const message = `Kính gửi Quý khách,\n\nHóa đơn phòng ${invoice.roomName} của Quý khách (${fmt(invoice.totalAmount)}đ) sẽ đến hạn vào ngày ${fmtDate(invoice.dueDate)}. Vui lòng hoàn tất thanh toán đúng hạn để tránh phí phạt phát sinh.\n\nTrân trọng,\nCăn Hộ F4`;

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
  const message = `Kính gửi Quý khách,\n\nHóa đơn phòng ${invoice.roomName} của Quý khách (${fmt(invoice.totalAmount)}đ) đã quá hạn từ ngày ${fmtDate(invoice.dueDate)}. Chúng tôi xin nhắc nhở Quý khách hoàn tất thanh toán trong thời gian sớm nhất để tránh phát sinh thêm chi phí.\n\nTrân trọng,\nCăn Hộ F4`;

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
  const message = `Kính gửi Quý khách,\n\nHợp đồng thuê phòng ${populated.room?.name || ""} của Quý khách sẽ hết hạn vào ngày ${fmtDate(populated.endDate)}. Vui lòng liên hệ với chúng tôi để gia hạn nếu Quý khách có nhu cầu tiếp tục thuê.\n\nTrân trọng,\nCăn Hộ F4`;

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
  const message = `Kính gửi Quý khách,\n\nHợp đồng thuê phòng ${populated.room?.name || ""} của Quý khách đã được phê duyệt thành công. Vui lòng hoàn tất thanh toán tiền cọc và tháng đầu để chính thức bắt đầu hợp đồng.\n\nTrân trọng,\nCăn Hộ F4`;

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
    ? `Kính gửi Quý khách,\n\nHợp đồng thuê phòng ${roomName} của Quý khách đã chính thức hết hạn vào ngày ${fmtDate(populated.endDate)}. Nếu Quý khách có nhu cầu tiếp tục thuê, vui lòng liên hệ với chúng tôi để gia hạn.\n\nTrân trọng,\nCăn Hộ F4`
    : `Kính gửi Quý khách,\n\nHợp đồng thuê phòng ${roomName} của Quý khách đã được chấm dứt. Vui lòng liên hệ với chúng tôi để hoàn tất các thủ tục thanh toán cuối kỳ và hoàn trả tiền cọc theo quy định.\n\nTrân trọng,\nCăn Hộ F4`;

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
  const message = `Kính gửi Quý khách,\n\nHoá đơn ${loaiInvoice} phòng ${invoice.roomName} của Quý khách (${fmt(invoice.totalAmount)}đ) vừa được phát hành.${dueText} Vui lòng truy cập hệ thống để xem chi tiết và hoàn tất thanh toán đúng hạn.\n\nTrân trọng,\nCăn Hộ F4`;

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
  const message = `Kính gửi Quý khách,\n\nHoá đơn ${loaiInvoice} phòng ${invoice.roomName} của Quý khách (${fmt(invoice.totalAmount)}đ) đã được xác nhận thanh toán${phuongThuc} thành công. Cảm ơn Quý khách đã hoàn tất thanh toán.\n\nTrân trọng,\nCăn Hộ F4`;

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

  switch (status) {
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
  const message = `Kính gửi Quý khách,\n\nSự cố tại phòng ${room?.name || ""} ${statusText}.${noteMsg}\n\nTrân trọng,\nCăn Hộ F4`;

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
    ? `Kính gửi Quý khách,\n\n${baseInfo} đã được khôi phục. Chúng tôi xin lỗi vì sự thay đổi trước đó và mong Quý khách thông cảm.\n\nTrân trọng,\nCăn Hộ F4`
    : `Kính gửi Quý khách,\n\n${baseInfo} đã được xác nhận thành công. Vui lòng có mặt đúng thời gian đã hẹn.\n\nTrân trọng,\nCăn Hộ F4`;

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
  const message = `Kính gửi Quý khách,\n\nChúng tôi xin thông báo lịch hẹn xem phòng ${room?.name || ""} ngày ${fmtDate(appointment.date)} lúc ${appointment.time} đã bị hủy. Chúng tôi xin lỗi vì sự bất tiện này. Để đặt lịch mới, Quý khách vui lòng truy cập website.\n\nTrân trọng,\nCăn Hộ F4`;

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
    try {
      // Đảm bảo status = overdue
      if (invoice.status === "unpaid") {
        invoice.status = "overdue";
      }

      // Tính số ngày quá hạn
      const dueDate = new Date(invoice.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      const daysOverdue = Math.floor((startOfToday - dueDate) / (1000 * 60 * 60 * 24));
      const currentStep = invoice.overdueStep || 0;

      // ── Áp dụng phí phạt nếu >= 4 ngày và chưa có ──
      let penaltyAppliedNow = false;
      if (daysOverdue >= 4 && (!invoice.penaltyFee || invoice.penaltyFee === 0)) {
        const baseAmount = invoice.totalAmount || 0;
        invoice.penaltyFee = Math.round(baseAmount * 0.05);
        penaltyAppliedNow = true;
      }

      // ── Step 6: Chấm dứt hợp đồng (> 19 ngày) — xử lý trong cronJobs.js ──
      // Không xử lý ở đây, chỉ trả về thông tin để cronJobs xử lý

      // ── Step 5: Cảnh báo chấm dứt HĐ sau 5 ngày (>= 14 ngày) ──
      if (daysOverdue >= 14 && currentStep < 5) {
        invoice.overdueStep = 5;
        await invoice.save();
        const tenantNotifs = await notifyTenantTerminationWarning(invoice);
        const staffNotifs = await notifyInvoiceOverdue(invoice);
        results.push(...tenantNotifs, ...staffNotifs);
        continue;
      }

      // ── Step 4: Cảnh báo công nợ nghiêm trọng (>= 9 ngày) ──
      if (daysOverdue >= 9 && currentStep < 4) {
        invoice.overdueStep = 4;
        await invoice.save();
        const tenantNotifs = await notifyTenantSevereWarning(invoice);
        const staffNotifs = await notifyInvoiceOverdue(invoice);
        results.push(...tenantNotifs, ...staffNotifs);
        continue;
      }

      // ── Step 3: Áp dụng phí phạt 5% (>= 4 ngày) ──
      if (daysOverdue >= 4 && currentStep < 3) {
        invoice.overdueStep = 3;
        await invoice.save(); // pre("save") sẽ tự cộng penaltyFee vào totalAmount
        const tenantNotifs = await notifyTenantPenaltyApplied(invoice);
        const staffNotifs = await notifyInvoiceOverdue(invoice);
        results.push(...tenantNotifs, ...staffNotifs);
        continue;
      }

      // Nếu chỉ áp dụng phạt mà không vào step mới (ví dụ đã ở step 3 nhưng vì lý do nào đó mất penalty)
      if (penaltyAppliedNow && currentStep >= 3) {
        await invoice.save();
      }

      // ── Step 2: Nhắc nhở lần 2 (>= 3 ngày) ──
      if (daysOverdue >= 3 && currentStep < 2) {
        invoice.overdueStep = 2;
        await invoice.save();
        const tenantNotifs = await notifyTenantOverdueReminder2(invoice);
        const staffNotifs = await notifyInvoiceOverdue(invoice);
        results.push(...tenantNotifs, ...staffNotifs);
        continue;
      }

      // ── Step 1: Nhắc nhở lần 1 (>= 1 ngày) ──
      if (daysOverdue >= 1 && currentStep < 1) {
        invoice.overdueStep = 1;
        await invoice.save();
        const tenantNotifs = await notifyTenantOverdueReminder1(invoice);
        const staffNotifs = await notifyInvoiceOverdue(invoice);
        results.push(...tenantNotifs, ...staffNotifs);
        continue;
      }

      // Nếu chưa vào bước nào mới, vẫn lưu status overdue
      if (invoice.isModified()) {
        await invoice.save();
      }
    } catch (err) {
      console.error(`[Overdue] Lỗi xử lý hóa đơn ${invoice._id}:`, err.message);
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

// ─── Overdue escalation notification helpers ─────────────────────────────────

/** Nhắc nhở lần 1 (1 ngày quá hạn) → tenant */
const notifyTenantOverdueReminder1 = async (invoice) => {
  const tenant = await User.findById(invoice.tenantId).select("_id email name");
  if (!tenant) return [];

  const title = "🔔 Nhắc nhở thanh toán hóa đơn (lần 1)";
  const message = `Kính gửi Quý khách,\n\nHóa đơn phòng ${invoice.roomName} (${fmt(invoice.totalAmount)}đ) đã quá hạn thanh toán từ ngày ${fmtDate(invoice.dueDate)}. Vui lòng hoàn tất thanh toán sớm nhất để tránh các khoản phí phạt phát sinh.\n\nTrân trọng,\nCăn Hộ F4`;

  return dispatch({
    recipients: [{ _id: tenant._id, email: tenant.email, name: tenant.name }],
    data: { type: "INVOICE", title, message, invoiceId: invoice._id },
    channels: ["inapp", "email"],
    actionUrl: buildFrontendUrl("/my-invoices"),
  });
};

/** Nhắc nhở lần 2 (3 ngày quá hạn) → tenant */
const notifyTenantOverdueReminder2 = async (invoice) => {
  const tenant = await User.findById(invoice.tenantId).select("_id email name");
  if (!tenant) return [];

  const title = "⚠️ Nhắc nhở thanh toán hóa đơn (lần 2)";
  const message = `Kính gửi Quý khách,\n\nĐây là lần nhắc nhở thứ 2 về hóa đơn phòng ${invoice.roomName} (${fmt(invoice.totalAmount)}đ) đã quá hạn từ ngày ${fmtDate(invoice.dueDate)}. Nếu không thanh toán trong thời gian tới, hệ thống sẽ tự động áp dụng phí phạt quá hạn.\n\nTrân trọng,\nCăn Hộ F4`;

  return dispatch({
    recipients: [{ _id: tenant._id, email: tenant.email, name: tenant.name }],
    data: { type: "INVOICE", title, message, invoiceId: invoice._id },
    channels: ["inapp", "email"],
    actionUrl: buildFrontendUrl("/my-invoices"),
  });
};

/** Áp dụng phí phạt 5% (4 ngày quá hạn) → tenant */
const notifyTenantPenaltyApplied = async (invoice) => {
  const tenant = await User.findById(invoice.tenantId).select("_id email name");
  if (!tenant) return [];

  const title = "💸 Đã áp dụng phí phạt quá hạn 5%";
  const message = `Kính gửi Quý khách,\n\nDo hóa đơn phòng ${invoice.roomName} chưa được thanh toán sau nhiều lần nhắc nhở, hệ thống đã áp dụng phí phạt quá hạn 5% (${fmt(invoice.penaltyFee)}đ). Tổng số tiền cần thanh toán hiện tại là ${fmt(invoice.totalAmount)}đ.\n\nVui lòng thanh toán sớm nhất có thể.\n\nTrân trọng,\nCăn Hộ F4`;

  return dispatch({
    recipients: [{ _id: tenant._id, email: tenant.email, name: tenant.name }],
    data: { type: "INVOICE", title, message, invoiceId: invoice._id },
    channels: ["inapp", "email"],
    actionUrl: buildFrontendUrl("/my-invoices"),
  });
};

/** Cảnh báo công nợ nghiêm trọng (9 ngày quá hạn) → tenant */
const notifyTenantSevereWarning = async (invoice) => {
  const tenant = await User.findById(invoice.tenantId).select("_id email name");
  if (!tenant) return [];

  const title = "🚨 Cảnh báo công nợ nghiêm trọng";
  const message = `Kính gửi Quý khách,\n\nHóa đơn phòng ${invoice.roomName} (${fmt(invoice.totalAmount)}đ) đã quá hạn thanh toán nghiêm trọng. Nếu tình trạng công nợ tiếp tục kéo dài, chúng tôi sẽ buộc phải xem xét chấm dứt hợp đồng thuê phòng.\n\nVui lòng liên hệ ngay với ban quản lý để giải quyết.\n\nTrân trọng,\nCăn Hộ F4`;

  return dispatch({
    recipients: [{ _id: tenant._id, email: tenant.email, name: tenant.name }],
    data: { type: "INVOICE", title, message, invoiceId: invoice._id },
    channels: ["inapp", "email"],
    actionUrl: buildFrontendUrl("/my-invoices"),
  });
};

/** Cảnh báo chấm dứt hợp đồng sau 5 ngày (14 ngày quá hạn) → tenant */
const notifyTenantTerminationWarning = async (invoice) => {
  const tenant = await User.findById(invoice.tenantId).select("_id email name");
  if (!tenant) return [];

  const title = "❌ Thông báo sẽ chấm dứt hợp đồng sau 5 ngày";
  const message = `Kính gửi Quý khách,\n\nDo hóa đơn phòng ${invoice.roomName} (${fmt(invoice.totalAmount)}đ) đã quá hạn thanh toán quá lâu mà chưa được giải quyết, chúng tôi chính thức thông báo:\n\nHợp đồng thuê phòng của Quý khách sẽ bị chấm dứt sau 5 ngày nữa nếu khoản nợ không được thanh toán. Quý khách cũng sẽ mất toàn bộ tiền cọc.\n\nVui lòng liên hệ ngay với ban quản lý để thanh toán và tránh bị chấm dứt hợp đồng.\n\nTrân trọng,\nCăn Hộ F4`;

  return dispatch({
    recipients: [{ _id: tenant._id, email: tenant.email, name: tenant.name }],
    data: { type: "INVOICE", title, message, invoiceId: invoice._id },
    channels: ["inapp", "email"],
    actionUrl: buildFrontendUrl("/my-invoices"),
  });
};

/** Thông báo hợp đồng đã bị chấm dứt do nợ (> 19 ngày quá hạn) → tenant */
const notifyTenantContractTerminatedDueToDebt = async (invoice, contract) => {
  const tenant = await User.findById(invoice.tenantId).select("_id email name");
  if (!tenant) return [];

  const room = await Room.findById(contract.room).select("name");
  const title = "🔴 Hợp đồng đã bị chấm dứt do nợ quá hạn";
  const message = `Kính gửi Quý khách,\n\nHợp đồng thuê phòng ${room?.name || invoice.roomName} của Quý khách đã bị chấm dứt do hóa đơn quá hạn thanh toán quá lâu mà không được giải quyết.\n\n• Tiền cọc: Bị tịch thu theo quy định.\n• Phòng: Đã được giải phóng.\n\nNếu có bất kỳ thắc mắc nào, vui lòng liên hệ với ban quản lý.\n\nTrân trọng,\nCăn Hộ F4`;

  return dispatch({
    recipients: [{ _id: tenant._id, email: tenant.email, name: tenant.name }],
    data: { type: "CONTRACT", title, message, contractId: contract._id, invoiceId: invoice._id },
    channels: ["inapp", "email"],
    actionUrl: buildFrontendUrl("/my-room"),
  });
};

/** Thông báo cho staff/admin khi hợp đồng bị chấm dứt do nợ */
const notifyStaffContractTerminatedDueToDebt = async (invoice, contract) => {
  const district = await getInvoiceDistrict(invoice);
  const room = await Room.findById(contract.room).select("name");
  const title = "🔴 Hợp đồng bị chấm dứt do nợ quá hạn";
  const message = `Hợp đồng phòng ${room?.name || invoice.roomName} — ${invoice.representativeName} đã bị hệ thống tự động chấm dứt do hóa đơn quá hạn ${fmt(invoice.totalAmount)}đ không được thanh toán. Tiền cọc đã bị tịch thu. Phòng chuyển sang trạng thái Available.`;

  return await notifyStaffByDistrict(district, {
    type: "CONTRACT",
    title,
    message,
    contractId: contract._id,
    invoiceId: invoice._id,
    actionUrl: buildFrontendUrl("/admin/contracts"),
  });
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
  const message = `Kính gửi Quý khách,\n\nHợp đồng thuê phòng ${populated.room?.name || ""} của Quý khách sắp hết hạn vào ngày ${fmtDate(populated.endDate)}. Chủ trọ muốn hỏi ý kiến Quý khách về việc gia hạn hợp đồng.${noteSection}\n\nVui lòng đăng nhập ứng dụng để phản hồi.\n\nTrân trọng,\nCăn Hộ F4`;

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
  const message = `Kính gửi Quý khách,\n\nChủ trọ đã tạo hợp đồng gia hạn cho phòng ${populated.room?.name || ""} (từ ${fmtDate(populated.startDate)} đến ${fmtDate(populated.endDate)}, giá thuê ${fmt(populated.monthlyRent)}đ/tháng). Vui lòng đăng nhập ứng dụng để xem chi tiết và ký xác nhận.\n\nTrân trọng,\nCăn Hộ F4`;

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

// ─── Service booking ─────────────────────────────────────────────────────────
/**
 * Gửi thông báo (in-app + email) cho tenant khi ServiceBooking đổi trạng thái.
 * `booking.service` và `booking.tenant` phải đã populate (tenant cần `email`/`name` để gửi mail).
 */
const notifyTenantServiceBookingStatusChanged = async (booking, status) => {
  const STATUS_TEXT = {
    confirmed: { title: "✅ Booking dịch vụ đã được xác nhận", verb: "đã được xác nhận" },
    completed: { title: "🎉 Dịch vụ đã hoàn thành", verb: "đã hoàn thành" },
    cancelled: { title: "❌ Booking dịch vụ đã bị hủy", verb: "đã bị hủy" },
  };
  const info = STATUS_TEXT[status];
  if (!info) return [];

  const serviceName = booking.service?.name || "Dịch vụ";
  const message = `Kính gửi Quý khách,\n\nBooking dịch vụ "${serviceName}" (hẹn lúc ${fmtDate(booking.scheduledAt)}) ${info.verb}.\n\nTrân trọng,\nCăn Hộ F4`;

  return dispatch({
    recipients: [{ _id: booking.tenant._id, email: booking.tenant.email, name: booking.tenant.name }],
    data: {
      type: "SERVICE",
      title: info.title,
      message,
      serviceBookingId: booking._id,
    },
    channels: ["inapp", "email"],
  });
};

/**
 * Gửi thông báo (in-app + email) cho tenant khi 1 Service họ đang có booking pending/confirmed
 * bị admin/staff chuyển isActive:true → false (tạm ngừng kinh doanh).
 * KHÔNG tự hủy booking — chỉ báo cho tenant biết, admin/staff tự xử lý tiếp bằng tay.
 * `booking.tenant` phải đã populate (cần `email`/`name` để gửi mail).
 */
const notifyTenantServiceDeactivated = async (booking, service) => {
  const title = "⏸️ Dịch vụ tạm ngừng kinh doanh";
  const message = `Kính gửi Quý khách,\n\nDịch vụ "${service.name}" mà Quý khách đã đặt (hẹn lúc ${fmtDate(booking.scheduledAt)}) hiện đã tạm ngừng kinh doanh. Booking của Quý khách vẫn được giữ nguyên, đội ngũ CSKH sẽ liên hệ Quý khách sớm.\n\nTrân trọng,\nCăn Hộ F4`;

  return dispatch({
    recipients: [{ _id: booking.tenant._id, email: booking.tenant.email, name: booking.tenant.name }],
    data: {
      type: "SERVICE",
      title,
      message,
      serviceBookingId: booking._id,
    },
    channels: ["inapp", "email"],
  });
};

/**
 * Gửi thông báo (in-app + email) cho tenant khi vừa tạo ServiceBooking mới (status='pending').
 * `booking.service` và `booking.tenant` phải đã populate.
 */
const notifyTenantServiceBookingCreated = async (booking) => {
  const serviceName = booking.service?.name || "Dịch vụ";
  const title = "📝 Booking dịch vụ đã được ghi nhận";
  const message = `Kính gửi Quý khách,\n\nBooking dịch vụ "${serviceName}" (số lượng ${booking.quantity}, hẹn lúc ${fmtDate(booking.scheduledAt)}, tổng ${fmt(booking.totalAmount)}đ) của Quý khách đã được ghi nhận và đang chờ xác nhận từ chúng tôi.\n\nTrân trọng,\nCăn Hộ F4`;

  return dispatch({
    recipients: [{ _id: booking.tenant._id, email: booking.tenant.email, name: booking.tenant.name }],
    data: {
      type: "SERVICE",
      title,
      message,
      serviceBookingId: booking._id,
    },
    channels: ["inapp", "email"],
    actionUrl: buildFrontendUrl("/my-service-bookings"),
  });
};

/**
 * Gửi thông báo (in-app + email) cho toàn bộ staff/admin khi có ServiceBooking mới cần xử lý.
 * `booking.service` và `booking.tenant` phải đã populate.
 */
const notifyStaffNewServiceBooking = async (booking) => {
  const tenantName = booking.tenant?.name || "";
  const tenantPhone = booking.tenant?.phone || "";
  const serviceName = booking.service?.name || "Dịch vụ";
  const title = "🛎️ Booking dịch vụ mới cần xác nhận";
  const message = `${tenantName} (${tenantPhone}) đặt dịch vụ "${serviceName}" (SL: ${booking.quantity}), hẹn lúc ${fmtDate(booking.scheduledAt)}.`;

  return notifyStaff({
    type: "SERVICE",
    title,
    message,
    serviceBookingId: booking._id,
    actionUrl: buildFrontendUrl("/admin/service-bookings"),
  });
};

/**
 * Gửi email biên lai cho tenant khi ServiceBooking được xác nhận đã thanh toán (paymentStatus='paid').
 * `booking.service` và `booking.tenant` phải đã populate.
 */
const notifyTenantServiceBookingPaid = async (booking) => {
  const serviceName = booking.service?.name || "Dịch vụ";
  const title = `✅ Xác nhận thanh toán dịch vụ thành công — ${serviceName}`;
  const message = `Kính gửi Quý khách,\n\nBooking dịch vụ "${serviceName}" (tổng ${fmt(booking.totalAmount)}đ) của Quý khách đã được xác nhận thanh toán thành công. Cảm ơn Quý khách.\n\nTrân trọng,\nCăn Hộ F4`;

  return dispatch({
    recipients: [{ _id: booking.tenant._id, email: booking.tenant.email, name: booking.tenant.name }],
    data: {
      type: "SERVICE",
      title,
      message,
      serviceBookingId: booking._id,
    },
    channels: ["inapp", "email"],
    actionUrl: buildFrontendUrl("/my-service-bookings"),
  });
};

// ─── Short-term Bookings ────────────────────────────────────────────────────────
const notifyNewBooking = async (booking) => {
  const room = booking.room;
  const tenant = booking.tenant;

  const district = room?.district || "";
  const title = "🛎️ Đặt phòng mới cần xử lý";
  const message = `Khách hàng ${tenant?.name || "Khách vãng lai"} (${tenant?.phone || tenant?.email || ""}) vừa đặt phòng ${room?.name || ""} từ ${fmtDate(booking.checkInDateTime)} đến ${fmtDate(booking.checkOutDateTime)}. Tổng tiền: ${fmt(booking.totalAmount)}đ.`;

  return await notifyStaffByDistrict(district, {
    type: "BOOKING",
    title,
    message,
    roomId: room?._id,
    actionUrl: buildFrontendUrl(`/admin/bookings`),
  });
};

const notifyStaffBookingPaid = async (booking) => {
  const room = booking.room;
  const tenant = booking.tenant;
  const district = room?.district || "";

  const title = "💰 Đặt phòng đã thanh toán";
  const message = `Khách hàng ${tenant?.name || ""} đã thanh toán ${fmt(booking.totalAmount)}đ cho phòng ${room?.name || ""} qua ${booking.paymentMethod}.`;

  return await notifyStaffByDistrict(district, {
    type: "BOOKING",
    title,
    message,
    roomId: room?._id,
    actionUrl: buildFrontendUrl(`/admin/bookings`),
  });
};

const notifyTenantBookingPaid = async (booking) => {
  const room = booking.room;
  const tenant = booking.tenant;
  if (!tenant || !tenant.email) return [];

  const title = "✅ Xác nhận thanh toán đặt phòng thành công";
  const message = `Kính gửi Quý khách,\n\nBooking phòng ${room?.name || ""} của Quý khách (từ ${fmtDate(booking.checkInDateTime)} đến ${fmtDate(booking.checkOutDateTime)}) đã được xác nhận thanh toán thành công số tiền ${fmt(booking.totalAmount)}đ qua ${booking.paymentMethod || "tiền mặt"}.\n\nCảm ơn Quý khách!\n\nTrân trọng,\nCăn Hộ F4`;

  return dispatch({
    recipients: [{ _id: tenant._id, email: tenant.email, name: tenant.name }],
    data: {
      type: "BOOKING",
      title,
      message,
      roomId: room?._id,
    },
    channels: ["inapp", "email"],
    actionUrl: buildFrontendUrl("/my-bookings"),
  });
};

const notifyTenantBookingConfirmed = async (booking) => {
  const room = booking.room;
  const tenant = booking.tenant;
  if (!tenant || !tenant.email) return [];

  const title = "✅ Booking phòng đã được xác nhận";
  const message = `Kính gửi Quý khách,\n\nBooking phòng ${room?.name || ""} của Quý khách (từ ${fmtDate(booking.checkInDateTime)} đến ${fmtDate(booking.checkOutDateTime)}) đã được chúng tôi XÁC NHẬN.\n\nVui lòng có mặt đúng giờ để làm thủ tục nhận phòng.\n\nTrân trọng,\nCăn Hộ F4`;

  return dispatch({
    recipients: [{ _id: tenant._id, email: tenant.email, name: tenant.name }],
    data: {
      type: "BOOKING",
      title,
      message,
      roomId: room?._id,
    },
    channels: ["inapp", "email"],
    actionUrl: buildFrontendUrl("/my-bookings"),
  });
};

const notifyTenantBookingCheckedIn = async (booking) => {
  const room = booking.room;
  const tenant = booking.tenant;
  if (!tenant || !tenant.email) return [];

  const title = "🔑 Chào mừng bạn đến với phòng của chúng tôi";
  const message = `Kính gửi Quý khách,\n\nQuý khách đã làm thủ tục nhận phòng (Check-in) thành công tại phòng ${room?.name || ""}.\n\nChúc Quý khách có một kỳ lưu trú tuyệt vời! Nếu cần bất kỳ hỗ trợ nào, đừng ngần ngại liên hệ với ban quản lý.\n\nTrân trọng,\nCăn Hộ F4`;

  return dispatch({
    recipients: [{ _id: tenant._id, email: tenant.email, name: tenant.name }],
    data: {
      type: "BOOKING",
      title,
      message,
      roomId: room?._id,
    },
    channels: ["inapp", "email"],
    actionUrl: buildFrontendUrl("/my-bookings"),
  });
};

const notifyTenantBookingCheckedOut = async (booking) => {
  const room = booking.room;
  const tenant = booking.tenant;
  if (!tenant || !tenant.email) return [];

  const title = "👋 Cảm ơn Quý khách đã lưu trú";
  const message = `Kính gửi Quý khách,\n\nQuý khách đã làm thủ tục trả phòng (Check-out) thành công tại phòng ${room?.name || ""}.\n\nCảm ơn Quý khách đã tin tưởng và sử dụng dịch vụ của Căn Hộ F4. Hy vọng sẽ được đón tiếp Quý khách trong những dịp tới!\n\nTrân trọng,\nCăn Hộ F4`;

  return dispatch({
    recipients: [{ _id: tenant._id, email: tenant.email, name: tenant.name }],
    data: {
      type: "BOOKING",
      title,
      message,
      roomId: room?._id,
    },
    channels: ["inapp", "email"],
    actionUrl: buildFrontendUrl("/my-bookings"),
  });
};

const notifyTenantBookingCancelled = async (booking) => {
  const room = booking.room;
  const tenant = booking.tenant;
  if (!tenant || !tenant.email) return [];

  const title = "❌ Booking phòng đã bị huỷ";
  const message = `Kính gửi Quý khách,\n\nChúng tôi rất tiếc phải thông báo Booking phòng ${room?.name || ""} của Quý khách (từ ${fmtDate(booking.checkInDateTime)} đến ${fmtDate(booking.checkOutDateTime)}) đã BỊ HUỶ. Vui lòng liên hệ với ban quản lý để biết thêm chi tiết hoặc để đặt một phòng khác.\n\nTrân trọng,\nCăn Hộ F4`;

  return dispatch({
    recipients: [{ _id: tenant._id, email: tenant.email, name: tenant.name }],
    data: {
      type: "BOOKING",
      title,
      message,
      roomId: room?._id,
    },
    channels: ["inapp", "email"],
    actionUrl: buildFrontendUrl("/my-bookings"),
  });
};

const notifyStaffServiceBookingPaid = async (serviceBooking, paymentMethodStr, req) => {
  const serviceName = serviceBooking?.service?.name || "dịch vụ";
  const tenant = serviceBooking?.tenant;
  const tenantName = tenant?.name || "Một khách hàng";
  const tenantPhone = tenant?.phoneNumber ? ` (${tenant.phoneNumber})` : "";
  const title = "💰 Đã nhận thanh toán Dịch vụ";
  const message = `Khách hàng ${tenantName}${tenantPhone} vừa thanh toán ${fmt(serviceBooking.totalAmount)}đ qua ${paymentMethodStr} cho ${serviceName}.`;

  return notifyStaff({
    title,
    message,
    type: "SERVICE",
    serviceBookingId: serviceBooking?._id,
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
  notifyStaffCashPaymentRequest,
  notifyInvoiceOverdue,
  notifyContractExpiring,
  notifyStaffNewServiceBooking,
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
  notifyTenantServiceBookingCreated,
  notifyTenantServiceBookingStatusChanged,
  notifyTenantServiceDeactivated,
  notifyTenantServiceBookingPaid,
  // Extension
  notifyTenantExtensionRequest,
  notifyAdminTenantAgreedExtension,
  notifyAdminTenantDeclinedExtension,
  notifyTenantExtensionCreated,
  // Cron
  checkExpiringContracts,
  checkOverdueInvoices,
  checkDueSoonInvoices,
  // Overdue escalation
  notifyTenantContractTerminatedDueToDebt,
  notifyStaffContractTerminatedDueToDebt,
  // Bookings
  notifyNewBooking,
  notifyStaffBookingPaid,
  notifyTenantBookingPaid,
  notifyTenantBookingConfirmed,
  notifyTenantBookingCheckedIn,
  notifyTenantBookingCheckedOut,
  notifyTenantBookingCancelled,
  notifyStaffServiceBookingPaid,
  notifyTenantServiceBookingPaid,
  // Socket
  sendSocketNotification,
};
