import { useState } from 'react'
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

export default function RoomGalleryDesktop({ images }: Props) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  // Sort by order, primary first
  const sorted = [...images].sort((a, b) => {
    if (a.isPrimary) return -1
    if (b.isPrimary) return 1
    return a.order - b.order
  })

  const displayImgs = sorted.length > 0 ? sorted : [{ _id: 'default', url: FALLBACK, isPrimary: true, order: 0 }]
  const mainImg = displayImgs[0]
  const sideImgs = displayImgs.slice(1, 5)
  const totalExtra = displayImgs.length - 5

  const openLightbox = (index: number) => {
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  const handleImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    (e.target as HTMLImageElement).src = FALLBACK
  }

  // Determine how many side images to calculate grid
  const sideCount = Math.min(sideImgs.length, 4)

  return (
    <>
      <div className="rdg-container">
        {/* Main large image */}
        <div className="rdg-main" onClick={() => openLightbox(0)}>
          <img
            src={mainImg.url}
            alt="Ảnh đại diện phòng"
            className="rdg-img"
            loading="eager"
            onError={handleImgError}
          />
        </div>

        {/* Side images grid */}
        {sideCount > 0 && (
          <div className={`rdg-side count-${sideCount}`}>
            {sideImgs.map((img, i) => (
              <div
                key={img._id}
                className="rdg-side-item"
                onClick={() => openLightbox(i + 1)}
              >
                <img
                  src={img.url}
                  alt={`Ảnh phòng ${i + 2}`}
                  className="rdg-img"
                  loading="lazy"
                  onError={handleImgError}
                />
                {/* Overlay +N on last image if more than 5 */}
                {i === sideCount - 1 && totalExtra > 0 && (
                  <div className="rdg-overlay">
                    <span>+{totalExtra}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* View all button */}
        {/* {displayImgs.length > 1 && (
          <button className="rdg-view-all" onClick={() => openLightbox(0)}>
            📷 Xem tất cả {displayImgs.length} ảnh
          </button>
        )} */}
      </div>

      {/* Lightbox */}
      <RoomLightbox
        images={displayImgs}
        open={lightboxOpen}
        index={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  )
}
