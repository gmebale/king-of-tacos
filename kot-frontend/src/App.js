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
import AdminMobileMoney from './Pages/AdminMobileMoney';
import StaffOrderStart from './Pages/StaffOrderStart';

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
          <Route path="/admin/dashboard" element={<ProtectedRoute requiredPermission="dashboard"><Layout currentPageName="AdminDashboard"><AdminDashboard /></Layout></ProtectedRoute>} />
          <Route path="/admin/orders" element={<ProtectedRoute requiredPermission="orders"><Layout currentPageName="AdminOrders"><AdminOrders /></Layout></ProtectedRoute>} />
          <Route path="/admin/new-order" element={<ProtectedRoute requiredRoles={['serveur']}><Layout currentPageName="NewRestaurantOrder"><StaffOrderStart /></Layout></ProtectedRoute>} />
          <Route path="/admin/kitchen" element={<ProtectedRoute requiredPermission="kitchen"><Layout currentPageName="KitchenMode"><KitchenMode /></Layout></ProtectedRoute>} />
          <Route path="/admin/kitchen-hot" element={<ProtectedRoute requiredPermissions={['kitchen_hot', 'kitchen']}><Layout currentPageName="KitchenHotMode"><KitchenMode station="cuisine_chaude" /></Layout></ProtectedRoute>} />
          <Route path="/admin/kitchen-cold" element={<ProtectedRoute requiredPermissions={['kitchen_cold', 'kitchen']}><Layout currentPageName="KitchenColdMode"><KitchenMode station="cuisine_froide" /></Layout></ProtectedRoute>} />
          <Route path="/admin/bar" element={<ProtectedRoute requiredRoles={['admin', 'bar']}><Layout currentPageName="BarMode"><KitchenMode station="bar" /></Layout></ProtectedRoute>} />
          <Route path="/admin/cashier" element={<ProtectedRoute requiredPermission="cashier"><Layout currentPageName="CashierMode"><CashierMode /></Layout></ProtectedRoute>} />
          <Route path="/admin/finance" element={<ProtectedRoute requiredPermission="finance"><Layout currentPageName="AdminFinance"><AdminFinance /></Layout></ProtectedRoute>} />
          <Route path="/admin/mobile-money" element={<ProtectedRoute requiredPermission="cashier"><Layout currentPageName="AdminMobileMoney"><AdminMobileMoney /></Layout></ProtectedRoute>} />
          <Route path="/admin/stock" element={<ProtectedRoute requiredPermission="stock"><Layout currentPageName="AdminStock"><AdminStock /></Layout></ProtectedRoute>} />
          <Route path="/admin/staff" element={<ProtectedRoute requiredRoles={['admin']}><Layout currentPageName="AdminStaff"><AdminStaff /></Layout></ProtectedRoute>} />
          <Route path="/admin/loyalty" element={<ProtectedRoute requiredPermission="loyalty"><Layout currentPageName="AdminLoyalty"><AdminLoyalty /></Layout></ProtectedRoute>} />
          <Route path="/admin/settings" element={<ProtectedRoute requiredPermission="settings"><Layout currentPageName="AdminSettings"><AdminSettings /></Layout></ProtectedRoute>} />
          <Route path="/admin/reviews" element={<ProtectedRoute requiredPermission="reviews"><Layout currentPageName="AdminReviews"><AdminReviews /></Layout></ProtectedRoute>} />
          <Route path="/login" element={<Layout currentPageName="Auth"><Login /></Layout>} />
          <Route path="/register" element={<Layout currentPageName="Auth"><Register /></Layout>} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
