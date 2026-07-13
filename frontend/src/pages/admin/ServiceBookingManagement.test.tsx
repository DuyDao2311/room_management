import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import ServiceBookingManagement from './ServiceBookingManagement'
import { serviceBookingService } from '../../api/serviceBooking.service'

vi.mock('../../api/serviceBooking.service', async () => {
  const actual = await vi.importActual<typeof import('../../api/serviceBooking.service')>('../../api/serviceBooking.service')
  return {
    ...actual,
    serviceBookingService: {
      getBookings: vi.fn(),
      confirmBooking: vi.fn(),
      completeBooking: vi.fn(),
      cancelBooking: vi.fn(),
      payBooking: vi.fn(),
    },
  }
})

const BOOKING_PENDING = {
  _id: 'b1',
  service: { _id: 's1', name: 'Dọn phòng', category: 'cleaning', unit: 'lần', images: [], price: 100000 },
  tenant: { _id: 't1', name: 'Nguyễn Văn A', email: 'a@test.com' },
  scheduledAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
  quantity: 1, unitPrice: 100000, totalAmount: 100000,
  status: 'pending', paymentStatus: 'unpaid',
  createdAt: '', updatedAt: '',
}

describe('ServiceBookingManagement', () => {
  beforeEach(() => {
    vi.mocked(serviceBookingService.getBookings).mockResolvedValue({ data: [BOOKING_PENDING] } as any)
  })

  test('render booking pending với nút Xác nhận + Hủy', async () => {
    render(<MemoryRouter><ServiceBookingManagement /></MemoryRouter>)
    expect(await screen.findByText('Xác nhận')).toBeInTheDocument()
    expect(screen.getByText('Hủy')).toBeInTheDocument()
  })

  test('bấm Xác nhận gọi confirmBooking rồi tải lại danh sách', async () => {
    vi.mocked(serviceBookingService.confirmBooking).mockResolvedValue({ data: { ...BOOKING_PENDING, status: 'confirmed' } } as any)
    render(<MemoryRouter><ServiceBookingManagement /></MemoryRouter>)
    await userEvent.click(await screen.findByText('Xác nhận'))
    await waitFor(() => expect(serviceBookingService.confirmBooking).toHaveBeenCalledWith('b1'))
  })

  test('booking completed không còn nút hành động trạng thái', async () => {
    vi.mocked(serviceBookingService.getBookings).mockResolvedValue({
      data: [{ ...BOOKING_PENDING, status: 'completed' }],
    } as any)
    render(<MemoryRouter><ServiceBookingManagement /></MemoryRouter>)
    await screen.findByText('Dọn phòng')
    expect(screen.queryByText('Xác nhận')).not.toBeInTheDocument()
    expect(screen.queryByText('Hoàn thành')).not.toBeInTheDocument()
  })

  test('bấm Đánh dấu đã trả gọi payBooking', async () => {
    vi.mocked(serviceBookingService.payBooking).mockResolvedValue({ data: { ...BOOKING_PENDING, paymentStatus: 'paid' } } as any)
    render(<MemoryRouter><ServiceBookingManagement /></MemoryRouter>)
    await userEvent.click(await screen.findByText('Đánh dấu đã trả'))
    await waitFor(() => expect(serviceBookingService.payBooking).toHaveBeenCalledWith('b1'))
  })

  test('booking confirmed hiện nút Hoàn thành + Hủy, không hiện Xác nhận', async () => {
    vi.mocked(serviceBookingService.getBookings).mockResolvedValue({
      data: [{ ...BOOKING_PENDING, status: 'confirmed' }],
    } as any)
    render(<MemoryRouter><ServiceBookingManagement /></MemoryRouter>)
    expect(await screen.findByText('Hoàn thành')).toBeInTheDocument()
    expect(screen.getByText('Hủy')).toBeInTheDocument()
    expect(screen.queryByText('Xác nhận')).not.toBeInTheDocument()
  })

  test('booking cancelled (đã thanh toán trạng thái unpaid) không còn nút hành động nào', async () => {
    vi.mocked(serviceBookingService.getBookings).mockResolvedValue({
      data: [{ ...BOOKING_PENDING, status: 'cancelled', paymentStatus: 'unpaid' }],
    } as any)
    render(<MemoryRouter><ServiceBookingManagement /></MemoryRouter>)
    await screen.findByText('Dọn phòng')
    expect(screen.queryByText('Xác nhận')).not.toBeInTheDocument()
    expect(screen.queryByText('Hoàn thành')).not.toBeInTheDocument()
    expect(screen.queryByText('Hủy')).not.toBeInTheDocument()
    expect(screen.queryByText('Đánh dấu đã trả')).not.toBeInTheDocument()
  })
})
