import React, { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Minus, ShoppingCart, TrendingDown } from "lucide-react";
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import CustomizationDialog from './CustomizationDialog';

export default function ProductCard({ product, onAddToCart, cartItem, onUpdateQuantity }) {
  const [showCustomization, setShowCustomization] = useState(false);
  const quantity = cartItem?.quantity || 0;
  const hasDiscount = product.discount_percentage > 0;
  const finalPrice = hasDiscount 
    ? product.price * (1 - product.discount_percentage / 100)
    : product.price;

  const handleAddClick = () => {
    if (product.customization?.isConfigurable) {
      setShowCustomization(true);
    } else {
      onAddToCart(product);
    }
  };

  const handleCustomizationConfirm = (customizedProduct, qty) => {
    for (let i = 0; i < qty; i++) {
      onAddToCart(customizedProduct);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ y: -5 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="overflow-hidden border-2 hover:border-amber-400 transition-all duration-300 hover:shadow-2xl group">
          <div className="relative h-48 bg-gradient-to-br from-amber-50 to-yellow-100 overflow-hidden">
            {product.image ? (
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ShoppingCart className="w-16 h-16 text-amber-300" />
              </div>
            )}
            
            {/* Badges */}
            <div className="absolute top-3 right-3 flex flex-col gap-2">
              {hasDiscount && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring" }}
                >
                  <Badge className="bg-red-500 text-white shadow-lg">
                    -{product.discount_percentage}%
                  </Badge>
                </motion.div>
              )}
              {product.stock < 5 && (
                <Badge className="bg-orange-500 text-white shadow-lg">
                  Stock faible
                </Badge>
              )}
            </div>
          </div>

          <CardContent className="p-6">
            <div className="mb-4">
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {product.name}
              </h3>
              {product.description && (
                <p className="text-gray-600 text-sm line-clamp-2">
                  {product.description}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div>
                {hasDiscount ? (
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-green-600">
                        {Math.round(finalPrice).toLocaleString()} FCFA
                      </span>
                    </div>
                    <span className="text-sm text-gray-500 line-through">
                      {product.price.toLocaleString()} FCFA
                    </span>
                  </div>
                ) : (
                  <span className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-yellow-500 bg-clip-text text-transparent">
                    {product.price.toLocaleString()} FCFA
                  </span>
                )}
              </div>

              {quantity === 0 ? (
                <Button
                  onClick={handleAddClick}
                  className="bg-gradient-to-r from-yellow-400 to-amber-600 hover:from-yellow-500 hover:to-amber-700 text-white rounded-xl shadow-lg"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {product.category === "tacos" ? "Personnaliser" : "Ajouter"}
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => onUpdateQuantity(product.id, -1)}
                    className="rounded-xl border-amber-400 text-amber-600 hover:bg-amber-50"
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="text-lg font-bold w-8 text-center">
                    {quantity}
                  </span>
                  <Button
                    size="icon"
                    onClick={() => onUpdateQuantity(product.id, 1)}
                    className="rounded-xl bg-gradient-to-r from-yellow-400 to-amber-600 text-white"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {product.customization?.isConfigurable && (
        <CustomizationDialog
          open={showCustomization}
          onOpenChange={setShowCustomization}
          product={product}
          onConfirm={handleCustomizationConfirm}
        />
      )}
    </>
  );
}