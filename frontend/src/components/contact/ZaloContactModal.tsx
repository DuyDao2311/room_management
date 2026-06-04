import React, { useState, useEffect } from 'react';
import { Modal, Button, Avatar, Typography, message, Skeleton } from 'antd';
import { PhoneOutlined, MessageOutlined, CopyOutlined } from '@ant-design/icons';
import QRCode from 'react-qr-code';

const { Title, Text } = Typography;

interface ZaloContactModalProps {
  open: boolean;
  onClose: () => void;
  customer: {
    fullName: string;
    phone: string;
    avatar?: string;
  };
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ZaloContactModal Error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'white', zIndex: 9999, padding: 20, color: 'red' }}>
          <h2>Something went wrong in ZaloContactModal.</h2>
          <pre>{this.state.error?.message}</pre>
          <pre>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function ZaloContactModal(props: ZaloContactModalProps) {
  return (
    <ErrorBoundary>
      <ZaloContactModalContent {...props} />
    </ErrorBoundary>
  );
}

function ZaloContactModalContent({ open, onClose, customer }: ZaloContactModalProps) {
  const [loading, setLoading] = useState(false);

  // Giả lập loading skeleton mượt mà trong 500ms
  useEffect(() => {
    if (open) {
      setLoading(true);
      const timer = setTimeout(() => setLoading(false), 500);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const zaloUrl = `https://zalo.me/${customer.phone}`;

  const handleCopy = () => {
    if (!customer.phone) return;
    navigator.clipboard.writeText(customer.phone)
      .then(() => {
        message.success("Đã sao chép số điện thoại");
      })
      .catch(() => {
        message.error("Lỗi khi sao chép");
      });
  };

  const handleCall = () => {
    if (!customer.phone) return;
    window.open(`tel:${customer.phone}`);
  };

  const handleZaloChat = () => {
    if (!customer.phone) return;
    window.open(zaloUrl, "_blank");
  };

  // Lấy chữ cái đầu của tên để làm avatar mặc định
  const getInitials = (name: string) => {
    if (!name) return "KH";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 1).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  return (
    <Modal
      title={<div style={{ textAlign: 'center', fontSize: '18px', fontWeight: 600 }}>Liên hệ khách hàng</div>}
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width={400}
      styles={{ body: { padding: '24px 20px' } }}
      className="zalo-contact-modal"
    >
      {loading ? (
        <Skeleton avatar active paragraph={{ rows: 2 }} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          {customer.phone ? (
            <>
              {/* Thông tin khách hàng */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <Avatar size={64} src={customer.avatar} style={{ backgroundColor: '#1890ff', fontSize: '24px' }}>
                  {!customer.avatar && getInitials(customer.fullName)}
                </Avatar>
                <Title level={4} style={{ margin: 0 }}>{customer.fullName}</Title>
                <Text type="secondary" style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <PhoneOutlined /> {customer.phone}
                </Text>
              </div>

              {/* QR Code */}
              <div style={{
                padding: '16px',
                background: '#fff',
                borderRadius: '16px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                border: '1px solid #f0f0f0',
                width: 'fit-content',
                marginTop: '8px',
                marginBottom: '8px'
              }}>
                {React.createElement((QRCode as any).default || (QRCode as any).QRCode || QRCode, {
                  value: zaloUrl,
                  size: 180,
                  level: "H"
                })}
              </div>
              <Text strong style={{ textAlign: 'center', color: '#1890ff' }}>
                Quét mã bằng Zalo để nhắn tin
              </Text>
            </>
          ) : (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <Text type="secondary">Khách hàng không có số điện thoại</Text>
            </div>
          )}

          {/* Các nút hành động */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            gap: '12px',
            marginTop: '16px'
          }}>
            <Button
              type="primary"
              size="large"
              icon={<MessageOutlined />}
              onClick={handleZaloChat}
              style={{ borderRadius: '8px', height: '48px', backgroundColor: '#0068ff' }}
              disabled={!customer.phone}
            >
              Chat Zalo
            </Button>

            <div style={{ display: 'flex', gap: '12px' }}>
              <Button
                size="large"
                icon={<PhoneOutlined />}
                onClick={handleCall}
                style={{ flex: 1, borderRadius: '8px' }}
                disabled={!customer.phone}
              >
                Gọi điện
              </Button>
              <Button
                size="large"
                icon={<CopyOutlined />}
                onClick={handleCopy}
                style={{ flex: 1, borderRadius: '8px' }}
                disabled={!customer.phone}
              >
                Copy SĐT
              </Button>
            </div>

            {/* <Button 
              size="large" 
              icon={<CloseOutlined />} 
              onClick={onClose}
              style={{ borderRadius: '8px', marginTop: '4px' }}
            >
              Đóng modal
            </Button> */}
          </div>
        </div>
      )}
    </Modal>
  );
}
