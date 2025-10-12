import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight, ArrowLeft } from "lucide-react"; // Added ArrowLeft
import { Button } from "../Components/ui/button";
import { Card, CardContent } from "../Components/ui/card";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "../utils";

export default function Cart() {
  const navigate = useNavigate();
  const [cart, setCart] = useState([]);

  useEffect(() => {
    loadCart();
    window.addEventListener('storage', loadCart);
    return () => window.removeEventListener('storage', loadCart);
  }, []);

  const loadCart = () => {
    const savedCart = JSON.parse(localStorage.getItem('kingoftacos_cart') || '[]');
    setCart(savedCart);
  };

  const updateQuantity = (productId, change) => {
    const newCart = cart.map(item => {
      // For items with customization, their ID might be unique per customization.
      // We should update based on the full item object if IDs can be identical for different customizations.
      // Assuming productId is unique enough for now. If not, a more complex `id` or a `uniqueKey` including customization should be used.
      if (item.id === productId) {
        return { ...item, quantity: Math.max(1, item.quantity + change) };
      }
      return item;
    });
    setCart(newCart);
    localStorage.setItem('kingoftacos_cart', JSON.stringify(newCart));
    window.dispatchEvent(new Event('storage'));
  };

  const removeItem = (productId) => {
    const newCart = cart.filter(item => item.id !== productId);
    setCart(newCart);
    localStorage.setItem('kingoftacos_cart', JSON.stringify(newCart));
    window.dispatchEvent(new Event('storage'));
  };

  const clearCart = () => {
    setCart([]);
    localStorage.removeItem('kingoftacos_cart');
    window.dispatchEvent(new Event('storage'));
  };

  const subtotal = cart.reduce((sum, item) => {
    const price = item.displayPrice || item.price;
    return sum + (price * item.quantity);
  }, 0);
  const total = subtotal;

  if (cart.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
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
      <div className="max-w-4xl mx-auto px-6">
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
            {cart.reduce((sum, item) => sum + item.quantity, 0)} article{cart.length > 1 ? 's' : ''}
          </p>
        </motion.div>

        <div className="space-y-4 mb-8">
          <AnimatePresence>
            {cart.map((item) => (
              <motion.div
                key={item.id} // Assuming item.id is unique for each distinct item, including customizations
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                layout
              >
                <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="w-24 h-24 bg-gradient-to-br from-amber-50 to-yellow-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="w-full h-full object-cover rounded-2xl"
                          />
                        ) : (
                          <ShoppingBag className="w-10 h-10 text-amber-400" />
                        )}
                      </div>

                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-bold text-lg">{item.name}</h3>
                            {item.customizationSummary && (
                              <p className="text-sm text-gray-600 mt-1">
                                {item.customizationSummary}
                              </p>
                            )}
                            <p className="text-amber-600 font-semibold mt-1">
                              {(item.displayPrice || item.price).toLocaleString()} FCFA
                            </p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeItem(item.id)}
                            className="text-red-500 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => updateQuantity(item.id, -1)}
                            className="rounded-xl border-amber-400 text-amber-600 hover:bg-amber-50 h-8 w-8"
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="text-lg font-bold w-8 text-center">
                            {item.quantity}
                          </span>
                          <Button
                            size="icon"
                            onClick={() => updateQuantity(item.id, 1)}
                            className="rounded-xl bg-gradient-to-r from-yellow-400 to-amber-600 text-white h-8 w-8"
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                          <span className="ml-auto text-lg font-bold">
                            {((item.displayPrice || item.price) * item.quantity).toLocaleString()} FCFA
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
          <CardContent className="p-6">
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-lg">
                <span className="text-gray-700">Sous-total</span>
                <span className="font-semibold">{subtotal.toLocaleString()} FCFA</span>
              </div>
              <div className="border-t-2 border-amber-200 pt-3">
                <div className="flex justify-between text-2xl font-bold">
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
