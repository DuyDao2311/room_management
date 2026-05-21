import api from './axios';

export interface FeedbackReply {
  text: string;
  repliedAt: string;
  repliedByName: string;
}

export interface Feedback {
  _id: string;
  room: { _id: string; name: string; address: string } | string;
  tenant: { _id: string; name: string; email: string } | string;
  rating: number;
  comment: string;
  isAnonymous: boolean;
  tenantName?: string; // chỉ có trong public response
  status: 'visible' | 'hidden';
  createdAt: string;
  updatedAt: string;
  reply?: FeedbackReply | null;
}

export interface FeedbackDistribution {
  1: number; 2: number; 3: number; 4: number; 5: number;
}

export interface PublicFeedbackResponse {
  feedbacks: Feedback[];
  distribution: FeedbackDistribution;
}

export interface AllFeedbacksResponse {
  feedbacks: Feedback[];
  total: number;
  page: number;
  totalPages: number;
}

// ── Public ─────────────────────────────────────────────────────────────────
export const getFeedbacksByRoom = (roomId: string): Promise<PublicFeedbackResponse> =>
  api.get(`/feedback/room/${roomId}`).then((r) => r.data);

// ── Tenant ─────────────────────────────────────────────────────────────────
export const getMyFeedback = (roomId: string): Promise<Feedback | null> =>
  api.get(`/feedback/my/${roomId}`).then((r) => r.data);

export const checkEligibility = (roomId: string): Promise<{ eligible: boolean }> =>
  api.get(`/feedback/eligible/${roomId}`).then((r) => r.data);

export const createFeedback = (data: {
  roomId: string;
  rating: number;
  comment?: string;
  isAnonymous?: boolean;
}): Promise<Feedback> => api.post('/feedback', data).then((r) => r.data);

export const updateFeedback = (
  id: string,
  data: { rating?: number; comment?: string; isAnonymous?: boolean }
): Promise<Feedback> => api.put(`/feedback/${id}`, data).then((r) => r.data);

export const deleteFeedback = (id: string): Promise<{ message: string }> =>
  api.delete(`/feedback/${id}`).then((r) => r.data);

// ── Admin / Staff ───────────────────────────────────────────────────────────
export const getAllFeedbacks = (params?: {
  status?: 'visible' | 'hidden';
  roomId?: string;
  rating?: number;
  page?: number;
  limit?: number;
}): Promise<AllFeedbacksResponse> =>
  api.get('/feedback', { params }).then((r) => r.data);

export const toggleFeedbackStatus = (
  id: string,
  status: 'visible' | 'hidden'
): Promise<{ message: string; feedback: Feedback }> =>
  api.patch(`/feedback/${id}/status`, { status }).then((r) => r.data);

export const replyToFeedback = (
  id: string,
  text: string
): Promise<{ message: string; feedback: Feedback }> =>
  api.put(`/feedback/${id}/reply`, { text }).then((r) => r.data);
