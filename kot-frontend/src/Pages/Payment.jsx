import React, { useEffect, useState } from "react";
import { Order } from "../Entities/Order";
import { motion } from "framer-motion";
import { Button } from "../Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../Components/ui/card";
import { ArrowLeft, CreditCard } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "../utils";
import { formatCustomization } from "../utils/customization";
import { useAuthContext } from "../contexts/AuthContext";
import { Input } from "../Components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../Components/ui/dialog";
import { toast } from 'react-hot-toast';
import api from "../services/api.service";

export default function Payment() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthContext();
  const { cart, formData, total, pre_discount_total, pre_discount_subtotal, promo_code, gifted_redemption_id, loyalty_discount } = location.state || {};
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverCode, setServerCode] = useState("");
  const [serverCodeError, setServerCodeError] = useState("");
  const [isCodeDialogOpen, setIsCodeDialogOpen] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState(null);
  const [paymentSystemName, setPaymentSystemName] = useState('airtelmoney');
  const [simuMsisdn, setSimuMsisdn] = useState('077000001');
  const [createdOrder, setCreatedOrder] = useState(null);
  const isStaffOrder = user?.role === "serveur" && sessionStorage.getItem("kot_staff_order_mode") === "true";
  const availableOperators = [
    ...(paymentSettings?.mobile_money_airtel_enabled ? [{ value: 'airtelmoney', label: 'Airtel Money' }] : []),
    ...(paymentSettings?.mobile_money_moov_enabled ? [{ value: 'moovmoney', label: 'Moov Money' }] : []),
    ...(paymentSettings?.ebilling_test_mode ? [{ value: 'SIMU', label: 'SIMU · test Lab' }] : [])
  ];
  const ebillingAvailable = Boolean(paymentSettings?.ebilling_enabled && paymentSettings.mobile_money_enabled && availableOperators.length);

  useEffect(() => {
    let active = true;
    api.get('/settings/payment')
      .then(response => {
        if (!active) return;
        setPaymentSettings(response.data);
        const firstAvailable = response.data.mobile_money_airtel_enabled
          ? 'airtelmoney'
          : response.data.mobile_money_moov_enabled ? 'moovmoney' : '';
        if (response.data.ebilling_test_mode) setPaymentSystemName('SIMU');
        else if (firstAvailable) setPaymentSystemName(firstAvailable);
      })
      .catch(() => { if (active) setPaymentSettings({ ebilling_enabled: false }); });
    return () => { active = false; };
  }, []);

  if (!cart || total == null) {
    navigate(createPageUrl("Checkout"));
    return null;
  }

  const handlePayment = async () => {
    if (isStaffOrder && !isCodeDialogOpen) {
      setIsCodeDialogOpen(true);
      return;
    }
    if (isStaffOrder && !/^[a-z0-9]{6}$/i.test(serverCode)) {
      setServerCodeError("Saisissez le code serveur de 6 caractères.");
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('Cart before filtering:', cart);
      const orderItems = cart.filter(item => item.product).map(item => ({
        product_id: item.product.id,
        product_name: item.product.name,
        quantity: item.quantity,
        price: item.subtotal / item.quantity,
        customization: item.customization,
        customizationSummary: item.customizationSummary
      }));
      console.log('Order items to send:', orderItems);

      const orderData = {
        items: orderItems,
        total_amount: total,
        pre_discount_total: pre_discount_total ?? total,
        pre_discount_subtotal: pre_discount_subtotal ?? total,
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone,
        customer_email: formData.customer_email,
        order_type: formData.order_type,
        service_location: formData.service_location,
        delivery_address: formData.delivery_address,
        table_number: formData.table_number,
        pickup_time: formData.pickup_time,
        notes: formData.notes,
        loyalty_customer_id: formData.loyalty_customer_id || null,
        promo_code: promo_code || null,
        gifted_redemption_id: gifted_redemption_id || null
      };

      if (isStaffOrder) {
        await Order.createStaff({
          ...orderData,
          payment_method: formData.payment_method,
          server_code: serverCode
        });
        sessionStorage.removeItem("kot_staff_order_mode");
        localStorage.removeItem('kingoftacos_cart');
        window.dispatchEvent(new Event('storage'));
        navigate(createPageUrl("OrderSuccess"));
      } else {
        const useEbilling = ebillingAvailable;
        const order = createdOrder || await Order.create({
          ...orderData,
          ...(useEbilling ? { payment_method: 'mobile_money' } : {})
        });
        if (useEbilling && !createdOrder) setCreatedOrder(order);

        localStorage.removeItem('kingoftacos_cart');
        window.dispatchEvent(new Event('storage'));

        if (useEbilling) {
          let initiationError = null;
          try {
            await api.post('/payments/ebilling/ussd-push', {
              orderId: order.id,
              paymentStatusToken: order.payment_status_token,
              paymentSystemName,
              ...(paymentSystemName === 'SIMU' ? { payerMsisdn: simuMsisdn } : {})
            });
          } catch (error) {
            initiationError = error.response?.data?.message || 'Le démarrage du paiement n’a pas pu être confirmé.';
          }
          navigate(createPageUrl("OrderSuccess"), {
            state: {
              ebillingPayment: {
                orderId: order.id,
                orderCode: order.order_code,
                paymentStatusToken: order.payment_status_token,
                paymentSystemName,
                payerMsisdn: paymentSystemName === 'SIMU' ? simuMsisdn : undefined,
                initiationError
              }
            }
          });
        } else {
          navigate(createPageUrl("OrderSuccess"));
        }
      }
    } catch (error) {
      console.error("Error creating order:", error);
      if (isStaffOrder) setServerCodeError(error.response?.data?.message || "Impossible de valider le code serveur.");
      else toast.error(error.response?.data?.message || 'Impossible de créer la commande. Vérifiez le code promo et réessayez.');
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
            {isStaffOrder ? "Confirmer la commande" : "Paiement"}
          </h1>
          <p className="text-gray-600">{isStaffOrder ? "Vérifiez la commande avant son envoi en cuisine" : "Vérifiez votre commande et procédez au paiement"}</p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Récapitulatif de la commande</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {cart.filter(item => item.product).map((item, index) => (
                    <div key={`${item.product.id}-${index}`}>
                      <div className="flex justify-between">
                        <span>{item.quantity}x {item.product.name}</span>
                        <span>{item.subtotal.toLocaleString()} FCFA</span>
                      </div>
                      {item.customizationSummary && (
                        <div className="text-xs text-gray-500 mt-1 ml-4">
                          {item.customizationSummary}
                        </div>
                      )}
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
                  {loyalty_discount > 0 && <p className="mt-2 text-right text-sm text-green-700">Avantage fidélité / promo : −{loyalty_discount.toLocaleString()} FCFA</p>}
                </div>
                {!isStaffOrder && paymentSettings && (
                  <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    {ebillingAvailable ? (
                      <>
                        <Label htmlFor="mobile-money-operator">Paiement Mobile Money</Label>
                        <select
                          id="mobile-money-operator"
                          value={paymentSystemName}
                          onChange={event => setPaymentSystemName(event.target.value)}
                          className="mt-2 h-11 w-full rounded-md border border-input bg-white px-3 text-sm"
                        >
                          {availableOperators.map(operator => <option key={operator.value} value={operator.value}>{operator.label}</option>)}
                        </select>
                        {paymentSystemName === 'SIMU' ? (
                          <>
                            <Label htmlFor="simu-msisdn" className="mt-3 block">Numéro de scénario SIMU</Label>
                            <Input id="simu-msisdn" value={simuMsisdn} onChange={event => setSimuMsisdn(event.target.value)} placeholder="077000001" />
                            <p className="mt-2 text-sm text-gray-600">Le simulateur ne déclenche pas d’appel sur un téléphone réel. Utilisez l’un des numéros de scénario du guide E-Billing.</p>
                          </>
                        ) : (
                          <p className="mt-2 text-sm text-gray-600">Un message de confirmation sera envoyé au {formData.customer_phone}. La commande ne sera confirmée qu’après validation du paiement par E-Billing.</p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-gray-600">Le paiement Mobile Money en ligne n’est pas encore activé. Vous pouvez confirmer la commande et régler au retrait ou à la livraison.</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Button
              onClick={handlePayment}
              disabled={isSubmitting}
              className="w-full mt-6 bg-gradient-to-r from-yellow-400 to-amber-600 hover:from-yellow-500 hover:to-amber-700 text-white py-6 rounded-2xl text-lg font-semibold shadow-lg"
            >
              {isSubmitting ? "Traitement..." : isStaffOrder ? "Confirmer la commande" : ebillingAvailable ? "Continuer avec Mobile Money" : "Confirmer la commande"}
              <CreditCard className="ml-2 w-5 h-5" />
            </Button>
          </div>

          <div>
            <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200">
              <CardHeader>
                <CardTitle>Informations de commande</CardTitle>
              </CardHeader>
              <CardContent>
                <p><strong>Nom:</strong> {formData.customer_name}</p>
                <p><strong>Téléphone:</strong> {formData.customer_phone}</p>
                <p><strong>Type:</strong> {formData.order_type === "livraison" ? "Livraison" : formData.order_type === "sur_place" ? "Sur place" : "À emporter"}</p>
                {formData.table_number && <p><strong>Table:</strong> {formData.table_number}</p>}
                {formData.service_location && <p><strong>Lieu:</strong> {formData.service_location_name || formData.service_location}</p>}
                {isStaffOrder && <p><strong>Paiement prévu:</strong> {formData.payment_method}</p>}
                {formData.order_type === "livraison" && <p><strong>Adresse:</strong> {formData.delivery_address}</p>}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={isCodeDialogOpen} onOpenChange={(open) => {
        setIsCodeDialogOpen(open);
        if (!open) { setServerCode(""); setServerCodeError(""); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la prise de commande</DialogTitle>
            <DialogDescription>Saisissez votre code serveur avant l’envoi en cuisine.</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            autoComplete="off"
            maxLength={6}
            value={serverCode}
            onChange={(event) => { setServerCode(event.target.value.toUpperCase()); setServerCodeError(""); }}
            className="text-center text-xl tracking-[0.3em] uppercase"
            aria-label="Code serveur à 6 caractères"
          />
          {serverCodeError && <p className="text-sm text-red-600" role="alert">{serverCodeError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCodeDialogOpen(false)}>Annuler</Button>
            <Button onClick={handlePayment} disabled={isSubmitting || serverCode.length !== 6} className="bg-amber-500 hover:bg-amber-600">
              {isSubmitting ? "Vérification..." : "Valider et envoyer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
