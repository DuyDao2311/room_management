import Lightbox from 'yet-another-react-lightbox'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen'
import Counter from 'yet-another-react-lightbox/plugins/counter'
import 'yet-another-react-lightbox/styles.css'
import 'yet-another-react-lightbox/plugins/counter.css'

interface RoomImage {
  _id: string
  url: string
  isPrimary: boolean
  order: number
}

interface Props {
  images: RoomImage[]
  open: boolean
  index: number
  onClose: () => void
}

export default function RoomLightbox({ images, open, index, onClose }: Props) {
  const slides = images.map((img) => ({
    src: img.url,
    alt: img.isPrimary ? 'Ảnh đại diện' : 'Ảnh phòng',
  }))

  return (
    <Lightbox
      open={open}
      close={onClose}
      index={index}
      slides={slides}
      plugins={[Zoom, Fullscreen, Counter]}
      animation={{ fade: 250 }}
      carousel={{ finite: false }}
      controller={{ closeOnBackdropClick: true }}
      zoom={{
        maxZoomPixelRatio: 3,
        scrollToZoom: true,
      }}
      counter={{ container: { style: { top: '16px', bottom: 'unset' } } }}
      styles={{
        container: { backgroundColor: 'rgba(0, 0, 0, 0.92)' },
      }}
    />
  )
}
