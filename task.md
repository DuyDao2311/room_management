# Task: Migrate Frontend → React

## Phase 1 — Setup
- `[/]` Cài React packages
- `[ ]` Tạo vite.config.ts
- `[ ]` Cập nhật tsconfig.json (thêm jsx)
- `[ ]` Cập nhật index.html

## Phase 2 — Cấu trúc & Core
- `[ ]` Tạo main.tsx (entry point)
- `[ ]` Tạo App.tsx (Router)
- `[ ]` Tạo api/axios.ts
- `[ ]` Tạo contexts/AuthContext.tsx
- `[ ]` Tạo components/layout/Header.tsx
- `[ ]` Tạo components/layout/Footer.tsx
- `[ ]` Tạo components/ui/ (Button, Badge, Spinner)

## Phase 3 — Pages
- `[ ]` pages/public/Home.tsx (migrate từ main.ts)
- `[ ]` pages/public/RoomList.tsx
- `[ ]` pages/public/RoomDetail.tsx
- `[ ]` pages/auth/Login.tsx
- `[ ]` pages/auth/Register.tsx
- `[ ]` pages/admin/Dashboard.tsx
- `[ ]` pages/admin/RoomManagement.tsx
- `[ ]` pages/admin/ContractManagement.tsx
- `[ ]` pages/admin/InvoiceManagement.tsx
- `[ ]` pages/tenant/MyInvoices.tsx

## Phase 4 — Polish & Verify
- `[ ]` Cập nhật index.css (bổ sung styles mới)
- `[ ]` npm run build — kiểm tra không lỗi
- `[ ]` Xóa file thừa (counter.ts, main.ts cũ)
