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

  test('nút xóa disabled khi dịch vụ đã có booking', async () => {
    const SERVICE_WITH_BOOKING = { ...SERVICE_A, bookingCount: 2 }
    vi.mocked(serviceService.getServices).mockResolvedValue({ data: [SERVICE_WITH_BOOKING] } as any)
    render(<ServiceManagement />)
    await screen.findByText('Dọn phòng')
    expect(screen.getByRole('button', { name: 'Xóa dịch vụ' })).toBeDisabled()
  })

  test('xóa dịch vụ chưa có booking gọi deleteService rồi tải lại danh sách', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(serviceService.deleteService).mockResolvedValue({ data: { message: 'ok' } } as any)
    const SERVICE_NO_BOOKING = { ...SERVICE_A, bookingCount: 0 }
    vi.mocked(serviceService.getServices).mockResolvedValue({ data: [SERVICE_NO_BOOKING] } as any)
    render(<ServiceManagement />)
    await screen.findByText('Dọn phòng')
    await userEvent.click(screen.getByRole('button', { name: 'Xóa dịch vụ' }))
    await waitFor(() => expect(serviceService.deleteService).toHaveBeenCalledWith('1'))
  })
})
