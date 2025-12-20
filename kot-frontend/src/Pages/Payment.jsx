import React, { useState } from "react";
import { Order } from "../Entities/Order";
import { motion } from "framer-motion";
import { Button } from "../Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../Components/ui/card";
import { ArrowLeft, CreditCard } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "../utils";

export default function Payment() {
  const navigate = useNavigate();
  const location = useLocation();
  const { cart, formData, total } = location.state || {};
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!cart || !total) {
    navigate(createPageUrl("Checkout"));
    return null;
  }

  const handlePayment = async () => {
    setIsSubmitting(true);

    try {
      const orderItems = cart.filter(item => item.product).map(item => ({
        product_name: item.product.name,
        quantity: item.quantity,
        price: item.product.displayPrice || item.product.price,
        customization: item.customizations || item.customization || null
      }));

      await Order.create({
        items: orderItems,
        total_amount: total,
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone,
        customer_email: formData.customer_email,
        order_type: formData.order_type,
        delivery_address: formData.delivery_address,
        pickup_time: formData.pickup_time,
        notes: formData.notes
      });

      localStorage.removeItem('kingoftacos_cart');
      window.dispatchEvent(new Event('storage'));
      navigate(createPageUrl("OrderSuccess"));
    } catch (error) {
      console.error("Error creating order:", error);
    }

    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Button
            variant="ghost"
            onClick={() => navigate(createPageUrl("Checkout"))}
            className="mb-4 text-amber-600 hover:text-amber-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour à la commande
          </Button>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-amber-600 to-yellow-500 bg-clip-text text-transparent">
            Paiement
          </h1>
          <p className="text-gray-600">Vérifiez votre commande et procédez au paiement</p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Récapitulatif de la commande</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {cart.filter(item => item.product).map((item) => (
                    <div key={item.id} className="flex justify-between">
                      <span>{item.quantity}x {item.product.name}</span>
                      <span>{((item.product.displayPrice || item.product.price) * item.quantity).toLocaleString()} FCFA</span>
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-6 border-t">
                  <div className="flex justify-between text-xl font-bold">
                    <span>Total</span>
                    <span className="bg-gradient-to-r from-amber-600 to-yellow-500 bg-clip-text text-transparent">
                      {total.toLocaleString()} FCFA
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={handlePayment}
              disabled={isSubmitting}
              className="w-full mt-6 bg-gradient-to-r from-yellow-400 to-amber-600 hover:from-yellow-500 hover:to-amber-700 text-white py-6 rounded-2xl text-lg font-semibold shadow-lg"
            >
              {isSubmitting ? "Traitement..." : "Payer maintenant"}
              <CreditCard className="ml-2 w-5 h-5" />
            </Button>
          </div>

          <div>
            <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200">
              <CardHeader>
                <CardTitle>Informations de livraison</CardTitle>
              </CardHeader>
              <CardContent>
                <p><strong>Nom:</strong> {formData.customer_name}</p>
                <p><strong>Téléphone:</strong> {formData.customer_phone}</p>
                <p><strong>Type:</strong> {formData.order_type === "livraison" ? "Livraison" : "À emporter"}</p>
                {formData.order_type === "livraison" && <p><strong>Adresse:</strong> {formData.delivery_address}</p>}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
