import React, { useRef } from "react";
import { motion } from "framer-motion";
import { ShoppingCart } from "lucide-react";
import { Button } from '../ui/button';

export default function CartSummary({ cartTotal, cartCount, onCheckout }) {
  const viewportRef = useRef(null);

  return (
    <>
      <div className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 border-t border-gray-200 bg-white/95 p-2.5 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] backdrop-blur md:hidden">
        <Button
          onClick={onCheckout}
          aria-label={`Voir le panier : ${cartCount} article${cartCount > 1 ? 's' : ''}, ${cartTotal.toLocaleString()} FCFA`}
          className="flex h-14 w-full items-center justify-between rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 px-3 text-slate-900 shadow-lg hover:from-yellow-500 hover:to-amber-600 sm:px-5"
        >
          <span className="flex min-w-0 items-center gap-2"><ShoppingCart className="h-5 w-5 flex-none" /><span className="truncate text-xs font-semibold sm:text-sm">Voir le panier & commander · {cartCount} art.</span></span>
          <span className="ml-2 whitespace-nowrap text-xs font-bold sm:text-sm">{cartTotal.toLocaleString()} FCFA</span>
        </Button>
      </div>

      <div ref={viewportRef} className="pointer-events-none fixed inset-0 z-50 hidden md:block">
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
            className="relative flex h-16 w-16 cursor-grab items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-600 text-slate-900 shadow-xl ring-2 ring-white hover:from-yellow-500 hover:to-amber-700 active:cursor-grabbing"
          >
            <ShoppingCart className="h-7 w-7" />
            <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold text-white ring-2 ring-white">
              {cartCount}
            </span>
          </Button>
        </motion.div>
      </div>
    </>
  );
}
