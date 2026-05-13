/**
 * SignaturePad.tsx
 * Component chữ ký điện tử tái sử dụng được
 *
 * FIX: Canvas HTML có 2 kích thước riêng biệt:
 *  1. CSS display size (width: 100%)  → chỉ ảnh hưởng hiển thị
 *  2. Internal pixel buffer (canvas.width / canvas.height) → ảnh hưởng vẽ
 *
 * Nếu chỉ dùng CSS, pixel buffer vẫn là 300×150 mặc định.
 * Kết quả: tọa độ chuột bị lệch → stroke không ghi nhận → isEmpty() luôn true
 * → Button "Lưu chữ ký" bị disabled mãi.
 *
 * Giải pháp: Dùng ResizeObserver để đo container thực tế,
 * sau đó gán canvas.width / canvas.height = kích thước thực.
 */

import { useRef, useState, useEffect, useCallback } from 'react'
import SignatureCanvas from 'react-signature-canvas'


const CANVAS_HEIGHT = 140 // px

interface SignaturePadProps {
  /** Nhãn hiển thị phía trên canvas (VD: "BÊN CHO THUÊ") */
  label: string
  /** Nhãn phụ (VD: "(Ký, ghi rõ họ tên)") */
  subLabel?: string
  /** Chữ ký đã lưu (base64 PNG) - khi truyền vào sẽ hiển thị ảnh, không cho vẽ lại */
  savedSignature?: string
  /** Callback trả về base64 PNG khi người dùng nhấn "Lưu chữ ký" */
  onSave: (base64: string) => void
  /** Callback khi người dùng nhấn "Xóa chữ ký" */
  onClear: () => void
  /** Màu viền accent (mặc định #0f5cc7) */
  accentColor?: string
}

export default function SignaturePad({
  label,
  subLabel = '(Ký, ghi rõ họ tên)',
  savedSignature,
  onSave,
  onClear,
  accentColor = '#0f5cc7',
}: SignaturePadProps) {
  // Ref trỏ đến instance của react-signature-canvas
  const sigCanvasRef = useRef<SignatureCanvas>(null)

  // Ref container để đo chiều rộng thực tế
  const containerRef = useRef<HTMLDivElement>(null)

  // Canvas có trống không (dùng để enable/disable nút Lưu)
  const [isEmpty, setIsEmpty] = useState(true)

  /**
   * Đồng bộ pixel buffer của canvas với kích thước container thực tế.
   * Phải gọi sau khi layout hoàn tất (mount, resize).
   * Lưu ý: clear() là cần thiết vì resize canvas tự xóa nội dung.
   */
  // const syncCanvasSize = useCallback(() => {
  //   if (!containerRef.current || !sigCanvasRef.current) return
  //   const containerWidth = containerRef.current.offsetWidth
  //   if (containerWidth === 0) return // Chưa render xong

  //   const canvas = sigCanvasRef.current.getCanvas()

  //   // Chỉ resize nếu kích thước thay đổi (tránh clear không cần thiết)
  //   if (canvas.width !== containerWidth || canvas.height !== CANVAS_HEIGHT) {
  //     canvas.width = containerWidth
  //     canvas.height = CANVAS_HEIGHT
  //     sigCanvasRef.current.clear()
  //     setIsEmpty(true)
  //   }
  // }, [])
  const syncCanvasSize = useCallback(() => {
    if (!containerRef.current || !sigCanvasRef.current) return

    const canvas = sigCanvasRef.current.getCanvas()
    const data = canvas.toDataURL() // 👈 lưu tạm

    const containerWidth = containerRef.current.offsetWidth
    if (containerWidth === 0) return

    if (canvas.width !== containerWidth || canvas.height !== CANVAS_HEIGHT) {
      canvas.width = containerWidth
      canvas.height = CANVAS_HEIGHT

      // 👇 restore lại nét vẽ
      const img = new Image()
      img.src = data
      img.onload = () => {
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0)
      }
    }
  }, [])


  // Đồng bộ kích thước lần đầu sau khi DOM render xong
  // useEffect(() => {
  //   // Delay nhỏ để đảm bảo container đã có kích thước thực
  //   const timer = setTimeout(syncCanvasSize, 30)
  //   return () => clearTimeout(timer)
  // }, [syncCanvasSize, savedSignature])
  useEffect(() => {
    requestAnimationFrame(() => {
      syncCanvasSize()
    })
  }, [syncCanvasSize])

  // Lắng nghe thay đổi kích thước container (window resize, sidebar toggle, ...)
  useEffect(() => {
    if (!containerRef.current) return

    const observer = new ResizeObserver(() => {
      // Chỉ resize khi KHÔNG đang vẽ
      if (!savedSignature && !isDrawingRef.current) {
        syncCanvasSize()
      }
    })

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [syncCanvasSize, savedSignature])

  // Khi savedSignature bị xóa từ bên ngoài → reset canvas
  useEffect(() => {
    if (!savedSignature) {
      sigCanvasRef.current?.clear()
      setIsEmpty(true)
      // Đồng bộ lại kích thước sau khi canvas được hiện ra trở lại
      setTimeout(syncCanvasSize, 30)
    }
  }, [savedSignature, syncCanvasSize])


  /** Lưu chữ ký: xuất PNG base64 rồi gọi callback onSave */
  // const handleSave = () => {
  //   if (!sigCanvasRef.current || sigCanvasRef.current.isEmpty()) return

  //   // getTrimmedCanvas() cắt bỏ vùng trắng xung quanh nét vẽ
  //   const dataURL = sigCanvasRef.current
  //     .getTrimmedCanvas()
  //     .toDataURL('image/png')
  //   onSave(dataURL)
  // }
  const isDrawingRef = useRef(false)
  const handleSave = () => {
    console.log('CLICK SAVE')

    if (!sigCanvasRef.current) {
      console.log('Canvas null')
      return
    }

    if (sigCanvasRef.current.isEmpty()) {
      console.log('Canvas empty')
      return
    }

    const dataURL = sigCanvasRef.current
      .getTrimmedCanvas()
      .toDataURL('image/png')

    console.log('SAVE OK', dataURL)

    onSave(dataURL)
  }

  /** Xóa canvas + thông báo cho parent */
  const handleClear = () => {
    sigCanvasRef.current?.clear()
    setIsEmpty(true)
    onClear()
  }

  return (
    <div
      className="sig-pad-wrapper"
      style={{ '--sig-accent': accentColor } as React.CSSProperties}
    >
      {/* ── Tiêu đề ── */}
      <div className="sig-pad-header">
        <div className="sig-pad-label">{label}</div>
        <div className="sig-pad-sublabel">{subLabel}</div>
      </div>

      {/* ── Nếu đã có chữ ký → hiển thị ảnh preview ── */}
      {savedSignature ? (
        <>
          <div className="sig-pad-preview">
            <img
              src={savedSignature}
              alt={`Chữ ký ${label}`}
              className="sig-pad-img"
            />
            <div className="sig-pad-saved-badge">✓ Đã ký</div>
          </div>

          {/* Nút xóa để ký lại */}
          <div className="sig-pad-actions">
            <button
              type="button"
              className="sig-btn sig-btn-clear"
              onClick={handleClear}
            >
              🗑 Xóa và ký lại
            </button>
          </div>
        </>
      ) : (
        <>
          {/* ── Canvas vẽ chữ ký ── */}
          {/*
            ref={containerRef} để đo chiều rộng thực tế của container.
            KHÔNG dùng CSS width/height trên <canvas> để tránh lệch tọa độ.
            Kích thước pixel buffer được set thủ công trong syncCanvasSize().
          */}
          <div className="sig-pad-canvas-wrap" ref={containerRef}>
            <div className="sig-pad-hint">Ký tên tại đây</div>
            <SignatureCanvas
              ref={sigCanvasRef}
              penColor="#1a1a2e"
              minWidth={1.5}
              maxWidth={3}
              canvasProps={{
                // KHÔNG set width/height qua className hay style ở đây.
                // Chúng ta quản lý pixel buffer thủ công qua syncCanvasSize().
                style: {
                  display: 'block',
                  width: '100%',
                  height: `${CANVAS_HEIGHT}px`,
                  touchAction: 'none', // quan trọng cho mobile
                },
              }}
              // Gọi mỗi khi người dùng nhấc bút → cập nhật isEmpty
              // onEnd={() => {
              //   setIsEmpty(sigCanvasRef.current?.isEmpty() ?? true)
              // }}
              onBegin={() => {
                isDrawingRef.current = true
                setIsEmpty(false)
              }}
              onEnd={() => {
                isDrawingRef.current = false
                if (sigCanvasRef.current) {
                  setIsEmpty(sigCanvasRef.current.isEmpty())
                }
              }}
            />
          </div>

          {/* ── Nút hành động ── */}
          <div className="sig-pad-actions">
            <button
              type="button"
              className="sig-btn sig-btn-clear"
              onClick={handleClear}
            >
              🗑 Xóa
            </button>
            <button
              type="button"
              className="sig-btn sig-btn-save"
              onClick={handleSave}
              disabled={false}
              title={isEmpty ? 'Vui lòng ký trước khi lưu' : 'Lưu chữ ký'}
            >
              💾 Lưu chữ ký
            </button>
          </div>
        </>
      )}
    </div>
  )
}
