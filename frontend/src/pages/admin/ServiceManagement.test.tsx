import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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
  unit: 'lần', images: [], avgRating: 4.5, ratingCount: 2, isActive: true,
  createdAt: '', updatedAt: '',
}

describe('ServiceManagement', () => {
  beforeEach(() => {
    vi.mocked(serviceService.getServices).mockResolvedValue({ data: [SERVICE_A] } as any)
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

  test('nhập khung giờ nhận đặt → payload gửi đúng bookingWindowStart/bookingWindowEnd', async () => {
    vi.mocked(serviceService.createService).mockResolvedValue({ data: SERVICE_A } as any)
    render(<ServiceManagement />)
    await screen.findByText('Dọn phòng')
    await userEvent.click(screen.getByText(/THÊM DỊCH VỤ/i))
    await userEvent.type(screen.getByLabelText('Tên dịch vụ'), 'Spa')
    await userEvent.type(screen.getByLabelText('Giá (VNĐ)'), '200000')
    fireEvent.change(screen.getByLabelText('Giờ nhận đặt từ'), { target: { value: '08:00' } })
    fireEvent.change(screen.getByLabelText('Đến'), { target: { value: '22:00' } })
    await userEvent.click(screen.getByText('Thêm dịch vụ'))
    await waitFor(() => expect(serviceService.createService).toHaveBeenCalledWith(
      expect.objectContaining({ bookingWindowStart: '08:00', bookingWindowEnd: '22:00' })
    ))
  })

  test('sửa dịch vụ có sẵn khung giờ → hiện đúng giá trị trong ô input', async () => {
    const SERVICE_WITH_WINDOW = { ...SERVICE_A, bookingWindowStart: '08:00', bookingWindowEnd: '22:00' }
    vi.mocked(serviceService.getServices).mockResolvedValue({ data: [SERVICE_WITH_WINDOW] } as any)
    render(<ServiceManagement />)
    await screen.findByText('Dọn phòng')
    await userEvent.click(screen.getByTitle('Sửa'))
    expect(screen.getByLabelText('Giờ nhận đặt từ')).toHaveValue('08:00')
    expect(screen.getByLabelText('Đến')).toHaveValue('22:00')
  })
})
