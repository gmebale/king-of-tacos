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
import api from "../services/api.service";
import { toast } from 'react-hot-toast';

export default function Checkout() {
  const navigate = useNavigate();
  const { cart, getTotal, isLoading } = useCart();

  const [user, setUser] = useState(null);
  const [serviceLocations, setServiceLocations] = useState([]);
  const [linkedCustomer, setLinkedCustomer] = useState(null);
  const [searchingLoyaltyCustomer, setSearchingLoyaltyCustomer] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [activePromo, setActivePromo] = useState(null);
  const [giftRedemption, setGiftRedemption] = useState(null);
  const [loyaltyClaims, setLoyaltyClaims] = useState(null);
  const isStaffOrder = user?.role === 'serveur' && sessionStorage.getItem('kot_staff_order_mode') === 'true';
  const [formData, setFormData] = useState({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    order_type: "emporter",
    service_location: "",
    delivery_address: "",
    pickup_time: "",
    table_number: "",
    payment_method: "cash",
    notes: ""
  });

  useEffect(() => {
    if (!isLoading && cart.length === 0) {
      navigate(createPageUrl("Menu"));
    }
    loadUser();
  }, [cart, navigate, isLoading]);

  useEffect(() => {
    api.get('/settings/locations')
      .then(response => setServiceLocations(response.data || []))
      .catch(error => console.error('Error loading service locations:', error));
  }, []);

  const loadCart = () => {
    // Cart is now managed by useCart hook
  };

  const loadUser = async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);
      if (currentUser) {
        const staffOrderMode = currentUser.role === 'serveur';
        if (currentUser.role === 'serveur') sessionStorage.setItem('kot_staff_order_mode', 'true');
        setFormData(prev => ({
          ...prev,
          customer_name: staffOrderMode ? "" : currentUser.full_name || "",
          customer_email: staffOrderMode ? "" : currentUser.email || "",
          customer_phone: staffOrderMode ? "" : currentUser.phone || "",
          delivery_address: currentUser.address || "",
          order_type: currentUser.role === 'serveur' && sessionStorage.getItem('kot_staff_order_mode') === 'true'
            ? 'sur_place'
            : prev.order_type
        }));
        if (currentUser.role === 'client') {
          api.get('/loyalty/my-rewards').then(response => {
            setLoyaltyClaims(response.data || []);
          }).catch(error => console.error('Error loading claimed rewards:', error));
        }
      }
    } catch (error) {
      console.log("User not logged in");
    }
  };

  const total = getTotal();

  const deliveryFee = formData.order_type === "livraison" ? 2000 : 0;
  const giftCartItem = !activePromo && giftRedemption?.reward?.giftedProduct
    ? cart.find(item => item.product?.id === giftRedemption.reward.giftedProduct.id && item.quantity > 0)
    : null;
  const giftDiscount = giftCartItem ? Math.round(giftCartItem.subtotal / giftCartItem.quantity) : 0;
  const promoDiscount = activePromo?.promo?.type === 'percentage'
    ? Math.round(total * activePromo.promo.value / 100)
    : activePromo?.promo?.type === 'free_delivery' ? deliveryFee
      : activePromo?.promo?.type === 'fixed_amount' ? Math.min(total, activePromo.promo.value) : 0;
  const appliedDiscount = activePromo ? promoDiscount : giftDiscount;
  const finalTotal = Math.max(0, total + deliveryFee - appliedDiscount);

  useEffect(() => {
    if (user?.role !== 'client' || loyaltyClaims === null) return;
    let cancelled = false;
    const applyEligibleClaim = async () => {
      const promoClaims = loyaltyClaims.filter(claim => claim.promoCode?.is_active).sort((a, b) => new Date(a.expires_at) - new Date(b.expires_at));
      for (const claim of promoClaims) {
        try {
          const validation = await api.post('/loyalty/validate-promo', { code: claim.promoCode.code, order_amount: total, order_type: formData.order_type });
          if (!cancelled) {
            setActivePromo(current => current?.loyalty === false ? current : { code: validation.data.promo.code, promo: validation.data.promo, loyalty: true });
            setGiftRedemption(null);
          }
          return;
        } catch (_error) { /* Test the next unexpired reward code. */ }
      }
      if (!cancelled) {
        setActivePromo(current => current?.loyalty ? null : current);
        setGiftRedemption(current => current || loyaltyClaims.find(claim => claim.reward?.type === 'gifted_product') || null);
      }
    };
    applyEligibleClaim();
    return () => { cancelled = true; };
  }, [user?.role, loyaltyClaims, formData.order_type, total]);

  const applyPromoCode = async () => {
    if (!promoInput.trim()) return toast.error('Saisissez un code promo.');
    try {
      const response = await api.post('/loyalty/validate-promo', { code: promoInput.trim(), order_amount: total, order_type: formData.order_type });
      setActivePromo({ code: response.data.promo.code, promo: response.data.promo, loyalty: false });
      setGiftRedemption(null);
      toast.success('Code promo appliqué.');
    } catch (error) { toast.error(error.response?.data?.message || 'Code promo invalide.'); }
  };

  const lookupLoyaltyCustomer = async () => {
    const contacts = [...new Set([formData.customer_email.trim(), formData.customer_phone.trim()].filter(Boolean))];
    if (!contacts.length) return toast.error('Saisissez le courriel ou le téléphone du client.');
    setSearchingLoyaltyCustomer(true);
    let lastError;
    try {
      for (const contact of contacts) {
        try {
          const response = await api.get('/loyalty/staff/customer', { params: { contact } });
          setLinkedCustomer(response.data);
          setFormData(current => ({ ...current, loyalty_customer_id: response.data.id }));
          toast.success(`Compte fidélité associé : ${response.data.full_name}`);
          return;
        } catch (error) {
          lastError = error;
          if (![404, 409].includes(error.response?.status)) throw error;
        }
      }
      setLinkedCustomer(null);
      setFormData(current => ({ ...current, loyalty_customer_id: '' }));
      toast.error(lastError?.response?.data?.message || 'Compte fidélité introuvable.');
    } catch (error) {
      setLinkedCustomer(null);
      setFormData(current => ({ ...current, loyalty_customer_id: '' }));
      toast.error(error.response?.data?.message || 'Impossible de rechercher le compte fidélité.');
    } finally {
      setSearchingLoyaltyCustomer(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isStaffOrder && formData.order_type === 'sur_place' && !formData.service_location) return;
    navigate('/payment', {
      state: {
        cart,
        formData,
        total: finalTotal,
        pre_discount_total: total + deliveryFee,
        pre_discount_subtotal: total,
        promo_code: activePromo?.code || null,
        gifted_redemption_id: !activePromo && giftCartItem ? giftRedemption.id : null,
        loyalty_discount: appliedDiscount
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
                    <Label htmlFor="name">
                      {isStaffOrder && formData.order_type === 'sur_place' ? 'Nom du client (facultatif)' : isStaffOrder ? 'Nom ou numéro de retrait *' : 'Nom complet *'}
                    </Label>
                    <Input
                      id="name"
                      required={!isStaffOrder || formData.order_type === 'emporter'}
                      value={formData.customer_name}
                      onChange={(e) => setFormData({...formData, customer_name: e.target.value})}
                      className="rounded-xl border-2 focus:border-amber-400"
                      placeholder={isStaffOrder && formData.order_type === 'emporter' ? 'Nom du client ou numéro de retrait' : 'Votre nom'}
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone">Téléphone{isStaffOrder ? ' (facultatif)' : ' *'}</Label>
                    <Input
                      id="phone"
                      required={!isStaffOrder}
                      type="tel"
                      value={formData.customer_phone}
                      onChange={(e) => { setLinkedCustomer(null); setFormData(current => ({...current, customer_phone: e.target.value, loyalty_customer_id: ''})); }}
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
                      onChange={(e) => { setLinkedCustomer(null); setFormData(current => ({...current, customer_email: e.target.value, loyalty_customer_id: ''})); }}
                      className="rounded-xl border-2 focus:border-amber-400"
                      placeholder="votre@email.com"
                    />
                  </div>
                  {isStaffOrder && <div className="rounded-lg border bg-amber-50 p-3">
                    <p className="text-sm text-gray-700">Pour créditer les points après paiement et clôture, associez cette commande au compte du client inscrit.</p>
                    <Button type="button" variant="outline" className="mt-2" onClick={lookupLoyaltyCustomer} disabled={searchingLoyaltyCustomer}>
                      {searchingLoyaltyCustomer ? 'Recherche en cours…' : 'Rechercher le compte fidélité'}
                    </Button>
                    {linkedCustomer && <p className="mt-2 text-sm font-medium text-green-700">{linkedCustomer.full_name} · {linkedCustomer.loyalty_points} points</p>}
                  </div>}
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

                    {isStaffOrder && (
                      <div className="flex items-center space-x-2 p-4 border-2 rounded-xl hover:border-amber-400 cursor-pointer">
                        <RadioGroupItem value="sur_place" id="sur_place" />
                        <Label htmlFor="sur_place" className="flex items-center gap-2 cursor-pointer flex-1">
                          <MapPin className="w-5 h-5 text-amber-600" />
                          <div>
                            <p className="font-semibold">Sur place</p>
                            <p className="text-sm text-gray-500">Dégustation au restaurant</p>
                          </div>
                        </Label>
                      </div>
                    )}

                    {!isStaffOrder && <div className="flex items-center space-x-2 p-4 border-2 rounded-xl hover:border-amber-400 cursor-pointer">
                      <RadioGroupItem value="livraison" id="livraison" />
                      <Label htmlFor="livraison" className="flex items-center gap-2 cursor-pointer flex-1">
                        <Truck className="w-5 h-5 text-amber-600" />
                        <div>
                          <p className="font-semibold">Livraison</p>
                          <p className="text-sm text-gray-500">Livré chez vous (+2000 FCFA)</p>
                        </div>
                      </Label>
                    </div>}
                  </RadioGroup>

                  {isStaffOrder && formData.order_type === 'sur_place' && (
                    <div className="mt-4 space-y-4">
                      <div>
                        <Label htmlFor="service-location">Lieu *</Label>
                        <select id="service-location" required value={formData.service_location} onChange={(e) => setFormData({ ...formData, service_location: e.target.value, service_location_name: serviceLocations.find(location => location.slug === e.target.value)?.name || '' })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                          <option value="">Choisir un lieu</option>
                          {serviceLocations.map(location => <option key={location.slug} value={location.slug}>{location.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="table-number">Numéro de table *</Label>
                        <Input id="table-number" required value={formData.table_number} onChange={(e) => setFormData({ ...formData, table_number: e.target.value })} />
                      </div>
                    </div>
                  )}

                  {isStaffOrder && (
                    <div className="mt-4">
                      <Label htmlFor="payment-method">Moyen de paiement prévu *</Label>
                      <select id="payment-method" required value={formData.payment_method} onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                        <option value="cash">Espèces</option>
                        <option value="card">Carte bancaire</option>
                        <option value="mobile_money">Mobile money</option>
                      </select>
                    </div>
                  )}

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

              {!isStaffOrder && <Card>
                <CardHeader><CardTitle>Code promo et récompenses</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {activePromo ? <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">
                    {activePromo.loyalty ? 'Votre récompense fidélité est appliquée automatiquement' : 'Code promo appliqué'} : <strong className="font-mono">{activePromo.code}</strong>
                    <Button type="button" variant="link" className="ml-2 p-0" onClick={() => { setActivePromo(null); setGiftRedemption(loyaltyClaims?.find(claim => claim.reward?.type === 'gifted_product') || null); }}>Retirer</Button>
                  </div> : <div className="flex gap-2">
                    <Input value={promoInput} onChange={event => setPromoInput(event.target.value.toUpperCase())} placeholder="Saisir un code promo" />
                    <Button type="button" variant="outline" onClick={applyPromoCode}>Appliquer</Button>
                  </div>}
                  {!activePromo && giftCartItem && <p className="text-sm text-green-700">Produit offert appliqué : {giftRedemption.reward.giftedProduct.name}</p>}
                  {!activePromo && giftRedemption && !giftCartItem && <p className="text-sm text-amber-800">Ajoutez {giftRedemption.reward.giftedProduct?.name} au panier pour bénéficier de votre produit offert.</p>}
                  {activePromo && <p className="text-sm text-green-700">Réduction : −{appliedDiscount.toLocaleString()} FCFA</p>}
                </CardContent>
              </Card>}

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-yellow-400 to-amber-600 hover:from-yellow-500 hover:to-amber-700 text-white py-6 rounded-2xl text-lg font-semibold shadow-lg"
              >
                {isStaffOrder ? "Continuer vers la confirmation" : "Procéder au paiement"}
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
                      {item.customizationSummary && (
                        <div className="text-xs text-gray-500 mt-1">
                          {item.customizationSummary}
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

                  {appliedDiscount > 0 && <div className="flex justify-between text-green-700"><span>{giftCartItem && !activePromo ? `Produit offert (${giftRedemption.reward.giftedProduct.name})` : 'Réduction promo'}</span><span>−{appliedDiscount.toLocaleString()} FCFA</span></div>}

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
