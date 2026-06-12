import { useState, useEffect } from 'react'
import RoomGalleryDesktop from './RoomGalleryDesktop'
import RoomGalleryMobile from './RoomGalleryMobile'

interface RoomImage {
  _id: string
  url: string
  isPrimary: boolean
  order: number
}

interface Props {
  images: RoomImage[]
}

export default function RoomGallery({ images }: Props) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  if (!images || images.length === 0) {
    // Skeleton loading state
    return (
      <div className="rdg-skeleton">
        <div className="rdg-skeleton-main" />
        <div className="rdg-skeleton-side">
          <div className="rdg-skeleton-item" />
          <div className="rdg-skeleton-item" />
          <div className="rdg-skeleton-item" />
          <div className="rdg-skeleton-item" />
        </div>
      </div>
    )
  }

  return isMobile ? (
    <RoomGalleryMobile images={images} />
  ) : (
    <RoomGalleryDesktop images={images} />
  )
}
