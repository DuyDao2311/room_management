import { useState } from 'react'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Pagination } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/pagination'
import RoomLightbox from './RoomLightbox.tsx' // Trigger TS Server Refresh

interface RoomImage {
  _id: string
  url: string
  isPrimary: boolean
  order: number
}

interface Props {
  images: RoomImage[]
}

const FALLBACK = 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80'

export default function RoomGalleryMobile({ images }: Props) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  const sorted = [...images].sort((a, b) => {
    if (a.isPrimary) return -1
    if (b.isPrimary) return 1
    return a.order - b.order
  })

  const displayImgs = sorted.length > 0 ? sorted : [{ _id: 'default', url: FALLBACK, isPrimary: true, order: 0 }]

  const handleImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    (e.target as HTMLImageElement).src = FALLBACK
  }

  return (
    <>
      <div className="rdg-mobile">
        <Swiper
          modules={[Pagination]}
          pagination={{ clickable: true }}
          spaceBetween={0}
          slidesPerView={1}
          className="rdg-swiper"
        >
          {displayImgs.map((img, i) => (
            <SwiperSlide key={img._id}>
              <img
                src={img.url}
                alt={`Ảnh phòng ${i + 1}`}
                className="rdg-swiper-img"
                loading={i === 0 ? 'eager' : 'lazy'}
                onClick={() => {
                  setLightboxIndex(i)
                  setLightboxOpen(true)
                }}
                onError={handleImgError}
              />
            </SwiperSlide>
          ))}
        </Swiper>
        <div className="rdg-mobile-count">
          {displayImgs.length} ảnh
        </div>
      </div>

      <RoomLightbox
        images={displayImgs}
        open={lightboxOpen}
        index={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  )
}
