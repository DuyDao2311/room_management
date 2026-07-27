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
  usesVariants: false, variants: [], requiresCapacityMatch: false, capacityFieldLabel: '',
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

  test('dịch vụ usesVariants hiện "Từ X đ" theo giá nhỏ nhất trong variants', async () => {
    const VARIANTS_SERVICE = {
      ...SERVICE_A, _id: '2', name: 'Đưa đón sân bay', category: 'transport',
      usesVariants: true, variants: [
        { label: '4 chỗ', capacity: 4, price: 200000 },
        { label: '7 chỗ', capacity: 7, price: 300000 },
      ],
    }
    vi.mocked(serviceService.getServices).mockResolvedValue({ data: [VARIANTS_SERVICE] } as any)
    render(<MemoryRouter><ServiceList /></MemoryRouter>)
    expect(await screen.findByText('Từ 200.000đ')).toBeInTheDocument()
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

describe('ServiceDetail — dịch vụ usesVariants + requiresCapacityMatch=true (vd xe)', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ user: { _id: 'u1', role: 'tenant' } } as any)
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

  test('hiện giá "Từ X đ" thay vì price/unit', async () => {
    vi.mocked(serviceService.getServiceById).mockResolvedValue({ data: CAPACITY_MATCH_SERVICE } as any)
    render(
      <MemoryRouter initialEntries={['/services/2']}>
        <Routes><Route path="/services/:id" element={<ServiceDetail />} /></Routes>
      </MemoryRouter>
    )
    expect(await screen.findByText(/Từ 200.000 đ/)).toBeInTheDocument()
  })

  test('mở modal hiện ô nhãn động (capacityFieldLabel) + danh sách lựa chọn, khóa lựa chọn to hơn mức cần', async () => {
    vi.mocked(serviceService.getServiceById).mockResolvedValue({ data: CAPACITY_MATCH_SERVICE } as any)
    render(
      <MemoryRouter initialEntries={['/services/2']}>
        <Routes><Route path="/services/:id" element={<ServiceDetail />} /></Routes>
      </MemoryRouter>
    )
    await userEvent.click(await screen.findByText('Đặt dịch vụ'))

    expect(screen.getByLabelText('Số hành khách')).toBeInTheDocument()
    expect(screen.getByLabelText(/4 chỗ/)).toBeChecked()
    expect(screen.getByLabelText(/7 chỗ/)).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Số hành khách'), { target: { value: '5' } })

    expect(screen.getByLabelText(/7 chỗ/)).toBeChecked()
    expect(screen.getByLabelText(/4 chỗ/)).toBeDisabled()
  })

  test('điền form và xác nhận đặt → gọi createBooking với selectedVariant/matchQuantity', async () => {
    vi.mocked(serviceService.getServiceById).mockResolvedValue({ data: CAPACITY_MATCH_SERVICE } as any)
    vi.mocked(serviceBookingService.createBooking).mockResolvedValue({ data: {} } as any)
    render(
      <MemoryRouter initialEntries={['/services/2']}>
        <Routes><Route path="/services/:id" element={<ServiceDetail />} /></Routes>
      </MemoryRouter>
    )
    await userEvent.click(await screen.findByText('Đặt dịch vụ'))

    fireEvent.change(screen.getByLabelText('Số hành khách'), { target: { value: '3' } })

    const dateInput = screen.getByPlaceholderText('Chọn ngày và giờ')
    const future = new Date(Date.now() + 24 * 3600 * 1000)
    const dd = String(future.getDate()).padStart(2, '0')
    const mm = String(future.getMonth() + 1).padStart(2, '0')
    const yyyy = future.getFullYear()
    await userEvent.type(dateInput, `${dd}/${mm}/${yyyy} 10:00`)
    fireEvent.keyDown(dateInput, { key: 'Enter', code: 'Enter' })

    await userEvent.click(screen.getByText('Xác nhận đặt'))

    await waitFor(() => expect(serviceBookingService.createBooking).toHaveBeenCalledWith(
      expect.objectContaining({ serviceId: '2', selectedVariant: '4 chỗ', matchQuantity: 3 })
    ))
    expect(await screen.findByText('Đặt dịch vụ thành công!')).toBeInTheDocument()
  })

  test('hiện description dưới mỗi lựa chọn khi variant có description', async () => {
    const SERVICE_WITH_DESC = {
      ...CAPACITY_MATCH_SERVICE, _id: '5',
      variants: [
        { label: '4 chỗ', capacity: 4, price: 200000, description: 'Xe 4 chỗ, tối đa 4 hành khách' },
        { label: '7 chỗ', capacity: 7, price: 300000, description: 'Xe 7 chỗ, tối đa 7 hành khách' },
      ],
    }
    vi.mocked(serviceService.getServiceById).mockResolvedValue({ data: SERVICE_WITH_DESC } as any)
    render(
      <MemoryRouter initialEntries={['/services/5']}>
        <Routes><Route path="/services/:id" element={<ServiceDetail />} /></Routes>
      </MemoryRouter>
    )
    await userEvent.click(await screen.findByText('Đặt dịch vụ'))

    expect(screen.getByText('Xe 4 chỗ, tối đa 4 hành khách')).toBeInTheDocument()
    expect(screen.getByText('Xe 7 chỗ, tối đa 7 hành khách')).toBeInTheDocument()
  })
})

describe('ServiceDetail — dịch vụ usesVariants + requiresCapacityMatch=false (vd spa gói giờ)', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ user: { _id: 'u1', role: 'tenant' } } as any)
  })

  const FREE_CHOICE_SERVICE = {
    _id: '3', name: 'Gói spa', category: 'spa', description: '',
    images: [], avgRating: 0, ratingCount: 0, isActive: true,
    usesVariants: true, requiresCapacityMatch: false, capacityFieldLabel: '',
    variants: [{ label: '60 phút', price: 300000 }, { label: '90 phút', price: 450000 }],
    createdAt: '', updatedAt: '',
  }

  test('khách chọn tự do lựa chọn, không có ô nhập số lượng để khóa, radio không bị disabled', async () => {
    vi.mocked(serviceService.getServiceById).mockResolvedValue({ data: FREE_CHOICE_SERVICE } as any)
    render(
      <MemoryRouter initialEntries={['/services/3']}>
        <Routes><Route path="/services/:id" element={<ServiceDetail />} /></Routes>
      </MemoryRouter>
    )
    await userEvent.click(await screen.findByText('Đặt dịch vụ'))

    expect(screen.getByLabelText(/60 phút/)).not.toBeDisabled()
    expect(screen.getByLabelText(/90 phút/)).not.toBeDisabled()

    await userEvent.click(screen.getByLabelText(/90 phút/))
    expect(screen.getByLabelText(/90 phút/)).toBeChecked()
  })

  test('hiện description dưới mỗi lựa chọn khi variant có description', async () => {
    const SERVICE_WITH_DESC = {
      ...FREE_CHOICE_SERVICE, _id: '4',
      variants: [
        { label: '60 phút', price: 300000, description: 'Massage thư giãn toàn thân' },
        { label: '90 phút', price: 450000, description: 'Massage + xông hơi' },
      ],
    }
    vi.mocked(serviceService.getServiceById).mockResolvedValue({ data: SERVICE_WITH_DESC } as any)
    render(
      <MemoryRouter initialEntries={['/services/4']}>
        <Routes><Route path="/services/:id" element={<ServiceDetail />} /></Routes>
      </MemoryRouter>
    )
    await userEvent.click(await screen.findByText('Đặt dịch vụ'))

    expect(screen.getByText('Massage thư giãn toàn thân')).toBeInTheDocument()
    expect(screen.getByText('Massage + xông hơi')).toBeInTheDocument()
  })
})
