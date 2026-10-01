import React, { useRef } from "react";
import { motion } from "framer-motion";
import { ShoppingCart } from "lucide-react";
import { Button } from '../ui/button';

export default function CartSummary({ cartTotal, cartCount, onCheckout }) {
  const viewportRef = useRef(null);

  return (
    <div ref={viewportRef} className="pointer-events-none fixed inset-0 z-50">
      <motion.div
        drag
        dragConstraints={viewportRef}
        dragMomentum={false}
        dragElastic={0}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="pointer-events-auto absolute bottom-5 right-5 touch-none"
      >
        <Button
          onClick={onCheckout}
          aria-label={`Ouvrir le panier : ${cartCount} article${cartCount > 1 ? 's' : ''}, ${cartTotal.toLocaleString()} FCFA`}
          title={`${cartCount} article${cartCount > 1 ? 's' : ''} · ${cartTotal.toLocaleString()} FCFA`}
          className="relative flex h-16 w-16 cursor-grab items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-600 text-white shadow-xl ring-2 ring-white hover:from-yellow-500 hover:to-amber-700 active:cursor-grabbing"
        >
          <ShoppingCart className="h-7 w-7" />
          <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold text-white ring-2 ring-white">
            {cartCount}
          </span>
        </Button>
      </motion.div>
    </div>
  );
}
