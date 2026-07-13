/**
 * Promotion API Service — Frontend API calls cho module Promotion
 */
import api from "./axios";

// ── Types ──────────────────────────────────────────────────────────────────
export interface Promotion {
  _id: string;
  name: string;
  description: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  maxDiscount: number | null;
  roomIds: Array<{ _id: string; name: string; price: number }> | string[];
  startDate: string;
  endDate: string;
  status: "upcoming" | "active" | "expired" | "disabled";
  createdBy?: { _id: string; name: string } | string;
  createdAt: string;
  updatedAt: string;
}

export interface PromotionListResponse {
  success: boolean;
  message: string;
  data: Promotion[];
  total: number;
  page: number;
  totalPages: number;
}

export interface PromotionPayload {
  name: string;
  description?: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  maxDiscount?: number | null;
  roomIds: string[];
  startDate: string;
  endDate: string;
}

// ── API calls ──────────────────────────────────────────────────────────────

/** Lấy danh sách promotion (có pagination, search, filter) */
export async function getPromotions(params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sort?: string;
}): Promise<PromotionListResponse> {
  const res = await api.get("/promotions", { params });
  return res.data;
}

/** Lấy chi tiết promotion */
export async function getPromotionById(id: string): Promise<Promotion> {
  const res = await api.get(`/promotions/${id}`);
  return res.data.data;
}

/** Tạo promotion mới */
export async function createPromotion(data: PromotionPayload): Promise<Promotion> {
  const res = await api.post("/promotions", data);
  return res.data.data;
}

/** Cập nhật promotion */
export async function updatePromotion(
  id: string,
  data: Partial<PromotionPayload>
): Promise<Promotion> {
  const res = await api.put(`/promotions/${id}`, data);
  return res.data.data;
}

/** Đổi trạng thái promotion */
export async function changePromotionStatus(
  id: string,
  status: string
): Promise<Promotion> {
  const res = await api.patch(`/promotions/${id}/status`, { status });
  return res.data.data;
}

/** Soft delete promotion */
export async function deletePromotion(id: string): Promise<void> {
  await api.delete(`/promotions/${id}`);
}

/** Lấy danh sách rooms để chọn trong form promotion */
export async function getRoomsForSelect(): Promise<
  Array<{ _id: string; name: string; price: number; address: string; status: string }>
> {
  const res = await api.get("/rooms");
  return res.data;
}
