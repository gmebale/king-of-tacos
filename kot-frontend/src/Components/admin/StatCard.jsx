import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "../ui/card";
import { TrendingUp } from "lucide-react";
import { Skeleton } from "../ui/skeleton";

export default function StatCard({ title, value, icon: Icon, color, trend, alert, isLoading }) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-4 w-24 mb-4" />
          <Skeleton className="h-8 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -5 }}
      transition={{ duration: 0.2 }}
    >
      <Card className={`overflow-hidden border-2 ${alert ? 'border-red-300' : 'border-gray-200'} hover:shadow-xl transition-all`}>
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
              <h3 className="text-3xl font-bold text-gray-900">{value}</h3>
            </div>
            <div className={`p-3 rounded-xl bg-gradient-to-br ${color}`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
          </div>
          {trend && (
            <div className="flex items-center text-sm text-green-600">
              <TrendingUp className="w-4 h-4 mr-1" />
              <span className="font-medium">{trend}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}