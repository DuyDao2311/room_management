import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import MyServiceBookings from './MyServiceBookings'
import { serviceBookingService } from '../../api/serviceBooking.service'

vi.mock('../../api/serviceBooking.service', async () => {
  const actual = await vi.importActual<typeof import('../../api/serviceBooking.service')>('../../api/serviceBooking.service')
  return {
    ...actual,
    serviceBookingService: {
      getBookings: vi.fn(),
      cancelBooking: vi.fn(),
      rateBooking: vi.fn(),
    },
  }
})

const baseBooking = (overrides = {}) => ({
  _id: 'b1',
  service: { _id: 's1', name: 'Dọn phòng', category: 'cleaning', unit: 'lần', images: [], price: 100000 },
  quantity: 1, unitPrice: 100000, totalAmount: 100000,
  paymentStatus: 'unpaid',
  createdAt: '', updatedAt: '',
  ...overrides,
})

describe('MyServiceBookings', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  test('booking pending còn xa giờ hẹn → thấy nút Hủy booking', async () => {
    vi.mocked(serviceBookingService.getBookings).mockResolvedValue({
      data: [baseBooking({ status: 'pending', scheduledAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString() })],
    } as any)
    render(<MemoryRouter><MyServiceBookings /></MemoryRouter>)
    expect(await screen.findByText('Hủy booking')).toBeInTheDocument()
  })

  test('booking pending còn dưới 1h → không thấy nút Hủy booking', async () => {
    vi.mocked(serviceBookingService.getBookings).mockResolvedValue({
      data: [baseBooking({ status: 'pending', scheduledAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() })],
    } as any)
    render(<MemoryRouter><MyServiceBookings /></MemoryRouter>)
    await screen.findByText('Dọn phòng')
    expect(screen.queryByText('Hủy booking')).not.toBeInTheDocument()
  })

  test('booking confirmed còn xa giờ hẹn → vẫn không thấy nút Hủy booking (chặn theo status, không chỉ theo giờ)', async () => {
    vi.mocked(serviceBookingService.getBookings).mockResolvedValue({
      data: [baseBooking({ status: 'confirmed', scheduledAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString() })],
    } as any)
    render(<MemoryRouter><MyServiceBookings /></MemoryRouter>)
    await screen.findByText('Dọn phòng')
    expect(screen.queryByText('Hủy booking')).not.toBeInTheDocument()
  })

  test('booking completed chưa rating → chấm sao gọi rateBooking', async () => {
    vi.mocked(serviceBookingService.getBookings).mockResolvedValue({
      data: [baseBooking({ status: 'completed', scheduledAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString() })],
    } as any)
    vi.mocked(serviceBookingService.rateBooking).mockResolvedValue({ data: {} } as any)
    render(<MemoryRouter><MyServiceBookings /></MemoryRouter>)
    await userEvent.click(await screen.findByText('Đánh Giá'))
    const stars = screen.getAllByRole('button', { name: /\d sao/ })
    await userEvent.click(stars[2])
    await userEvent.click(screen.getByText('Gửi đánh giá'))
    await waitFor(() => expect(serviceBookingService.rateBooking).toHaveBeenCalledWith('b1', expect.objectContaining({ rating: 3 })))
  })

  test('booking completed đã có rating → hiện "★ x/5", không có nút chấm sao', async () => {
    vi.mocked(serviceBookingService.getBookings).mockResolvedValue({
      data: [baseBooking({ status: 'completed', rating: 4, scheduledAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString() })],
    } as any)
    render(<MemoryRouter><MyServiceBookings /></MemoryRouter>)
    expect(await screen.findByText(/★ 4\/5/)).toBeInTheDocument()
    expect(screen.queryByText('Đánh Giá')).not.toBeInTheDocument()
  })

  test('chọn tag rồi gửi đánh giá → rateBooking nhận đúng tags', async () => {
    vi.mocked(serviceBookingService.getBookings).mockResolvedValue({
      data: [baseBooking({ status: 'completed', scheduledAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString() })],
    } as any)
    vi.mocked(serviceBookingService.rateBooking).mockResolvedValue({ data: {} } as any)
    render(<MemoryRouter><MyServiceBookings /></MemoryRouter>)
    await userEvent.click(await screen.findByText('Đánh Giá'))

    await userEvent.click(screen.getByText('Sạch sẽ'))
    await userEvent.click(screen.getByText('Đúng giờ'))
    await userEvent.click(screen.getByText('Gửi đánh giá'))

    await waitFor(() => expect(serviceBookingService.rateBooking).toHaveBeenCalledWith(
      'b1', expect.objectContaining({ tags: ['Sạch sẽ', 'Đúng giờ'] })
    ))
  })

  test('booking dùng variant hiện "Lựa chọn" + SL thay vì Số lượng', async () => {
    vi.mocked(serviceBookingService.getBookings).mockResolvedValue({
      data: [baseBooking({
        status: 'pending', scheduledAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
        service: { _id: 's2', name: 'Đưa đón sân bay', category: 'transport', unit: '', images: [], price: 0 },
        selectedVariant: '4 chỗ', matchQuantity: 3,
      })],
    } as any)
    render(<MemoryRouter><MyServiceBookings /></MemoryRouter>)
    expect(await screen.findByText('Lựa chọn')).toBeInTheDocument()
    expect(await screen.findByText('4 chỗ • SL: 3')).toBeInTheDocument()
  })
})
