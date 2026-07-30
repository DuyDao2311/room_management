import api from './axios'
import type { Service } from './service.service'

export type ServiceBookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled'
export type ServiceBookingPaymentStatus = 'unpaid' | 'paid'

export interface ServiceBookingTenant {
  _id: string
  name: string
  email: string
  phone?: string
}

export interface ServiceBooking {
  _id: string
  service: Pick<Service, '_id' | 'name' | 'category' | 'unit' | 'images' | 'price'> | null
  tenant: ServiceBookingTenant
  scheduledAt: string
  quantity: number
  unitPrice: number
  totalAmount: number
  status: ServiceBookingStatus
  paymentStatus: ServiceBookingPaymentStatus
  rating?: number
  review?: string
  note?: string
  selectedVariant?: string
  matchQuantity?: number
  createdAt: string
  updatedAt: string
}

export const serviceBookingService = {
  createBooking: (data: {
    serviceId: string
    scheduledAt: string
    note?: string
    quantity?: number
    selectedVariant?: string
    matchQuantity?: number
  }) => api.post<ServiceBooking>('/service-bookings', data),

  getBookings: (params?: { status?: string; paymentStatus?: string }) =>
    api.get<ServiceBooking[]>('/service-bookings', { params }),

  getBookingById: (id: string) => api.get<ServiceBooking>(`/service-bookings/${id}`),

  confirmBooking: (id: string) => api.put<ServiceBooking>(`/service-bookings/${id}/confirm`),
  completeBooking: (id: string) => api.put<ServiceBooking>(`/service-bookings/${id}/complete`),
  cancelBooking: (id: string) => api.put<ServiceBooking>(`/service-bookings/${id}/cancel`),
  payBooking: (id: string) => api.put<ServiceBooking>(`/service-bookings/${id}/pay`),
  rateBooking: (id: string, data: { rating: number; review?: string; tags?: string[] }) =>
    api.put<ServiceBooking>(`/service-bookings/${id}/rate`, data),
}
