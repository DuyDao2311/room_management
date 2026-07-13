import api from './axios'

export type ServiceCategory = 'cleaning' | 'food' | 'laundry' | 'transport' | 'spa' | 'maintenance'
export type ServiceUnit = 'lần' | 'buổi' | 'khách'

export interface Service {
  _id: string
  name: string
  category: ServiceCategory
  description: string
  price: number
  unit: ServiceUnit
  images: string[]
  avgRating: number
  ratingCount: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  cleaning: 'Dọn dẹp',
  food: 'Ăn uống',
  laundry: 'Giặt ủi',
  transport: 'Đưa đón',
  spa: 'Spa',
  maintenance: 'Sửa chữa nhỏ',
}

export const CATEGORY_TAGS: Record<ServiceCategory, string[]> = {
  cleaning: ['Sạch sẽ', 'Đúng giờ', 'Chu đáo', 'Nhanh gọn'],
  food: ['Ngon miệng', 'Đúng giờ', 'Trình bày đẹp', 'Đáng tiền'],
  laundry: ['Sạch thơm', 'Đúng hẹn', 'Cẩn thận', 'Nhanh chóng'],
  transport: ['Đúng giờ', 'Tài xế thân thiện', 'Xe sạch sẽ', 'Lái xe an toàn'],
  spa: ['Thư giãn', 'Chuyên nghiệp', 'Nhẹ nhàng', 'Đáng tiền'],
  maintenance: ['Xử lý nhanh', 'Chuyên nghiệp', 'Đúng giờ', 'Giải quyết triệt để'],
}

export interface ServiceReview {
  _id: string
  rating: number
  review?: string
  tags: string[]
  createdAt: string
  tenant: { name: string }
}

export const serviceService = {
  getServices: (params?: { category?: string }) =>
    api.get<Service[]>('/services', { params }),

  getServiceById: (id: string) => api.get<Service>(`/services/${id}`),

  getReviews: (id: string) => api.get<ServiceReview[]>(`/services/${id}/reviews`),

  createService: (data: {
    name: string
    category: ServiceCategory
    description?: string
    price: number
    unit: ServiceUnit
    images?: string[]
  }) => api.post<Service>('/services', data),

  updateService: (
    id: string,
    data: Partial<{
      name: string
      category: ServiceCategory
      description: string
      price: number
      unit: ServiceUnit
      images: string[]
      isActive: boolean
    }>
  ) => api.put<Service>(`/services/${id}`, data),
}
