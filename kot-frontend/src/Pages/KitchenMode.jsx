import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChefHat,
  Coffee,
  Clock,
  CheckCircle,
  Play,
  Volume2,
  VolumeX
} from "lucide-react";
import { Button } from "../Components/ui/button";
import { Badge } from "../Components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../Components/ui/card";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import api from "../services/api.service";

const STATION_LABELS = {
  bar: 'Bar',
  cuisine_chaude: 'Cuisine chaude',
  cuisine_froide: 'Cuisine froide'
};

export default function KitchenMode({ station = 'cuisine_chaude' }) {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingOrder, setUpdatingOrder] = useState(null);
  const [isSoundEnabled, setIsSoundEnabled] = useState(false);
  const [soundError, setSoundError] = useState('');
  const audioContextRef = useRef(null);
  const soundEnabledRef = useRef(false);
  const knownItemIdsRef = useRef(null);

  useEffect(() => {
    loadOrders();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadOrders, 30000);
    return () => clearInterval(interval);
  }, [station]);

  const loadOrders = async () => {
    try {
      const response = await api.get('/kitchen/orders', { params: { station } });
      const nextOrders = response.data;
      const nextItemIds = new Set(
        nextOrders.flatMap(order => order.items.map(item => String(item.id)))
      );
      const knownItemIds = knownItemIdsRef.current;

      if (
        knownItemIds &&
        soundEnabledRef.current &&
        [...nextItemIds].some(itemId => !knownItemIds.has(itemId))
      ) {
        playOrderAlert();
      }

      knownItemIdsRef.current = nextItemIds;
      setOrders(nextOrders);
    } catch (error) {
      console.error('Error loading kitchen orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const playOrderAlert = async () => {
    const audioContext = audioContextRef.current;
    if (!audioContext) return;

    try {
      if (audioContext.state !== 'running') {
        await audioContext.resume();
      }

      const oscillator = audioContext.createOscillator();
      const volume = audioContext.createGain();
      const now = audioContext.currentTime;

      oscillator.frequency.setValueAtTime(880, now);
      volume.gain.setValueAtTime(0.0001, now);
      volume.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
      volume.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
      oscillator.connect(volume);
      volume.connect(audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.45);
      setSoundError('');
    } catch (error) {
      console.error('Error playing kitchen order alert:', error);
      soundEnabledRef.current = false;
      setIsSoundEnabled(false);
      setSoundError("Le son a été bloqué. Veuillez l'activer à nouveau.");
    }
  };

  const toggleOrderSound = async () => {
    if (soundEnabledRef.current) {
      soundEnabledRef.current = false;
      setIsSoundEnabled(false);
      setSoundError('');
      return;
    }

    if (!window.AudioContext) {
      setSoundError("La lecture audio n'est pas prise en charge par ce navigateur.");
      return;
    }

    try {
      const audioContext = audioContextRef.current || new window.AudioContext();
      await audioContext.resume();
      audioContextRef.current = audioContext;
      soundEnabledRef.current = true;
      setIsSoundEnabled(true);
      setSoundError('');
    } catch (error) {
      console.error('Error enabling kitchen order alerts:', error);
      setSoundError("Impossible d'activer le son. Vérifiez les réglages du navigateur.");
    }
  };

  const updateItemStatus = async (orderId, itemId, newStatus) => {
    setUpdatingOrder(itemId);
    try {
      await api.put(`/kitchen/orders/${orderId}/items/${itemId}/status`, { status: newStatus });
      await loadOrders();
    } catch (error) {
      console.error('Error updating preparation item:', error);
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

  const getStatusText = (status) => {
    switch (status) {
      case 'en_attente': return 'En attente';
      case 'en_preparation': return 'En préparation';
      case 'prete': return 'Prête';
      default: return status;
    }
  };

  const stationItems = orders.flatMap(order => order.items.map(item => ({ ...item, order })));
  const pendingCount = stationItems.filter(item => item.preparation_status === 'en_attente').length;
  const preparingCount = stationItems.filter(item => item.preparation_status === 'en_preparation').length;
  const readyCount = stationItems.filter(item => item.preparation_status === 'prete').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 p-4 md:p-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
      >
        <div className="flex items-center gap-3 mb-2">
          {station === 'bar' ? <Coffee className="w-8 h-8 text-orange-600" /> : <ChefHat className="w-8 h-8 text-orange-600" />}
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
            {STATION_LABELS[station]}
          </h1>
        </div>
        <p className="text-gray-600">
          Traitez les articles attribués à ce poste. Une commande passe à « prête » lorsque tous ses articles sont terminés.
        </p>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <Button
            type="button"
            variant={isSoundEnabled ? 'default' : 'outline'}
            aria-pressed={isSoundEnabled}
            onClick={toggleOrderSound}
            className={isSoundEnabled ? 'bg-green-600 text-white hover:bg-green-700' : ''}
          >
            {isSoundEnabled ? <Volume2 className="mr-2 h-4 w-4" /> : <VolumeX className="mr-2 h-4 w-4" />}
            {isSoundEnabled ? 'Son activé' : 'Activer le son'}
          </Button>
          {soundError && <p role="alert" className="text-sm text-red-600">{soundError}</p>}
        </div>
      </motion.div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-800">Articles en attente</p>
                <p className="text-2xl font-bold text-yellow-900">{pendingCount}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-800">Articles en préparation</p>
                <p className="text-2xl font-bold text-blue-900">{preparingCount}</p>
              </div>
              <Play className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-800">Articles prêts</p>
                <p className="text-2xl font-bold text-green-900">{readyCount}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Commandes avec des articles pour {STATION_LABELS[station]} ({orders.length})
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {orders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                updatingOrder={updatingOrder}
                onUpdateItemStatus={updateItemStatus}
                getStatusColor={getStatusColor}
                getStatusText={getStatusText}
              />
            ))}
          </AnimatePresence>
        </div>
        {!isLoading && orders.length === 0 && (
          <div className="rounded-xl border border-dashed bg-white p-10 text-center text-gray-500">
            Aucune commande à traiter sur ce poste.
          </div>
        )}
      </section>
    </div>
  );
}

// Order Card Component
function OrderCard({ order, onUpdateItemStatus, updatingOrder, getStatusColor, getStatusText }) {
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
            #{order.order_code || order.id.slice(-6)}
          </CardTitle>
          <Badge className={`${getStatusColor(order.status)} border`}>
            {getStatusText(order.status)}
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
          {order.table_number && <p className="text-sm text-gray-600">Table {order.table_number}</p>}
          {order.service_location && <p className="text-sm text-gray-600">Lieu : {order.service_location_name || order.service_location}</p>}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Articles:</p>
          {order.items.map((item) => {
            const nextStatus = item.preparation_status === 'en_attente'
              ? 'en_preparation'
              : item.preparation_status === 'en_preparation' ? 'prete' : null;
            const buttonLabel = item.preparation_status === 'en_attente' ? 'Commencer' : 'Marquer prêt';
            return <div key={item.id} className="rounded-lg border p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="text-gray-700">{item.quantity}x {item.product_name}</span>
                <Badge className={`${getStatusColor(item.preparation_status)} border`}>{getStatusText(item.preparation_status)}</Badge>
              </div>
              {item.customizationSummary && (
                <div className="text-xs text-gray-500 mt-1 ml-4">
                  {item.customizationSummary}
                </div>
              )}
              {nextStatus && <Button
                size="sm"
                className="mt-2 w-full bg-gradient-to-r from-orange-500 to-red-500 text-white"
                disabled={updatingOrder === item.id}
                onClick={() => onUpdateItemStatus(order.id, item.id, nextStatus)}
              >
                {updatingOrder === item.id ? 'Mise à jour...' : buttonLabel}
              </Button>}
            </div>;
          })}
        </div>

        {order.notes && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm font-medium text-yellow-800 mb-1">Notes:</p>
            <p className="text-sm text-yellow-700">{order.notes}</p>
          </div>
        )}
      </CardContent>
    </motion.div>
  );
}
