import { useState, useRef, useEffect } from 'react'
import api from '../../api/axios'
import { MdOutlineDeleteOutline } from "react-icons/md";
import { useAuth } from '../../contexts/AuthContext';

interface Message {
  id: string
  role: 'user' | 'ai'
  content: string
  rooms?: RoomSuggestion[]
  timestamp: Date
}

interface RoomSuggestion {
  _id: string
  name: string
  address: string
  price: number
  area?: number
  type?: string
  status?: string
  images?: any[]
}

const QUICK_SUGGESTIONS = [
  '🏠 Tìm phòng giá rẻ dưới 3 triệu',
  '📍 Tìm phòng gần vị trí của tôi',
  '🛋️ Phòng full nội thất',
  '👥 Phòng cho 2 người ở',
]

function TypingIndicator() {
  return (
    <div className="chat-msg chat-msg--ai">
      <div className="chat-avatar chat-avatar--ai">🤖</div>
      <div className="chat-bubble chat-bubble--ai typing-indicator">
        <span></span><span></span><span></span>
      </div>
    </div>
  )
}

function RoomCard({ room }: { room: RoomSuggestion }) {
  const img = room.images?.[0]?.url || room.images?.[0] || 'https://vinhomeoceanpark.net/wp-content/uploads/khong-sang-song-hien-dai-tien-ich-tai-studio-vinhomes-ocean-park.jpg'
  return (
    <a href={`/rooms/${room._id}`} target="_blank" rel="noreferrer" className="chat-room-card">
      <div className="chat-room-img">
        {img
          ? <img src={img} alt={room.name} />
          : <div className="chat-room-img-placeholder">🏠</div>
        }
        <span className={`chat-room-badge ${room.status === 'available' ? 'badge-avail' : 'badge-full'}`}>
          {room.status === 'available' ? 'Còn trống' : 'Đã thuê'}
        </span>
      </div>
      <div className="chat-room-info">
        <p className="chat-room-name">{room.name}</p>
        <p className="chat-room-addr">📍 {room.address}</p>
        <p className="chat-room-price">
          {room.price.toLocaleString('vi-VN')}
          <span>đ/tháng</span>
        </p>
        {room.area && <p className="chat-room-meta">📐 {room.area} m²</p>}
      </div>
    </a>
  )
}

function ChatMessage({ msg }: { msg: Message }) {
  const isAI = msg.role === 'ai'

  // Format markdown-like text (bold, bullet)
  const formatText = (text: string) => {
    const lines = text.split('\n')
    return lines.map((line, i) => {
      const formattedLine = line
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.*?)__/g, '<em>$1</em>')
      const isBullet = line.trimStart().startsWith('- ') || line.trimStart().startsWith('• ')
      return (
        <span key={i} className={isBullet ? 'chat-bullet' : undefined}>
          <span dangerouslySetInnerHTML={{ __html: formattedLine || '&nbsp;' }} />
          {i < lines.length - 1 && <br />}
        </span>
      )
    })
  }

  return (
    <div className={`chat-msg ${isAI ? 'chat-msg--ai' : 'chat-msg--user'}`}>
      {isAI && <div className="chat-avatar chat-avatar--ai">🤖</div>}
      <div className={`chat-bubble ${isAI ? 'chat-bubble--ai' : 'chat-bubble--user'}`}>
        {formatText(msg.content)}
        {msg.rooms && msg.rooms.length > 0 && (
          <div className="chat-room-list">
            {msg.rooms.map(r => <RoomCard key={r._id} room={r} />)}
          </div>
        )}
        <span className="chat-time">
          {msg.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      {!isAI && <div className="chat-avatar chat-avatar--user">👤</div>}
    </div>
  )
}

export default function ChatBox() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init',
      role: 'ai',
      content: 'Xin chào! 👋 Em có thể giúp được gì cho anh/chị:\n- 🔍 Tìm kiếm phòng theo khu vực & ngân sách\n- 💬 Tư vấn phòng phù hợp với nhu cầu\n- 📋 Giải đáp thắc mắc về hợp đồng, giá cả\nAnh/chị muốn tìm phòng như thế nào ạ?',
      timestamp: new Date(),
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<{ role: string; content: string }[]>([])
  const [unread, setUnread] = useState(0)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setUnread(0)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || loading) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    const newHistory = [...history, { role: 'user', content }]

    try {
      const res = await api.post('/chat', {
        message: content,
        history: newHistory,
        userAddress: user?.address || null,
      })

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: res.data.text || 'Hệ thống chưa hiểu rõ yêu cầu, anh/chị có thể nói rõ hơn không ạ?',
        rooms: res.data.rooms || [],
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, aiMsg])
      setHistory([...newHistory, { role: 'ai', content: aiMsg.content }])

      if (!open) setUnread(u => u + 1)
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: '⚠️ Xin lỗi, hệ thống đang gặp sự cố. Anh/chị vui lòng thử lại sau ạ!',
        timestamp: new Date(),
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => {
    setMessages([{
      id: 'init-reset',
      role: 'ai',
      content: 'Cuộc hội thoại đã được làm mới! 🔄 Hệ thống sẵn sàng hỗ trợ anh/chị tìm phòng ạ.',
      timestamp: new Date(),
    }])
    setHistory([])
  }

  return (
    <>
      {/* Floating button */}
      <button
        id="chat-toggle-btn"
        className={`chat-fab ${open ? 'chat-fab--active' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label="Mở chat AI"
      >
        <span className="chat-fab-icon">{open ? '✕' : '💬'}</span>
        {!open && unread > 0 && (
          <span className="chat-fab-badge">{unread}</span>
        )}
        {!open && (
          <span className="chat-fab-label">Tư vấn</span>
        )}
      </button>

      {/* Chat window */}
      <div className={`chat-window ${open ? 'chat-window--open' : ''}`} id="chat-window">
        {/* Header */}
        <div className="chat-header">
          <div className="chat-header-info">
            <div className="chat-header-avatar">
              <span>🤖</span>
              <span className="chat-online-dot"></span>
            </div>
            <div>
              <p className="chat-header-name">Hỗ trợ</p>
              <p className="chat-header-sub">Phòng trọ DTT</p>
            </div>
          </div>
          <div className="chat-header-actions">
            <button onClick={clearChat} className="chat-icon-btn" title="Làm mới chat"><MdOutlineDeleteOutline size={30} /></button>
            <button onClick={() => setOpen(false)} className="chat-icon-btn" title="Đóng">✕</button>
          </div>
        </div>

        {/* Messages area */}
        <div className="chat-body" id="chat-body">
          {messages.map(msg => (
            <ChatMessage key={msg.id} msg={msg} />
          ))}
          {loading && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick suggestions (hiện khi chỉ có 1 tin nhắn init) */}
        {messages.length === 1 && !loading && (
          <div className="chat-suggestions">
            {QUICK_SUGGESTIONS.map((s, i) => (
              <button key={i} className="chat-suggestion-btn" onClick={() => sendMessage(s)}>
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="chat-footer">
          <input
            ref={inputRef}
            id="chat-input"
            className="chat-input"
            type="text"
            placeholder="Nhập yêu cầu tìm phòng..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={loading}
            maxLength={500}
          />
          <button
            id="chat-send-btn"
            className={`chat-send-btn ${input.trim() && !loading ? 'chat-send-btn--active' : ''}`}
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            aria-label="Gửi tin nhắn"
          >
            {loading ? (
              <span className="chat-send-spinner"></span>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Backdrop (mobile) */}
      {open && <div className="chat-backdrop" onClick={() => setOpen(false)} />}
    </>
  )
}
