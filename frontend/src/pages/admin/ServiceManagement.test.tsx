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
    },
  }
})

const SERVICE_A = {
  _id: '1', name: 'Dọn phòng', category: 'cleaning', description: '', price: 100000,
  unit: 'lần', images: [], avgRating: 4.5, ratingCount: 2, isActive: true, carOptions: [],
  createdAt: '', updatedAt: '',
}

describe('ServiceManagement', () => {
  beforeEach(() => {
    vi.mocked(serviceService.getServices).mockClear().mockResolvedValue({ data: [SERVICE_A] } as any)
    vi.mocked(serviceService.createService).mockClear()
    vi.mocked(serviceService.updateService).mockClear()
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
    await waitFor(() => expect(serviceService.createService).toHaveBeenCalledWith(expect.objectContaining({ name: 'Giặt ủi', price: 50000 })))
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

  test('chọn category Đưa đón hiện editor loại xe thay vì ô Giá/Đơn vị tính', async () => {
    render(<ServiceManagement />)
    await screen.findByText('Dọn phòng')
    await userEvent.click(screen.getByText(/THÊM DỊCH VỤ/i))
    await userEvent.selectOptions(screen.getByLabelText('Loại dịch vụ'), 'transport')

    expect(screen.queryByLabelText('Giá (VNĐ)')).not.toBeInTheDocument()
    expect(screen.getByText('Các loại xe')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Tên loại xe (VD: 4 chỗ)')).toBeInTheDocument()
  })

  test('bấm "+ Thêm loại xe" thêm 1 dòng, nút xóa disabled khi chỉ còn 1 dòng', async () => {
    render(<ServiceManagement />)
    await screen.findByText('Dọn phòng')
    await userEvent.click(screen.getByText(/THÊM DỊCH VỤ/i))
    await userEvent.selectOptions(screen.getByLabelText('Loại dịch vụ'), 'transport')

    expect(screen.getAllByPlaceholderText('Tên loại xe (VD: 4 chỗ)')).toHaveLength(1)
    expect(screen.getByLabelText('Xóa loại xe')).toBeDisabled()

    await userEvent.click(screen.getByText('+ Thêm loại xe'))
    expect(screen.getAllByPlaceholderText('Tên loại xe (VD: 4 chỗ)')).toHaveLength(2)
    expect(screen.getAllByLabelText('Xóa loại xe')[0]).not.toBeDisabled()
  })

  test('tạo dịch vụ transport gửi đúng carOptions, không gửi price/unit', async () => {
    vi.mocked(serviceService.createService).mockResolvedValue({ data: SERVICE_A } as any)
    render(<ServiceManagement />)
    await screen.findByText('Dọn phòng')
    await userEvent.click(screen.getByText(/THÊM DỊCH VỤ/i))
    await userEvent.type(screen.getByLabelText('Tên dịch vụ'), 'Đưa đón sân bay')
    await userEvent.selectOptions(screen.getByLabelText('Loại dịch vụ'), 'transport')
    await userEvent.type(screen.getByPlaceholderText('Tên loại xe (VD: 4 chỗ)'), '4 chỗ')
    await userEvent.type(screen.getByPlaceholderText('Sức chứa (người)'), '4')
    await userEvent.type(screen.getByPlaceholderText('Giá xe (VNĐ)'), '200000')
    await userEvent.click(screen.getByText('Thêm dịch vụ'))

    await waitFor(() => expect(serviceService.createService).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Đưa đón sân bay',
      category: 'transport',
      carOptions: [{ label: '4 chỗ', capacity: 4, price: 200000 }],
    })))
    const callArg = vi.mocked(serviceService.createService).mock.calls[0][0] as any
    expect(callArg.price).toBeUndefined()
    expect(callArg.unit).toBeUndefined()
  })

  test('sửa dịch vụ transport hiện đúng carOptions đã lưu', async () => {
    const SERVICE_TRANSPORT = {
      ...SERVICE_A, _id: '2', name: 'Đưa đón sân bay', category: 'transport',
      carOptions: [
        { label: '4 chỗ', capacity: 4, price: 200000 },
        { label: '7 chỗ', capacity: 7, price: 300000 },
      ],
    }
    vi.mocked(serviceService.getServices).mockResolvedValue({ data: [SERVICE_TRANSPORT] } as any)
    render(<ServiceManagement />)
    await screen.findByText('Đưa đón sân bay')
    await userEvent.click(screen.getByTitle('Sửa'))

    expect(screen.getAllByPlaceholderText('Tên loại xe (VD: 4 chỗ)')).toHaveLength(2)
    expect(screen.getByDisplayValue('4 chỗ')).toBeInTheDocument()
    expect(screen.getByDisplayValue('300000')).toBeInTheDocument()
  })
})
