export default function Spinner({ size = 'md', label = 'Đang tải...' }: { size?: 'sm' | 'md' | 'lg'; label?: string }) {
  return (
    <div className={`spinner-wrap spinner-${size}`} role="status" aria-label={label}>
      <div className="spinner-ring" />
      {size !== 'sm' && <p className="spinner-label">{label}</p>}
    </div>
  )
}
