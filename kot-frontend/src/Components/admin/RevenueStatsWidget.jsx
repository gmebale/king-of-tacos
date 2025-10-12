import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { TrendingUp, Calendar } from "lucide-react";
import { motion } from "framer-motion";

export default function RevenueStatsWidget({ orders }) {
  const [period, setPeriod] = useState("day");

  const calculateRevenue = (periodType) => {
    const now = new Date();
    let filteredOrders = [];

    switch (periodType) {
      case "day":
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        filteredOrders = orders.filter(order => {
          const orderDate = new Date(order.created_date);
          return orderDate >= today && order.status !== "annulee";
        });
        break;

      case "week":
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        filteredOrders = orders.filter(order => {
          const orderDate = new Date(order.created_date);
          return orderDate >= weekStart && order.status !== "annulee";
        });
        break;

      case "month":
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        filteredOrders = orders.filter(order => {
          const orderDate = new Date(order.created_date);
          return orderDate >= monthStart && order.status !== "annulee";
        });
        break;

      case "year":
        const yearStart = new Date(now.getFullYear(), 0, 1);
        filteredOrders = orders.filter(order => {
          const orderDate = new Date(order.created_date);
          return orderDate >= yearStart && order.status !== "annulee";
        });
        break;
    }

    const total = filteredOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
    const count = filteredOrders.length;
    const average = count > 0 ? total / count : 0;

    return { total, count, average };
  };

  const stats = calculateRevenue(period);

  const periodLabels = {
    day: "Aujourd'hui",
    week: "Cette semaine",
    month: "Ce mois",
    year: "Cette année"
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-green-600" />
          Chiffre d'affaires
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={period} onValueChange={setPeriod}>
          <TabsList className="grid grid-cols-4 bg-gray-100">
            <TabsTrigger value="day" className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-600 data-[state=active]:text-white">
              Jour
            </TabsTrigger>
            <TabsTrigger value="week" className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-600 data-[state=active]:text-white">
              Semaine
            </TabsTrigger>
            <TabsTrigger value="month" className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-600 data-[state=active]:text-white">
              Mois
            </TabsTrigger>
            <TabsTrigger value="year" className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-600 data-[state=active]:text-white">
              Année
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <motion.div
          key={period}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border-2 border-green-200">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
              <Calendar className="w-4 h-4" />
              {periodLabels[period]}
            </div>
            <div className="text-4xl font-bold text-green-700 mb-1">
              {stats.total.toLocaleString()} FCFA
            </div>
            <div className="text-sm text-gray-600">
              {stats.count} commande{stats.count > 1 ? 's' : ''}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-4 border-2 border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Panier moyen</p>
              <p className="text-xl font-bold text-gray-900">
                {Math.round(stats.average).toLocaleString()} FCFA
              </p>
            </div>

            <div className="bg-white rounded-xl p-4 border-2 border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Commandes</p>
              <p className="text-xl font-bold text-gray-900">
                {stats.count}
              </p>
            </div>
          </div>
        </motion.div>
      </CardContent>
    </Card>
  );
}