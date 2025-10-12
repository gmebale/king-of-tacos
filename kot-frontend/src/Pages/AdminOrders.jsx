import React, { useState, useEffect } from "react";
import { Order } from "../Entities/Order";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, 
  Filter, 
  Clock,
  CheckCircle,
  Package,
  XCircle
} from "lucide-react";
import { Input } from "../Components/ui/input";
import { Button } from "../Components/ui/button";
import { Badge } from "../Components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "../Components/ui/tabs";
import { Card, CardContent } from "../Components/ui/card";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import OrderCard from "../Components/admin/OrderCard";

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [orders, searchQuery, statusFilter]);

  const loadOrders = async () => {
    setIsLoading(true);
    const data = await Order.list("-created_date");
    setOrders(data);
    setIsLoading(false);
  };

  const filterOrders = () => {
    let filtered = orders;

    if (statusFilter !== "all") {
      filtered = filtered.filter(o => o.status === statusFilter);
    }

    if (searchQuery) {
      filtered = filtered.filter(o =>
        o.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.id.includes(searchQuery)
      );
    }

    setFilteredOrders(filtered);
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    await Order.update(orderId, { status: newStatus });
    loadOrders();
  };

  const statusCounts = {
    all: orders.length,
    en_attente: orders.filter(o => o.status === "en_attente").length,
    en_preparation: orders.filter(o => o.status === "en_preparation").length,
    prete: orders.filter(o => o.status === "prete").length,
    en_livraison: orders.filter(o => o.status === "en_livraison").length, // Added new status
    livree: orders.filter(o => o.status === "livree").length
  };

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
          Gestion des Commandes
        </h1>
        <p className="text-gray-600">
          Suivez et gérez toutes les commandes en temps réel
        </p>
      </motion.div>

      {/* Search & Filters */}
      <div className="mb-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            placeholder="Rechercher par nom ou numéro de commande..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-12 rounded-xl border-2 focus:border-amber-400"
          />
        </div>

        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="bg-white border-2 border-gray-200 flex-wrap h-auto">
            <TabsTrigger 
              value="all" 
              className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-400 data-[state=active]:to-amber-500 data-[state=active]:text-white"
            >
              Toutes ({statusCounts.all})
            </TabsTrigger>
            <TabsTrigger 
              value="en_attente"
              className="rounded-xl data-[state=active]:bg-yellow-500 data-[state=active]:text-white"
            >
              En attente ({statusCounts.en_attente})
            </TabsTrigger>
            <TabsTrigger 
              value="en_preparation"
              className="rounded-xl data-[state=active]:bg-blue-500 data-[state=active]:text-white"
            >
              En préparation ({statusCounts.en_preparation})
            </TabsTrigger>
            <TabsTrigger 
              value="prete"
              className="rounded-xl data-[state=active]:bg-green-500 data-[state=active]:text-white"
            >
              Prêtes ({statusCounts.prete})
            </TabsTrigger>
            <TabsTrigger 
              value="en_livraison" // Added new status tab
              className="rounded-xl data-[state=active]:bg-purple-500 data-[state=active]:text-white"
            >
              En livraison ({statusCounts.en_livraison})
            </TabsTrigger>
            <TabsTrigger 
              value="livree"
              className="rounded-xl data-[state=active]:bg-gray-500 data-[state=active]:text-white"
            >
              Livrées ({statusCounts.livree})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Orders List */}
      <AnimatePresence mode="wait">
        {isLoading ? (
          <div className="grid md:grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Aucune commande trouvée</p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid md:grid-cols-2 gap-4"
          >
            {filteredOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onUpdateStatus={updateOrderStatus}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
