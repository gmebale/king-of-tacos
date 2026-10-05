import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, Home, List, Smartphone, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "../Components/ui/button";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "../utils";
import api from "../services/api.service";

export default function OrderSuccess() {
  const location = useLocation();
  const ebillingPayment = location.state?.ebillingPayment;
  const [paymentStatus, setPaymentStatus] = useState(ebillingPayment ? 'requires_action' : 'paid');
  const [providerState, setProviderState] = useState('');
  const [pushState, setPushState] = useState('');
  const [statusMessage, setStatusMessage] = useState(ebillingPayment?.initiationError || '');
  const [paymentConflict, setPaymentConflict] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!ebillingPayment?.orderId || !ebillingPayment?.paymentStatusToken) return undefined;
    let active = true;
    let timer;
    let attempts = 0;

    const checkPayment = async () => {
      try {
        const response = await api.get(`/payments/ebilling/status/${encodeURIComponent(ebillingPayment.orderId)}`, {
          headers: { 'X-Payment-Token': ebillingPayment.paymentStatusToken }
        });
        if (!active) return;
        setPaymentStatus(response.data.paymentStatus);
        setProviderState(response.data.providerState || '');
        setPushState(response.data.pushState || '');
        setPaymentConflict(Boolean(response.data.conflict));
        setStatusMessage(response.data.conflict ? 'Le paiement est reçu, mais la commande est clôturée ou annulée. Contactez le restaurant.' : '');
        if (!['paid', 'failed'].includes(response.data.paymentStatus) && attempts++ < 24) {
          timer = setTimeout(checkPayment, 5000);
        } else if (!['paid', 'failed'].includes(response.data.paymentStatus)) {
          setStatusMessage('Le paiement est toujours en attente. Vous pouvez quitter cette page ; la confirmation sera synchronisée lors du prochain suivi.');
        }
      } catch (_error) {
        if (!active) return;
        if (attempts++ < 24) timer = setTimeout(checkPayment, 8000);
        else setStatusMessage('Impossible de joindre E-Billing pour le moment. Réessayez dans quelques instants.');
      }
    };

    checkPayment();
    return () => { active = false; clearTimeout(timer); };
  }, [ebillingPayment, retryCount]);

  useEffect(() => {
    if (ebillingPayment && (paymentStatus !== 'paid' || paymentConflict)) return;
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
      ], { duration: 3000 + Math.random() * 2000, easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' });
      animation.onfinish = () => confetti.remove();
    }
  }, [ebillingPayment, paymentStatus, paymentConflict]);

  const retryPayment = async () => {
    if (!ebillingPayment) return;
    setRetrying(true);
    setStatusMessage('');
    try {
      await api.post('/payments/ebilling/ussd-push', {
        orderId: ebillingPayment.orderId,
        paymentStatusToken: ebillingPayment.paymentStatusToken,
        paymentSystemName: ebillingPayment.paymentSystemName,
        ...(ebillingPayment.paymentSystemName === 'SIMU' ? { payerMsisdn: ebillingPayment.payerMsisdn } : {})
      });
      setPaymentStatus('requires_action');
      setProviderState('accepted');
      setRetryCount(count => count + 1);
    } catch (error) {
      setStatusMessage(error.response?.data?.message || 'Impossible de relancer la demande.');
    } finally {
      setRetrying(false);
    }
  };

  const isPaid = !ebillingPayment || paymentStatus === 'paid';
  const isFailed = paymentStatus === 'failed';

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-10">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-lg w-full"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
          className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl ${isPaid ? 'bg-gradient-to-br from-green-400 to-emerald-600' : isFailed ? 'bg-red-100' : 'bg-amber-100'}`}
        >
          {isPaid ? <CheckCircle className="w-14 h-14 text-white" /> : isFailed ? <AlertCircle className="w-12 h-12 text-red-600" /> : <Smartphone className="w-12 h-12 text-amber-600" />}
        </motion.div>

        <h1 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">
          {!ebillingPayment ? 'Commande confirmée !' : paymentConflict ? 'Paiement reçu, vérification nécessaire' : isPaid ? 'Paiement confirmé !' : isFailed ? 'Paiement non abouti' : 'Confirmez sur votre téléphone'}
        </h1>
        {ebillingPayment?.orderCode && <p className="mb-3 text-gray-600">Commande {ebillingPayment.orderCode}</p>}
        <p className="text-lg text-gray-600 mb-3">
          {!ebillingPayment
            ? 'Votre commande a bien été enregistrée.'
            : paymentConflict
              ? 'Le paiement est confirmé, mais la commande est déjà clôturée ou annulée. Le restaurant doit vérifier la situation avant toute préparation.'
              : isPaid
              ? 'E-Billing a confirmé le paiement. Votre commande est en préparation.'
              : isFailed
                ? 'E-Billing a signalé un échec. Vérifiez votre numéro et réessayez.'
                : ebillingPayment.paymentSystemName === 'SIMU'
                  ? 'Demande transmise au simulateur E-Billing. Aucun appel ne sera envoyé à un téléphone réel.'
                  : `Une demande ${ebillingPayment.paymentSystemName === 'moovmoney' ? 'Moov Money' : 'Airtel Money'} a été envoyée au téléphone associé à la commande.`}
        </p>
        {ebillingPayment && !isPaid && !isFailed && <p className="mb-4 text-sm text-gray-500">État facture : {providerState || 'en attente'}{pushState ? ` · Push USSD : ${pushState}` : ''} · La commande ne partira en préparation qu’après confirmation du paiement.</p>}
        {statusMessage && <p className="mb-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900" role="status">{statusMessage}</p>}
        {ebillingPayment && !isPaid && !isFailed && !statusMessage && <p className="mb-5 flex items-center justify-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />Vérification du paiement…</p>}

        <div className="space-y-3">
          {ebillingPayment && (isFailed || ebillingPayment.initiationError) && (
            <Button onClick={retryPayment} disabled={retrying} className="w-full bg-amber-500 hover:bg-amber-600 py-5">
              {retrying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Réessayer avec {ebillingPayment.paymentSystemName === 'moovmoney' ? 'Moov Money' : ebillingPayment.paymentSystemName === 'SIMU' ? 'SIMU' : 'Airtel Money'}
            </Button>
          )}
          <Link to={createPageUrl("OrdersPage")}>
            <Button className="w-full bg-gradient-to-r from-yellow-400 to-amber-600 hover:from-yellow-500 hover:to-amber-700 text-white py-5 rounded-2xl text-lg">
              <List className="mr-2 h-5 w-5" />Suivre ma commande
            </Button>
          </Link>
          <Link to={createPageUrl("Home")}>
            <Button variant="outline" className="w-full border-2 border-amber-400 text-amber-600 hover:bg-amber-50 py-5 rounded-2xl text-lg">
              <Home className="mr-2 h-5 w-5" />Retour à l'accueil
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
