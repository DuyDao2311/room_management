import api from './axios'

export interface Booking {
  _id: string
  room: any
  tenant: any
  bookingType: 'hour' | 'day' | 'week' | 'month'
  checkInDateTime: string
  checkOutDateTime: string
  totalHours: number
  totalDays: number
  totalWeeks: number
  totalMonths: number
  unitPrice: number
  roomTotal: number
  serviceTotal: number
  totalAmount: number
  serviceBookings?: any[]
  paymentStatus: 'pending' | 'paid' | 'refunded'
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled'
  note?: string
  createdAt: string
  updatedAt: string
}

export const bookingService = {
  // Tenant creates a booking
  createBooking: (data: {
    roomId: string
    bookingType?: string
    checkInDateTime: string
    checkOutDateTime: string
    note?: string
    guests?: number
    services?: { serviceId: string; quantity: number; scheduledAt?: string; note?: string }[]
  }) => api.post<Booking>('/bookings', data),

  // Get bookings (Admin/Staff sees all/district, Tenant sees their own)
  getBookings: (params?: { status?: string; paymentStatus?: string }) => 
    api.get<Booking[]>('/bookings', { params }),

  getBookingById: (id: string) => api.get<Booking>(`/bookings/${id}`),

  // Check availability
  checkAvailability: (roomId: string, checkInDateTime: string, checkOutDateTime: string) =>
    api.get<{ available: boolean; message?: string }>(`/rooms/${roomId}/availability`, {
      params: { checkInDateTime, checkOutDateTime }
    }),

  // Get calendar
  getRoomCalendar: (roomId: string, start?: string, end?: string) =>
    api.get<Booking[]>(`/rooms/${roomId}/calendar`, {
      params: { start, end }
    }),

  // Status updates
  confirmBooking: (id: string) => api.put<Booking>(`/bookings/${id}/confirm`),
  checkInBooking: (id: string) => api.put<Booking>(`/bookings/${id}/checkin`),
  checkOutBooking: (id: string) => api.put<Booking>(`/bookings/${id}/checkout`),
  cancelBooking: (id: string) => api.put<Booking>(`/bookings/${id}/cancel`),
  
  // Payment
  payBooking: (id: string) => api.put<Booking>(`/bookings/${id}/pay`),

  // Stats
  getStats: () => api.get('/bookings/stats'),
}
