import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { CheckCircle, Home, List } from "lucide-react";
import { Button } from "../Components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";

export default function OrderSuccess() {
  useEffect(() => {
    const confetti = () => {
      // Simple confetti effect
      for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.style.position = 'fixed';
        confetti.style.width = '10px';
        confetti.style.height = '10px';
        confetti.style.background = ['#FFD700', '#FFA500', '#FF6347'][Math.floor(Math.random() * 3)];
        confetti.style.left = Math.random() * window.innerWidth + 'px';
        confetti.style.top = '-10px';
        confetti.style.borderRadius = '50%';
        confetti.style.pointerEvents = 'none';
        confetti.style.zIndex = '9999';
        document.body.appendChild(confetti);

        const animation = confetti.animate([
          { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
          { transform: `translateY(${window.innerHeight}px) rotate(${Math.random() * 360}deg)`, opacity: 0 }
        ], {
          duration: 3000 + Math.random() * 2000,
          easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        });

        animation.onfinish = () => confetti.remove();
      }
    };
    
    confetti();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-lg"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
          className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl"
        >
          <CheckCircle className="w-14 h-14 text-white" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-amber-600 to-yellow-500 bg-clip-text text-transparent"
        >
          Commande confirmée !
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-xl text-gray-600 mb-8"
        >
          Votre commande est en préparation. Nous vous préviendrons quand elle sera prête !
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-4"
        >
          <Link to={createPageUrl("OrdersPage")}>
            <Button className="w-full bg-gradient-to-r from-yellow-400 to-amber-600 hover:from-yellow-500 hover:to-amber-700 text-white py-6 rounded-2xl text-lg">
              <List className="mr-2 w-5 h-5" />
              Suivre ma commande
            </Button>
          </Link>

          <Link to={createPageUrl("Home")}>
            <Button variant="outline" className="w-full border-2 border-amber-400 text-amber-600 hover:bg-amber-50 py-6 rounded-2xl text-lg">
              <Home className="mr-2 w-5 h-5" />
              Retour à l'accueil
            </Button>
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}