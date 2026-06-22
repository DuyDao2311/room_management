import { useState, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { MdStar, MdStarBorder, MdDeleteOutline, MdDragIndicator, MdAdd } from 'react-icons/md'
import api from '../../api/axios'
import AddImageModal from './AddImageModal'

interface RoomImage {
  _id: string
  url: string
  isPrimary: boolean
  order: number
}

interface RoomImageManagerProps {
  roomId: string
  images: RoomImage[]
  onImagesChange: (images: RoomImage[]) => void
}

const PLACEHOLDER_IMG = 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=400&q=60'

// ── Sortable Image Item ────────────────────────────────────────
function SortableImageItem({
  image,
  onSetPrimary,
  onDelete,
}: {
  image: RoomImage
  onSetPrimary: (id: string) => void
  onDelete: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image._id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="rim-item" {...attributes}>
      {/* Drag handle */}
      <div className="rim-drag-handle" {...listeners} title="Kéo để đổi vị trí">
        <MdDragIndicator size={20} />
      </div>

      {/* Image preview */}
      <div className="rim-img-wrap">
        <img
          src={image.url}
          alt="Room"
          className="rim-img"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).src = PLACEHOLDER_IMG
          }}
        />
        {image.isPrimary && <span className="rim-primary-badge">Ảnh đại diện</span>}
      </div>

      {/* Actions */}
      <div className="rim-actions">
        <button
          type="button"
          className={`rim-action-btn ${image.isPrimary ? 'rim-primary-active' : ''}`}
          onClick={() => onSetPrimary(image._id)}
          title={image.isPrimary ? 'Đang là ảnh đại diện' : 'Đặt làm ảnh đại diện'}
        >
          {image.isPrimary ? <MdStar size={18} color="#f59e0b" /> : <MdStarBorder size={18} />}
        </button>
        <button
          type="button"
          className="rim-action-btn rim-delete-btn"
          onClick={() => onDelete(image._id)}
          title="Xóa ảnh"
        >
          <MdDeleteOutline size={18} />
        </button>
      </div>

      {/* URL display */}
      <div className="rim-url" title={image.url}>
        {image.url.length > 50 ? image.url.slice(0, 50) + '...' : image.url}
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────
export default function RoomImageManager({ roomId, images, onImagesChange }: RoomImageManagerProps) {
  const [showAddModal, setShowAddModal] = useState(false)
  const [loading, setLoading] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // Sort images by order
  const sortedImages = [...images].sort((a, b) => a.order - b.order)

  // Drag end → auto save reorder
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = sortedImages.findIndex((img) => img._id === active.id)
      const newIndex = sortedImages.findIndex((img) => img._id === over.id)
      const reordered = arrayMove(sortedImages, oldIndex, newIndex)

      // Update local state immediately
      const updatedImages = reordered.map((img, idx) => ({ ...img, order: idx }))
      onImagesChange(updatedImages)

      // Call API
      try {
        await api.put(`/rooms/${roomId}/images/reorder`, {
          imageIds: reordered.map((img) => img._id),
        })
      } catch (err) {
        console.error('Reorder error:', err)
      }
    },
    [sortedImages, roomId, onImagesChange]
  )

  // Set primary
  const handleSetPrimary = async (imageId: string) => {
    setLoading(true)
    try {
      const res = await api.put(`/rooms/${roomId}/images/${imageId}/primary`)
      onImagesChange(res.data.data)
    } catch (err) {
      console.error('Set primary error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Delete image
  const handleDelete = async (imageId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa ảnh này?')) return
    setLoading(true)
    try {
      const res = await api.delete(`/rooms/${roomId}/images/${imageId}`)
      onImagesChange(res.data.data)
    } catch (err) {
      console.error('Delete image error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Refresh images from server
  const refreshImages = async () => {
    try {
      const res = await api.get(`/rooms/${roomId}`)
      onImagesChange(res.data.images || [])
    } catch (err) {
      console.error('Refresh images error:', err)
    }
  }

  return (
    <div className="rim-container">
      {/* Header */}
      <div className="rim-header">
        <div>
          <h3 className="rim-title">Quản lý ảnh phòng</h3>
          <p className="rim-subtitle">{sortedImages.length} ảnh • Kéo thả để sắp xếp thứ tự</p>
        </div>
        <button
          type="button"
          className="button button-primary"
          onClick={() => setShowAddModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <MdAdd size={18} /> Thêm ảnh
        </button>
      </div>

      {/* Image grid with drag & drop */}
      {sortedImages.length === 0 ? (
        <div className="rim-empty">
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🖼️</div>
          <p>Chưa có ảnh nào. Bấm "Thêm ảnh" để bắt đầu.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortedImages.map((img) => img._id)} strategy={rectSortingStrategy}>
            <div className={`rim-grid ${loading ? 'rim-loading' : ''}`}>
              {sortedImages.map((img) => (
                <SortableImageItem
                  key={img._id}
                  image={img}
                  onSetPrimary={handleSetPrimary}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Add Image Modal */}
      <AddImageModal
        roomId={roomId}
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={refreshImages}
      />
    </div>
  )
}
