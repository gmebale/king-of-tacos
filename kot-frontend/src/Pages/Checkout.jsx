import React, { useState, useEffect } from "react";
import { User } from "../Entities/User";
import { motion } from "framer-motion";
import { Button } from "../Components/ui/button";
import { Input } from "../Components/ui/input";
import { Label } from "../Components/ui/label";
import { Textarea } from "../Components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "../Components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "../Components/ui/card";
import { ShoppingBag, Clock, MapPin, Check, Truck, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "../utils";
import { useCart } from "../hooks/useCart";
import { formatCustomization } from "../utils/customization";

export default function Checkout() {
  const navigate = useNavigate();
  const { cart, getTotal, isLoading } = useCart();

  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    order_type: "emporter",
    delivery_address: "",
    pickup_time: "",
    notes: ""
  });

  useEffect(() => {
    if (!isLoading && cart.length === 0) {
      navigate(createPageUrl("Menu"));
    }
    loadUser();
  }, [cart, navigate, isLoading]);

  const loadCart = () => {
    // Cart is now managed by useCart hook
  };

  const loadUser = async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);
      if (currentUser) {
        setFormData(prev => ({
          ...prev,
          customer_name: currentUser.full_name || "",
          customer_email: currentUser.email || "",
          customer_phone: currentUser.phone || "",
          delivery_address: currentUser.address || ""
        }));
      }
    } catch (error) {
      console.log("User not logged in");
    }
  };

  const total = getTotal();

  const deliveryFee = formData.order_type === "livraison" ? 2000 : 0;
  const finalTotal = total + deliveryFee;

  const handleSubmit = (e) => {
    e.preventDefault();
    navigate('/payment', {
      state: {
        cart,
        formData,
        total: finalTotal
      }
    });
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
            onClick={() => navigate(createPageUrl("Cart"))}
            className="mb-4 text-amber-600 hover:text-amber-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour au panier
          </Button>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-amber-600 to-yellow-500 bg-clip-text text-transparent">
            Finaliser la commande
          </h1>
          <p className="text-gray-600">Quelques informations pour préparer votre commande</p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-amber-600 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold">1</span>
                    </div>
                    Vos informations
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="name">Nom complet *</Label>
                    <Input
                      id="name"
                      required
                      value={formData.customer_name}
                      onChange={(e) => setFormData({...formData, customer_name: e.target.value})}
                      className="rounded-xl border-2 focus:border-amber-400"
                      placeholder="Votre nom"
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone">Téléphone *</Label>
                    <Input
                      id="phone"
                      required
                      type="tel"
                      value={formData.customer_phone}
                      onChange={(e) => setFormData({...formData, customer_phone: e.target.value})}
                      className="rounded-xl border-2 focus:border-amber-400"
                      placeholder="06 12 34 56 78"
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.customer_email}
                      onChange={(e) => setFormData({...formData, customer_email: e.target.value})}
                      className="rounded-xl border-2 focus:border-amber-400"
                      placeholder="votre@email.com"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-amber-600 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold">2</span>
                    </div>
                    Type de commande
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    value={formData.order_type}
                    onValueChange={(value) => setFormData({...formData, order_type: value})}
                  >
                    <div className="flex items-center space-x-2 p-4 border-2 rounded-xl hover:border-amber-400 cursor-pointer">
                      <RadioGroupItem value="emporter" id="emporter" />
                      <Label htmlFor="emporter" className="flex items-center gap-2 cursor-pointer flex-1">
                        <ShoppingBag className="w-5 h-5 text-amber-600" />
                        <div>
                          <p className="font-semibold">À emporter</p>
                          <p className="text-sm text-gray-500">Récupérez votre commande</p>
                        </div>
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2 p-4 border-2 rounded-xl hover:border-amber-400 cursor-pointer">
                      <RadioGroupItem value="sur_place" id="sur_place" />
                      <Label htmlFor="sur_place" className="flex items-center gap-2 cursor-pointer flex-1">
                        <MapPin className="w-5 h-5 text-amber-600" />
                        <div>
                          <p className="font-semibold">Sur place</p>
                          <p className="text-sm text-gray-500">Dégustez au restaurant</p>
                        </div>
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2 p-4 border-2 rounded-xl hover:border-amber-400 cursor-pointer">
                      <RadioGroupItem value="livraison" id="livraison" />
                      <Label htmlFor="livraison" className="flex items-center gap-2 cursor-pointer flex-1">
                        <Truck className="w-5 h-5 text-amber-600" />
                        <div>
                          <p className="font-semibold">Livraison</p>
                          <p className="text-sm text-gray-500">Livré chez vous (+2000 FCFA)</p>
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>

                  {formData.order_type === "livraison" && (
                    <div className="mt-4">
                      <Label htmlFor="address">Adresse de livraison *</Label>
                      <Textarea
                        id="address"
                        required
                        value={formData.delivery_address}
                        onChange={(e) => setFormData({...formData, delivery_address: e.target.value})}
                        className="rounded-xl border-2 focus:border-amber-400"
                        placeholder="Numéro, rue, quartier, ville..."
                        rows={3}
                      />
                    </div>
                  )}

                  <div className="mt-4">
                    <Label htmlFor="time">Heure souhaitée (optionnel)</Label>
                    <Input
                      id="time"
                      type="time"
                      value={formData.pickup_time}
                      onChange={(e) => setFormData({...formData, pickup_time: e.target.value})}
                      className="rounded-xl border-2 focus:border-amber-400"
                    />
                  </div>

                  <div className="mt-4">
                    <Label htmlFor="notes">Instructions spéciales</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                      className="rounded-xl border-2 focus:border-amber-400"
                      placeholder="Ex: Sans oignons, bien cuit..."
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-yellow-400 to-amber-600 hover:from-yellow-500 hover:to-amber-700 text-white py-6 rounded-2xl text-lg font-semibold shadow-lg"
              >
                Procéder au paiement
                <Check className="ml-2 w-5 h-5" />
              </Button>
            </form>
          </div>

          <div>
            <Card className="sticky top-24 bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200">
              <CardHeader>
                <CardTitle>Récapitulatif</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {cart.map((item) => (
                  <div key={`${item.product.id}-${JSON.stringify(item.customization)}`} className="flex justify-between text-sm">
                    <div className="flex-1">
                      <span>{item.quantity}x {item.product.name}</span>
                      {(item.customization) && formatCustomization(item.customization, item.customizationConfig || item.product?.customization) && (
                        <div className="text-xs text-gray-500 mt-1">
                          {formatCustomization(item.customization, item.customizationConfig || item.product?.customization)}
                        </div>
                      )}
                    </div>
                    <span className="font-semibold">
                      {item.subtotal.toLocaleString()} FCFA
                    </span>
                  </div>
                ))}
                
                <div className="border-t-2 border-amber-200 pt-4 space-y-2">
                  <div className="flex justify-between">
                    <span>Sous-total</span>
                    <span className="font-semibold">{total.toLocaleString()} FCFA</span>
                  </div>
                  
                  {deliveryFee > 0 && (
                    <div className="flex justify-between text-amber-600">
                      <span>Frais de livraison</span>
                      <span className="font-semibold">{deliveryFee.toLocaleString()} FCFA</span>
                    </div>
                  )}

                  <div className="flex justify-between text-2xl font-bold pt-2">
                    <span>Total</span>
                    <span className="bg-gradient-to-r from-amber-600 to-yellow-500 bg-clip-text text-transparent">
                      {finalTotal.toLocaleString()} FCFA
                    </span>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-4 text-center">
                  <Clock className="w-6 h-6 text-amber-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-gray-700">
                    {formData.order_type === "livraison" ? "Livré en ~30 minutes" : "Prêt en ~10 minutes"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}