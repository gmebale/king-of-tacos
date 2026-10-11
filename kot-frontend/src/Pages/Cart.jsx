import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight, ArrowLeft } from "lucide-react"; // Added ArrowLeft
import { Button } from "../Components/ui/button";
import { Card, CardContent } from "../Components/ui/card";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "../utils";
import { useCart } from "../hooks/useCart";
import { resolveMediaUrl } from "../utils/media";

export default function Cart() {
  const navigate = useNavigate();
  const { cart, updateQuantity, removeFromCart, clearCart, getTotal, getTotalItems } = useCart();

  const subtotal = getTotal();
  const total = subtotal;

  if (cart.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-24 h-24 bg-gradient-to-br from-yellow-100 to-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShoppingBag className="w-12 h-12 text-amber-500" />
          </div>
          <h2 className="text-3xl font-bold mb-4 text-gray-900">Votre panier est vide</h2>
          <p className="text-gray-600 mb-8">Découvrez notre délicieux menu</p>
          <Button
            onClick={() => navigate(createPageUrl("Menu"))}
            className="bg-gradient-to-r from-yellow-400 to-amber-600 hover:from-yellow-500 hover:to-amber-700 text-white px-8 py-6 rounded-2xl"
          >
            Voir le menu
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          {/* New "Retour au menu" button */}
          <Button
            variant="ghost"
            onClick={() => navigate(createPageUrl("Menu"))}
            className="mb-4 text-amber-600 hover:text-amber-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour au menu
          </Button>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-amber-600 to-yellow-500 bg-clip-text text-transparent">
            Votre Panier
          </h1>
          <p className="text-gray-600">
            {getTotalItems()} article{cart.length > 1 ? 's' : ''}
          </p>
        </motion.div>

        <div className="space-y-4 mb-8">
          <AnimatePresence>
            {cart.map((item) => (
              <motion.div
                key={`${item.product.id}-${JSON.stringify(item.customization)}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                layout
              >
                <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex gap-3 sm:gap-4">
                      <div className="h-20 w-20 flex-shrink-0 rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-100 flex items-center justify-center sm:h-24 sm:w-24">
                        {item.product.image_url ? (
                          <img
                            src={resolveMediaUrl(item.product.image_url)}
                            alt={item.product.name}
                            className="w-full h-full object-cover rounded-2xl"
                          />
                        ) : (
                          <ShoppingBag className="w-10 h-10 text-amber-400" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="break-words text-base font-bold sm:text-lg">{item.product.name}</h3>
                            {item.customizationSummary && (
                              <p className="mt-1 break-words text-sm text-gray-600">
                                {item.customizationSummary}
                              </p>
                            )}
                            <p className="text-amber-600 font-semibold mt-1">
                              {(item.product.displayPrice || item.product.price).toLocaleString()} FCFA
                            </p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeFromCart(item.product.id, item.customization)}
                            className="text-red-500 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1, item.customization)}
                            className="h-11 w-11 rounded-xl border-amber-400 text-amber-600 hover:bg-amber-50 sm:h-8 sm:w-8"
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="w-8 text-center text-lg font-bold">
                            {item.quantity}
                          </span>
                          <Button
                            size="icon"
                            onClick={() => updateQuantity(item.product.id, item.quantity + 1, item.customization)}
                            className="h-11 w-11 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-600 text-white sm:h-8 sm:w-8"
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                          <span className="w-full text-right text-base font-bold sm:ml-auto sm:w-auto sm:text-lg">
                            {item.subtotal.toLocaleString()} FCFA
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200">
          <CardContent className="p-4 sm:p-6">
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-lg">
                <span className="text-gray-700">Sous-total</span>
                <span className="font-semibold">{subtotal.toLocaleString()} FCFA</span>
              </div>
              <div className="border-t-2 border-amber-200 pt-3">
                <div className="flex justify-between gap-3 text-xl font-bold sm:text-2xl">
                  <span>Total</span>
                  <span className="bg-gradient-to-r from-amber-600 to-yellow-500 bg-clip-text text-transparent">
                    {total.toLocaleString()} FCFA
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Button
                onClick={() => navigate(createPageUrl("Checkout"))}
                className="w-full bg-gradient-to-r from-yellow-400 to-amber-600 hover:from-yellow-500 hover:to-amber-700 text-white py-6 rounded-2xl text-lg font-semibold shadow-lg group"
              >
                Passer la commande
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>

              <Button
                onClick={clearCart}
                variant="outline"
                className="w-full border-2 border-red-300 text-red-600 hover:bg-red-50 rounded-2xl py-6"
              >
                Vider le panier
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
