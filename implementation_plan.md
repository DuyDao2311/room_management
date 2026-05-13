# Migrate Frontend sang React + Xây dựng Backend API

## Mô tả

Dự án **Phòng Trọ DTT** hiện có:
- **Frontend**: Vite + vanilla TypeScript, UI landing page hardcode, chưa routing thực
- **Backend**: Express + MongoDB kết nối, nhưng chưa có route/model/middleware nào

Mục tiêu: Chuyển frontend thành **React (TSX) với react-router-dom**, đồng thời xây dựng backend đủ để frontend hoạt động được.

---

## User Review Required

> [!IMPORTANT]
> Dự án này là **Đồ án tốt nghiệp** — tôi sẽ thiết kế cấu trúc chuẩn, có đủ tính năng core của một hệ thống quản lý phòng trọ. Bạn hãy xác nhận danh sách tính năng bên dưới trước khi tôi bắt đầu.

> [!WARNING]
> File `src/main.ts` và `src/counter.ts` sẽ bị **xóa/thay thế** hoàn toàn. CSS hiện tại (`style.css`) sẽ được **giữ lại và mở rộng**.

---

## Phạm vi tính năng (MVP)

### 👤 Auth
- Đăng ký / Đăng nhập (JWT)
- Phân quyền: **Admin** (chủ trọ) và **Tenant** (khách thuê)

### 🏠 Phòng (Rooms)
- Admin: CRUD phòng (tên, giá, diện tích, trạng thái, ảnh)
- Public: Xem danh sách, tìm kiếm, lọc phòng
- Chi tiết phòng

### 📋 Hợp đồng (Contracts)
- Admin: Tạo hợp đồng thuê (gán phòng + khách)
- Admin: Xem, cập nhật, kết thúc hợp đồng

### 💰 Hóa đơn (Invoices)
- Admin: Tạo hóa đơn điện/nước/dịch vụ hằng tháng
- Tenant: Xem hóa đơn của mình

### 📊 Dashboard Admin
- Thống kê: số phòng trống/đã thuê, doanh thu tháng, số hợp đồng hoạt động

---

## Proposed Changes

### Phase 1 — Setup React Frontend

#### [MODIFY] [package.json](file:///e:/Đồ%20án%20tốt%20nghiệp/room_management/frontend/package.json)
Thêm: `react`, `react-dom`, `@types/react`, `@types/react-dom`, `@vitejs/plugin-react`
Xóa không cần thiết: không có gì cần xóa, giữ `axios` và `react-router-dom`

#### [NEW] vite.config.ts
Cấu hình Vite với `@vitejs/plugin-react` plugin

#### [MODIFY] [tsconfig.json](file:///e:/Đồ%20án%20tốt%20nghiệp/room_management/frontend/tsconfig.json)
Thêm `"jsx": "react-jsx"` vào `compilerOptions`

#### [MODIFY] [index.html](file:///e:/Đồ%20án%20tốt%20nghiệp/room_management/frontend/index.html)
Đổi script src từ `main.ts` → `main.tsx`, thêm SEO meta tags

---

### Phase 2 — Cấu trúc React

```
src/
├── main.tsx                  # entry point
├── App.tsx                   # Router setup
├── index.css                 # CSS giữ lại + bổ sung
├── api/
│   └── axios.ts              # axios instance với baseURL
├── contexts/
│   └── AuthContext.tsx        # global auth state (JWT)
├── components/
│   ├── layout/
│   │   ├── Header.tsx
│   │   └── Footer.tsx
│   └── ui/
│       ├── Button.tsx
│       ├── Badge.tsx
│       └── Spinner.tsx
└── pages/
    ├── public/
    │   ├── Home.tsx           # Landing page (migrate từ main.ts)
    │   ├── RoomList.tsx       # Danh sách phòng (public)
    │   └── RoomDetail.tsx     # Chi tiết phòng
    ├── auth/
    │   ├── Login.tsx
    │   └── Register.tsx
    ├── admin/
    │   ├── Dashboard.tsx
    │   ├── RoomManagement.tsx
    │   ├── ContractManagement.tsx
    │   └── InvoiceManagement.tsx
    └── tenant/
        └── MyInvoices.tsx
```

---

### Phase 3 — Backend API (Express + MongoDB)

```
backend/
├── server.js (mở rộng: middleware, routes)
├── config/
│   └── db.js (giữ nguyên)
├── models/
│   ├── User.js
│   ├── Room.js
│   ├── Contract.js
│   └── Invoice.js
├── routes/
│   ├── auth.js        POST /api/auth/register, POST /api/auth/login
│   ├── rooms.js       GET/POST/PUT/DELETE /api/rooms
│   ├── contracts.js   GET/POST/PUT /api/contracts
│   └── invoices.js    GET/POST /api/invoices
└── middleware/
    └── auth.js        verifyToken middleware
```

---

## Routing Plan (Frontend)

| Path | Component | Auth |
|------|-----------|------|
| `/` | `Home` | Public |
| `/rooms` | `RoomList` | Public |
| `/rooms/:id` | `RoomDetail` | Public |
| `/login` | `Login` | Public |
| `/register` | `Register` | Public |
| `/admin` | `Dashboard` | Admin only |
| `/admin/rooms` | `RoomManagement` | Admin only |
| `/admin/contracts` | `ContractManagement` | Admin only |
| `/admin/invoices` | `InvoiceManagement` | Admin only |
| `/my-invoices` | `MyInvoices` | Tenant only |

---

## Verification Plan

### Automated Tests
- `npm run build` — đảm bảo TypeScript compile không lỗi
- `npm run dev` — kiểm tra app chạy trên localhost:5173

### Manual Verification
- Kiểm tra navigation giữa các trang
- Đăng ký / đăng nhập hoạt động
- Admin tạo phòng, xem dashboard
- Tenant xem hóa đơn
- Responsive trên mobile

---

## Thứ tự thực hiện

1. ✅ Install React packages
2. ✅ Setup Vite config + tsconfig
3. ✅ Tạo cấu trúc thư mục + entry point
4. ✅ AuthContext + axios instance
5. ✅ Layout components (Header, Footer)
6. ✅ Migrate Home page từ main.ts
7. ✅ Backend: Models + Routes + Middleware
8. ✅ Auth pages (Login, Register)
9. ✅ Admin pages
10. ✅ Tenant pages
