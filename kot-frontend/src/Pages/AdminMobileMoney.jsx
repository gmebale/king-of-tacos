import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../Components/ui/card";
import { Button } from "../Components/ui/button";
import { Badge } from "../Components/ui/badge";
import api from "../services/api.service";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_LABELS = {
  requires_action: "À vérifier",
  paid: "Validé",
  failed: "Rejeté"
};

const STATUS_STYLES = {
  requires_action: "bg-yellow-100 text-yellow-800 border-yellow-200",
  paid: "bg-green-100 text-green-800 border-green-200",
  failed: "bg-red-100 text-red-800 border-red-200"
};

export default function AdminMobileMoney() {
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState("requires_action");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const response = await api.get("/payments/mobile-money", {
        params: statusFilter ? { status: statusFilter } : {}
      });
      setOrders(response.data || []);
    } catch (error) {
      console.error("Error loading mobile money orders:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [statusFilter]);

  const handleApprove = async (id) => {
    try {
      setActionLoading(id);
      await api.put(`/payments/mobile-money/${id}/approve`);
      await loadOrders();
    } catch (error) {
      console.error("Error approving mobile money:", error);
      alert("Erreur lors de la validation.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id) => {
    if (!window.confirm("Rejeter ce paiement mobile money ?")) return;
    try {
      setActionLoading(id);
      await api.put(`/payments/mobile-money/${id}/reject`);
      await loadOrders();
    } catch (error) {
      console.error("Error rejecting mobile money:", error);
      alert("Erreur lors du rejet.");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Paiements Mobile Money</h1>
        <p className="text-gray-600 mt-2">Validez manuellement les paiements par Airtel Money ou Mobicash</p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filtrer</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-gray-200 px-3 py-2"
          >
            <option value="requires_action">À vérifier</option>
            <option value="paid">Validé</option>
            <option value="failed">Rejeté</option>
          </select>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Chargement...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 text-gray-500">Aucun paiement trouvé</div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const statusLabel = STATUS_LABELS[order.payment_status] || order.payment_status;
            const statusStyle = STATUS_STYLES[order.payment_status] || "bg-gray-100 text-gray-800 border-gray-200";
            return (
              <Card key={order.id} className="border-2">
                <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="text-lg">Commande #{order.order_code || order.id}</CardTitle>
                    <p className="text-sm text-gray-500">
                      {format(new Date(order.created_date), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                    </p>
                  </div>
                  <Badge className={`border ${statusStyle}`}>{statusLabel}</Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <p className="font-semibold">{order.customer_name}</p>
                      <p className="text-sm text-gray-500">{order.customer_phone}</p>
                      <p className="text-sm text-gray-500">{order.customer_email}</p>
                    </div>
                    <div className="text-lg font-bold text-amber-600">
                      {(order.total_amount || 0).toLocaleString()} FCFA
                    </div>
                  </div>

                  {order.notes && (
                    <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-900">
                      {order.notes}
                    </div>
                  )}

                  {order.payment_status === "requires_action" && (
                    <div className="flex flex-col md:flex-row gap-2">
                      <Button
                        onClick={() => handleApprove(order.id)}
                        disabled={actionLoading === order.id}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {actionLoading === order.id ? "Validation..." : "Valider"}
                      </Button>
                      <Button
                        onClick={() => handleReject(order.id)}
                        disabled={actionLoading === order.id}
                        variant="destructive"
                      >
                        {actionLoading === order.id ? "Rejet..." : "Rejeter"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
