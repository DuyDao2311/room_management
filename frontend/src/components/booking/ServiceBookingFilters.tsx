import React from 'react';
import { FiSearch, FiSliders } from 'react-icons/fi';

interface ServiceBookingFiltersProps {
  filters: {
    search: string;
    status: string;
    paymentStatus: string;
  };
  onFilterChange: (newFilters: any) => void;
}

export default function ServiceBookingFilters({ filters, onFilterChange }: ServiceBookingFiltersProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    onFilterChange({ [name]: value });
  };

  const hasActiveFilter = !!(filters.search || filters.status || filters.paymentStatus);

  const handleResetFilter = () => {
    onFilterChange({
      search: '',
      status: '',
      paymentStatus: ''
    });
  };

  return (
    <div style={{ padding: '20px 24px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
      {/* Search */}
      <div style={{ position: 'relative', flex: '1 1 220px', minWidth: '180px' }}>
        <FiSearch size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
        <input
          type="text"
          name="search"
          value={filters.search}
          onChange={handleChange}
          placeholder="Tìm dịch vụ / khách hàng..."
          style={{ width: '100%', padding: '10px 16px 10px 36px', borderRadius: '6px', border: 'none', background: '#f1f5f9', color: '#475467', outline: 'none', fontSize: '0.9rem' }}
        />
      </div>

      {/* Status */}
      <select
        name="status"
        value={filters.status}
        onChange={handleChange}
        style={{ padding: '10px 16px', borderRadius: '6px', border: 'none', background: '#f1f5f9', color: '#475467', outline: 'none', fontSize: '0.9rem' }}
      >
        <option value="">Tất cả Trạng thái</option>
        <option value="pending">Chờ xác nhận</option>
        <option value="confirmed">Đã xác nhận</option>
        <option value="completed">Đã hoàn thành</option>
        <option value="cancelled">Đã hủy</option>
      </select>

      {/* Payment Status */}
      <select
        name="paymentStatus"
        value={filters.paymentStatus}
        onChange={handleChange}
        style={{ padding: '10px 16px', borderRadius: '6px', border: 'none', background: '#f1f5f9', color: '#475467', outline: 'none', fontSize: '0.9rem' }}
      >
        <option value="">Tất cả Thanh toán</option>
        <option value="unpaid">Chưa thanh toán</option>
        <option value="paid">Đã thanh toán</option>
      </select>

      {/* Reset */}
      <button
        onClick={handleResetFilter}
        title="Xóa bộ lọc"
        style={{
          padding: '10px 14px', borderRadius: '6px', border: 'none',
          background: hasActiveFilter ? '#fee2e2' : '#f1f5f9',
          color: hasActiveFilter ? '#dc2626' : '#475467',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s'
        }}
      >
        <FiSliders size={18} />
      </button>
    </div>
  );
}
