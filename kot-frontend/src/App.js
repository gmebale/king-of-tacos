import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ErrorBoundary from './Components/common/ErrorBoundary';
import ProtectedRoute from './Components/common/ProtectedRoute';
import Layout from './Layout';
import Home from './Pages/Home';
import Menu from './Pages/Menu';
import Cart from './Pages/Cart';
import Checkout from './Pages/Checkout';
import Payment from './Pages/Payment';
import OrdersPage from './Pages/OrdersPage';
import OrderSuccess from './Pages/OrderSuccess';
import Profile from './Pages/Profile';
import Login from './Pages/Login';
import Register from './Pages/Register';
import AdminDashboard from './Pages/AdminDashboard';
import AdminOrders from './Pages/AdminOrders';
import AdminStock from './Pages/AdminStock';
import AdminStaff from './Pages/AdminStaff';
import AdminSettings from './Pages/AdminSettings';
import AdminFinance from './Pages/AdminFinance';
import KitchenMode from './Pages/KitchenMode';
import CashierMode from './Pages/CashierMode';
import AdminLoyalty from './Pages/AdminLoyalty';
import AdminReviews from './Pages/AdminReviews';

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<Layout currentPageName="Home"><Home /></Layout>} />
          <Route path="/menu" element={<Layout currentPageName="Menu"><Menu /></Layout>} />
          <Route path="/cart" element={<Layout currentPageName="Cart"><Cart /></Layout>} />
          <Route path="/checkout" element={<Layout currentPageName="Checkout"><Checkout /></Layout>} />
          <Route path="/payment" element={<Layout currentPageName="Payment"><Payment /></Layout>} />
          <Route path="/orders-page" element={<Layout currentPageName ="OrdersPage"><OrdersPage /></Layout>} />
          <Route path="/order-success" element={<Layout currentPageName="OrderSuccess"><OrderSuccess /></Layout>} />
          <Route path="/profile" element={<Layout currentPageName="Profile"><Profile /></Layout>} />
          <Route path="/admin/dashboard" element={<ProtectedRoute requiredRoles={['admin']}><Layout currentPageName="AdminDashboard"><AdminDashboard /></Layout></ProtectedRoute>} />
          <Route path="/admin/orders" element={<ProtectedRoute requiredRoles={['admin', 'staff']}><Layout currentPageName="AdminOrders"><AdminOrders /></Layout></ProtectedRoute>} />
          <Route path="/admin/kitchen" element={<ProtectedRoute requiredRoles={['admin', 'staff']}><Layout currentPageName="KitchenMode"><KitchenMode /></Layout></ProtectedRoute>} />
          <Route path="/admin/cashier" element={<ProtectedRoute requiredRoles={['admin']}><Layout currentPageName="CashierMode"><CashierMode /></Layout></ProtectedRoute>} />
          <Route path="/admin/finance" element={<ProtectedRoute requiredRoles={['admin']}><Layout currentPageName="AdminFinance"><AdminFinance /></Layout></ProtectedRoute>} />
          <Route path="/admin/stock" element={<ProtectedRoute requiredRoles={['admin']}><Layout currentPageName="AdminStock"><AdminStock /></Layout></ProtectedRoute>} />
          <Route path="/admin/staff" element={<ProtectedRoute requiredRoles= {['admin']}><Layout currentPageName="AdminStaff"><AdminStaff /></Layout></ProtectedRoute>} />
          <Route path="/admin/cashier" element={<ProtectedRoute requiredRoles={['admin']}><Layout currentPageName="CashierMode"><CashierMode /></Layout></ProtectedRoute>} />
          <Route path="/admin/loyalty" element={<ProtectedRoute requiredRoles={['admin']}><Layout currentPageName="AdminLoyalty"><AdminLoyalty /></Layout></ProtectedRoute>} />
          <Route path="/admin/settings" element={<ProtectedRoute requiredRoles={['admin']}><Layout currentPageName="AdminSettings"><AdminSettings /></Layout></ProtectedRoute>} />
          <Route path="/admin/reviews" element={<ProtectedRoute requiredRoles={['admin']}><Layout currentPageName="AdminReviews"><AdminReviews /></Layout></ProtectedRoute>} />
          <Route path="/login" element={<Layout currentPageName="Auth"><Login /></Layout>} />
          <Route path="/register" element={<Layout currentPageName="Auth"><Register /></Layout>} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
