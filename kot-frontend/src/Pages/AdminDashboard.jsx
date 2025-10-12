import React, { useState, useEffect } from "react";
import { Order } from "../Entities/Order";
import { Product } from "../Entities/Product";
import { User } from "../Entities/User";
import { motion } from "framer-motion";
import { 
  TrendingUp, 
  ShoppingCart, 
  Package, 
  AlertCircle,
  Euro,
  Users,
  Clock
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../Components/ui/card";
import { Badge } from "../Components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import StatCard from '../Components/admin/StatCard';
import RecentOrdersWidget from '../Components/admin/RecentOrdersWidget';
import LowStockWidget from '../Components/admin/LowStockWidget';
import RevenueStatsWidget from '../Components/admin/RevenueStatsWidget'; // Added import

export default function AdminDashboard() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState({
    todayRevenue: 0,
    todayOrders: 0,
    pendingOrders: 0,
    lowStockItems: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    
    const [allOrders, allProducts] = await Promise.all([
      Order.list("-created_date"),
      Product.list()
    ]);

    setOrders(allOrders);
    setProducts(allProducts);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayOrders = allOrders.filter(order => {
      const orderDate = new Date(order.created_date);
      return orderDate >= today;
    });

    const todayRevenue = todayOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
    const pendingOrders = allOrders.filter(o => o.status === "en_attente" || o.status === "en_preparation").length;
    const lowStockItems = allProducts.filter(p => p.stock <= p.stock_alert_threshold).length;

    setStats({
      todayRevenue,
      todayOrders: todayOrders.length,
      pendingOrders,
      lowStockItems
    });

    setIsLoading(false);
  };

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
          Tableau de Bord
        </h1>
        <p className="text-gray-600">
          Bienvenue sur votre espace d'administration
        </p>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Chiffre du jour"
          value={`${stats.todayRevenue.toLocaleString()} FCFA`}
          icon={Euro}
          color="from-green-500 to-emerald-600"
          trend="+12%"
          isLoading={isLoading}
        />
        <StatCard
          title="Commandes du jour"
          value={stats.todayOrders}
          icon={ShoppingCart}
          color="from-blue-500 to-indigo-600"
          isLoading={isLoading}
        />
        <StatCard
          title="En attente"
          value={stats.pendingOrders}
          icon={Clock}
          color="from-yellow-500 to-amber-600"
          isLoading={isLoading}
        />
        <StatCard
          title="Alertes stock"
          value={stats.lowStockItems}
          icon={AlertCircle}
          color="from-red-500 to-rose-600"
          alert={stats.lowStockItems > 0}
          isLoading={isLoading}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6"> {/* Added space-y-6 */}
          <RecentOrdersWidget orders={orders.slice(0, 10)} isLoading={isLoading} />
        </div>

        <div className="space-y-6"> {/* New div structure for widgets */}
          <RevenueStatsWidget orders={orders} /> {/* Added RevenueStatsWidget */}
          <LowStockWidget products={products} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}