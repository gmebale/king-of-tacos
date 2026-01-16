import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from '../ui/button';
import { Clock, User, Phone, ShoppingBag, MapPin } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { formatCustomization } from "../../utils/customization";

export default function OrderCard({ order, onUpdateStatus }) {
  const getStatusColor = (status) => {
    const colors = {
      en_attente: "bg-yellow-100 text-yellow-800 border-yellow-300",
      en_preparation: "bg-blue-100 text-blue-800 border-blue-300",
      prete: "bg-green-100 text-green-800 border-green-300",
      en_livraison: "bg-purple-100 text-purple-800 border-purple-300", // New status color
      livree: "bg-gray-100 text-gray-800 border-gray-300",
      annulee: "bg-red-100 text-red-800 border-red-300"
    };
    return colors[status] || colors.en_attente;
  };

  const getStatusLabel = (status) => {
    const labels = {
      en_attente: "En attente",
      en_preparation: "En préparation",
      prete: "Prête",
      en_livraison: "En livraison", // New status label
      livree: "Livrée",
      annulee: "Annulée"
    };
    return labels[status] || status;
  };

  const getNextStatus = (currentStatus) => {
    const flow = {
      en_attente: "en_preparation",
      en_preparation: order.order_type === "livraison" ? "en_livraison" : "prete", // Conditional next status
      en_livraison: "livree", // New status flow
      prete: "livree"
    };
    return flow[currentStatus];
  };

  const getNextStatusLabel = (currentStatus) => {
    const labels = {
      en_attente: "Commencer",
      en_preparation: order.order_type === "livraison" ? "Mettre en livraison" : "Marquer prête", // Conditional next status label
      en_livraison: "Marquer livrée", // New status label
      prete: "Marquer livrée"
    };
    return labels[currentStatus];
  };

  const displayCode = order.order_code || `KOT-${order.id?.slice(-6) || ''}`;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      layout
    >
      <Card className="border-2 hover:border-amber-400 transition-all hover:shadow-xl">
        <CardHeader className="bg-gradient-to-r from-amber-50 to-yellow-50 border-b">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-bold mb-1">
                Commande #{displayCode}
              </h3>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="w-4 h-4" />
                {format(new Date(order.created_date), "d MMM yyyy 'à' HH:mm", { locale: fr })}
              </div>
            </div>
            <Badge className={`border ${getStatusColor(order.status)}`}>
              {getStatusLabel(order.status)}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <div className="space-y-4 mb-6">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-gray-400" />
              <div>
                <p className="font-semibold">{order.customer_name}</p>
                <p className="text-sm text-gray-600">{order.customer_phone}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-gray-400" />
              <Badge variant="outline">
                {order.order_type === "emporter" && "À emporter"}
                {order.order_type === "sur_place" && "Sur place"}
                {order.order_type === "livraison" && "Livraison"} {/* Updated for delivery type */}
              </Badge>
            </div>

            {order.order_type === "livraison" && order.delivery_address && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <p className="text-sm font-semibold text-purple-900 mb-1">Adresse de livraison:</p>
                <p className="text-sm text-purple-700">{order.delivery_address}</p>
              </div>
            )}

            {order.pickup_time && (
              <div className="flex items-center gap-3 text-sm text-amber-600">
                <Clock className="w-4 h-4" />
                Heure souhaitée: {order.pickup_time}
              </div>
            )}
          </div>

          <div className="border-t pt-4 mb-4">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" />
              Articles
            </h4>
            <div className="space-y-2">
              {order.items?.map((item, idx) => (
                <div key={idx} className="text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-700">
                      {item.quantity}x {item.product_name}
                    </span>
                    <span className="font-semibold">
                      {item.subtotal?.toLocaleString()} FCFA
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
          </div>

          {order.notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Note:</span> {order.notes}
              </p>
            </div>
          )}

          <div className="flex justify-between items-center pt-4 border-t mb-4">
            <span className="font-semibold text-lg">Total</span>
            <span className="text-2xl font-bold text-amber-600">
              {order.total_amount?.toLocaleString()} FCFA
            </span>
          </div>

          {order.status !== "livree" && order.status !== "annulee" && (
            <div className="space-y-2">
              <Button
                onClick={() => onUpdateStatus(order.id, getNextStatus(order.status))}
                className="w-full bg-gradient-to-r from-yellow-400 to-amber-600 hover:from-yellow-500 hover:to-amber-700 text-white rounded-xl"
              >
                {getNextStatusLabel(order.status)}
              </Button>
              {order.status === "en_attente" && (
                <Button
                  onClick={() => onUpdateStatus(order.id, "annulee")}
                  variant="outline"
                  className="w-full border-2 border-red-300 text-red-600 hover:bg-red-50 rounded-xl"
                >
                  Annuler
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
