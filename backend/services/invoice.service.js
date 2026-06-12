const mongoose = require("mongoose");
const Invoice = require("../models/Invoice");
const Contract = require("../models/Contract");
const { checkUserDistrictPermission } = require("../middleware/auth");

/**
 * Lấy hợp đồng đã populate room & kiểm tra quyền truy cập.
 */
const getContractOrFail = async (contractId, user, session = null) => {
  const contract = await Contract.findById(contractId)
    .populate("room", "name address price district")
    .session(session);

  if (!contract) {
    const err = new Error("Không tìm thấy hợp đồng.");
    err.status = 404;
    throw err;
  }

  // Admin: bypass
  if (user.role === "admin") return contract;

  // Staff: kiểm tra district
  if (user.role === "staff") {
    const roomDistrict = contract.room?.district || "";
    if (!user.managedDistricts || !user.managedDistricts.includes(roomDistrict)) {
      const err = new Error("Bạn không có quyền truy cập hợp đồng thuộc khu vực này.");
      err.status = 403;
      throw err;
    }
    return contract;
  }

  // Tenant không được tạo
  const err = new Error("Không có quyền truy cập hợp đồng này.");
  err.status = 403;
  throw err;
};

const createManualInvoiceService = async (payload, user) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      contractId, month, year,
      electricity, water, extraFees, notes,
    } = payload;

    if (!contractId || !month || !year) {
      const err = new Error("contractId, month và year là bắt buộc.");
      err.status = 400;
      throw err;
    }

    // 1. Lấy và kiểm tra hợp đồng
    const contract = await getContractOrFail(contractId, user, session);

    // Kiểm tra status hợp đồng
    if (contract.status !== "active") {
      const err = new Error("Hợp đồng không còn hiệu lực");
      err.status = 400;
      throw err;
    }

    // 2. Validate tháng/năm không được là quá khứ
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1; // 1-12
    const currentYear = currentDate.getFullYear();

    const invoiceMonth = Number(month);
    const invoiceYear = Number(year);

    if (invoiceYear < currentYear || (invoiceYear === currentYear && invoiceMonth < currentMonth)) {
      const err = new Error("Không được tạo hóa đơn cho tháng đã qua");
      err.status = 400;
      throw err;
    }

    // 3. Kiểm tra duplicate
    const existingInvoice = await Invoice.findOne({
      contract: contractId,
      type: "service",
      month: invoiceMonth,
      year: invoiceYear
    }).session(session);

    if (existingInvoice) {
      const err = new Error(`Hóa đơn tháng ${invoiceMonth}/${invoiceYear} đã tồn tại cho hợp đồng này.`);
      err.status = 409;
      throw err;
    }

    // 4. Tính toán ngày hạn (issueDate + 5 ngày)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 5);

    // 5. Tạo hóa đơn
    const newInvoiceArr = await Invoice.create([{
      contract:            contractId,
      type:                "service",
      month:               invoiceMonth,
      year:                invoiceYear,

      // --- Snapshot ---
      representativeName:  contract.representativeName,
      representativePhone: contract.representativePhone,
      roomName:            contract.room.name,
      rentAmount:          contract.monthlyRent,

      electricity: {
        oldReading: Number(electricity.oldReading),
        newReading: Number(electricity.newReading),
        rate:       Number(electricity.rate),
      },
      water: {
        oldReading: Number(water.oldReading),
        newReading: Number(water.newReading),
        rate:       Number(water.rate),
      },
      extraFees: Array.isArray(extraFees) ? extraFees : [],

      dueDate:   dueDate,
      notes:     notes || "",
      createdBy: user._id,
    }], { session });

    await session.commitTransaction();
    session.endSession();

    return newInvoiceArr[0];
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};

module.exports = {
  createManualInvoiceService
};
