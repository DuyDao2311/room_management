// frontend/src/pages/public/Service.test.tsx
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { vi, describe, test, expect, beforeEach, beforeAll } from 'vitest'
import ServiceList from './ServiceList'
import ServiceDetail from './ServiceDetail'
import { useAuth } from '../../contexts/AuthContext.tsx'
import { serviceBookingService } from '../../api/serviceBooking.service'
import { serviceService } from '../../api/service.service'

vi.mock('../../api/serviceBooking.service', async () => {
  const actual = await vi.importActual<typeof import('../../api/serviceBooking.service')>('../../api/serviceBooking.service')
  return { ...actual, serviceBookingService: { createBooking: vi.fn() } }
})

vi.mock('../../api/service.service', async () => {
  const actual = await vi.importActual<typeof import('../../api/service.service')>('../../api/service.service')
  return {
    ...actual,
    serviceService: {
      getServices: vi.fn(),
      getServiceById: vi.fn(),
      getReviews: vi.fn().mockResolvedValue({ data: [] }),
    },
  }
})

vi.mock('../../contexts/AuthContext.tsx', () => ({
  useAuth: vi.fn(),
}))

beforeAll(() => {
  // jsdom không implement ResizeObserver — react-datepicker's Time component (showTimeSelect) cần nó.
  ;(globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

const SERVICE_A = {
  _id: '1', name: 'Dọn phòng', category: 'cleaning', description: 'Mô tả', price: 100000,
  unit: 'lần', images: [], avgRating: 4.5, ratingCount: 2, isActive: true,
  createdAt: '', updatedAt: '',
}

describe('ServiceList', () => {
  test('render danh sách dịch vụ và lọc theo tab', async () => {
    vi.mocked(serviceService.getServices).mockResolvedValue({ data: [SERVICE_A] } as any)
    render(<MemoryRouter><ServiceList /></MemoryRouter>)
    expect(await screen.findByText('Dọn phòng')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Đưa đón'))
    await waitFor(() => expect(serviceService.getServices).toHaveBeenLastCalledWith({ category: 'transport' }))
  })
})

describe('ServiceDetail', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ user: { _id: 'u1', role: 'tenant' } } as any)
  })

  test('dịch vụ isActive:false hiện message tạm ngừng kinh doanh', async () => {
    vi.mocked(serviceService.getServiceById).mockRejectedValue({ response: { data: { message: 'Dịch vụ này hiện đã tạm ngừng kinh doanh.' } } })
    render(
      <MemoryRouter initialEntries={['/services/1']}>
        <Routes><Route path="/services/:id" element={<ServiceDetail />} /></Routes>
      </MemoryRouter>
    )
    expect(await screen.findByText('Dịch vụ này hiện đã tạm ngừng kinh doanh.')).toBeInTheDocument()
  })

  test('tăng số lượng cập nhật đúng Tạm tính = giá × số lượng', async () => {
    vi.mocked(serviceService.getServiceById).mockResolvedValue({ data: SERVICE_A } as any)
    render(
      <MemoryRouter initialEntries={['/services/1']}>
        <Routes><Route path="/services/:id" element={<ServiceDetail />} /></Routes>
      </MemoryRouter>
    )
    await userEvent.click(await screen.findByText('Đặt dịch vụ'))
    const quantityInput = screen.getByLabelText(/Số lượng/)
    // Dùng fireEvent.change thay vì userEvent.clear + type: input này là controlled
    // component với logic clamp Math.max(1, ...) trên mỗi keystroke, nên clear()
    // (bắn change với giá trị rỗng) bị snap ngay về "1" trước khi kịp gõ ký tự tiếp theo,
    // khiến '3' bị nối vào thành "13" thay vì thay thế. fireEvent.change set giá trị
    // một lần duy nhất nên tránh được vấn đề này.
    fireEvent.change(quantityInput, { target: { value: '3' } })
    expect(screen.getByText('300.000 đ')).toBeInTheDocument()
  })

  test('điền form và xác nhận đặt → gọi createBooking đúng tham số, hiện thông báo thành công', async () => {
    vi.mocked(serviceService.getServiceById).mockResolvedValue({ data: SERVICE_A } as any)
    vi.mocked(serviceBookingService.createBooking).mockResolvedValue({ data: {} } as any)
    render(
      <MemoryRouter initialEntries={['/services/1']}>
        <Routes><Route path="/services/:id" element={<ServiceDetail />} /></Routes>
      </MemoryRouter>
    )
    await userEvent.click(await screen.findByText('Đặt dịch vụ'))

    const quantityInput = screen.getByLabelText(/Số lượng/)
    fireEvent.change(quantityInput, { target: { value: '3' } })

    // DatePicker (react-datepicker) không có label liên kết qua htmlFor, nên lấy input
    // qua placeholder. Gõ trực tiếp chuỗi theo đúng dateFormat="dd/MM/yyyy HH:mm" rồi
    // nhấn Enter để commit giá trị đã gõ (giống thao tác thật của user), thay vì click
    // qua lịch popup — cách này ổn định hơn nhiều trong jsdom.
    const dateInput = screen.getByPlaceholderText('Chọn ngày và giờ')
    const future = new Date(Date.now() + 24 * 3600 * 1000)
    const dd = String(future.getDate()).padStart(2, '0')
    const mm = String(future.getMonth() + 1).padStart(2, '0')
    const yyyy = future.getFullYear()
    await userEvent.type(dateInput, `${dd}/${mm}/${yyyy} 10:00`)
    fireEvent.keyDown(dateInput, { key: 'Enter', code: 'Enter' })

    await userEvent.click(screen.getByText('Xác nhận đặt'))

    await waitFor(() => expect(serviceBookingService.createBooking).toHaveBeenCalledWith(
      expect.objectContaining({ serviceId: '1', quantity: 3 })
    ))
    expect(await screen.findByText('Đặt dịch vụ thành công!')).toBeInTheDocument()
  })

  test('đặt dịch vụ khi chưa có phòng (403) → hiện modal "Chưa thể đặt dịch vụ"', async () => {
    vi.mocked(serviceService.getServiceById).mockResolvedValue({ data: SERVICE_A } as any)
    vi.mocked(serviceBookingService.createBooking).mockRejectedValue({
      response: { status: 403, data: { message: 'Bạn cần đang thuê phòng để đặt dịch vụ này.' } },
    })
    render(
      <MemoryRouter initialEntries={['/services/1']}>
        <Routes><Route path="/services/:id" element={<ServiceDetail />} /></Routes>
      </MemoryRouter>
    )
    await userEvent.click(await screen.findByText('Đặt dịch vụ'))

    const dateInput = screen.getByPlaceholderText('Chọn ngày và giờ')
    const future = new Date(Date.now() + 24 * 3600 * 1000)
    const dd = String(future.getDate()).padStart(2, '0')
    const mm = String(future.getMonth() + 1).padStart(2, '0')
    const yyyy = future.getFullYear()
    await userEvent.type(dateInput, `${dd}/${mm}/${yyyy} 10:00`)
    fireEvent.keyDown(dateInput, { key: 'Enter', code: 'Enter' })

    await userEvent.click(screen.getByText('Xác nhận đặt'))

    expect(await screen.findByText('Chưa thể đặt dịch vụ')).toBeInTheDocument()
    expect(screen.getByText('Bạn cần đang thuê phòng để đặt dịch vụ này.')).toBeInTheDocument()
  })

  test('hiện review công khai của dịch vụ', async () => {
    vi.mocked(serviceService.getServiceById).mockResolvedValue({ data: SERVICE_A } as any)
    vi.mocked(serviceService.getReviews).mockResolvedValue({
      data: [{ _id: 'r1', rating: 5, review: 'Rất hài lòng', tags: ['Sạch sẽ'], createdAt: '', tenant: { name: 'Khách A' } }],
    } as any)
    render(
      <MemoryRouter initialEntries={['/services/1']}>
        <Routes><Route path="/services/:id" element={<ServiceDetail />} /></Routes>
      </MemoryRouter>
    )
    expect(await screen.findByText('Khách A')).toBeInTheDocument()
    expect(screen.getByText('Rất hài lòng')).toBeInTheDocument()
    expect(screen.getByText('Sạch sẽ')).toBeInTheDocument()
  })
})
