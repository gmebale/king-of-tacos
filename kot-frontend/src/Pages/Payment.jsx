import React, { useState, useEffect } from "react";
import { Order } from "../Entities/Order";
import { motion } from "framer-motion";
import { Button } from "../Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../Components/ui/card";
import { ArrowLeft, CreditCard, Wallet } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "../utils";
import { PaymentService } from "../services/payment.service";
import api from "../services/api.service";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useElements, useStripe } from "@stripe/react-stripe-js";

const stripePromise = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY)
  : null;

function StripeCardForm({ clientSecret, amount, onSuccess, onError }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [localError, setLocalError] = useState("");

  const handleSubmit = async () => {
    if (!stripe || !elements || !clientSecret) return;
    setProcessing(true);
    setLocalError("");

    const card = elements.getElement(CardElement);
    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card,
      },
    });

    if (error) {
      setLocalError(error.message || "Paiement refusé");
      onError?.(error);
    } else if (paymentIntent?.status === "succeeded") {
      onSuccess();
    }

    setProcessing(false);
  };

  return (
    <div className="mt-4 space-y-3">
      <CardElement className="p-3 border rounded-md bg-white" />
      {localError && <p className="text-sm text-red-600">{localError}</p>}
      <Button onClick={handleSubmit} disabled={processing || !stripe} className="w-full">
        {processing ? "Validation..." : `Payer ${amount?.toLocaleString()} FCFA`}
      </Button>
    </div>
  );
}

export default function Payment() {
  const navigate = useNavigate();
  const location = useLocation();
  const { cart, formData, total, isStaff: isStaffFromState } = location.state || {};
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [orderMode, setOrderMode] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [mobileMoneyProvider, setMobileMoneyProvider] = useState("airtel");
  const [mobileMoneyPhone, setMobileMoneyPhone] = useState("");
  const [mobileMoneyMessage, setMobileMoneyMessage] = useState("");
  const [mobileMoneyScreenshots, setMobileMoneyScreenshots] = useState([]);
  const [uploadingScreenshots, setUploadingScreenshots] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState({
    mobile_money_enabled: true,
    mobile_money_airtel_enabled: true,
    mobile_money_mobicash_enabled: true
  });
  const [loadingPaymentSettings, setLoadingPaymentSettings] = useState(true);

  if (!cart || !total) {
    navigate(createPageUrl("Checkout"));
    return null;
  }

  const filteredCart = cart.filter((item) => item.product);
  const isOnlineAllowed = ["livraison", "emporter", "pickup"].includes(formData?.order_type);
  const isMobileMoneyAllowedType = ["livraison", "emporter", "pickup"].includes(formData?.order_type);

  useEffect(() => {
    const loadPaymentSettings = async () => {
      try {
        const response = await api.get('/settings/payment');
        setPaymentSettings(response.data);
      } catch (error) {
        console.error("Error loading payment settings:", error);
      } finally {
        setLoadingPaymentSettings(false);
      }
    };

    loadPaymentSettings();
  }, []);

  useEffect(() => {
    if (loadingPaymentSettings) return;
    const enabledProviders = [];
    if (paymentSettings.mobile_money_airtel_enabled) enabledProviders.push("airtel");
    if (paymentSettings.mobile_money_mobicash_enabled) enabledProviders.push("mobicash");
    if (!enabledProviders.includes(mobileMoneyProvider)) {
      setMobileMoneyProvider(enabledProviders[0] || "");
    }
  }, [loadingPaymentSettings, paymentSettings, mobileMoneyProvider]);
  const isOnSite = formData?.order_type === "sur_place";
  const isStaff = Boolean(isStaffFromState);

  const clearCartAndRedirect = () => {
    localStorage.removeItem("kingoftacos_cart");
    window.dispatchEvent(new Event("storage"));
    navigate(createPageUrl("OrderSuccess"));
  };

  const createOrderIfNeeded = async (mode = "online", paymentDetails = {}) => {
    setErrorMessage("");
    if (orderId && orderMode === mode) return orderId;

    const orderItems = filteredCart.map((item) => ({
      product_name: item.product.name,
      quantity: item.quantity,
      price: item.subtotal / item.quantity,
      customization: item.customization,
      customizationSummary: item.customizationSummary,
    }));

    const payload = {
      items: orderItems,
      total_amount: total,
      customer_name: formData.customer_name,
      customer_phone: formData.customer_phone,
      customer_email: formData.customer_email,
      order_type: formData.order_type,
      delivery_address: formData.delivery_address,
      pickup_time: formData.pickup_time,
      notes: formData.notes,
      pay_on_delivery: mode === "cash_on_delivery",
      payment_method: paymentDetails.payment_method,
      mobile_money_provider: paymentDetails.mobile_money_provider,
      mobile_money_phone: paymentDetails.mobile_money_phone,
      mobile_money_message: paymentDetails.mobile_money_message,
      mobile_money_screenshots: paymentDetails.mobile_money_screenshots
    };

    const created = await Order.create(payload);
    setOrderId(created.id);
    setOrderMode(mode);
    return created.id;
  };

  const handlePayOnDelivery = async () => {
    setIsSubmitting(true);
    try {
      await createOrderIfNeeded("cash_on_delivery");
      clearCartAndRedirect();
    } catch (error) {
      console.error("Error creating pay-on-delivery order:", error);
      setErrorMessage(error.response?.data?.message || "Erreur lors de la création de la commande");
    }
    setIsSubmitting(false);
  };

  const handleStripePayment = async () => {
    if (!stripePromise) {
      setErrorMessage("Clé Stripe manquante (REACT_APP_STRIPE_PUBLISHABLE_KEY).");
      return;
    }

    setIsSubmitting(true);
    try {
      const createdOrderId = await createOrderIfNeeded("online");
      const { clientSecret: secret } = await PaymentService.createStripeIntent(createdOrderId);
      setClientSecret(secret);
    } catch (error) {
      console.error("Error starting Stripe payment:", error);
      setErrorMessage(error.response?.data?.message || "Erreur Stripe");
    }
    setIsSubmitting(false);
  };

  const handlePaypalPayment = async () => {
    setIsSubmitting(true);
    try {
      const createdOrderId = await createOrderIfNeeded("online");
      const { approveUrl } = await PaymentService.createPaypalOrder(createdOrderId);
      if (approveUrl) {
        window.location.href = approveUrl;
      } else {
        setErrorMessage("Lien PayPal non disponible");
      }
    } catch (error) {
      console.error("Error starting PayPal payment:", error);
      setErrorMessage(error.response?.data?.message || "Erreur PayPal");
    }
    setIsSubmitting(false);
  };

  const handleStripeSuccess = () => {
    clearCartAndRedirect();
  };

  const handleOnSiteValidation = async () => {
    if (!isStaff) {
      setErrorMessage("Le mode sur place est réservé au staff.");
      return;
    }
    setIsSubmitting(true);
    try {
      await createOrderIfNeeded("on_site");
      clearCartAndRedirect();
    } catch (error) {
      console.error("Error creating on-site order:", error);
      setErrorMessage(error.response?.data?.message || "Erreur lors de la création de la commande");
    }
    setIsSubmitting(false);
  };

  const isMobileMoneyReady = mobileMoneyPhone.trim() && (mobileMoneyMessage.trim() || mobileMoneyScreenshots.length > 0);
  const handleMobileMoneyPayment = async () => {
    if (!paymentSettings.mobile_money_enabled) {
      setErrorMessage("Le mobile money est désactivé pour le moment.");
      return;
    }
    if (!paymentSettings.mobile_money_airtel_enabled && !paymentSettings.mobile_money_mobicash_enabled) {
      setErrorMessage("Aucun opérateur mobile money n'est disponible.");
      return;
    }
    if (!isMobileMoneyReady) {
      setErrorMessage("Veuillez renseigner le numéro et au moins le message ou une capture d'écran.");
      return;
    }
    setIsSubmitting(true);
    try {
      await createOrderIfNeeded("mobile_money", {
        payment_method: "mobile_money",
        mobile_money_provider: mobileMoneyProvider,
        mobile_money_phone: mobileMoneyPhone,
        mobile_money_message: mobileMoneyMessage,
        mobile_money_screenshots: mobileMoneyScreenshots.length > 0 ? mobileMoneyScreenshots : undefined
      });
      clearCartAndRedirect();
    } catch (error) {
      console.error("Error creating mobile money order:", error);
      setErrorMessage(error.response?.data?.message || "Erreur lors de la création de la commande");
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
          <p className="text-gray-600">Vérifiez votre commande et choisissez votre mode de paiement</p>
        </motion.div>

        {errorMessage && (
          <div className="mb-6 p-4 rounded-md border border-red-200 bg-red-50 text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Récapitulatif de la commande</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredCart.map((item, index) => (
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
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-3 mt-6">
              {formData.order_type === "livraison" && (
                <Button
                  onClick={handlePayOnDelivery}
                  disabled={isSubmitting}
                  variant="outline"
                  className="w-full py-4 text-amber-700 border-amber-300 hover:border-amber-400"
                >
                  {isSubmitting ? "Traitement..." : "Payer à la livraison"}
                </Button>
              )}

              {isOnSite && isStaff && (
                <div className="p-4 rounded-md border border-amber-200 bg-amber-50 text-amber-800">
                  Paiement sur place uniquement. Validez pour enregistrer la commande.
                  <Button
                    onClick={handleOnSiteValidation}
                    disabled={isSubmitting}
                    className="w-full mt-3 bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {isSubmitting ? "Traitement..." : "Valider (paiement sur place)"}
                  </Button>
                </div>
              )}

              {isOnSite && !isStaff && (
                <div className="p-4 rounded-md border border-amber-200 bg-amber-50 text-amber-800">
                  Le mode sur place est réservé au staff.
                  <Button
                    onClick={() => navigate(createPageUrl("Checkout"))}
                    variant="outline"
                    className="w-full mt-3"
                  >
                    Retour à la commande
                  </Button>
                </div>
              )}

              {isOnlineAllowed && (
                <>
                  <Button
                    onClick={handleStripePayment}
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-yellow-400 to-amber-600 hover:from-yellow-500 hover:to-amber-700 text-white py-4 rounded-2xl text-lg font-semibold shadow-lg"
                  >
                    {isSubmitting ? "Traitement..." : "Payer par carte (Stripe)"}
                    <CreditCard className="ml-2 w-5 h-5" />
                  </Button>

                  <Button
                    onClick={handlePaypalPayment}
                    disabled={isSubmitting}
                    variant="secondary"
                    className="w-full py-4 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? "Redirection..." : "Payer avec PayPal"}
                    <Wallet className="w-5 h-5" />
                  </Button>

                  {paymentSettings.mobile_money_enabled && isMobileMoneyAllowedType && (
                    <Card className="border-amber-200">
                      <CardHeader>
                        <CardTitle className="text-base">Payer par mobile money</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Opérateur
                          </label>
                          <select
                            value={mobileMoneyProvider}
                            onChange={(e) => setMobileMoneyProvider(e.target.value)}
                            className="w-full rounded-md border border-amber-200 bg-white px-3 py-2"
                          >
                            {paymentSettings.mobile_money_airtel_enabled && (
                              <option value="airtel">AIRTEL Money</option>
                            )}
                            {paymentSettings.mobile_money_mobicash_enabled && (
                              <option value="mobicash">Mobicash</option>
                            )}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Numéro de l'expéditeur
                          </label>
                          <input
                            type="tel"
                            value={mobileMoneyPhone}
                            onChange={(e) => setMobileMoneyPhone(e.target.value)}
                            placeholder="Ex: 0770 00 00 00"
                            className="w-full rounded-md border border-amber-200 bg-white px-3 py-2"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Message de transaction (preuve)
                          </label>
                          <textarea
                            rows={3}
                            value={mobileMoneyMessage}
                            onChange={(e) => setMobileMoneyMessage(e.target.value)}
                            placeholder="Collez ici le SMS de paiement"
                            className="w-full rounded-md border border-amber-200 bg-white px-3 py-2"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Capture d'écran (optionnel)
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={async (e) => {
                              const files = Array.from(e.target.files);
                              if (files.length === 0) return;
                              
                              setUploadingScreenshots(true);
                              try {
                                const uploadPromises = files.map(async (file) => {
                                  const formData = new FormData();
                                  formData.append('file', file);
                                  const response = await api.post('/upload', formData, {
                                    headers: { 'Content-Type': 'multipart/form-data' }
                                  });
                                  return response.data.file_url;
                                });
                                const urls = await Promise.all(uploadPromises);
                                setMobileMoneyScreenshots([...mobileMoneyScreenshots, ...urls]);
                              } catch (error) {
                                console.error('Upload error:', error);
                                setErrorMessage('Erreur lors de l\'upload des captures d\'écran');
                              } finally {
                                setUploadingScreenshots(false);
                              }
                            }}
                            className="w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-sm"
                            disabled={uploadingScreenshots}
                          />
                          {mobileMoneyScreenshots.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {mobileMoneyScreenshots.map((url, idx) => (
                                <div key={idx} className="relative">
                                  <img src={url} alt={`Capture ${idx + 1}`} className="w-20 h-20 object-cover rounded border" />
                                  <button
                                    type="button"
                                    onClick={() => setMobileMoneyScreenshots(mobileMoneyScreenshots.filter((_, i) => i !== idx))}
                                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <Button
                          onClick={handleMobileMoneyPayment}
                          disabled={isSubmitting || !isMobileMoneyReady || !mobileMoneyProvider}
                          className="w-full bg-amber-700 hover:bg-amber-800 text-white"
                        >
                          {isSubmitting ? "Traitement..." : "Confirmer le paiement mobile money"}
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}

              {!isOnlineAllowed && (
                <div className="p-4 rounded-md border border-amber-200 bg-amber-50 text-amber-800">
                  Les paiements en ligne sont disponibles uniquement pour la livraison ou le pickup.
                </div>
              )}

              {clientSecret && stripePromise && (
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <StripeCardForm
                    clientSecret={clientSecret}
                    amount={total}
                    onSuccess={handleStripeSuccess}
                    onError={(err) => setErrorMessage(err?.message || "Erreur de paiement")}
                  />
                </Elements>
              )}
            </div>
          </div>

          <div>
            <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200">
              <CardHeader>
                <CardTitle>Informations de livraison</CardTitle>
              </CardHeader>
              <CardContent>
                <p><strong>Nom:</strong> {formData.customer_name}</p>
                <p><strong>Téléphone:</strong> {formData.customer_phone}</p>
                <p><strong>Type:</strong> {formData.order_type === "livraison" ? "Livraison" : formData.order_type === "pickup" ? "À emporter" : formData.order_type}</p>
                {formData.order_type === "livraison" && <p><strong>Adresse:</strong> {formData.delivery_address}</p>}
                {formData.pickup_time && <p><strong>Heure de retrait:</strong> {formData.pickup_time}</p>}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
