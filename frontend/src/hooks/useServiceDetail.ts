import { useState, useEffect, useCallback, type FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.tsx'
import { serviceService, type Service, type ServiceReview } from '../api/service.service'
import { serviceBookingService } from '../api/serviceBooking.service'

const NO_ROOM_MESSAGE = 'Bạn cần đang thuê phòng để đặt dịch vụ này.'
const ONE_HOUR_MS = 60 * 60 * 1000

export interface UseServiceDetailResult {
  service: Service | null
  loading: boolean
  error: string
  reviews: ServiceReview[]
  reviewsLoading: boolean
  showBookModal: boolean
  openBookModal: () => void
  closeBookModal: () => void
  scheduledAt: string
  setScheduledAt: (v: string) => void
  quantity: number
  setQuantity: (v: number) => void
  note: string
  setNote: (v: string) => void
  matchQuantity: number
  setMatchQuantity: (v: number) => void
  selectedVariant: string
  setSelectedVariant: (v: string) => void
  totalPreview: number
  filterBookingTime: (time: Date) => boolean
  handleBook: (e: FormEvent) => Promise<void>
  bookLoading: boolean
  bookSent: boolean
  bookError: string
  noRoomModal: boolean
  closeNoRoomModal: () => void
}

export function useServiceDetail(id: string | undefined): UseServiceDetailResult {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [service, setService] = useState<Service | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reviews, setReviews] = useState<ServiceReview[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(true)

  const [showBookModal, setShowBookModal] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [note, setNote] = useState('')
  const [matchQuantity, setMatchQuantity] = useState(1)
  const [selectedVariant, setSelectedVariant] = useState('')
  const [bookLoading, setBookLoading] = useState(false)
  const [bookError, setBookError] = useState('')
  const [bookSent, setBookSent] = useState(false)
  const [noRoomModal, setNoRoomModal] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    serviceService.getServiceById(id)
      .then((res: any) => setService(res.data))
      .catch((err: any) => setError(err.response?.data?.message || 'Không thể tải thông tin dịch vụ.'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!id) return
    setReviewsLoading(true)
    serviceService.getReviews(id)
      .then((res: any) => setReviews(res.data))
      .catch(() => setReviews([]))
      .finally(() => setReviewsLoading(false))
  }, [id])

  useEffect(() => {
    if (!service || !service.usesVariants || !service.requiresCapacityMatch) return
    const smallestSufficient = [...service.variants]
      .sort((a, b) => (a.capacity ?? 0) - (b.capacity ?? 0))
      .find(v => (v.capacity ?? 0) >= matchQuantity)
    setSelectedVariant(smallestSufficient ? smallestSufficient.label : '')
  }, [matchQuantity, service])

  const openBookModal = useCallback(() => {
    if (!user) { navigate(`/login?redirect=${location.pathname}`); return }
    setScheduledAt('')
    setQuantity(1)
    setMatchQuantity(1)
    setNote('')
    setBookError('')
    setBookSent(false)
    if (service && service.usesVariants && !service.requiresCapacityMatch) {
      setSelectedVariant(service.variants[0]?.label ?? '')
    }
    setShowBookModal(true)
  }, [user, navigate, location.pathname, service])

  const closeBookModal = useCallback(() => setShowBookModal(false), [])
  const closeNoRoomModal = useCallback(() => setNoRoomModal(false), [])

  const filterBookingTime = useCallback((time: Date) => {
    if (time.getTime() - Date.now() < ONE_HOUR_MS) return false
    if (!service?.bookingWindowStart || !service?.bookingWindowEnd) return true
    const hhmm = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`
    return hhmm >= service.bookingWindowStart && hhmm <= service.bookingWindowEnd
  }, [service])

  const handleBook = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (!service) return
    setBookError('')
    if (!scheduledAt) { setBookError('Vui lòng chọn thời gian hẹn.'); return }
    if (service.usesVariants && !selectedVariant) {
      setBookError('Vui lòng chọn 1 lựa chọn hợp lệ.')
      return
    }
    setBookLoading(true)
    try {
      if (service.usesVariants && service.requiresCapacityMatch) {
        await serviceBookingService.createBooking({ serviceId: service._id, scheduledAt, note, selectedVariant, matchQuantity })
      } else if (service.usesVariants) {
        await serviceBookingService.createBooking({ serviceId: service._id, scheduledAt, note, selectedVariant, quantity })
      } else {
        await serviceBookingService.createBooking({ serviceId: service._id, scheduledAt, quantity, note })
      }
      setBookSent(true)
    } catch (err: any) {
      if (err.response?.status === 403 && err.response?.data?.message === NO_ROOM_MESSAGE) {
        setNoRoomModal(true)
      } else {
        setBookError(err.response?.data?.message || 'Đặt dịch vụ thất bại. Vui lòng thử lại.')
      }
    } finally {
      setBookLoading(false)
    }
  }, [service, scheduledAt, quantity, note, selectedVariant, matchQuantity])

  const totalPreview = (() => {
    if (!service) return 0
    if (!service.usesVariants) return service.price * quantity
    const variant = service.variants.find(v => v.label === selectedVariant)
    if (!variant) return 0
    return service.requiresCapacityMatch ? variant.price : variant.price * quantity
  })()

  return {
    service, loading, error,
    reviews, reviewsLoading,
    showBookModal, openBookModal, closeBookModal,
    scheduledAt, setScheduledAt, quantity, setQuantity, note, setNote,
    matchQuantity, setMatchQuantity, selectedVariant, setSelectedVariant,
    totalPreview,
    filterBookingTime,
    handleBook, bookLoading, bookSent, bookError,
    noRoomModal, closeNoRoomModal,
  }
}
