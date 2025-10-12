import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Clock, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Skeleton } from "../ui/skeleton";
import { Link } from "react-router-dom";
import { createPageUrl } from "../../utils";

export default function RecentOrdersWidget({ orders, isLoading }) {
  const getStatusColor = (status) => {
    const colors = {
      en_attente: "bg-yellow-100 text-yellow-800 border-yellow-300",
      en_preparation: "bg-blue-100 text-blue-800 border-blue-300",
      prete: "bg-green-100 text-green-800 border-green-300",
      livree: "bg-gray-100 text-gray-800 border-gray-300"
    };
    return colors[status] || colors.en_attente;
  };

  const getStatusLabel = (status) => {
    const labels = {
      en_attente: "En attente",
      en_preparation: "En préparation",
      prete: "Prête",
      livree: "Livrée"
    };
    return labels[status] || status;
  };

  return (
    <Card className="border-2">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-600" />
          Commandes récentes
        </CardTitle>
        <Link to={createPageUrl("AdminOrders")}>
          <Button variant="ghost" size="sm" className="text-amber-600">
            Voir tout
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4 border rounded-xl">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <p className="text-center text-gray-500 py-8">Aucune commande</p>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-4 border-2 rounded-xl hover:border-amber-400 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold">#{order.id.slice(-6)}</p>
                    <Badge className={`border ${getStatusColor(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">{order.customer_name}</p>
                  <p className="text-xs text-gray-500">
                    {format(new Date(order.created_date), "HH:mm", { locale: fr })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-amber-600">
                    {order.total_amount?.toLocaleString()} FCFA
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
