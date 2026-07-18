// frontend/src/pages/public/ServiceDetail.tsx
import { useParams, Link, useNavigate } from "react-router-dom";
import Spinner from "../../components/ui/Spinner.tsx";
import { CATEGORY_LABELS, getMinVariantPrice } from "../../api/service.service";
import { useServiceDetail } from "../../hooks/useServiceDetail";
import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { vi } from "date-fns/locale";
import { CheckCircle2 } from "lucide-react";

registerLocale("vi", vi);

export default function ServiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    service,
    loading,
    error,
    reviews,
    reviewsLoading,
    showBookModal,
    openBookModal,
    closeBookModal,
    scheduledAt,
    setScheduledAt,
    quantity,
    setQuantity,
    note,
    setNote,
    matchQuantity,
    setMatchQuantity,
    selectedVariant,
    setSelectedVariant,
    totalPreview,
    filterBookingTime,
    handleBook,
    bookLoading,
    bookSent,
    bookError,
    noRoomModal,
    closeNoRoomModal,
  } = useServiceDetail(id);

  if (loading)
    return (
      <div className="page-shell">
        <Spinner label="Đang tải dịch vụ..." />
      </div>
    );
  if (error || !service) {
    return (
      <div className="page-shell">
        <div
          className="container"
          style={{ padding: "80px 0", textAlign: "center" }}
        >
          <h2 style={{ color: "#101828" }}>
            {error || "Không tìm thấy dịch vụ."}
          </h2>
          <Link
            to="/services"
            className="button button-primary"
            style={{ marginTop: "16px", display: "inline-block" }}
          >
            ← Xem dịch vụ khác
          </Link>
        </div>
      </div>
    );
  }

  const imageUrl =
    service.images.length > 0
      ? service.images[0]
      : "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1200";

  return (
    <div className="page-shell">
      <div
        className="container"
        style={{
          padding: "40px 0",
          display: "grid",
          gridTemplateColumns: "1.6fr 1fr",
          gap: "40px",
          alignItems: "start",
        }}
      >
        <div>
          <div
            style={{
              borderRadius: "16px",
              overflow: "hidden",
              height: "380px",
              backgroundImage: `url("${imageUrl.replace(/"/g, "%22")}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              marginBottom: "24px",
            }}
          />
          <span
            style={{
              background: "#d1e4ff",
              color: "#003e68",
              padding: "6px 12px",
              borderRadius: "4px",
              fontSize: "0.8rem",
              fontWeight: 700,
            }}
          >
            {CATEGORY_LABELS[service.category].toUpperCase()}
          </span>
          <h1
            style={{
              fontSize: "2rem",
              fontWeight: 800,
              color: "#101828",
              margin: "16px 0 8px",
            }}
          >
            {service.name}
          </h1>
          <div
            style={{ color: "#f79009", fontWeight: 700, marginBottom: "16px" }}
          >
            ★ {service.avgRating.toFixed(1)} ({service.ratingCount} đánh giá)
          </div>
          <p style={{ color: "#475467", lineHeight: 1.7, fontSize: "1rem" }}>
            {service.description || "Chưa có mô tả chi tiết."}
          </p>

          <div style={{ marginTop: "32px" }}>
            <h2
              style={{
                fontSize: "1.3rem",
                fontWeight: 700,
                color: "#101828",
                marginBottom: "16px",
              }}
            >
              Đánh giá từ khách
            </h2>
            <div
              style={{
                background: "white",
                borderRadius: "16px",
                padding: "8px 28px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
              }}
            >
              {reviewsLoading && <Spinner label="Đang tải đánh giá..." />}
              {!reviewsLoading && reviews.length === 0 && (
                <p style={{ color: "#667085", padding: "16px 0" }}>
                  Chưa có đánh giá nào.
                </p>
              )}
              {!reviewsLoading &&
                reviews.map((r, i) => (
                  <div
                    key={r._id}
                    style={{
                      borderBottom:
                        i < reviews.length - 1 ? "1px solid #f2f4f7" : "none",
                      padding: "20px 0",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "6px",
                      }}
                    >
                      <strong style={{ color: "#101828" }}>
                        {r.tenant.name}
                      </strong>
                      <span style={{ color: "#f79009", fontWeight: 700 }}>
                        ★ {r.rating}/5
                      </span>
                    </div>
                    {r.tags.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          gap: "6px",
                          flexWrap: "wrap",
                          marginBottom: "8px",
                        }}
                      >
                        {r.tags.map((tag) => (
                          <span
                            key={tag}
                            style={{
                              background: "#f2f4f7",
                              color: "#344054",
                              padding: "3px 10px",
                              borderRadius: "999px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {r.review && (
                      <p style={{ color: "#475467", margin: 0 }}>{r.review}</p>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div
          style={{
            position: "sticky",
            top: "24px",
            background: "white",
            borderRadius: "16px",
            padding: "28px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
          }}
        >
          <div
            style={{
              fontSize: "1.6rem",
              fontWeight: 800,
              color: "#101828",
              marginBottom: "4px",
            }}
          >
            {service.usesVariants ? (
              <>
                Từ{" "}
                {getMinVariantPrice(service.variants).toLocaleString("vi-VN")} đ
              </>
            ) : (
              <>
                {service.price.toLocaleString("vi-VN")} đ{" "}
                <span
                  style={{
                    fontSize: "1rem",
                    fontWeight: 500,
                    color: "#667085",
                  }}
                >
                  /{service.unit}
                </span>
              </>
            )}
          </div>
          <button
            className="button button-primary"
            style={{ width: "100%", marginTop: "16px", padding: "14px" }}
            onClick={openBookModal}
          >
            Đặt dịch vụ
          </button>
        </div>
      </div>

      {showBookModal && (
        <div
          className="modal-overlay"
          onClick={closeBookModal}
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Đặt "{service.name}"</h2>
              <button
                className="modal-close"
                onClick={closeBookModal}
              >
                ✕
              </button>
            </div>
            {bookSent ? (
              <div style={{ padding: "24px", textAlign: "center" }}>
                <div style={{ marginBottom: "12px" }}>
                  <CheckCircle2 size={40} color="#7cb85a" strokeWidth={2} />
                </div>
                <h3>Đặt dịch vụ thành công!</h3>
                <p style={{ color: "#667085", margin: "8px 0 20px" }}>
                  Booking của bạn đang chờ xác nhận. Xem chi tiết tại "Dịch vụ
                  của tôi".
                </p>
                <button
                  className="button button-primary"
                  onClick={() => navigate("/my-service-bookings")}
                >
                  Xem Dịch vụ của tôi
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleBook}
                className="modal-form"
              >
                {bookError && (
                  <div
                    className="alert alert-error"
                    style={{ marginBottom: "16px" }}
                  >
                    {bookError}
                  </div>
                )}
                <div className="form-group">
                  <label>Thời gian hẹn</label>
                  <DatePicker
                    selected={scheduledAt ? new Date(scheduledAt) : null}
                    onChange={(date: Date | null) =>
                      setScheduledAt(date ? date.toISOString() : "")
                    }
                    showTimeSelect
                    minDate={new Date()}
                    filterTime={filterBookingTime}
                    dateFormat="dd/MM/yyyy HH:mm"
                    locale="vi"
                    className="form-input"
                    placeholderText="Chọn ngày và giờ"
                    required
                  />
                </div>
                {service.usesVariants && service.requiresCapacityMatch ? (
                  <>
                    <div className="form-group">
                      <label htmlFor="sd-match-quantity">
                        {service.capacityFieldLabel || "Số lượng"}
                      </label>
                      <input
                        id="sd-match-quantity"
                        type="number"
                        className="form-input"
                        min={1}
                        value={matchQuantity}
                        onChange={(e) =>
                          setMatchQuantity(Math.max(1, Number(e.target.value)))
                        }
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Lựa chọn</label>
                      {service.variants.map((v) => {
                        const disabled = v.label !== selectedVariant;
                        return (
                          <label
                            key={v.label}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              padding: "8px 0",
                              opacity: disabled ? 0.4 : 1,
                            }}
                          >
                            <input
                              type="radio"
                              name="selectedVariant"
                              value={v.label}
                              checked={selectedVariant === v.label}
                              disabled={disabled}
                              onChange={() => setSelectedVariant(v.label)}
                            />
                            {v.label} —{" "}
                            {disabled
                              ? "không khả dụng"
                              : `${v.price.toLocaleString("vi-VN")}đ`}
                          </label>
                        );
                      })}
                    </div>
                    {selectedVariant === "" && (
                      <div
                        className="alert alert-error"
                        style={{ marginBottom: "16px" }}
                      >
                        Vượt quá sức chứa tối đa (
                        {Math.max(
                          ...service.variants.map((v) => v.capacity ?? 0),
                        )}
                        ).
                      </div>
                    )}
                  </>
                ) : service.usesVariants ? (
                  <>
                    <div className="form-group">
                      <label>Lựa chọn</label>
                      {service.variants.map((v) => (
                        <label
                          key={v.label}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "8px 0",
                          }}
                        >
                          <input
                            type="radio"
                            name="selectedVariant"
                            value={v.label}
                            checked={selectedVariant === v.label}
                            onChange={() => setSelectedVariant(v.label)}
                          />
                          {v.label} — {v.price.toLocaleString("vi-VN")}đ
                        </label>
                      ))}
                    </div>
                    <div className="form-group">
                      <label htmlFor="sd-quantity">Số lượng</label>
                      <input
                        id="sd-quantity"
                        type="number"
                        className="form-input"
                        value={quantity}
                        min={1}
                        onChange={(e) =>
                          setQuantity(Math.max(1, Number(e.target.value)))
                        }
                        required
                      />
                    </div>
                  </>
                ) : (
                  <div className="form-group">
                    <label htmlFor="sd-quantity">
                      Số lượng ({service.unit})
                    </label>
                    <input
                      id="sd-quantity"
                      type="number"
                      className="form-input"
                      value={quantity}
                      min={1}
                      onChange={(e) =>
                        setQuantity(Math.max(1, Number(e.target.value)))
                      }
                      required
                    />
                  </div>
                )}
                <div className="form-group">
                  <label htmlFor="sd-note">Ghi chú (tùy chọn)</label>
                  <textarea
                    id="sd-note"
                    className="form-input"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder="Yêu cầu thêm..."
                  />
                </div>
                <div
                  style={{
                    background: "#f8f9fa",
                    padding: "16px",
                    borderRadius: "8px",
                    display: "flex",
                    justifyContent: "space-between",
                    fontWeight: 700,
                    marginBottom: "16px",
                  }}
                >
                  <span>Tạm tính</span>
                  <span>{totalPreview.toLocaleString("vi-VN")} đ</span>
                </div>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={closeBookModal}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="button button-primary"
                    disabled={
                      bookLoading || (service.usesVariants && !selectedVariant)
                    }
                  >
                    {bookLoading ? "Đang gửi..." : "Xác nhận đặt"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {noRoomModal && (
        <div
          className="modal-overlay"
          onClick={closeNoRoomModal}
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "420px" }}
          >
            <div className="modal-header">
              <h2>Chưa thể đặt dịch vụ</h2>
              <button
                className="modal-close"
                onClick={closeNoRoomModal}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: "24px", textAlign: "center" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>🔒</div>
              <p style={{ color: "#475467" }}>
                Bạn cần đang thuê phòng để đặt dịch vụ này.
              </p>
              <button
                className="button button-primary"
                style={{ marginTop: "16px" }}
                onClick={closeNoRoomModal}
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
