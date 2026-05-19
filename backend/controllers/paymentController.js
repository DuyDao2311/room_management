const invoiceModel = require('../models/Invoice');
const contractModel = require('../models/Contract');
const userModel = require('../models/User');
const paymentModel = require('../models/Payment');
const { checkUserDistrictPermission } = require('../middleware/auth');

const { NotFoundError, BadRequestError, ForbiddenError } = require('../core/error.response');
const { Created, OK } = require('../core/success.response');

const crypto = require('crypto');
const https = require('https');

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PAYMENT CONTROLLER - Tích hợp Momo & VNPay cho hệ thống quản lý phòng trọ
 * 
 * Hỗ trợ 2 phương thức thanh toán:
 * 1. Momo - Mobile wallet
 * 2. VNPay - Banking payment
 * ═══════════════════════════════════════════════════════════════════════════
 */

function generatePaymentID() {
    // Tạo ID thanh toán bao gồm timestamp để tránh trùng lặp
    const now = new Date();
    const timestamp = now.getTime();
    const random = Math.floor(Math.random() * 10000);
    return `INV${timestamp}${random}`;
}

class PaymentController {
    /**
     * Tạo thanh toán cho hóa đơn
     * Body: { invoiceId, typePayment: 'momo' | 'vnpay' }
     */
    async createPayment(req, res, next) {
        try {
            const { invoiceId, typePayment } = req.body;
            const userId = req.user; // Lấy từ JWT middleware

            // Validate phương thức thanh toán
            if (!['momo', 'vnpay'].includes(typePayment)) {
                return next(new BadRequestError('Phương thức thanh toán phải là "momo" hoặc "vnpay"'));
            }

            // Kiểm tra hóa đơn tồn tại
            const invoice = await invoiceModel.findById(invoiceId).populate('contract');
            if (!invoice) {
                return next(new NotFoundError('Hóa đơn không tồn tại'));
            }

            // Kiểm tra hóa đơn chưa được thanh toán
            if (invoice.status === 'paid') {
                return next(new BadRequestError('Hóa đơn này đã được thanh toán'));
            }

            // Lấy thông tin tenant
            const tenant = await userModel.findById(invoice.tenantId || userId);
            if (!tenant) {
                return next(new NotFoundError('Người dùng không tồn tại'));
            }

            // Tạo bản ghi Payment ở trạng thái "pending" trước khi redirect sang gateway
            const pendingPayment = await paymentModel.create({
                invoice:       invoice._id,
                contract:      invoice.contract?._id || invoice.contract,
                tenant:        tenant._id,
                paymentMethod: typePayment,
                amount:        invoice.totalAmount,
                status:        'pending',
            });

            // Xử lý theo phương thức thanh toán
            if (typePayment === 'momo') {
                return this._handleMomo(invoice, tenant, req, res, next, pendingPayment._id);
            } else if (typePayment === 'vnpay') {
                return this._handleVNPay(invoice, tenant, req, res, next, pendingPayment._id);
            }
        } catch (error) {
            return next(error);
        }
    }

    /**
     * Xử lý thanh toán Momo
     */
    async _handleMomo(invoice, tenant, req, res, next, pendingPaymentId = null) {
        try {
            // Lấy credentials từ environment (hoặc .env)
            const accessKey = process.env.MOMO_ACCESS_KEY || 'F8BBA842ECF85';
            const secretKey = process.env.MOMO_SECRET_KEY || 'K951B6PE1waDMi640xX08PD3vg6EkVlz';
            const partnerCode = process.env.MOMO_PARTNER_CODE || 'MOMO';

            const orderId = partnerCode + generatePaymentID();
            const requestId = orderId;
            const orderInfo = `Thanh toan hoa don phong tro - Hop dong: ${invoice.contract._id}`;
            // Momo redirect người dùng về BACKEND trước để cập nhật trạng thái
            const redirectUrl = `${process.env.SERVER_URL || 'http://localhost:5000'}/api/payment/momo-callback`;
            const ipnUrl = `${process.env.SERVER_URL || 'http://localhost:5000'}/api/payment/momo-callback`;
            const requestType = 'payWithMethod';
            const amount = invoice.totalAmount;
            // extraData lưu "invoiceId:pendingPaymentId" để verify callback
            const extraData = `${invoice._id.toString()}:${pendingPaymentId || ''}`;

            // Ghi orderId vào Payment record đang pending
            if (pendingPaymentId) {
                await paymentModel.findByIdAndUpdate(pendingPaymentId, {
                    'momo.orderId':   orderId,
                    'momo.requestId': requestId,
                });
            }

            // Tạo signature
            const rawSignature =
                'accessKey=' +
                accessKey +
                '&amount=' +
                amount +
                '&extraData=' +
                extraData +
                '&ipnUrl=' +
                ipnUrl +
                '&orderId=' +
                orderId +
                '&orderInfo=' +
                orderInfo +
                '&partnerCode=' +
                partnerCode +
                '&redirectUrl=' +
                redirectUrl +
                '&requestId=' +
                requestId +
                '&requestType=' +
                requestType;

            const signature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');

            const requestBody = JSON.stringify({
                partnerCode,
                partnerName: 'Room Management System',
                storeId: 'RoomManagementStore',
                requestId,
                amount,
                orderId,
                orderInfo,
                redirectUrl,
                ipnUrl,
                lang: 'vi',
                requestType,
                autoCapture: true,
                extraData,
                orderGroupId: '',
                signature,
            });

            const options = {
                hostname: process.env.MOMO_HOST || 'test-payment.momo.vn',
                port: 443,
                path: '/v2/gateway/api/create',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(requestBody),
                },
            };

            const request = https.request(options, (response) => {
                let data = '';
                response.on('data', (chunk) => {
                    data += chunk;
                });
                response.on('end', () => {
                    try {
                        const momoResponse = JSON.parse(data);
                        return new Created({
                            message: 'Tạo yêu cầu thanh toán Momo thành công',
                            metadata: {
                                paymentUrl: momoResponse.payUrl,
                                orderId: momoResponse.orderId,
                                invoiceId: invoice._id,
                            },
                        }).send(res);
                    } catch (err) {
                        console.error('Lỗi parse Momo response:', err);
                        return next(new BadRequestError('Lỗi khi xử lý yêu cầu Momo'));
                    }
                });
            });

            request.on('error', (error) => {
                console.error('Lỗi Momo request:', error);
                return next(new BadRequestError('Lỗi kết nối Momo'));
            });

            request.write(requestBody);
            request.end();
        } catch (error) {
            return next(error);
        }
    }

    /**
     * Xử lý thanh toán VNPay
     */
    async _handleVNPay(invoice, tenant, req, res, next, pendingPaymentId = null) {
        try {
            // Kiểm tra xem có cài đặt vnpay package không
            let VNPay;
            try {
                const vnpayModule = require('vnpay');
                VNPay = vnpayModule.VNPay;
            } catch (e) {
                return next(new BadRequestError('VNPay chưa được cài đặt. Vui lòng chạy: npm install vnpay'));
            }

            const vnpay = new VNPay({
                tmnCode: process.env.VNPAY_TMN_CODE || '64DFOLZV',
                secureSecret: process.env.VNPAY_SECRET_KEY || 'O6J4Z89F24EL7WDPFXJEJBX47AGBLQVO',
                vnpayHost: process.env.VNPAY_HOST || 'https://sandbox.vnpayment.vn',
                testMode: process.env.VNPAY_TEST_MODE !== 'false',
                hashAlgorithm: 'SHA512',
            });

            // Helper: format ngày theo giờ VN (GMT+7) → YYYYMMDDHHmmss
            const toVNDate = (date) => {
                const vnDate = new Date(date.getTime() + 7 * 60 * 60 * 1000);
                return vnDate.toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
            };

            const now = new Date();
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);

            const txnRef = generatePaymentID();

            // Ghi txnRef vào Payment record đang pending
            if (pendingPaymentId) {
                await paymentModel.findByIdAndUpdate(pendingPaymentId, {
                    'vnpay.txnRef':    txnRef,
                    'vnpay.orderInfo': `Thanh toan hoa don: ${invoice._id}`,
                });
            }

            const vnpayResponse = vnpay.buildPaymentUrl({
                vnp_Amount: invoice.totalAmount, // thư viện vnpay đã tự nhân 100 nội bộ
                vnp_IpAddr: req.ip || '127.0.0.1',
                vnp_TxnRef: txnRef,
                vnp_OrderInfo: `Thanh toan hoa don: ${invoice._id}`,
                vnp_OrderType: 'other',
                // VNPay redirect người dùng về BACKEND trước để cập nhật trạng thái,
                // sau đó backend sẽ redirect tiếp sang frontend
                vnp_ReturnUrl: `${process.env.SERVER_URL || 'http://localhost:5000'}/api/payment/vnpay-callback`,
                vnp_Locale: 'vn',
                vnp_CreateDate: toVNDate(now),
                vnp_ExpireDate: toVNDate(tomorrow),
            });

            return new Created({
                message: 'Tạo yêu cầu thanh toán VNPay thành công',
                metadata: {
                    paymentUrl: vnpayResponse,
                    invoiceId: invoice._id,
                },
            }).send(res);
        } catch (error) {
            return next(error);
        }
    }

    /**
     * Callback từ Momo
     */
    async momoCallback(req, res, next) {
        try {
            const { resultCode, orderId, extraData, message, transId, payType } = req.query;

            console.log('Momo Callback:', { resultCode, orderId, extraData, message });

            // extraData = "invoiceId:pendingPaymentId"
            const [invoiceId, pendingPaymentId] = (extraData || '').split(':');

            if (resultCode !== '0') {
                console.warn('Thanh toán Momo thất bại:', resultCode);

                // Cập nhật Payment record → failed
                if (pendingPaymentId) {
                    await paymentModel.findByIdAndUpdate(pendingPaymentId, {
                        status:          'failed',
                        'momo.resultCode': Number(resultCode),
                        'momo.message':    message,
                        'momo.orderId':    orderId,
                    });
                }

                return res.redirect(
                    `${process.env.CLIENT_URL || 'http://localhost:5173'}/payment/failed?reason=${message}`
                );
            }

            const invoice = await invoiceModel.findById(invoiceId);
            if (!invoice) {
                console.error('Không tìm thấy hóa đơn:', invoiceId);
                return res.redirect(
                    `${process.env.CLIENT_URL || 'http://localhost:5173'}/payment/failed?reason=invoice-not-found`
                );
            }

            // Cập nhật trạng thái hóa đơn → paid
            invoice.status = 'paid';
            invoice.paidAt = new Date();
            invoice.paymentMethod = 'momo';
            await invoice.save();

            // Cập nhật Payment record → success
            if (pendingPaymentId) {
                await paymentModel.findByIdAndUpdate(pendingPaymentId, {
                    status:            'success',
                    paidAt:            new Date(),
                    'momo.orderId':    orderId,
                    'momo.transId':    transId,
                    'momo.resultCode': 0,
                    'momo.message':    message,
                    'momo.payType':    payType,
                });
            } else {
                // fallback: tạo mới nếu không có pendingPaymentId
                await paymentModel.create({
                    invoice:       invoice._id,
                    contract:      invoice.contract,
                    paymentMethod: 'momo',
                    amount:        invoice.totalAmount,
                    status:        'success',
                    paidAt:        new Date(),
                    momo: { orderId, transId, resultCode: 0, message, payType },
                });
            }

            console.log('Thanh toán Momo thành công:', invoice._id);

            return res.redirect(
                `${process.env.CLIENT_URL || 'http://localhost:5173'}/payment/success/${invoice._id}`
            );
        } catch (error) {
            console.error('Lỗi Momo callback:', error);
            return next(error);
        }
    }

    /**
     * Callback từ VNPay
     */
    async vnpayCallback(req, res, next) {
        try {
            const {
                vnp_ResponseCode,
                vnp_TxnRef,
                vnp_OrderInfo,
                vnp_TransactionNo,
                vnp_BankCode,
                vnp_BankTranNo,
            } = req.query;

            console.log('VNPay Callback:', { vnp_ResponseCode, vnp_TxnRef, vnp_OrderInfo });

            // Tìm Payment record qua txnRef
            const paymentRecord = await paymentModel.findOne({ 'vnpay.txnRef': vnp_TxnRef });

            if (vnp_ResponseCode !== '00') {
                console.warn('Thanh toán VNPay thất bại:', vnp_ResponseCode);

                // Cập nhật Payment record → failed
                if (paymentRecord) {
                    await paymentModel.findByIdAndUpdate(paymentRecord._id, {
                        status:                'failed',
                        'vnpay.responseCode':  vnp_ResponseCode,
                        'vnpay.transactionNo': vnp_TransactionNo,
                        'vnpay.bankCode':      vnp_BankCode,
                    });
                }

                return res.redirect(
                    `${process.env.CLIENT_URL || 'http://localhost:5173'}/payment/failed?reason=vnpay-error`
                );
            }

            // Lấy invoiceId từ OrderInfo: "Thanh toan hoa don: {invoiceId}"
            const invoiceId = vnp_OrderInfo?.split(': ')[1] || (paymentRecord?.invoice?.toString());

            const invoice = await invoiceModel.findById(invoiceId);
            if (!invoice) {
                console.error('Không tìm thấy hóa đơn:', invoiceId);
                return res.redirect(
                    `${process.env.CLIENT_URL || 'http://localhost:5173'}/payment/failed?reason=invoice-not-found`
                );
            }

            // Cập nhật trạng thái hóa đơn → paid
            invoice.status = 'paid';
            invoice.paidAt = new Date();
            invoice.paymentMethod = 'vnpay';
            await invoice.save();

            // Cập nhật Payment record → success
            if (paymentRecord) {
                await paymentModel.findByIdAndUpdate(paymentRecord._id, {
                    status:                'success',
                    paidAt:                new Date(),
                    'vnpay.responseCode':  '00',
                    'vnpay.transactionNo': vnp_TransactionNo,
                    'vnpay.bankCode':      vnp_BankCode,
                    'vnpay.bankTranNo':    vnp_BankTranNo,
                    'vnpay.orderInfo':     vnp_OrderInfo,
                });
            } else {
                // fallback: tạo mới nếu không tìm thấy qua txnRef
                await paymentModel.create({
                    invoice:       invoice._id,
                    contract:      invoice.contract,
                    paymentMethod: 'vnpay',
                    amount:        invoice.totalAmount,
                    status:        'success',
                    paidAt:        new Date(),
                    vnpay: {
                        txnRef:        vnp_TxnRef,
                        transactionNo: vnp_TransactionNo,
                        bankCode:      vnp_BankCode,
                        responseCode:  '00',
                        orderInfo:     vnp_OrderInfo,
                        bankTranNo:    vnp_BankTranNo,
                    },
                });
            }

            console.log('Thanh toán VNPay thành công:', invoice._id);

            return res.redirect(
                `${process.env.CLIENT_URL || 'http://localhost:5173'}/payment/success/${invoice._id}`
            );
        } catch (error) {
            console.error('Lỗi VNPay callback:', error);
            return next(error);
        }
    }

    /**
     * Lấy danh sách hóa đơn đã thanh toán (Admin/Staff)
     */
    async getPayments(req, res, next) {
        try {
            const { status, paymentMethod } = req.query;
            const filter = {};

            if (status) filter.status = status;
            if (paymentMethod) filter.paymentMethod = paymentMethod;

            const payments = await invoiceModel
                .find(filter)
                .populate('contract')
                .populate('tenantId', 'name email phone')
                .populate('createdBy', 'name email')
                .sort({ createdAt: -1 });

            return new OK({
                message: 'Lấy danh sách thanh toán thành công',
                metadata: payments,
            }).send(res);
        } catch (error) {
            return next(error);
        }
    }

    /**
     * Lấy chi tiết hóa đơn
     */
    async getPaymentById(req, res, next) {
        try {
            const { invoiceId } = req.params;

            const invoice = await invoiceModel
                .findById(invoiceId)
                .populate('contract')
                .populate('tenantId', 'name email phone')
                .populate('createdBy', 'name email');

            if (!invoice) {
                return next(new NotFoundError('Hóa đơn không tồn tại'));
            }

            return new OK({
                message: 'Lấy hóa đơn thành công',
                metadata: invoice,
            }).send(res);
        } catch (error) {
            return next(error);
        }
    }

    /**
     * Cập nhật trạng thái thanh toán hóa đơn
     */
    async updatePaymentStatus(req, res, next) {
        try {
            const { invoiceId } = req.params;
            const { status } = req.body;

            if (!['unpaid', 'paid', 'overdue'].includes(status)) {
                return next(new BadRequestError('Trạng thái không hợp lệ'));
            }

            const invoice = await invoiceModel.findById(invoiceId);
            if (!invoice) {
                return next(new NotFoundError('Hóa đơn không tồn tại'));
            }

            invoice.status = status;
            if (status === 'paid' && !invoice.paidAt) {
                invoice.paidAt = new Date();
            }
            await invoice.save();

            return new OK({
                message: 'Cập nhật trạng thái thanh toán thành công',
                metadata: invoice,
            }).send(res);
        } catch (error) {
            return next(error);
        }
    }

    /**
     * Lấy thống kê thanh toán
     */
    async getPaymentStats(req, res, next) {
        try {
            const stats = await invoiceModel.aggregate([
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                        totalAmount: { $sum: '$totalAmount' },
                    },
                },
            ]);

            const paymentMethodStats = await invoiceModel.aggregate([
                {
                    $group: {
                        _id: '$paymentMethod',
                        count: { $sum: 1 },
                        totalAmount: { $sum: '$totalAmount' },
                    },
                },
            ]);

            return new OK({
                message: 'Lấy thống kê thanh toán thành công',
                metadata: {
                    byStatus: stats,
                    byPaymentMethod: paymentMethodStats,
                },
            }).send(res);
        } catch (error) {
            return next(error);
        }
    }

    /**
     * Xác nhận thanh toán bằng tiền mặt (Staff/Admin)
     */
    async payInvoiceWithCash(req, res, next) {
        try {
            const { invoiceId } = req.params;
            const { note } = req.body;
            const user = req.user; // từ JWT middleware

            // Lấy thông tin hóa đơn cùng với contract và room để kiểm tra district
            const invoice = await invoiceModel.findById(invoiceId).populate({
                path: 'contract',
                populate: {
                    path: 'room',
                    select: 'district'
                }
            });

            if (!invoice) {
                return next(new NotFoundError('Hóa đơn không tồn tại'));
            }

            if (invoice.status === 'paid') {
                return next(new BadRequestError('Hóa đơn này đã được thanh toán'));
            }

            // Lấy district từ room
            const room = invoice.contract?.room;
            const district = room?.district;

            if (!district) {
                return next(new BadRequestError('Không xác định được khu vực của hóa đơn này'));
            }

            // Phân quyền (Row-Level Security)
            if (!checkUserDistrictPermission(user, district)) {
                return res.status(403).json({
                    message: "Khu vực của hóa đơn này không thuộc thẩm quyền quản lý của bạn"
                });
            }

            // 1. Cập nhật hóa đơn
            invoice.status = 'paid';
            invoice.paidAt = new Date();
            invoice.paymentMethod = 'cash'; // Thêm để đồng bộ dù không có sẵn trong schema ban đầu
            await invoice.save();

            // 2. Tạo bản ghi Payment lưu vết
            const newPayment = await paymentModel.create({
                invoice: invoice._id,
                contract: invoice.contract._id,
                tenant: invoice.tenantId,
                paymentMethod: 'cash',
                amount: invoice.totalAmount,
                status: 'success',
                paidAt: new Date(),
                cash: {
                    receivedBy: user._id,
                    note: note || ''
                }
            });

            // 3. Emit Socket.io event cho tenant
            const io = req.app.get('io');
            if (io && invoice.tenantId) {
                io.to(`tenant_${invoice.tenantId.toString()}`).emit('invoice_paid', {
                    invoiceId: invoice._id,
                    status: 'paid',
                    paymentMethod: 'cash',
                    paidAt: invoice.paidAt,
                    message: 'Hóa đơn của bạn đã được xác nhận thanh toán tiền mặt'
                });
            }

            return new OK({
                message: 'Xác nhận thu tiền mặt thành công',
                metadata: {
                    invoice,
                    payment: newPayment
                }
            }).send(res);
        } catch (error) {
            return next(error);
        }
    }
}

module.exports = new PaymentController();
