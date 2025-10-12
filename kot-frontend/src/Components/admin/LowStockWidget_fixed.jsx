import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { AlertCircle, Package } from "lucide-react";
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { Link } from "react-router-dom";
import { createPageUrl } from '../../utils';
import { Button } from '../ui/button';

export default function LowStockWidget({ products, isLoading }) {
  const lowStockProducts = products.filter(p => p.stock <= p.stock_alert_threshold);

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          Alertes Stock
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 border rounded-xl">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-6 w-12" />
              </div>
            ))}
          </div>
        ) : lowStockProducts.length === 0 ? (
          <div className="text-center py-6">
            <Package className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600">Tout est en stock !</p>
          </div>
        ) : (
          <>
            <div className="space-y-3 mb-4">
              {lowStockProducts.slice(0, 5).map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 border-2 border-red-200 rounded-xl bg-red-50"
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm">{product.name}</p>
                    <p className="text-xs text-gray-600">{product.category}</p>
                  </div>
                  <Badge className="bg-red-500 text-white">
                    {product.stock} restant{product.stock > 1 ? 's' : ''}
                  </Badge>
                </div>
              ))}
            </div>
            <Link to={createPageUrl("AdminStock")}>
              <Button variant="outline" className="w-full border-2 border-red-300 text-red-600 hover:bg-red-50">
                Gérer le stock
              </Button>
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}
