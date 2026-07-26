import type { ReactNode } from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import { useServiceDetail } from './useServiceDetail'
import { useAuth } from '../contexts/AuthContext.tsx'
import { serviceBookingService } from '../api/serviceBooking.service'
import { serviceService } from '../api/service.service'

vi.mock('../api/serviceBooking.service', async () => {
  const actual = await vi.importActual<typeof import('../api/serviceBooking.service')>('../api/serviceBooking.service')
  return { ...actual, serviceBookingService: { createBooking: vi.fn() } }
})

vi.mock('../api/service.service', async () => {
  const actual = await vi.importActual<typeof import('../api/service.service')>('../api/service.service')
  return {
    ...actual,
    serviceService: {
      getServiceById: vi.fn(),
      getReviews: vi.fn().mockResolvedValue({ data: [] }),
    },
  }
})

vi.mock('../contexts/AuthContext.tsx', () => ({
  useAuth: vi.fn(),
}))

const SERVICE_A = {
  _id: '1', name: 'Dọn phòng', category: 'cleaning', description: 'Mô tả', price: 100000,
  unit: 'lần', images: [], avgRating: 4.5, ratingCount: 2, isActive: true,
  createdAt: '', updatedAt: '',
}

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>
}

describe('useServiceDetail', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ user: { _id: 'u1', role: 'tenant' } } as any)
  })

  test('filterBookingTime chặn giờ cách hiện tại dưới 1 tiếng, cho phép từ 1 tiếng trở lên', async () => {
    vi.setSystemTime(new Date('2026-07-09T10:38:00'))
    vi.mocked(serviceService.getServiceById).mockResolvedValue({ data: SERVICE_A } as any)

    const { result } = renderHook(() => useServiceDetail('1'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.filterBookingTime(new Date('2026-07-09T10:00:00'))).toBe(false) // đã qua
    expect(result.current.filterBookingTime(new Date('2026-07-09T11:37:00'))).toBe(false) // còn 59 phút
    expect(result.current.filterBookingTime(new Date('2026-07-09T11:38:00'))).toBe(true)  // đúng 1 tiếng
    expect(result.current.filterBookingTime(new Date('2026-07-10T08:00:00'))).toBe(true)  // ngày khác, đủ xa

    vi.useRealTimers()
  })

  test('handleBook: lỗi 403 "chưa có phòng" → bật noRoomModal, không set bookError', async () => {
    vi.mocked(serviceService.getServiceById).mockResolvedValue({ data: SERVICE_A } as any)
    vi.mocked(serviceBookingService.createBooking).mockRejectedValue({
      response: { status: 403, data: { message: 'Bạn cần đang thuê phòng để đặt dịch vụ này.' } },
    })

    const { result } = renderHook(() => useServiceDetail('1'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.setScheduledAt(new Date(Date.now() + 3600_000).toISOString()) })
    await act(async () => { await result.current.handleBook({ preventDefault: () => {} } as any) })

    expect(result.current.noRoomModal).toBe(true)
    expect(result.current.bookError).toBe('')
  })

  test('handleBook: lỗi khác (500) → set bookError, không bật noRoomModal', async () => {
    vi.mocked(serviceService.getServiceById).mockResolvedValue({ data: SERVICE_A } as any)
    vi.mocked(serviceBookingService.createBooking).mockRejectedValue({
      response: { status: 500, data: { message: 'Lỗi server.' } },
    })

    const { result } = renderHook(() => useServiceDetail('1'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.setScheduledAt(new Date(Date.now() + 3600_000).toISOString()) })
    await act(async () => { await result.current.handleBook({ preventDefault: () => {} } as any) })

    expect(result.current.bookError).toBe('Lỗi server.')
    expect(result.current.noRoomModal).toBe(false)
  })

  test('fetch reviews của service, trả về reviews sau khi load xong', async () => {
    vi.mocked(serviceService.getServiceById).mockResolvedValue({ data: SERVICE_A } as any)
    vi.mocked(serviceService.getReviews).mockResolvedValue({
      data: [{ _id: 'r1', rating: 5, review: 'Tốt', tags: ['Sạch sẽ'], createdAt: '', tenant: { name: 'Khách A' } }],
    } as any)

    const { result } = renderHook(() => useServiceDetail('1'), { wrapper })
    await waitFor(() => expect(result.current.reviewsLoading).toBe(false))

    expect(result.current.reviews).toHaveLength(1)
    expect(result.current.reviews[0].tenant.name).toBe('Khách A')
  })

  test('filterBookingTime chặn giờ ngoài khung giờ nhận đặt khi dịch vụ có set khung giờ', async () => {
    vi.setSystemTime(new Date('2026-07-09T06:00:00'))
    const SERVICE_WITH_WINDOW = { ...SERVICE_A, bookingWindowStart: '08:00', bookingWindowEnd: '22:00' }
    vi.mocked(serviceService.getServiceById).mockResolvedValue({ data: SERVICE_WITH_WINDOW } as any)

    const { result } = renderHook(() => useServiceDetail('1'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.filterBookingTime(new Date('2026-07-09T10:00:00'))).toBe(true)  // trong khung
    expect(result.current.filterBookingTime(new Date('2026-07-09T23:00:00'))).toBe(false) // sau giờ đóng
    expect(result.current.filterBookingTime(new Date('2026-07-10T07:00:00'))).toBe(false) // trước giờ mở

    vi.useRealTimers()
  })

  test('filterBookingTime không giới hạn gì khi dịch vụ không set khung giờ', async () => {
    vi.setSystemTime(new Date('2026-07-09T06:00:00'))
    vi.mocked(serviceService.getServiceById).mockResolvedValue({ data: SERVICE_A } as any)

    const { result } = renderHook(() => useServiceDetail('1'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.filterBookingTime(new Date('2026-07-09T23:00:00'))).toBe(true)
    expect(result.current.filterBookingTime(new Date('2026-07-10T02:00:00'))).toBe(true)

    vi.useRealTimers()
  })
})

const CAPACITY_MATCH_SERVICE = {
  _id: '2', name: 'Đưa đón sân bay', category: 'transport', description: '',
  images: [], avgRating: 0, ratingCount: 0, isActive: true,
  usesVariants: true, requiresCapacityMatch: true, capacityFieldLabel: 'Số hành khách',
  variants: [
    { label: '4 chỗ', capacity: 4, price: 200000 },
    { label: '7 chỗ', capacity: 7, price: 300000 },
  ],
  createdAt: '', updatedAt: '',
}

const FREE_CHOICE_VARIANT_SERVICE = {
  _id: '3', name: 'Gói spa', category: 'spa', description: '',
  images: [], avgRating: 0, ratingCount: 0, isActive: true,
  usesVariants: true, requiresCapacityMatch: false, capacityFieldLabel: '',
  variants: [
    { label: '60 phút', price: 300000 },
    { label: '90 phút', price: 450000 },
  ],
  createdAt: '', updatedAt: '',
}

describe('useServiceDetail — usesVariants + requiresCapacityMatch=true (vd xe)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAuth).mockReturnValue({ user: { _id: 'u1', role: 'tenant' } } as any)
  })

  test('mở modal đặt dịch vụ → tự chọn variant nhỏ nhất (mặc định 1)', async () => {
    vi.mocked(serviceService.getServiceById).mockResolvedValue({ data: CAPACITY_MATCH_SERVICE } as any)
    const { result } = renderHook(() => useServiceDetail('2'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.openBookModal() })

    expect(result.current.selectedVariant).toBe('4 chỗ')
    expect(result.current.totalPreview).toBe(200000)
  })

  test('tăng matchQuantity vượt sức chứa variant nhỏ → tự chuyển sang variant lớn hơn', async () => {
    vi.mocked(serviceService.getServiceById).mockResolvedValue({ data: CAPACITY_MATCH_SERVICE } as any)
    const { result } = renderHook(() => useServiceDetail('2'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.openBookModal() })
    act(() => { result.current.setMatchQuantity(5) })

    expect(result.current.selectedVariant).toBe('7 chỗ')
    expect(result.current.totalPreview).toBe(300000)
  })

  test('matchQuantity vượt sức chứa tối đa toàn bộ variants → selectedVariant rỗng, totalPreview = 0', async () => {
    vi.mocked(serviceService.getServiceById).mockResolvedValue({ data: CAPACITY_MATCH_SERVICE } as any)
    const { result } = renderHook(() => useServiceDetail('2'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.openBookModal() })
    act(() => { result.current.setMatchQuantity(10) })

    expect(result.current.selectedVariant).toBe('')
    expect(result.current.totalPreview).toBe(0)
  })

  test('handleBook gửi selectedVariant/matchQuantity, không gửi quantity', async () => {
    vi.mocked(serviceService.getServiceById).mockResolvedValue({ data: CAPACITY_MATCH_SERVICE } as any)
    vi.mocked(serviceBookingService.createBooking).mockResolvedValue({ data: {} } as any)
    const { result } = renderHook(() => useServiceDetail('2'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.openBookModal() })
    act(() => { result.current.setScheduledAt(new Date(Date.now() + 3600_000).toISOString()) })
    act(() => { result.current.setMatchQuantity(3) })
    await act(async () => { await result.current.handleBook({ preventDefault: () => {} } as any) })

    expect(serviceBookingService.createBooking).toHaveBeenCalledWith(expect.objectContaining({
      serviceId: '2', selectedVariant: '4 chỗ', matchQuantity: 3,
    }))
    const callArg = vi.mocked(serviceBookingService.createBooking).mock.calls[0][0] as any
    expect(callArg.quantity).toBeUndefined()
  })
})

describe('useServiceDetail — usesVariants + requiresCapacityMatch=false (vd spa gói giờ)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAuth).mockReturnValue({ user: { _id: 'u1', role: 'tenant' } } as any)
  })

  test('mở modal → tự chọn variant đầu tiên, khách chọn tự do được (không khóa)', async () => {
    vi.mocked(serviceService.getServiceById).mockResolvedValue({ data: FREE_CHOICE_VARIANT_SERVICE } as any)
    const { result } = renderHook(() => useServiceDetail('3'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.openBookModal() })
    expect(result.current.selectedVariant).toBe('60 phút')

    act(() => { result.current.setSelectedVariant('90 phút') })
    expect(result.current.selectedVariant).toBe('90 phút')
    expect(result.current.totalPreview).toBe(450000)
  })

  test('quantity=2 nhân đôi totalPreview', async () => {
    vi.mocked(serviceService.getServiceById).mockResolvedValue({ data: FREE_CHOICE_VARIANT_SERVICE } as any)
    const { result } = renderHook(() => useServiceDetail('3'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.openBookModal() })
    act(() => { result.current.setQuantity(2) })
    expect(result.current.totalPreview).toBe(600000)
  })

  test('handleBook gửi selectedVariant + quantity', async () => {
    vi.mocked(serviceService.getServiceById).mockResolvedValue({ data: FREE_CHOICE_VARIANT_SERVICE } as any)
    vi.mocked(serviceBookingService.createBooking).mockResolvedValue({ data: {} } as any)
    const { result } = renderHook(() => useServiceDetail('3'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.openBookModal() })
    act(() => { result.current.setScheduledAt(new Date(Date.now() + 3600_000).toISOString()) })
    act(() => { result.current.setQuantity(2) })
    await act(async () => { await result.current.handleBook({ preventDefault: () => {} } as any) })

    expect(serviceBookingService.createBooking).toHaveBeenCalledWith(expect.objectContaining({
      serviceId: '3', selectedVariant: '60 phút', quantity: 2,
    }))
  })
})
