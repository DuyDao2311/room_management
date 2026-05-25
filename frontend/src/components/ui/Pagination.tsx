interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <div className="pagination-container">
      <button
        className="pagination-btn"
        onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
        disabled={currentPage === 1}
        title="Trang trước"
      >
        &lsaquo;
      </button>

      {Array.from({ length: totalPages }).map((_, i) => (
        <button
          key={i + 1}
          className={`pagination-btn ${currentPage === i + 1 ? 'active' : ''}`}
          onClick={() => onPageChange(i + 1)}
        >
          {i + 1}
        </button>
      ))}

      <button
        className="pagination-btn"
        onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
        disabled={currentPage === totalPages}
        title="Trang sau"
      >
        &rsaquo;
      </button>
    </div>
  )
}
