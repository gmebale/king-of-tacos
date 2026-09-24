import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChefHat,
  Clock,
  CheckCircle,
  Package,
  Play,
  Pause,
  AlertCircle
} from "lucide-react";
import { Button } from "../Components/ui/button";
import { Badge } from "../Components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../Components/ui/card";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { formatCustomization } from "../utils/customization";
import api from "../services/api.service";

export default function KitchenMode() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingOrder, setUpdatingOrder] = useState(null);

  useEffect(() => {
    loadOrders();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadOrders = async () => {
    try {
      const response = await api.get('/kitchen/orders');
      setOrders(response.data);
    } catch (error) {
      console.error('Error loading kitchen orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    setUpdatingOrder(orderId);
    try {
      await api.put(`/kitchen/orders/${orderId}/status`, { status: newStatus });
      await loadOrders(); // Refresh orders
    } catch (error) {
      console.error('Error updating order status:', error);
    } finally {
      setUpdatingOrder(null);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'en_attente': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'en_preparation': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'prete': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'en_attente': return <Clock className="w-4 h-4" />;
      case 'en_preparation': return <Play className="w-4 h-4" />;
      case 'prete': return <CheckCircle className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'en_attente': return 'En attente';
      case 'en_preparation': return 'En préparation';
      case 'prete': return 'Prête';
      default: return status;
    }
  };

  const getNextStatus = (currentStatus) => {
    switch (currentStatus) {
      case 'en_attente': return 'en_preparation';
      case 'en_preparation': return 'prete';
      default: return null;
    }
  };

  const getNextStatusText = (currentStatus) => {
    switch (currentStatus) {
      case 'en_attente': return 'Commencer';
      case 'en_preparation': return 'Marquer prête';
      default: return null;
    }
  };

  const pendingOrders = orders.filter(o => o.status === 'en_attente');
  const preparingOrders = orders.filter(o => o.status === 'en_preparation');
  const readyOrders = orders.filter(o => o.status === 'prete');

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 p-4 md:p-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <ChefHat className="w-8 h-8 text-orange-600" />
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
            Mode Cuisine
          </h1>
        </div>
        <p className="text-gray-600">
          Gérez efficacement les commandes en cuisine
        </p>
      </motion.div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-800">En attente</p>
                <p className="text-2xl font-bold text-yellow-900">{pendingOrders.length}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-800">En préparation</p>
                <p className="text-2xl font-bold text-blue-900">{preparingOrders.length}</p>
              </div>
              <Play className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-800">Prêtes</p>
                <p className="text-2xl font-bold text-green-900">{readyOrders.length}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orders Sections */}
      <div className="space-y-8">
        {/* En Attente */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-yellow-600" />
            En Attente ({pendingOrders.length})
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {pendingOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onUpdateStatus={updateOrderStatus}
                  updatingOrder={updatingOrder}
                  getNextStatus={getNextStatus}
                  getNextStatusText={getNextStatusText}
                  getStatusColor={getStatusColor}
                  getStatusIcon={getStatusIcon}
                  getStatusText={getStatusText}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* En Préparation */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Play className="w-5 h-5 text-blue-600" />
            En Préparation ({preparingOrders.length})
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {preparingOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onUpdateStatus={updateOrderStatus}
                  updatingOrder={updatingOrder}
                  getNextStatus={getNextStatus}
                  getNextStatusText={getNextStatusText}
                  getStatusColor={getStatusColor}
                  getStatusIcon={getStatusIcon}
                  getStatusText={getStatusText}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Prêtes */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Prêtes ({readyOrders.length})
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {readyOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onUpdateStatus={updateOrderStatus}
                  updatingOrder={updatingOrder}
                  getNextStatus={getNextStatus}
                  getNextStatusText={getNextStatusText}
                  getStatusColor={getStatusColor}
                  getStatusIcon={getStatusIcon}
                  getStatusText={getStatusText}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

// Order Card Component
function OrderCard({ order, onUpdateStatus, updatingOrder, getNextStatus, getNextStatusText, getStatusColor, getStatusIcon, getStatusText }) {
  const nextStatus = getNextStatus(order.status);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="bg-white rounded-xl shadow-sm border-2 border-gray-100 hover:shadow-md transition-shadow"
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">
            #{order.id.slice(-6)}
          </CardTitle>
          <Badge className={`${getStatusColor(order.status)} border`}>
            {getStatusIcon(order.status)}
            <span className="ml-1">{getStatusText(order.status)}</span>
          </Badge>
        </div>
        <p className="text-sm text-gray-600">
          {format(new Date(order.created_date), 'HH:mm', { locale: fr })}
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <p className="font-medium text-gray-900">{order.customer_name}</p>
          <p className="text-sm text-gray-600">{order.customer_phone}</p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Articles:</p>
          {order.items.map((item, index) => (
            <div key={index} className="text-sm">
              <div className="flex justify-between">
                <span className="text-gray-700">
                  {item.quantity}x {item.product_name}
                </span>
              </div>
              {item.customizationSummary && (
                <div className="text-xs text-gray-500 mt-1 ml-4">
                  {item.customizationSummary}
                </div>
              )}
            </div>
          ))}
        </div>

        {order.notes && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm font-medium text-yellow-800 mb-1">Notes:</p>
            <p className="text-sm text-yellow-700">{order.notes}</p>
          </div>
        )}

        {nextStatus && (
          <Button
            onClick={() => onUpdateStatus(order.id, nextStatus)}
            disabled={updatingOrder === order.id}
            className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
          >
            {updatingOrder === order.id ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Mise à jour...
              </div>
            ) : (
              getNextStatusText(order.status)
            )}
          </Button>
        )}
      </CardContent>
    </motion.div>
  );
}
