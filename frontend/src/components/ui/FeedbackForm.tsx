import { useState } from 'react';
import StarRating from './StarRating';
import { createFeedback, updateFeedback, type Feedback } from '../../api/feedback';

interface FeedbackFormProps {
  roomId: string;
  existingFeedback?: Feedback | null;
  onSuccess: () => void;
  onCancel?: () => void;
}

export default function FeedbackForm({ roomId, existingFeedback, onSuccess, onCancel }: FeedbackFormProps) {
  const isEdit = !!existingFeedback;
  const [rating, setRating] = useState(existingFeedback?.rating ?? 0);
  const [comment, setComment] = useState(existingFeedback?.comment ?? '');
  const [isAnonymous, setIsAnonymous] = useState(existingFeedback?.isAnonymous ?? false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (rating === 0) { setError('Vui lòng chọn số sao.'); return; }

    setLoading(true);
    try {
      if (isEdit && existingFeedback) {
        await updateFeedback(existingFeedback._id, { rating, comment, isAnonymous });
      } else {
        await createFeedback({ roomId, rating, comment, isAnonymous });
      }
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Chọn số sao */}
      <div>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, color: '#374151', fontSize: 14 }}>
          Đánh giá của bạn <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <StarRating value={rating} onChange={setRating} size="lg" />
        {rating > 0 && (
          <span style={{ marginLeft: 12, color: '#6b7280', fontSize: 13 }}>
            {['', 'Rất tệ', 'Tệ', 'Bình thường', 'Tốt', 'Rất tốt'][rating]}
          </span>
        )}
      </div>

      {/* Nhận xét */}
      <div>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, color: '#374151', fontSize: 14 }}>
          Nhận xét
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={1000}
          rows={4}
          placeholder="Chia sẻ trải nghiệm của bạn về phòng này..."
          style={{
            width: '100%',
            padding: '10px 14px',
            border: '1.5px solid #e5e7eb',
            borderRadius: 10,
            fontSize: 14,
            color: '#111827',
            resize: 'vertical',
            outline: 'none',
            transition: 'border-color 0.2s',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
          }}
          onFocus={(e) => (e.target.style.borderColor = '#6366f1')}
          onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
        />
        <div style={{ textAlign: 'right', fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
          {comment.length}/1000
        </div>
      </div>

      {/* Ẩn danh */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, color: '#374151' }}>
        <input
          type="checkbox"
          checked={isAnonymous}
          onChange={(e) => setIsAnonymous(e.target.checked)}
          style={{ width: 16, height: 16, accentColor: '#6366f1', cursor: 'pointer' }}
        />
        Hiển thị ẩn danh (tên của bạn sẽ không được công khai)
      </label>

      {/* Error */}
      {error && (
        <div style={{
          padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: 8, color: '#b91c1c', fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: '9px 20px', border: '1.5px solid #e5e7eb', borderRadius: 8,
              background: '#fff', color: '#374151', fontSize: 14, cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Hủy
          </button>
        )}
        <button
          type="submit"
          disabled={loading || rating === 0}
          style={{
            padding: '9px 24px', border: 'none', borderRadius: 8,
            background: loading || rating === 0 ? '#c7d2fe' : '#6366f1',
            color: '#fff', fontSize: 14, cursor: loading || rating === 0 ? 'not-allowed' : 'pointer',
            fontWeight: 600, transition: 'background 0.2s',
          }}
        >
          {loading ? 'Đang gửi...' : isEdit ? 'Cập nhật' : 'Gửi đánh giá'}
        </button>
      </div>
    </form>
  );
}
