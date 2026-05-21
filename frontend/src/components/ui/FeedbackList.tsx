import { useEffect, useState, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import StarRating from './StarRating';
import {
  getFeedbacksByRoom,
  deleteFeedback,
  toggleFeedbackStatus,
  replyToFeedback,
  updateFeedback,
  type Feedback,
  type FeedbackDistribution,
} from '../../api/feedback';
import { useAuth } from '../../contexts/AuthContext';

interface FeedbackListProps {
  roomId: string;
  currentUserId?: string;
  ownFeedbackId?: string;
  onRefreshTrigger?: number;
  hideSummary?: boolean;
  summaryLayout?: 'top' | 'side';
  onEditSuccess?: (feedback: Feedback) => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function getInitial(name: string) {
  return name?.trim()?.[0]?.toUpperCase() || '?';
}

function avatarColor(name: string) {
  const colors = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// ── Rating Summary ─────────────────────────────────────────────────────────────
function RatingSummary({
  avg, count, distribution,
}: {
  avg: number; count: number; distribution: FeedbackDistribution;
}) {
  const label = avg >= 4.5 ? 'Xuất sắc' : avg >= 4 ? 'Rất tốt' : avg >= 3 ? 'Tốt' : avg >= 2 ? 'Trung bình' : 'Kém';
  return (
    <div className="fb-summary">
      <div className="fb-summary-left">
        <div className="fb-summary-score">{count > 0 ? avg.toFixed(1) : '—'}</div>
        <StarRating value={avg} size="md" />
        {count > 0 && <div className="fb-summary-label">{label}</div>}
        <div className="fb-summary-count">{count} đánh giá</div>
      </div>
      <div className="fb-summary-bars">
        {([5, 4, 3, 2, 1] as const).map((star) => {
          const pct = count > 0 ? (distribution[star] / count) * 100 : 0;
          return (
            <div key={star} className="fb-bar-row">
              <span className="fb-bar-label">{star}★</span>
              <div className="fb-bar-track">
                <div className="fb-bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="fb-bar-count">{distribution[star]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Reply Form ─────────────────────────────────────────────────────────────────
function ReplyBox({
  feedbackId, existingReply, onSaved,
}: {
  feedbackId: string; existingReply?: string; onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(existingReply || '');
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const openForm = () => {
    setOpen(true);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await replyToFeedback(feedbackId, text);
      onSaved();
      setOpen(false);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Lỗi khi lưu phản hồi.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Xóa phản hồi này?')) return;
    setSaving(true);
    try {
      await replyToFeedback(feedbackId, '');
      onSaved();
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSave();
    if (e.key === 'Escape') { setOpen(false); setText(existingReply || ''); }
  };

  if (!open) {
    return (
      <button onClick={openForm} className="fb-reply-toggle-btn">
        {existingReply ? (
          <><span>✏️</span> Sửa phản hồi</>
        ) : (
          <><span>💬</span> Phản hồi đánh giá này</>
        )}
      </button>
    );
  }

  return (
    <div className="fb-reply-form">
      <div className="fb-reply-form-header">
        <div className="fb-reply-form-avatar">BQL</div>
        <div>
          <div className="fb-reply-form-title">Phản hồi của Ban quản lý</div>
          <div className="fb-reply-form-hint">Ctrl+Enter để gửi · Esc để hủy</div>
        </div>
      </div>
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={3}
        maxLength={1000}
        placeholder="Cảm ơn bạn đã đánh giá. Chúng tôi rất trân trọng phản hồi của bạn..."
        className="fb-reply-textarea"
      />
      <div className="fb-reply-form-footer">
        <span className="fb-reply-char-count">{text.length}/1000</span>
        <div className="fb-reply-actions">
          {existingReply && (
            <button onClick={handleDelete} disabled={saving} className="fb-reply-btn-delete">
              Xóa phản hồi
            </button>
          )}
          <button
            onClick={() => { setOpen(false); setText(existingReply || ''); }}
            className="fb-reply-btn-cancel"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !text.trim()}
            className="fb-reply-btn-save"
          >
            {saving ? 'Đang lưu...' : '✓ Gửi phản hồi'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function FeedbackList({
  roomId, currentUserId, ownFeedbackId, onRefreshTrigger,
  hideSummary = false, summaryLayout = 'top', onEditSuccess,
}: FeedbackListProps) {
  const { user } = useAuth();
  const isAdminOrStaff = user?.role === 'admin' || user?.role === 'staff';

  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [distribution, setDistribution] = useState<FeedbackDistribution>({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  const [loading, setLoading] = useState(true);
  const [avgRating, setAvgRating] = useState(0);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRating, setEditRating] = useState(5);
  const [editComment, setEditComment] = useState('');
  const [editAnonymous, setEditAnonymous] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const location = useLocation();
  const highlightId = location.hash.startsWith('#feedback-')
    ? location.hash.replace('#feedback-', '')
    : null;
  const highlightRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getFeedbacksByRoom(roomId);
      setFeedbacks(data.feedbacks);
      setDistribution(data.distribution);
      const total = data.feedbacks.reduce((s, f) => s + f.rating, 0);
      setAvgRating(data.feedbacks.length > 0 ? total / data.feedbacks.length : 0);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [roomId]);

  useEffect(() => { load(); }, [load, onRefreshTrigger]);

  // Đóng menu khi click ngoài
  useEffect(() => {
    const close = () => setOpenMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  // Bắt đầu sửa inline
  const startEdit = (fb: Feedback) => {
    setEditingId(fb._id);
    setEditRating(fb.rating);
    setEditComment(fb.comment || '');
    setEditAnonymous(fb.isAnonymous || false);
    setOpenMenuId(null);
  };

  // Lưu thay đổi
  const saveEdit = async (fb: Feedback) => {
    if (!editRating) return;
    setEditSaving(true);
    try {
      const updated = await updateFeedback(fb._id, {
        rating: editRating,
        comment: editComment,
        isAnonymous: editAnonymous,
      });
      setEditingId(null);
      load();
      onEditSuccess?.(updated);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Lỗi khi lưu.');
    } finally {
      setEditSaving(false);
    }
  };

  const cancelEdit = () => setEditingId(null);

  useEffect(() => {
    if (highlightRef.current) {
      setTimeout(() => highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 500);
    }
  }, [feedbacks, highlightId]);

  // Bước 1: mở confirm modal
  const handleDelete = (id: string) => {
    setOpenMenuId(null);
    setConfirmDeleteId(id);
  };

  // Bước 2: thực sự xóa sau khi xác nhận
  const executeDelete = async () => {
    if (!confirmDeleteId) return;
    try { await deleteFeedback(confirmDeleteId); load(); }
    catch (e: any) { alert(e.response?.data?.message || 'Lỗi.'); }
    finally { setConfirmDeleteId(null); }
  };

  const handleToggle = async (id: string, current: 'visible' | 'hidden') => {
    try { await toggleFeedbackStatus(id, current === 'visible' ? 'hidden' : 'visible'); load(); }
    catch (e: any) { alert(e.response?.data?.message || 'Lỗi.'); }
  };

  if (loading) return (
    <div className="fb-loading">
      <div className="fb-loading-spinner" />
      <span>Đang tải đánh giá...</span>
    </div>
  );

  return (
    <div className={`fb-list-root${summaryLayout === 'side' ? ' fb-list-root--side' : ''}`}>
      {!hideSummary && (
        <RatingSummary avg={avgRating} count={feedbacks.length} distribution={distribution} />
      )}

      {feedbacks.length === 0 ? (
        <div className="fb-empty">
          <div className="fb-empty-icon">💬</div>
          <div className="fb-empty-title">Chưa có đánh giá nào</div>
          <p className="fb-empty-desc">Hãy là người đầu tiên chia sẻ trải nghiệm về phòng này.</p>
        </div>
      ) : (
        <div className="fb-cards">
          {feedbacks.map((fb) => {
            const isHighlighted = fb._id === highlightId;
            const name = (fb as any).tenantName || 'Người thuê';
            // Sử dụng ownFeedbackId nếu có, fallback sang so sánh tenant
            const isOwn = ownFeedbackId
              ? fb._id === ownFeedbackId
              : !!(currentUserId &&
                  (typeof fb.tenant === 'object' ? (fb.tenant as any)?._id : fb.tenant) === currentUserId);
            const isHidden = (fb as any).status === 'hidden';

            return (
              <div
                key={fb._id}
                id={`feedback-${fb._id}`}
                ref={isHighlighted ? highlightRef : null}
                className={`fb-card ${isHighlighted ? 'fb-card--highlighted' : ''} ${isHidden ? 'fb-card--hidden' : ''}`}
              >
                {/* ── Card header ── */}
                <div className="fb-card-header">
                  <div className="fb-card-left">
                    <div
                      className="fb-avatar"
                      style={{ background: fb.isAnonymous ? '#9ca3af' : avatarColor(name) }}
                    >
                      {fb.isAnonymous ? '?' : getInitial(name)}
                    </div>
                    <div>
                      <div className="fb-reviewer-name">
                        {name}
                        {isHidden && (
                          <span className="fb-badge fb-badge--hidden">Đã ẩn</span>
                        )}
                        {isHighlighted && (
                          <span className="fb-badge fb-badge--new">Đang xem</span>
                        )}
                      </div>
                      <div className="fb-stars-row">
                        <StarRating value={fb.rating} size="sm" />
                        <span className="fb-date">{formatDate(fb.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="fb-card-actions">
                    {isAdminOrStaff && (
                      <>
                        <button
                          onClick={() => handleToggle(fb._id, (fb as any).status)}
                          className="fb-action-btn fb-action-btn--neutral"
                        >
                          {isHidden ? 'Hiện' : 'Ẩn'}
                        </button>
                        <button
                          onClick={() => handleDelete(fb._id)}
                          className="fb-action-btn fb-action-btn--danger"
                        >
                          Xóa
                        </button>
                      </>
                    )}
                    {!isAdminOrStaff && isOwn && (
                      <div className="fb-menu-wrap" onClick={e => e.stopPropagation()}>
                        <button
                          className="fb-menu-btn"
                          onClick={() => setOpenMenuId(openMenuId === fb._id ? null : fb._id)}
                          aria-label="Tùy chọn"
                          title="Tùy chọn"
                        >
                          <span>⋮</span>
                        </button>
                        {openMenuId === fb._id && (
                          <div className="fb-menu-dropdown">
                            <button
                              className="fb-menu-item"
                              onClick={() => startEdit(fb)}
                            >
                              ✏️ Sửa đánh giá
                            </button>
                            <button
                              className="fb-menu-item fb-menu-item--danger"
                              onClick={() => { setOpenMenuId(null); handleDelete(fb._id); }}
                            >
                              🗑️ Xóa đánh giá
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Comment hoặc inline edit ── */}
                {editingId === fb._id ? (
                  <div className="fb-inline-edit">
                    <div className="fb-inline-edit-label">✏️ Chỉnh sửa đánh giá</div>
                    <div className="fb-inline-edit-stars">
                      <StarRating value={editRating} onChange={setEditRating} size="md" />
                    </div>
                    <textarea
                      className="fb-inline-edit-textarea"
                      value={editComment}
                      onChange={e => setEditComment(e.target.value)}
                      placeholder="Nhận xét của bạn..."
                      rows={3}
                      maxLength={1000}
                    />
                    <div className="fb-inline-edit-footer">
                      <label className="fb-inline-edit-anon">
                        <input
                          type="checkbox"
                          checked={editAnonymous}
                          onChange={e => setEditAnonymous(e.target.checked)}
                        />
                        Ẩn danh
                      </label>
                      <div className="fb-inline-edit-actions">
                        <button
                          className="fb-inline-btn-cancel"
                          onClick={cancelEdit}
                          disabled={editSaving}
                        >
                          Hủy
                        </button>
                        <button
                          className="fb-inline-btn-save"
                          onClick={() => saveEdit(fb)}
                          disabled={editSaving || !editRating}
                        >
                          {editSaving ? 'Đang lưu...' : '✓ Lưu'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  fb.comment && (
                    <p className="fb-comment">{fb.comment}</p>
                  )
                )}

                {/* ── Management Reply ── */}
                {fb.reply && (
                  <div className="fb-reply-block">
                    <div className="fb-reply-block-header">
                      <div className="fb-reply-block-avatar">BQL</div>
                      <div>
                        <div className="fb-reply-block-title">
                          Phản hồi từ Ban quản lý
                          <span className="fb-reply-block-author"> · {fb.reply.repliedByName}</span>
                        </div>
                        <div className="fb-reply-block-date">{formatDate(fb.reply.repliedAt)}</div>
                      </div>
                    </div>
                    <p className="fb-reply-block-text">{fb.reply.text}</p>
                  </div>
                )}

                {/* ── Reply form (admin/staff only) ── */}
                {isAdminOrStaff && (
                  <div className="fb-reply-form-wrap">
                    <ReplyBox
                      feedbackId={fb._id}
                      existingReply={fb.reply?.text}
                      onSaved={load}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Confirmation modal ── */}
      {confirmDeleteId && (
        <div className="fb-confirm-overlay" onClick={() => setConfirmDeleteId(null)}>
          <div className="fb-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="fb-confirm-icon">🗑️</div>
            <div className="fb-confirm-title">Xóa đánh giá?</div>
            <p className="fb-confirm-desc">Đánh giá sẽ bị xóa vĩnh viễn và không thể khôi phục.</p>
            <div className="fb-confirm-actions">
              <button
                className="fb-confirm-btn-cancel"
                onClick={() => setConfirmDeleteId(null)}
              >
                Hủy
              </button>
              <button
                className="fb-confirm-btn-delete"
                onClick={executeDelete}
              >
                🗑️ Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
