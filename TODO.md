# TODO: Add Finance System to Admin Side

## Backend Tasks
- [x] Update schema.prisma: Add loyalty_points Int @default(0) to User model
- [ ] Run Prisma migration for loyalty_points
- [x] Update orders.js: Assign 5 loyalty points when order status changes to 'livree' or 'prete' for authenticated users
- [x] Create kot-backend/routes/finance.js with endpoints:
  - GET /api/finance/revenue: Aggregated revenue data by date (include canceled as lost revenue)
  - GET /api/finance/top-products: Top-selling products by quantity and revenue
  - GET /api/finance/top-customers: Top customers by spending and loyalty points
- [x] Register finance routes in server.js

## Frontend Tasks
- [x] Install recharts library in frontend (optional for revenue chart)
- [x] Create kot-frontend/src/Pages/AdminFinance.jsx with:
  - Summary cards for net revenue, total revenue, lost revenue
  - Date filters (default 1st to current day of month, custom picker)
  - Tables for top-selling products (quantity & revenue)
  - Tables for top customers (spending & loyalty points)
  - Print button for intelligent report (summary, tables)
  - Real-time updates (polling every 30s)
  - Admin-only access
- [x] Add route /admin/finance in App.js
- [x] Add Finances link to admin menu in Layout.js
- [ ] Test the new Finance page functionality
