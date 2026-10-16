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
import { Label } from "../Components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../Components/ui/dialog";
import { toast } from 'react-hot-toast';
import api from "../services/api.service";

function normalizeGabonPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('00241')) {
    const national = digits.slice(5);
    if (national.length === 8) return `0${national}`;
    if (national.length === 9 && national.startsWith('0')) return national;
    return null;
  }
  if (digits.startsWith('241')) {
    const national = digits.slice(3);
    if (national.length === 8) return `0${national}`;
    if (national.length === 9 && national.startsWith('0')) return national;
    return null;
  }
  if (digits.startsWith('0') && digits.length === 9) return digits;
  if (digits.length === 8) return `0${digits}`;
  return null;
}

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
  const [paymentSettingsLoading, setPaymentSettingsLoading] = useState(true);
  const [paymentSettingsError, setPaymentSettingsError] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState('pvit');
  const [paymentSystemName, setPaymentSystemName] = useState('AIRTEL_MONEY');
  const [pvitPhone, setPvitPhone] = useState(formData?.customer_phone || '');
  const [simuMsisdn, setSimuMsisdn] = useState('077000001');
  const [createdOrder, setCreatedOrder] = useState(null);
  const isStaffOrder = user?.role === "serveur" && sessionStorage.getItem("kot_staff_order_mode") === "true";
  const ebillingOperators = paymentSettings?.ebilling_test_mode
    ? (user?.role === 'admin' ? [{ value: 'SIMU', label: 'SIMU · test Lab' }] : [])
    : [
      ...(paymentSettings?.mobile_money_airtel_enabled ? [{ value: 'airtelmoney', label: 'Airtel Money' }] : []),
      ...(paymentSettings?.mobile_money_moov_enabled ? [{ value: 'moovmoney', label: 'Moov Money' }] : [])
    ];
  const pvitOperators = [
    ...(paymentSettings?.pvit_airtel_enabled ? [{ value: 'AIRTEL_MONEY', label: 'Airtel Money' }] : []),
    ...(paymentSettings?.pvit_moov_enabled ? [{ value: 'MOOV_MONEY', label: 'Moov Money' }] : [])
  ];
  const ebillingAvailable = Boolean(paymentSettings?.ebilling_enabled && paymentSettings.mobile_money_enabled && ebillingOperators.length);
  const pvitAvailable = Boolean(paymentSettings?.pvit_enabled && paymentSettings.mobile_money_enabled && pvitOperators.length);
  const availableOperators = paymentProvider === 'pvit' ? pvitOperators : ebillingOperators;
  const mobileMoneyAvailable = (paymentProvider === 'pvit' && pvitAvailable) || (paymentProvider === 'ebilling' && ebillingAvailable);

  useEffect(() => {
    let active = true;
    api.get('/settings/payment')
      .then(response => {
        if (!active) return;
        setPaymentSettings(response.data);
        if (response.data.pvit_enabled) {
          setPaymentProvider('pvit');
          setPaymentSystemName(response.data.pvit_airtel_enabled ? 'AIRTEL_MONEY' : 'MOOV_MONEY');
        } else {
          setPaymentProvider('ebilling');
          const firstAvailable = response.data.mobile_money_airtel_enabled ? 'airtelmoney' : response.data.mobile_money_moov_enabled ? 'moovmoney' : '';
          if (response.data.ebilling_test_mode) setPaymentSystemName('SIMU');
          else if (firstAvailable) setPaymentSystemName(firstAvailable);
        }
      })
      .catch(() => { if (active) setPaymentSettingsError(true); })
      .finally(() => { if (active) setPaymentSettingsLoading(false); });
    return () => { active = false; };
  }, []);

  if (!cart || total == null) {
    navigate(createPageUrl("Checkout"));
    return null;
  }

  const handlePayment = async () => {
    if (!isStaffOrder && (paymentSettingsLoading || paymentSettingsError || !paymentSettings)) {
      toast.error(paymentSettingsError ? 'Impossible de charger les moyens de paiement. Actualisez la page pour réessayer.' : 'Patientez pendant le chargement des moyens de paiement.');
      return;
    }
    if (isStaffOrder && !isCodeDialogOpen) {
      setIsCodeDialogOpen(true);
      return;
    }
    if (isStaffOrder && !/^[a-z0-9]{6}$/i.test(serverCode)) {
      setServerCodeError("Saisissez le code serveur de 6 caractères.");
      return;
    }

    const normalizedPvitPhone = paymentProvider === 'pvit' && mobileMoneyAvailable ? normalizeGabonPhone(pvitPhone) : null;
    if (paymentProvider === 'pvit' && mobileMoneyAvailable && !normalizedPvitPhone) {
      toast.error('Saisissez un numéro gabonais valide pour recevoir le paiement.');
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
        const order = await Order.createStaff({
          ...orderData,
          payment_method: formData.payment_method,
          server_code: serverCode
        });
        sessionStorage.removeItem("kot_staff_order_mode");
        localStorage.removeItem('kingoftacos_cart');
        window.dispatchEvent(new Event('cart-updated'));
        navigate(createPageUrl("OrderSuccess"), {
          state: { guestOrder: { orderCode: order.order_code, phone: formData.customer_phone } }
        });
      } else {
        const useMobileMoney = mobileMoneyAvailable;
        const order = createdOrder || await Order.create({
          ...orderData,
          ...(useMobileMoney ? { payment_method: 'mobile_money' } : {})
        });
        if (useMobileMoney && !createdOrder) setCreatedOrder(order);

        localStorage.removeItem('kingoftacos_cart');
        window.dispatchEvent(new Event('cart-updated'));

        if (useMobileMoney && paymentProvider === 'pvit') {
          let initiationError = null;
          try {
            await api.post('/payments/pvit/create', {
              orderId: order.id, paymentStatusToken: order.payment_status_token, operatorCode: paymentSystemName, payerPhone: normalizedPvitPhone
            });
          } catch (error) {
            initiationError = error.response?.data?.message || 'Le démarrage du paiement PVit n’a pas pu être confirmé.';
          }
          navigate(createPageUrl("OrderSuccess"), {
            state: {
              pvitPayment: { orderId: order.id, orderCode: order.order_code, paymentStatusToken: order.payment_status_token, operatorCode: paymentSystemName, payerPhone: normalizedPvitPhone, initiationError },
              guestOrder: { orderCode: order.order_code, phone: formData.customer_phone }
            }
          });
        } else if (useMobileMoney) {
          let initiationError = null;
          try {
            await api.post('/payments/ebilling/ussd-push', {
              orderId: order.id, paymentStatusToken: order.payment_status_token, paymentSystemName,
              ...(paymentSystemName === 'SIMU' ? { payerMsisdn: simuMsisdn } : {})
            });
          } catch (error) {
            initiationError = error.response?.data?.message || 'Le démarrage du paiement n’a pas pu être confirmé.';
          }
          navigate(createPageUrl("OrderSuccess"), {
            state: {
              ebillingPayment: { orderId: order.id, orderCode: order.order_code, paymentStatusToken: order.payment_status_token, paymentSystemName, payerMsisdn: paymentSystemName === 'SIMU' ? simuMsisdn : undefined, initiationError },
              guestOrder: { orderCode: order.order_code, phone: formData.customer_phone }
            }
          });
        } else {
          navigate(createPageUrl("OrderSuccess"), {
            state: { guestOrder: { orderCode: order.order_code, phone: formData.customer_phone } }
          });
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
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
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
                      <div className="flex items-start justify-between gap-3">
                        <span className="min-w-0 flex-1 break-words">{item.quantity}x {item.product.name}</span>
                        <span className="shrink-0 text-right">{item.subtotal.toLocaleString()} FCFA</span>
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
                {!isStaffOrder && (paymentSettingsLoading || paymentSettingsError) && (
                  <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-gray-700" role="status">
                    {paymentSettingsLoading ? "Chargement des moyens de paiement..." : "Impossible de charger les moyens de paiement. Actualisez la page pour réessayer."}
                  </div>
                )}
                {!isStaffOrder && paymentSettings && !paymentSettingsLoading && !paymentSettingsError && (
                  <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    {mobileMoneyAvailable ? (
                      <>
                        {ebillingAvailable && pvitAvailable && (
                          <>
                            <Label htmlFor="mobile-money-provider">Prestataire de paiement</Label>
                            <select
                              id="mobile-money-provider"
                              value={paymentProvider}
                              onChange={event => {
                                const nextProvider = event.target.value;
                                setPaymentProvider(nextProvider);
                                const nextOperators = nextProvider === 'pvit' ? pvitOperators : ebillingOperators;
                                if (nextOperators.length) setPaymentSystemName(nextOperators[0].value);
                              }}
                              className="mt-2 h-11 w-full rounded-md border border-input bg-white px-3 text-sm"
                            >
                              <option value="pvit">MyPVIT</option>
                              <option value="ebilling">E-Billing</option>
                            </select>
                          </>
                        )}
                        <Label htmlFor="mobile-money-operator" className="mt-3 block">Paiement Mobile Money</Label>
                        <select
                          id="mobile-money-operator"
                          value={paymentSystemName}
                          onChange={event => setPaymentSystemName(event.target.value)}
                          className="mt-2 h-11 w-full rounded-md border border-input bg-white px-3 text-sm"
                        >
                          {availableOperators.map(operator => <option key={operator.value} value={operator.value}>{operator.label}</option>)}
                        </select>
                        {paymentProvider === 'pvit' ? (
                          <>
                            <Label htmlFor="pvit-payment-phone" className="mt-3 block">Numéro qui recevra la demande de paiement</Label>
                            <Input
                              id="pvit-payment-phone"
                              type="tel"
                              inputMode="tel"
                              autoComplete="tel"
                              value={pvitPhone}
                              onChange={event => setPvitPhone(event.target.value)}
                              placeholder="Ex. 074 12 34 56 ou +241 74 12 34 56"
                              required
                            />
                            <p className="mt-2 text-sm text-gray-600">Ce numéro peut différer du numéro de contact de la commande. Formats acceptés : 0XXXXXXXX, +241XXXXXXXX ou 00241XXXXXXXX. La commande ne partira en préparation qu’après confirmation MyPVIT.</p>
                          </>
                        ) : paymentSystemName === 'SIMU' ? (
                          <>
                            <Label htmlFor="simu-msisdn" className="mt-3 block">Numéro de scénario SIMU</Label>
                            <Input id="simu-msisdn" value={simuMsisdn} onChange={event => setSimuMsisdn(event.target.value)} placeholder="077000001" />
                            <p className="mt-2 text-sm text-gray-600">Le simulateur ne déclenche pas d’appel sur un téléphone réel. Utilisez l’un des numéros de scénario du guide E-Billing.</p>
                          </>
                        ) : (
                          <p className="mt-2 text-sm text-gray-600">Une demande de paiement sera envoyée au {formData.customer_phone}. La commande ne partira en préparation qu’après confirmation par E-Billing.</p>
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
              disabled={isSubmitting || (!isStaffOrder && (paymentSettingsLoading || paymentSettingsError || !paymentSettings))}
              className="w-full mt-6 bg-gradient-to-r from-yellow-400 to-amber-600 hover:from-yellow-500 hover:to-amber-700 text-slate-900 py-6 rounded-2xl text-lg font-semibold shadow-lg"
            >
              {isSubmitting ? "Traitement..." : !isStaffOrder && paymentSettingsLoading ? "Chargement des moyens de paiement..." : isStaffOrder ? "Confirmer la commande" : mobileMoneyAvailable ? "Continuer avec Mobile Money" : "Confirmer la commande"}
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
                {formData.order_type === "livraison" && <>
                  <p><strong>Adresse:</strong> {formData.delivery_address}</p>
                  <p className="mt-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">Les frais de livraison seront réglés directement au livreur partenaire et ne sont pas compris dans le montant payé à King Of Tacos.</p>
                </>}
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
