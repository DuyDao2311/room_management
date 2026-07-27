import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import ServiceImagePicker from './ServiceImagePicker'
import { serviceService } from '../../api/service.service'

vi.mock('../../api/service.service', async () => {
  const actual = await vi.importActual<typeof import('../../api/service.service')>('../../api/service.service')
  return {
    ...actual,
    serviceService: {
      uploadServiceImages: vi.fn(),
    },
  }
})

describe('ServiceImagePicker', () => {
  const onDone = vi.fn()
  const onClose = vi.fn()

  beforeEach(() => {
    onDone.mockClear()
    onClose.mockClear()
  })

  test('tải ảnh lên thành công thì thêm vào danh sách đã chọn', async () => {
    vi.mocked(serviceService.uploadServiceImages).mockResolvedValue({
      data: { urls: ['https://res.cloudinary.com/demo/services/a.jpg'] },
    } as any)

    render(<ServiceImagePicker onDone={onDone} onClose={onClose} />)
    const file = new File(['fake'], 'anh.jpg', { type: 'image/jpeg' })
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(fileInput, file)
    await userEvent.click(screen.getByRole('button', { name: 'Tải lên' }))

    expect(await screen.findByText('Ảnh đã chọn (1)')).toBeInTheDocument()
  })

  test('bấm Xong gọi onDone với danh sách URL đã chọn', async () => {
    vi.mocked(serviceService.uploadServiceImages).mockResolvedValue({
      data: { urls: ['https://res.cloudinary.com/demo/services/a.jpg'] },
    } as any)

    render(<ServiceImagePicker onDone={onDone} onClose={onClose} />)
    const file = new File(['fake'], 'anh.jpg', { type: 'image/jpeg' })
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(fileInput, file)
    await userEvent.click(screen.getByRole('button', { name: 'Tải lên' }))
    await screen.findByText('Ảnh đã chọn (1)')

    await userEvent.click(screen.getByRole('button', { name: 'Xong' }))
    expect(onDone).toHaveBeenCalledWith(['https://res.cloudinary.com/demo/services/a.jpg'])
  })

  test('lỗi tải ảnh hiện thông báo lỗi', async () => {
    vi.mocked(serviceService.uploadServiceImages).mockRejectedValue({
      response: { data: { message: 'Tải ảnh lên thất bại.' } },
    })

    render(<ServiceImagePicker onDone={onDone} onClose={onClose} />)
    const file = new File(['fake'], 'anh.jpg', { type: 'image/jpeg' })
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(fileInput, file)
    await userEvent.click(screen.getByRole('button', { name: 'Tải lên' }))

    expect(await screen.findByText('Tải ảnh lên thất bại.')).toBeInTheDocument()
  })

  test('nút Xong bị khóa khi chưa chọn ảnh nào', () => {
    render(<ServiceImagePicker onDone={onDone} onClose={onClose} />)
    expect(screen.getByRole('button', { name: 'Xong' })).toBeDisabled()
  })
})
