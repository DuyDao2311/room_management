import React from 'react';
import { FiSearch, FiFilter } from 'react-icons/fi';

interface IncidentFiltersProps {
  filters: {
    search: string;
    category: string;
    priority: string;
    status: string;
  };
  onFilterChange: (newFilters: any) => void;
}

export default function IncidentFilters({ filters, onFilterChange }: IncidentFiltersProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    onFilterChange({ [name]: value });
  };

  const hasActiveFilter = !!(filters.search || filters.category || filters.priority || filters.status);

  const handleResetFilter = () => {
    onFilterChange({
      search: '',
      category: '',
      priority: '',
      status: ''
    });
  };

  return (
    <div className="incident-filters-wrapper">
      <div className="incident-filter-search">
        <FiSearch size={16} className="incident-filter-icon" />
        <input
          type="text"
          name="search"
          value={filters.search}
          onChange={handleChange}
          placeholder="Tìm theo mã sự cố, tên phòng..."
          className="incident-filter-input"
        />
      </div>

      <div className="incident-filter-select-wrapper">
        <FiFilter size={16} className="incident-filter-icon" />
        <select
          name="category"
          value={filters.category}
          onChange={handleChange}
          className="incident-filter-select with-icon"
        >
          <option value="">Tất cả loại sự cố</option>
          <option value="Điện">Sự cố về Điện</option>
          <option value="Nước">Sự cố về Nước</option>
          <option value="Nội thất">Hư hỏng Nội thất</option>
          <option value="Khác">Khác</option>
        </select>
      </div>

      <select
        name="priority"
        value={filters.priority}
        onChange={handleChange}
        className="incident-filter-select"
      >
        <option value="">Mức độ</option>
        <option value="Thấp">Thấp</option>
        <option value="Bình thường">Bình thường</option>
        <option value="Cao">Cao</option>
        <option value="Khẩn cấp">Khẩn cấp</option>
      </select>

      <select
        name="status"
        value={filters.status}
        onChange={handleChange}
        className="incident-filter-select"
      >
        <option value="">Trạng thái</option>
        <option value="pending">Chờ xử lý</option>
        <option value="assigned">Đã tiếp nhận</option>
        <option value="in_progress">Đang xử lý</option>
        <option value="resolved">Đã xử lý</option>
        <option value="closed">Đóng</option>
        <option value="rejected">Từ chối</option>
      </select>

      <button
        onClick={handleResetFilter}
        title="Xóa bộ lọc"
        className={`incident-filter-reset ${hasActiveFilter ? 'active' : ''}`}
      >
        <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="18" width="18" xmlns="http://www.w3.org/2000/svg"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
      </button>
    </div>
  );
}
