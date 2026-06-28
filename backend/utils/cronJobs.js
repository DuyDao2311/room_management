/**
 * cronJobs.js
 * Tiến trình chạy ngầm hàng ngày xử lý hợp đồng:
 *   1. Cảnh báo admin/staff khi hợp đồng còn <= 30 ngày (chưa xử lý)
 *   2. Tự động chuyển hợp đồng quá hạn sang "expired"
 *   3. Sau 3 ngày expired mà chưa xử lý → "terminated" + giải phóng phòng
 *   4. Tự động chấm dứt hợp đồng do nợ quá hạn > 19 ngày
 */

const cron = require("node-cron");
const Contract = require("../models/Contract");
const Room = require("../models/Room");
const Invoice = require("../models/Invoice");
const {
  notifyContractExpiring,
  notifyTenantContractExpiring,
  notifyTenantContractEnded,
  sendSocketNotification,
  checkDueSoonInvoices,
  checkOverdueInvoices,
  notifyTenantContractTerminatedDueToDebt,
  notifyStaffContractTerminatedDueToDebt,
} = require("./notificationService");

const runDailyCronJobs = async (io) => {
  console.log("⏰ [CronJob] Bắt đầu kiểm tra hợp đồng hàng ngày...");
  try {
    await activateRenewalContracts(io);
    await warnExpiringContracts(io);
    await autoExpireContracts(io);
    await autoTerminateContracts(io);

    console.log("⏰ [CronJob] Bắt đầu kiểm tra hóa đơn hàng ngày...");
    const overdueNotifs = await checkOverdueInvoices();
    const dueSoonNotifs = await checkDueSoonInvoices();

    if (io) {
      [...overdueNotifs, ...dueSoonNotifs].forEach((n) => {
        sendSocketNotification(io, "new_notification", n);
      });
    }

    // Xử lý chấm dứt hợp đồng do nợ quá hạn > 19 ngày
    await autoTerminateOverdueInvoices(io);

    console.log("✅ [CronJob] Hoàn tất kiểm tra hợp đồng và hóa đơn.");
  } catch (err) {
    console.error("❌ [CronJob] Lỗi:", err.message);
    throw err;
  }
};

const initCronJobs = (io) => {
  console.log("📅 [CronJob] Sẵn sàng quét hợp đồng hàng ngày...");
};

// ─── 0. Kích hoạt hợp đồng gia hạn đến ngày bắt đầu ────────────────────────
const activateRenewalContracts = async (io) => {
  const now = new Date();

  // Tìm hợp đồng gia hạn đã ký (renewal) mà startDate <= hôm nay
  const renewalContracts = await Contract.find({
    status: "renewal",
    startDate: { $lte: now },
  }).populate("room", "name address").populate("tenant", "name email");

  if (renewalContracts.length === 0) {
    console.log("🔄 [CronJob] Không có hợp đồng gia hạn nào cần kích hoạt.");
    return;
  }

  console.log(`🔄 [CronJob] Tìm thấy ${renewalContracts.length} hợp đồng gia hạn cần kích hoạt.`);

  for (const renewal of renewalContracts) {
    try {
      // Chuyển HĐ gia hạn sang active
      await Contract.findByIdAndUpdate(renewal._id, { status: "active" });

      // Chuyển HĐ chính sang renewed
      if (renewal.parentContract) {
        await Contract.findByIdAndUpdate(renewal.parentContract, { status: "renewed" });
      }

      console.log(`  ✅ Kích hoạt HĐ gia hạn ${renewal._id} (phòng ${renewal.room?.name})`);
    } catch (err) {
      console.error(`[CronJob] Lỗi kích hoạt HĐ gia hạn ${renewal._id}:`, err.message);
    }
  }
};

// ─── 1. Cảnh báo hợp đồng còn <= 30 ngày (chưa xử lý) ────────────────────────
const warnExpiringContracts = async (io) => {
  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Chỉ cảnh báo những hợp đồng mà admin chưa gửi yêu cầu cho tenant
  const contracts = await Contract.find({
    status: "active",
    endDate: { $gte: now, $lte: thirtyDaysLater },
    extensionStatus: { $in: ["none", null] },
  });

  if (contracts.length === 0) {
    console.log("📢 [CronJob] Không có hợp đồng nào sắp hết hạn (<= 30 ngày) cần xử lý.");
    return;
  }

  console.log(`📢 [CronJob] Tìm thấy ${contracts.length} hợp đồng sắp hết hạn cần xử lý.`);

  for (const contract of contracts) {
    try {
      // Gửi notification cho admin/staff
      const staffNotifs = await notifyContractExpiring(contract);
      // Gửi notification cho tenant
      const tenantNotifs = await notifyTenantContractExpiring(contract);

      // Emit qua socket
      if (io) {
        [...staffNotifs, ...tenantNotifs].forEach((n) => {
          sendSocketNotification(io, "new_notification", n);
        });
      }
    } catch (err) {
      console.error(`[CronJob] Lỗi cảnh báo hợp đồng ${contract._id}:`, err.message);
    }
  }
};

// ─── 2. Tự động chuyển hợp đồng quá hạn sang "expired" ─────────────────────────
const autoExpireContracts = async (io) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const expiredContracts = await Contract.find({
    status: "active",
    endDate: { $lt: startOfToday },
  });

  if (expiredContracts.length === 0) {
    console.log("⏳ [CronJob] Không có hợp đồng nào quá hạn cần chuyển sang expired.");
    return;
  }

  console.log(`⏳ [CronJob] Tìm thấy ${expiredContracts.length} hợp đồng đã quá hạn → expired.`);

  for (const contract of expiredContracts) {
    try {
      await Contract.findByIdAndUpdate(contract._id, { status: "expired" });

      // Thông báo cho tenant
      const tenantNotifs = await notifyTenantContractEnded(contract, { reason: "expired" });
      if (io) {
        tenantNotifs.forEach((n) => sendSocketNotification(io, "new_notification", n));
      }
    } catch (err) {
      console.error(`[CronJob] Lỗi expire hợp đồng ${contract._id}:`, err.message);
    }
  }
};

// ─── 3. Sau 3 ngày expired → terminated + giải phóng phòng ──────────────────────
const autoTerminateContracts = async (io) => {
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  // Tìm hợp đồng expired có endDate < 3 ngày trước VÀ chưa được gia hạn
  const stalledContracts = await Contract.find({
    status: "expired",
    endDate: { $lt: threeDaysAgo },
    extensionStatus: { $nin: ["extended", "tenant_agreed"] },
  });

  if (stalledContracts.length === 0) {
    console.log("🔚 [CronJob] Không có hợp đồng expired > 3 ngày nào cần terminated.");
    return;
  }

  console.log(`🔚 [CronJob] Tìm thấy ${stalledContracts.length} hợp đồng expired > 3 ngày → terminated.`);

  for (const contract of stalledContracts) {
    try {
      await Contract.findByIdAndUpdate(contract._id, { status: "terminated" });

      // Giải phóng phòng (nếu chưa có hợp đồng nối tiếp)
      const hasSuccessor = await Contract.findOne({
        parentContract: contract._id,
        status: { $in: ["active", "pending"] },
      });
      if (!hasSuccessor) {
        await Room.findByIdAndUpdate(contract.room, { status: "available" });
      }

      // Thông báo tenant
      const tenantNotifs = await notifyTenantContractEnded(contract, { reason: "terminated" });
      if (io) {
        tenantNotifs.forEach((n) => sendSocketNotification(io, "new_notification", n));
      }
    } catch (err) {
      console.error(`[CronJob] Lỗi terminate hợp đồng ${contract._id}:`, err.message);
    }
  }
};

// ─── 4. Chấm dứt hợp đồng do nợ quá hạn > 19 ngày ─────────────────────────────
const autoTerminateOverdueInvoices = async (io) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Tìm hóa đơn overdue có overdueStep < 6 (chưa bị terminate)
  const overdueInvoices = await Invoice.find({
    status: "overdue",
    dueDate: { $ne: null },
    sentAt: { $ne: null },
    tenantId: { $ne: null },
    overdueStep: { $lt: 6 },
  });

  let terminatedCount = 0;

  for (const invoice of overdueInvoices) {
    try {
      const dueDate = new Date(invoice.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      const daysOverdue = Math.floor((startOfToday - dueDate) / (1000 * 60 * 60 * 24));

      // Chỉ xử lý khi quá hạn > 19 ngày
      if (daysOverdue <= 19) continue;

      console.log(`🔴 [CronJob] Hóa đơn ${invoice._id} quá hạn ${daysOverdue} ngày → chấm dứt HĐ.`);

      // Tìm hợp đồng liên quan
      const contract = await Contract.findById(invoice.contract)
        .populate("room", "name");

      if (!contract) {
        console.error(`[CronJob] Không tìm thấy hợp đồng ${invoice.contract} cho hóa đơn ${invoice._id}`);
        continue;
      }

      // Chỉ chấm dứt nếu hợp đồng đang active
      if (contract.status !== "active") {
        // Hợp đồng đã không còn active, chỉ đánh dấu overdueStep
        invoice.overdueStep = 6;
        await invoice.save();
        continue;
      }

      // 1. Chấm dứt hợp đồng + ghi chú tịch thu cọc
      const fmtDeposit = (contract.depositAmount || 0).toLocaleString("vi-VN");
      const terminationNote = `Chấm dứt tự động do nợ quá hạn hóa đơn (${invoice.roomName}, tháng ${invoice.month || ""}/${invoice.year || ""}). Tịch thu tiền cọc ${fmtDeposit}đ.`;
      await Contract.findByIdAndUpdate(contract._id, {
        status: "terminated",
        notes: contract.notes
          ? `${contract.notes}\n\n${terminationNote}`
          : terminationNote,
      });

      // 2. Giải phóng phòng
      const hasSuccessor = await Contract.findOne({
        parentContract: contract._id,
        status: { $in: ["active", "pending"] },
      });
      if (!hasSuccessor) {
        await Room.findByIdAndUpdate(contract.room, { status: "available" });
      }

      // 3. Đánh dấu hóa đơn đã xử lý
      invoice.overdueStep = 6;
      await invoice.save();

      // 4. Gửi thông báo cho tenant + admin/staff
      const tenantNotifs = await notifyTenantContractTerminatedDueToDebt(invoice, contract);
      const staffNotifs = await notifyStaffContractTerminatedDueToDebt(invoice, contract);

      if (io) {
        [...tenantNotifs, ...staffNotifs].forEach((n) => {
          sendSocketNotification(io, "new_notification", n);
        });
      }

      terminatedCount++;
      console.log(`  ✅ Đã chấm dứt HĐ ${contract._id} (phòng ${contract.room?.name || invoice.roomName})`);
    } catch (err) {
      console.error(`[CronJob] Lỗi terminate do nợ, hóa đơn ${invoice._id}:`, err.message);
    }
  }

  if (terminatedCount === 0) {
    console.log("🔴 [CronJob] Không có hợp đồng nào cần chấm dứt do nợ quá hạn.");
  } else {
    console.log(`🔴 [CronJob] Đã chấm dứt ${terminatedCount} hợp đồng do nợ quá hạn.`);
  }
};

module.exports = { initCronJobs, runDailyCronJobs };
