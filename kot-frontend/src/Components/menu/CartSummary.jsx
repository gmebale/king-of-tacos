import React from "react";
import { motion } from "framer-motion";
import { ShoppingCart, ArrowRight } from "lucide-react";
import { Button } from '../ui/button';

export default function CartSummary({ cart, cartTotal, cartCount, onCheckout }) {
  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className="hidden md:fixed md:bottom-4 md:left-auto md:right-4 md:w-96 md:rounded-3xl md:border-2 md:bg-white md:border-t-2 md:border-gray-200 md:shadow-2xl md:z-40"
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-amber-600 rounded-xl flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-medium text-gray-600 text-sm">Votre panier</p>
              <p className="text-xs text-gray-500">{cartCount} article{cartCount > 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-yellow-500 bg-clip-text text-transparent">
              {cartTotal.toLocaleString()} FCFA
            </p>
          </div>
        </div>

        <Button
          onClick={onCheckout}
          className="w-full bg-gradient-to-r from-yellow-400 to-amber-600 hover:from-yellow-500 hover:to-amber-700 text-white py-6 rounded-2xl shadow-lg text-lg font-semibold group md:border-0 border-2 border-amber-400"
        >
          Voir le panier
          <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>
    </motion.div>
  );
}