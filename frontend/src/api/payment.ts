/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Payment API Service - Tích hợp Momo, VNPay & Tiền mặt
 * ═══════════════════════════════════════════════════════════════════════════
 */

import api from './axios';

export interface PaymentResponse {
  message: string;
  metadata: {
    paymentUrl?: string;
    orderId?: string;
    invoiceId: string;
    totalAmount?: number;
    status?: string;
    paymentMethod?: string;
  };
}

/**
 * Tạo yêu cầu thanh toán (Momo hoặc VNPay)
 */
export async function createPayment(
  invoiceId: string,
  paymentMethod: 'momo' | 'vnpay'
): Promise<PaymentResponse> {
  try {
    const response = await api.post('/payment/create', {
      invoiceId,
      typePayment: paymentMethod,
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Lỗi tạo yêu cầu thanh toán');
  }
}

/**
 * Lấy danh sách hóa đơn đã thanh toán
 */
export async function getPayments(filters?: {
  status?: 'paid' | 'unpaid' | 'overdue';
  paymentMethod?: 'momo' | 'vnpay';
}) {
  try {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.paymentMethod) params.append('paymentMethod', filters.paymentMethod);

    const response = await api.get(`/payment?${params.toString()}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Lỗi tải danh sách thanh toán');
  }
}

/**
 * Lấy chi tiết thanh toán hóa đơn
 */
export async function getPaymentDetail(invoiceId: string) {
  try {
    const response = await api.get(`/payment/${invoiceId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Lỗi tải chi tiết thanh toán');
  }
}

/**
 * Redirect sang payment gateway (Momo hoặc VNPay)
 */
export function redirectToPayment(paymentUrl: string) {
  if (paymentUrl) {
    // Chuyển hướng trong cùng một tab để bảo toàn sessionStorage (AuthContext)
    window.location.href = paymentUrl;
  }
}

/**
 * Tenant yêu cầu thanh toán tiền mặt
 */
export async function requestCashPayment(invoiceId: string) {
  try {
    const response = await api.put(`/invoices/${invoiceId}/request-cash-payment`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Lỗi yêu cầu thanh toán tiền mặt');
  }
}

/**
 * Staff/Admin xác nhận thu tiền mặt
 */
export async function collectCashPayment(invoiceId: string, note?: string) {
  try {
    const response = await api.put(`/invoices/${invoiceId}/collect-cash`, { note });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Lỗi xác nhận thanh toán tiền mặt');
  }
}
