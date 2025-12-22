import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  RotateCcw,
  Star,
  MessageSquare
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../Components/ui/card";
import { Button } from "../Components/ui/button";
import { Badge } from "../Components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../Components/ui/tabs";
import { Textarea } from "../Components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../Components/ui/dialog";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import api from "../services/api.service";

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(5);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const response = await api.get('/orders/my-orders');
      setOrders(response.data);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const reorder = async (orderId) => {
    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      // Create cart items from order items
      const cartItems = order.items.map(item => ({
        product_name: item.product_name,
        quantity: item.quantity,
        price: item.price
      }));

      // Add to cart and redirect to checkout
      for (const item of cartItems) {
        await api.post('/cart/add', item);
      }

      // Redirect to cart
      window.location.href = '/cart';
    } catch (error) {
      console.error('Error reordering:', error);
    }
  };

  const submitReview = async (orderId, productId) => {
    try {
      await api.post('/orders/review', {
        order_id: orderId,
        product_id: productId,
        rating: reviewRating,
        comment: reviewText
      });

      setReviewText("");
      setReviewRating(5);
      setSelectedOrder(null);
      await loadOrders(); // Refresh orders
    } catch (error) {
      console.error('Error submitting review:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'en_attente': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'en_preparation': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'prete': return 'bg-green-100 text-green-800 border-green-200';
      case 'en_livraison': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'livree': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'annulee': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'en_attente': return 'En attente';
      case 'en_preparation': return 'En préparation';
      case 'prete': return 'Prête';
      case 'en_livraison': return 'En livraison';
      case 'livree': return 'Livrée';
      case 'annulee': return 'Annulée';
      default: return 'Statut inconnu';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'en_attente': return <Clock className="w-4 h-4" />;
      case 'en_preparation': return <Package className="w-4 h-4" />;
      case 'prete': return <CheckCircle className="w-4 h-4" />;
      case 'en_livraison': return <Truck className="w-4 h-4" />;
      case 'livree': return <CheckCircle className="w-4 h-4" />;
      case 'annulee': return <XCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const activeOrders = orders.filter(order => !['livree', 'annulee'].includes(order.status));
  const completedOrders = orders.filter(order => order.status === 'livree');
  const cancelledOrders = orders.filter(order => order.status === 'annulee');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4 md:p-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <Package className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
            Mes Commandes
          </h1>
        </div>
        <p className="text-gray-600">
          Suivez vos commandes et laissez des avis
        </p>
      </motion.div>

      <Tabs defaultValue="active" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="active">
            En cours ({activeOrders.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Terminées ({completedOrders.length})
          </TabsTrigger>
          <TabsTrigger value="cancelled">
            Annulées ({cancelledOrders.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-6">
          <AnimatePresence>
            {activeOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onReorder={reorder}
                getStatusColor={getStatusColor}
                getStatusText={getStatusText}
                getStatusIcon={getStatusIcon}
                showReorder={false}
                showReview={false}
              />
            ))}
          </AnimatePresence>
          {activeOrders.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">Aucune commande en cours</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-6">
          <AnimatePresence>
            {completedOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onReorder={reorder}
                onReview={(order) => setSelectedOrder(order)}
                getStatusColor={getStatusColor}
                getStatusText={getStatusText}
                getStatusIcon={getStatusIcon}
                showReorder={true}
                showReview={true}
              />
            ))}
          </AnimatePresence>
          {completedOrders.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">Aucune commande terminée</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="cancelled" className="space-y-6">
          <AnimatePresence>
            {cancelledOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onReorder={reorder}
                getStatusColor={getStatusColor}
                getStatusText={getStatusText}
                getStatusIcon={getStatusIcon}
                showReorder={true}
                showReview={false}
              />
            ))}
          </AnimatePresence>
          {cancelledOrders.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <XCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">Aucune commande annulée</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Review Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Laisser un avis</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Note</label>
              <div className="flex gap-1 mt-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setReviewRating(star)}
                    className="focus:outline-none"
                  >
                    <Star
                      className={`w-6 h-6 ${
                        star <= reviewRating
                          ? 'text-yellow-400 fill-current'
                          : 'text-gray-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Commentaire</label>
              <Textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Partagez votre expérience..."
                className="mt-1"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => submitReview(selectedOrder.id, selectedOrder.items[0]?.product_id)}
                className="flex-1"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Publier l'avis
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedOrder(null)}
              >
                Annuler
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Order Card Component
function OrderCard({
  order,
  onReorder,
  onReview,
  getStatusColor,
  getStatusText,
  getStatusIcon,
  showReorder,
  showReview
}) {
  const total = order.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="border rounded-lg p-6 bg-white shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-900">#{order.id.slice(-6)}</h3>
          <Badge className={`${getStatusColor(order.status)} border flex items-center gap-1`}>
            {getStatusIcon(order.status)}
            {getStatusText(order.status)}
          </Badge>
        </div>
        <p className="text-sm text-gray-600">
          {format(new Date(order.created_date), 'dd/MM/yyyy HH:mm', { locale: fr })}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <p className="font-medium text-gray-900">{order.customer_name}</p>
          <p className="text-sm text-gray-600">{order.customer_phone}</p>
          {order.customer_address && (
            <p className="text-sm text-gray-600">{order.customer_address}</p>
          )}
        </div>

        <div className="text-right">
          <p className="text-lg font-bold text-green-600">{total.toLocaleString()} FCFA</p>
          <p className="text-sm text-gray-600">{order.items.length} article(s)</p>
        </div>
      </div>

      {/* Order Items */}
      <div className="space-y-2 mb-4">
        {order.items.map((item, index) => (
          <div key={index} className="flex justify-between items-center py-1 border-b border-gray-100 last:border-b-0">
            <div className="flex-1">
              <p className="font-medium text-sm">{item.product_name}</p>
              <p className="text-xs text-gray-600">Quantité: {item.quantity}</p>
            </div>
            <p className="text-sm font-medium">{(item.quantity * item.price ).toFixed(2)} FCFA</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {showReorder && (
          <Button
            onClick={() => onReorder(order.id)}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Commander à nouveau
          </Button>
        )}

        {showReview && (
          <Button
            onClick={() => onReview(order)}
            size="sm"
            className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700"
          >
            <Star className="w-4 h-4" />
            Laisser un avis
          </Button>
        )}
      </div>
    </motion.div>
  );
}
