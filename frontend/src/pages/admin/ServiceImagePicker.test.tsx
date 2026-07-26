import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import ServiceImagePicker from './ServiceImagePicker'
import { serviceService } from '../../api/service.service'

vi.mock('../../api/service.service', async () => {
  const actual = await vi.importActual<typeof import('../../api/service.service')>('../../api/service.service')
  return {
    ...actual,
    serviceService: {
      searchServiceImages: vi.fn(),
      importServiceImage: vi.fn(),
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

  test('tìm ảnh rồi chọn 1 ảnh thì thêm vào danh sách đã chọn', async () => {
    vi.mocked(serviceService.searchServiceImages).mockResolvedValue({
      data: [{ id: 1, thumbnailUrl: 'https://pixabay.com/thumb1.jpg', imageUrl: 'https://pixabay.com/full1.jpg' }],
    } as any)
    vi.mocked(serviceService.importServiceImage).mockResolvedValue({
      data: { url: 'https://res.cloudinary.com/demo/services/a.jpg' },
    } as any)

    render(<ServiceImagePicker onDone={onDone} onClose={onClose} />)
    await userEvent.type(screen.getByPlaceholderText(/giường ngủ khách sạn/i), 'giường')
    await userEvent.click(screen.getByRole('button', { name: 'Tìm' }))

    const thumbnail = await screen.findByRole('button', { name: 'Chọn ảnh 1' })
    await userEvent.click(thumbnail)

    await waitFor(() => expect(serviceService.importServiceImage).toHaveBeenCalledWith('https://pixabay.com/full1.jpg'))
    expect(await screen.findByText('Ảnh đã chọn (1)')).toBeInTheDocument()
  })

  test('bấm Xong gọi onDone với danh sách URL đã chọn', async () => {
    vi.mocked(serviceService.searchServiceImages).mockResolvedValue({
      data: [{ id: 1, thumbnailUrl: 'https://pixabay.com/thumb1.jpg', imageUrl: 'https://pixabay.com/full1.jpg' }],
    } as any)
    vi.mocked(serviceService.importServiceImage).mockResolvedValue({
      data: { url: 'https://res.cloudinary.com/demo/services/a.jpg' },
    } as any)

    render(<ServiceImagePicker onDone={onDone} onClose={onClose} />)
    await userEvent.type(screen.getByPlaceholderText(/giường ngủ khách sạn/i), 'giường')
    await userEvent.click(screen.getByRole('button', { name: 'Tìm' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Chọn ảnh 1' }))
    await screen.findByText('Ảnh đã chọn (1)')

    await userEvent.click(screen.getByRole('button', { name: 'Xong' }))
    expect(onDone).toHaveBeenCalledWith(['https://res.cloudinary.com/demo/services/a.jpg'])
  })

  test('lỗi tìm ảnh hiện thông báo lỗi', async () => {
    vi.mocked(serviceService.searchServiceImages).mockRejectedValue({
      response: { data: { message: 'Tính năng tìm ảnh mẫu chưa được cấu hình.' } },
    })

    render(<ServiceImagePicker onDone={onDone} onClose={onClose} />)
    await userEvent.type(screen.getByPlaceholderText(/giường ngủ khách sạn/i), 'giường')
    await userEvent.click(screen.getByRole('button', { name: 'Tìm' }))

    expect(await screen.findByText('Tính năng tìm ảnh mẫu chưa được cấu hình.')).toBeInTheDocument()
  })
})
