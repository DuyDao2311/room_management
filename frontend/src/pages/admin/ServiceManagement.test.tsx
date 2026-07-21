import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import ServiceManagement from './ServiceManagement'
import { serviceService } from '../../api/service.service'

vi.mock('../../api/service.service', async () => {
  const actual = await vi.importActual<typeof import('../../api/service.service')>('../../api/service.service')
  return {
    ...actual,
    serviceService: {
      getServices: vi.fn(),
      createService: vi.fn(),
      updateService: vi.fn(),
      deleteService: vi.fn(),
    },
  }
})

const SERVICE_A = {
  _id: '1', name: 'Dọn phòng', category: 'cleaning', description: '', price: 100000,
  unit: 'lần', images: [], avgRating: 4.5, ratingCount: 2, isActive: true,
  usesVariants: false, variants: [], requiresCapacityMatch: false, capacityFieldLabel: '',
  createdAt: '', updatedAt: '',
}

describe('ServiceManagement', () => {
  beforeEach(() => {
    vi.mocked(serviceService.getServices).mockClear().mockResolvedValue({ data: [SERVICE_A] } as any)
    vi.mocked(serviceService.createService).mockClear()
    vi.mocked(serviceService.updateService).mockClear()
    vi.mocked(serviceService.deleteService).mockClear()
  })

  test('render danh sách dịch vụ từ API', async () => {
    render(<ServiceManagement />)
    expect(await screen.findByText('Dọn phòng')).toBeInTheDocument()
  })

  test('bấm THÊM DỊCH VỤ mở modal tạo mới', async () => {
    render(<ServiceManagement />)
    await screen.findByText('Dọn phòng')
    await userEvent.click(screen.getByText(/THÊM DỊCH VỤ/i))
    expect(screen.getByText('Thêm dịch vụ mới')).toBeInTheDocument()
  })

  test('tạo dịch vụ mới gọi createService rồi tải lại danh sách', async () => {
    vi.mocked(serviceService.createService).mockResolvedValue({ data: SERVICE_A } as any)
    render(<ServiceManagement />)
    await screen.findByText('Dọn phòng')
    await userEvent.click(screen.getByText(/THÊM DỊCH VỤ/i))
    await userEvent.type(screen.getByLabelText('Tên dịch vụ'), 'Giặt ủi')
    await userEvent.type(screen.getByLabelText('Giá (VNĐ)'), '50000')
    await userEvent.click(screen.getByText('Thêm dịch vụ'))
    await waitFor(() => expect(serviceService.createService).toHaveBeenCalledWith(expect.objectContaining({ name: 'Giặt ủi', price: 50000, isActive: false })))
  })

  test('lọc theo category chỉ hiện đúng loại', async () => {
    const SERVICE_B = { ...SERVICE_A, _id: '2', name: 'Xe đưa rước sân bay', category: 'transport' }
    vi.mocked(serviceService.getServices).mockResolvedValue({ data: [SERVICE_A, SERVICE_B] } as any)
    render(<ServiceManagement />)
    await screen.findByText('Dọn phòng')
    await userEvent.selectOptions(screen.getByRole('combobox'), 'transport')
    expect(screen.queryByText('Dọn phòng')).not.toBeInTheDocument()
    expect(screen.getByText('Xe đưa rước sân bay')).toBeInTheDocument()
  })

  test('bật checkbox "nhiều lựa chọn giá" hiện editor lựa chọn thay vì ô Giá/Đơn vị tính, KHÔNG cần đổi category', async () => {
    render(<ServiceManagement />)
    await screen.findByText('Dọn phòng')
    await userEvent.click(screen.getByText(/THÊM DỊCH VỤ/i))
    await userEvent.click(screen.getByLabelText('Dịch vụ này có nhiều lựa chọn giá'))

    expect(screen.queryByLabelText('Giá (VNĐ)')).not.toBeInTheDocument()
    expect(screen.getByText('Các lựa chọn')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Tên lựa chọn (VD: 4 chỗ)')).toBeInTheDocument()
    // category vẫn mặc định 'cleaning' — checkbox không phụ thuộc category
    expect(screen.getByLabelText('Loại dịch vụ')).toHaveValue('cleaning')
  })

  test('bật "yêu cầu khớp số lượng" hiện thêm ô nhãn + cột sức chứa', async () => {
    render(<ServiceManagement />)
    await screen.findByText('Dọn phòng')
    await userEvent.click(screen.getByText(/THÊM DỊCH VỤ/i))
    await userEvent.click(screen.getByLabelText('Dịch vụ này có nhiều lựa chọn giá'))

    expect(screen.queryByLabelText('Nhãn số lượng hiển thị cho khách')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Sức chứa')).not.toBeInTheDocument()

    await userEvent.click(screen.getByLabelText('Yêu cầu khớp số lượng (khóa chọn tự động theo sức chứa)'))

    expect(screen.getByLabelText('Nhãn số lượng hiển thị cho khách')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Sức chứa')).toBeInTheDocument()
  })

  test('bấm "+ Thêm lựa chọn" thêm 1 dòng, nút xóa disabled khi chỉ còn 1 dòng', async () => {
    render(<ServiceManagement />)
    await screen.findByText('Dọn phòng')
    await userEvent.click(screen.getByText(/THÊM DỊCH VỤ/i))
    await userEvent.click(screen.getByLabelText('Dịch vụ này có nhiều lựa chọn giá'))

    expect(screen.getAllByPlaceholderText('Tên lựa chọn (VD: 4 chỗ)')).toHaveLength(1)
    expect(screen.getByLabelText('Xóa lựa chọn')).toBeDisabled()

    await userEvent.click(screen.getByText('+ Thêm lựa chọn'))
    expect(screen.getAllByPlaceholderText('Tên lựa chọn (VD: 4 chỗ)')).toHaveLength(2)
    expect(screen.getAllByLabelText('Xóa lựa chọn')[0]).not.toBeDisabled()
  })

  test('tạo dịch vụ usesVariants + requiresCapacityMatch gửi đúng payload, không gửi price/unit', async () => {
    vi.mocked(serviceService.createService).mockResolvedValue({ data: SERVICE_A } as any)
    render(<ServiceManagement />)
    await screen.findByText('Dọn phòng')
    await userEvent.click(screen.getByText(/THÊM DỊCH VỤ/i))
    await userEvent.type(screen.getByLabelText('Tên dịch vụ'), 'Đưa đón sân bay')
    await userEvent.selectOptions(screen.getByLabelText('Loại dịch vụ'), 'transport')
    await userEvent.click(screen.getByLabelText('Dịch vụ này có nhiều lựa chọn giá'))
    await userEvent.click(screen.getByLabelText('Yêu cầu khớp số lượng (khóa chọn tự động theo sức chứa)'))
    await userEvent.type(screen.getByLabelText('Nhãn số lượng hiển thị cho khách'), 'Số hành khách')
    await userEvent.type(screen.getByPlaceholderText('Tên lựa chọn (VD: 4 chỗ)'), '4 chỗ')
    await userEvent.type(screen.getByPlaceholderText('Sức chứa'), '4')
    await userEvent.type(screen.getByPlaceholderText('Giá (VNĐ)'), '200000')
    await userEvent.click(screen.getByText('Thêm dịch vụ'))

    await waitFor(() => expect(serviceService.createService).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Đưa đón sân bay',
      usesVariants: true,
      requiresCapacityMatch: true,
      capacityFieldLabel: 'Số hành khách',
      variants: [{ label: '4 chỗ', capacity: 4, price: 200000 }],
    })))
    const callArg = vi.mocked(serviceService.createService).mock.calls[0][0] as any
    expect(callArg.price).toBeUndefined()
    expect(callArg.unit).toBeUndefined()
  })

  test('sửa dịch vụ usesVariants hiện đúng variants đã lưu', async () => {
    const SERVICE_VARIANTS = {
      ...SERVICE_A, _id: '2', name: 'Đưa đón sân bay', category: 'transport',
      usesVariants: true, requiresCapacityMatch: true, capacityFieldLabel: 'Số hành khách',
      variants: [
        { label: '4 chỗ', capacity: 4, price: 200000 },
        { label: '7 chỗ', capacity: 7, price: 300000 },
      ],
    }
    vi.mocked(serviceService.getServices).mockResolvedValue({ data: [SERVICE_VARIANTS] } as any)
    render(<ServiceManagement />)
    await screen.findByText('Đưa đón sân bay')
    await userEvent.click(screen.getByTitle('Sửa'))

    expect(screen.getAllByPlaceholderText('Tên lựa chọn (VD: 4 chỗ)')).toHaveLength(2)
    expect(screen.getByDisplayValue('4 chỗ')).toBeInTheDocument()
    expect(screen.getByDisplayValue('300000')).toBeInTheDocument()
  })

  test('nút xóa disabled khi dịch vụ đã có booking', async () => {
    const SERVICE_WITH_BOOKING = { ...SERVICE_A, bookingCount: 2 }
    vi.mocked(serviceService.getServices).mockResolvedValue({ data: [SERVICE_WITH_BOOKING] } as any)
    render(<ServiceManagement />)
    await screen.findByText('Dọn phòng')
    expect(screen.getByRole('button', { name: 'Xóa dịch vụ' })).toBeDisabled()
  })

  test('nút xóa disabled khi dịch vụ đang active dù chưa có booking', async () => {
    const SERVICE_ACTIVE_NO_BOOKING = { ...SERVICE_A, bookingCount: 0, isActive: true }
    vi.mocked(serviceService.getServices).mockResolvedValue({ data: [SERVICE_ACTIVE_NO_BOOKING] } as any)
    render(<ServiceManagement />)
    await screen.findByText('Dọn phòng')
    expect(screen.getByRole('button', { name: 'Xóa dịch vụ' })).toBeDisabled()
  })

  test('xóa dịch vụ chưa có booking gọi deleteService rồi tải lại danh sách', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(serviceService.deleteService).mockResolvedValue({ data: { message: 'ok' } } as any)
    const SERVICE_NO_BOOKING = { ...SERVICE_A, bookingCount: 0, isActive: false }
    vi.mocked(serviceService.getServices).mockResolvedValue({ data: [SERVICE_NO_BOOKING] } as any)
    render(<ServiceManagement />)
    await screen.findByText('Dọn phòng')
    await userEvent.click(screen.getByRole('button', { name: 'Xóa dịch vụ' }))
    await waitFor(() => expect(serviceService.deleteService).toHaveBeenCalledWith('1'))
  })

  test('chọn "Khác (tự nhập)" hiện ô input và lưu đúng giá trị gõ tay', async () => {
    vi.mocked(serviceService.createService).mockResolvedValue({ data: SERVICE_A } as any)
    render(<ServiceManagement />)
    await screen.findByText('Dọn phòng')
    await userEvent.click(screen.getByText(/THÊM DỊCH VỤ/i))
    await userEvent.selectOptions(screen.getByLabelText('Đơn vị tính'), '__custom__')
    const customInput = screen.getByPlaceholderText('VD: kg, phần, công')
    await userEvent.type(customInput, 'kg')
    await userEvent.type(screen.getByLabelText('Tên dịch vụ'), 'Giặt ủi')
    await userEvent.type(screen.getByLabelText('Giá (VNĐ)'), '50000')
    await userEvent.click(screen.getByText('Thêm dịch vụ'))
    await waitFor(() => expect(serviceService.createService).toHaveBeenCalledWith(expect.objectContaining({ unit: 'kg' })))
  })

  test('sửa dịch vụ có unit không khớp preset → select hiện "Khác" với giá trị đúng', async () => {
    const SERVICE_CUSTOM_UNIT = { ...SERVICE_A, unit: 'kg' }
    vi.mocked(serviceService.getServices).mockResolvedValue({ data: [SERVICE_CUSTOM_UNIT] } as any)
    render(<ServiceManagement />)
    await screen.findByText('Dọn phòng')
    await userEvent.click(screen.getByTitle('Sửa'))
    expect(screen.getByPlaceholderText('VD: kg, phần, công')).toHaveValue('kg')
  })
})
