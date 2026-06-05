/**
 * cronJobs.js
 * Tiến trình chạy ngầm hàng ngày xử lý hợp đồng:
 *   1. Cảnh báo admin/staff khi hợp đồng còn <= 30 ngày (chưa xử lý)
 *   2. Tự động chuyển hợp đồng quá hạn sang "expired"
 *   3. Sau 3 ngày expired mà chưa xử lý → "terminated" + giải phóng phòng
 */

const cron = require("node-cron");
const Contract = require("../models/Contract");
const Room = require("../models/Room");
const {
  notifyContractExpiring,
  notifyTenantContractExpiring,
  notifyTenantContractEnded,
  sendSocketNotification,
  checkDueSoonInvoices,
  checkOverdueInvoices,
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

    console.log("✅ [CronJob] Hoàn tất kiểm tra hợp đồng và hóa đơn.");
  } catch (err) {
    console.error("❌ [CronJob] Lỗi:", err.message);
    throw err;
  }
};

/**
 * Khởi tạo cronjob — gọi từ server.js sau khi kết nối DB.
 * @param {import("socket.io").Server} io
 */
const initCronJobs = (io) => {
  // Chạy mỗi ngày lúc 20:00 (Hệ thống chạy ngầm trong ứng dụng)
  cron.schedule("0 20 * * *", () => runDailyCronJobs(io), {
    scheduled: true,
    timezone: "Asia/Ho_Chi_Minh"
  });

  console.log("📅 [CronJob] Đã khởi tạo cronjob kiểm tra hợp đồng (20:00 hàng ngày).");
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

module.exports = { initCronJobs, runDailyCronJobs };
