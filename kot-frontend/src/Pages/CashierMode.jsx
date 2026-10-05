import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DollarSign,
  FileText,
  TrendingUp,
  Download,
  CheckCircle,
  Truck,
  Package,
  Calendar,
  BarChart3,
  Lock,
  Unlock,
  Calculator,
  Volume2,
  VolumeX
} from "lucide-react";
import { Button } from "../Components/ui/button";
import { Badge } from "../Components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../Components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../Components/ui/tabs";
import { Input } from "../Components/ui/input";
import { Label } from "../Components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../Components/ui/dialog";
import { Textarea } from "../Components/ui/textarea";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import api from "../services/api.service";
import { formatCustomizationForDisplay } from "../utils/index";

export default function CashierMode() {
  const [orders, setOrders] = useState([]);
  const [reports, setReports] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('day');
  const [cashRegisterSession, setCashRegisterSession] = useState(null);
  const [isOpeningRegister, setIsOpeningRegister] = useState(false);
  const [isClosingRegister, setIsClosingRegister] = useState(false);
  const [openingBalance, setOpeningBalance] = useState('');
  const [closingBalance, setClosingBalance] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState(false);
  const [soundError, setSoundError] = useState('');
  const audioContextRef = useRef(null);
  const soundEnabledRef = useRef(false);
  const notifiedOrderIdsRef = useRef(null);

  useEffect(() => {
    loadOrders();
    loadReports(selectedPeriod);
    loadCashRegisterSession();
    const interval = setInterval(loadOrders, 30000);
    return () => clearInterval(interval);
  }, [selectedPeriod]);

  const loadOrders = async () => {
    try {
      const response = await api.get('/cashier/orders');
      const nextOrders = response.data;
      const readyOrderIds = new Set(
        nextOrders
          .filter(order => (
            order.order_type === 'sur_place'
              ? order.status === 'servie'
              : order.status === 'prete'
          ))
          .map(order => order.id)
      );
      const notifiedOrderIds = notifiedOrderIdsRef.current;

      if (
        notifiedOrderIds &&
        soundEnabledRef.current &&
        [...readyOrderIds].some(orderId => !notifiedOrderIds.has(orderId))
      ) {
        playOrderAlert();
      }

      notifiedOrderIdsRef.current = readyOrderIds;
      setOrders(nextOrders);
    } catch (error) {
      console.error('Error loading cashier orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const playOrderAlert = async () => {
    const audioContext = audioContextRef.current;
    if (!audioContext) return;

    try {
      if (audioContext.state !== 'running') {
        await audioContext.resume();
      }

      const oscillator = audioContext.createOscillator();
      const volume = audioContext.createGain();
      const now = audioContext.currentTime;

      oscillator.frequency.setValueAtTime(880, now);
      volume.gain.setValueAtTime(0.0001, now);
      volume.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
      volume.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
      oscillator.connect(volume);
      volume.connect(audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.45);
      setSoundError('');
    } catch (error) {
      console.error('Error playing cashier order alert:', error);
      soundEnabledRef.current = false;
      setIsSoundEnabled(false);
      setSoundError("Le son a été bloqué. Veuillez l'activer à nouveau.");
    }
  };

  const toggleOrderSound = async () => {
    if (soundEnabledRef.current) {
      soundEnabledRef.current = false;
      setIsSoundEnabled(false);
      setSoundError('');
      return;
    }

    if (!window.AudioContext) {
      setSoundError("La lecture audio n'est pas prise en charge par ce navigateur.");
      return;
    }

    try {
      const audioContext = audioContextRef.current || new window.AudioContext();
      await audioContext.resume();
      audioContextRef.current = audioContext;
      soundEnabledRef.current = true;
      setIsSoundEnabled(true);
      setSoundError('');
    } catch (error) {
      console.error('Error enabling cashier order alerts:', error);
      setSoundError("Impossible d'activer le son. Vérifiez les réglages du navigateur.");
    }
  };

  useEffect(() => () => {
    soundEnabledRef.current = false;
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
  }, []);

  const loadReports = async (period) => {
    try {
      const response = await api.get(`/cashier/reports/${period}`);
      setReports(prev => ({ ...prev, [period]: response.data }));
    } catch (error) {
      console.error('Error loading reports:', error);
    }
  };

  const downloadReport = async (formatType = 'pdf') => {
    setIsDownloadingReport(true);
    try {
      const response = await api.get(`/cashier/reports/${selectedPeriod}/${formatType === 'excel' ? 'excel' : 'pdf'}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const extension = formatType === 'excel' ? 'xlsx' : 'pdf';
      link.setAttribute('download', `rapport-ventes-${selectedPeriod}-${format(new Date(), 'yyyy-MM-dd-HH-mm')}.${extension}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading report:', error);
      alert(`Impossible de générer le rapport ${formatType === 'excel' ? 'Excel' : 'PDF'}.`);
    } finally {
      setIsDownloadingReport(false);
    }
  };

  const generateInvoice = async (orderId) => {
    try {
      const response = await api.get(`/cashier/invoice/${orderId}`, {
        responseType: 'blob'
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `facture-${orderId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating invoice:', error);
    }
  };

  const markAsDelivered = async (orderId) => {
    try {
      await api.put(`/cashier/orders/${orderId}/deliver`);
      await loadOrders();
    } catch (error) {
      console.error('Error marking order as delivered:', error);
      alert(error.response?.data?.message || 'Impossible de mettre à jour la livraison.');
    }
  };

  const markAsPaid = async (orderId, payment_method) => {
    try {
      await api.put(`/cashier/orders/${orderId}/pay`, { payment_method });
      await Promise.all([loadOrders(), loadCashRegisterSession()]);
    } catch (error) {
      alert(error.response?.data?.message || 'Impossible de confirmer le paiement.');
    }
  };

  const closeOrder = async (orderId) => {
    try {
      await api.post(`/orders/${orderId}/close`);
      await loadOrders();
    } catch (error) {
      alert(error.response?.data?.message || 'Impossible de clôturer la commande.');
    }
  };

  const recordRefund = async (orderId) => {
    if (!window.confirm('Confirmer que le remboursement a bien été effectué ? Cette action l’enregistre dans la commande.')) return;
    try {
      await api.put(`/cashier/orders/${orderId}/refund`);
      await loadOrders();
    } catch (error) {
      alert(error.response?.data?.message || 'Impossible d’enregistrer le remboursement.');
    }
  };

  const loadCashRegisterSession = async () => {
    try {
      const response = await api.get('/cashier/session');
      setCashRegisterSession(response.data);
    } catch (error) {
      console.error('Error loading cash register session:', error);
      setCashRegisterSession({ isOpen: false });
    }
  };

  const openCashRegister = async () => {
    if (!openingBalance || openingBalance < 0) {
      alert('Veuillez entrer un solde d\'ouverture valide');
      return;
    }

    setIsOpeningRegister(true);
    try {
      await api.post('/cashier/session/open', { opening_balance: parseInt(openingBalance) });
      await loadCashRegisterSession();
      setOpeningBalance('');
    } catch (error) {
      console.error('Error opening cash register:', error);
      alert('Erreur lors de l\'ouverture de la caisse');
    } finally {
      setIsOpeningRegister(false);
    }
  };

  const closeCashRegister = async () => {
    if (!closingBalance) {
      alert('Veuillez entrer le solde de clôture');
      return;
    }

    setIsClosingRegister(true);
    try {
      const closeResponse = await api.post('/cashier/session/close', {
        closing_balance: parseInt(closingBalance),
        notes: closingNotes
      });
      // Télécharger automatiquement le rapport PDF de fermeture
      const sessionId = closeResponse?.data?.session?.id;
      if (sessionId) {
        try {
          const pdfResponse = await api.get('/cashier/session/close-report', {
            params: { sessionId },
            responseType: 'blob'
          });
          const url = window.URL.createObjectURL(new Blob([pdfResponse.data]));
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', `fermeture-caisse-${sessionId}.pdf`);
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(url);
        } catch (pdfError) {
          console.error('Error downloading close report:', pdfError);
          alert('Clôture effectuée mais le rapport PDF n’a pas pu être téléchargé.');
        }
      }
      await loadCashRegisterSession();
      setClosingBalance('');
      setClosingNotes('');
    } catch (error) {
      console.error('Error closing cash register:', error);
      alert('Erreur lors de la fermeture de la caisse');
    } finally {
      setIsClosingRegister(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'en_attente': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'en_preparation': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'prete': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'en_livraison': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'servie': return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'recuperee': return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      case 'livree': return 'bg-green-100 text-green-800 border-green-200';
      case 'annulee': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'en_attente': return 'En attente';
      case 'en_preparation': return 'En préparation';
      case 'prete': return 'Prête';
      case 'en_livraison': return 'En livraison';
      case 'servie': return 'Servie à table';
      case 'recuperee': return 'Récupérée';
      case 'livree': return 'Livrée';
      case 'annulee': return 'Annulée';
      default: return status;
    }
  };

  const currentReport = reports[selectedPeriod] || {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4 md:p-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
      >
        <div>
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-8 h-8 text-green-600" />
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
              Mode Caisse
            </h1>
          </div>
          <p className="text-gray-600">
            Gestion des factures et rapports de ventes
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Alertes : commandes sur place servies, autres commandes prêtes.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <Button
            type="button"
            variant={isSoundEnabled ? 'default' : 'outline'}
            aria-pressed={isSoundEnabled}
            onClick={toggleOrderSound}
            className={isSoundEnabled ? 'bg-green-600 text-white hover:bg-green-700' : ''}
          >
            {isSoundEnabled ? <Volume2 className="mr-2 h-4 w-4" /> : <VolumeX className="mr-2 h-4 w-4" />}
            {isSoundEnabled ? 'Son activé' : 'Activer le son'}
          </Button>
          {soundError && <p role="alert" className="text-sm text-red-600">{soundError}</p>}
        </div>
      </motion.div>

      {/* Cash Register Status */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              État de la Caisse
            </div>
            {cashRegisterSession?.isOpen ? (
              <Badge className="bg-green-100 text-green-800 border-green-200">
                <Unlock className="w-3 h-3 mr-1" />
                Ouverte
              </Badge>
            ) : (
              <Badge className="bg-red-100 text-red-800 border-red-200">
                <Lock className="w-3 h-3 mr-1" />
                Fermée
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cashRegisterSession?.isOpen ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">Ouverture</p>
                  <p className="text-lg font-bold">
                    {format(new Date(cashRegisterSession.session.opened_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Solde d'ouverture</p>
                  <p className="text-lg font-bold text-green-600">
                    {cashRegisterSession.session.opening_balance.toFixed(2)} FCFA
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Solde actuel</p>
                  <p className="text-lg font-bold text-blue-600">
                    {cashRegisterSession.session.current_balance.toFixed(2)} FCFA
                  </p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold mb-4">Fermer la Caisse</h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="closing-balance">Solde de clôture (FCFA)</Label>
                    <Input
                      id="closing-balance"
                      type="number"
                      step="0.01"
                      value={closingBalance}
                      onChange={(e) => setClosingBalance(e.target.value)}
                      placeholder="Entrez le solde réel"
                    />
                  </div>
                  <div>
                    <Label htmlFor="closing-notes">Notes (optionnel)</Label>
                    <Textarea
                      id="closing-notes"
                      value={closingNotes}
                      onChange={(e) => setClosingNotes(e.target.value)}
                      placeholder="Notes sur la clôture..."
                    />
                  </div>
                  <Button
                    onClick={closeCashRegister}
                    disabled={isClosingRegister}
                    variant="destructive"
                    className="w-full flex items-center gap-2"
                  >
                    <Lock className="w-4 h-4" />
                    {isClosingRegister ? 'Fermeture...' : 'Fermer la Caisse'}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-gray-600">La caisse est actuellement fermée.</p>
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold mb-4">Ouvrir la Caisse</h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="opening-balance">Solde d'ouverture (FCFA)</Label>
                    <Input
                      id="opening-balance"
                      type="number"
                      step="0.01"
                      value={openingBalance}
                      onChange={(e) => setOpeningBalance(e.target.value)}
                      placeholder="Entrez le solde d'ouverture"
                    />
                  </div>
                  <Button
                    onClick={openCashRegister}
                    disabled={isOpeningRegister}
                    className="w-full bg-green-600 hover:bg-green-700 flex items-center gap-2"
                  >
                    <Unlock className="w-4 h-4" />
                    {isOpeningRegister ? 'Ouverture...' : 'Ouvrir la Caisse'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="orders" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="orders">Commandes</TabsTrigger>
          <TabsTrigger value="reports">Rapports</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-6">
          {/* Orders List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Commandes à traiter ({orders.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <AnimatePresence>
                  {orders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onGenerateInvoice={generateInvoice}
                      onMarkDelivered={markAsDelivered}
                      onMarkPaid={markAsPaid}
                      onClose={closeOrder}
                      onRefund={recordRefund}
                      getStatusColor={getStatusColor}
                      getStatusText={getStatusText}
                    />
                  ))}
                </AnimatePresence>
                {orders.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    Aucune commande à traiter
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          {/* Period Selector */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Période d'analyse
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {[
                  { value: 'day', label: 'Aujourd\'hui' },
                  { value: 'week', label: 'Cette semaine' },
                  { value: 'month', label: 'Ce mois' },
                  { value: 'year', label: 'Cette année' }
                ].map((period) => (
                  <Button
                    key={period.value}
                    variant={selectedPeriod === period.value ? 'default' : 'outline'}
                    onClick={() => setSelectedPeriod(period.value)}
                  >
                    {period.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Sales Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Chiffre d'affaires</p>
                    <p className="text-2xl font-bold text-green-600">
                      {currentReport.totalRevenue?.toFixed(2) || '0.00'} FCFA
                    </p>
                  </div>
                  <DollarSign className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Nombre de commandes</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {currentReport.totalOrders || 0}
                    </p>
                  </div>
                  <Package className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Panier moyen</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {currentReport.averageOrderValue?.toFixed(2) || '0.00'} FCFA
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Ventes par lieu</CardTitle>
            </CardHeader>
            <CardContent>
              {currentReport.locationReport?.length ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {currentReport.locationReport.map(location => (
                    <div key={location.location} className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
                      <p className="font-semibold text-gray-900">{location.location}</p>
                      <p className="mt-1 text-xl font-bold text-amber-700">{location.revenue.toLocaleString()} FCFA</p>
                      <p className="text-sm text-gray-600">{location.orders} commande(s) · {location.items} article(s)</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Aucune vente par lieu pour cette période.</p>
              )}
            </CardContent>
          </Card>

          {/* Top Products */}
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Top Produits
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => downloadReport('pdf')} variant="outline" size="sm" disabled={isDownloadingReport} className="flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    {isDownloadingReport ? 'Génération...' : 'Rapport PDF'}
                  </Button>
                  <Button onClick={() => downloadReport('excel')} variant="outline" size="sm" disabled={isDownloadingReport} className="flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    {isDownloadingReport ? 'Génération...' : 'Rapport Excel'}
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {currentReport.topProducts?.map((product, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-sm font-bold text-orange-600">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{product.name}</p>
                        <p className="text-sm text-gray-600">{product.quantity} vendus</p>
                      </div>
                    </div>
                    <p className="font-bold text-green-600">{product.revenue.toFixed(2)} FCFA</p>
                  </div>
                )) || (
                  <div className="text-center py-8 text-gray-500">
                    Aucun produit vendu dans cette période
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Traçabilité des commandes clôturées</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {currentReport.orders?.map(order => (
                  <div key={order.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex flex-wrap justify-between gap-2 font-medium">
                      <span>#{order.order_code || order.id.slice(-8)} · {order.status}</span>
                      <span>{order.total_amount.toLocaleString()} FCFA · {order.payment_method || 'Paiement non renseigné'}</span>
                    </div>
                    <p className="mt-1 text-gray-600">
                      Validé par : {order.validated_by || 'Client en ligne'} · Clôturé par : {order.closed_by || '—'}
                    </p>
                  </div>
                ))}
                {!currentReport.orders?.length && <p className="text-sm text-gray-500">Aucune commande clôturée pour cette période.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Order Card Component
function OrderCard({ order, onGenerateInvoice, onMarkDelivered, onMarkPaid, onClose, onRefund, getStatusColor, getStatusText }) {
  const total = order.total_amount; 
  const displayCode = order.order_code || `KOT-${order.id?.slice(-6) || ''}`;
  const [paymentMethod, setPaymentMethod] = useState(order.payment_method || 'cash');
  const canClose = order.status === 'annulee'
    ? order.payment_status !== 'paid'
    : ['servie', 'recuperee', 'livree'].includes(order.status);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-900">#{displayCode}</h3>
          <Badge className={`${getStatusColor(order.status)} border`}>
            {getStatusText(order.status)}
          </Badge>
          {order.payment_status === 'paid' && <Badge className="bg-green-100 text-green-800">Payée</Badge>}
          {order.payment_status === 'refunded' && <Badge className="bg-blue-100 text-blue-800">Remboursée</Badge>}
        </div>
        <p className="text-sm text-gray-600">
          {format(new Date(order.created_date), 'HH:mm dd/MM', { locale: fr })}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <p className="font-medium text-gray-900">{order.customer_name}</p>
          {order.table_number && <p className="text-sm text-gray-600">Table {order.table_number}</p>}
          {order.service_location && <p className="text-sm text-gray-600">Lieu : {order.service_location_name || order.service_location}</p>}
          <p className="text-sm text-gray-600">{order.customer_phone}</p>
          <p className="text-sm text-gray-600">Paiement : {order.payment_method || 'Non renseigné'} ({order.payment_status})</p>
          <p className="text-sm text-gray-600">Validé par : {order.validatedBy?.full_name || 'Client en ligne'}</p>
          {order.closedBy && <p className="text-sm text-gray-600">Clôturé par : {order.closedBy.full_name}</p>}
          {order.customer_address && (
            <p className="text-sm text-gray-600">{order.customer_address}</p>
          )}
          <div className="mt-2">
            <p className="text-sm font-medium text-gray-700">Produits:</p>
            {order.items.map((item, index) => {
              const customizationText = formatCustomizationForDisplay(
                item.customizationFormatted,
                item.customizationDetails
              );
              return (
                <div key={index} className="text-sm text-gray-600">
                  <p>{item.quantity}x {item.product_name}</p>
                  {customizationText && (
                    <p className="text-xs text-orange-600 ml-4 italic">
                      {customizationText}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="text-right" >
          <p className="text-lg font-bold text-green-600">{total.toFixed(2)} FCFA</p>
          <p className="text-sm text-gray-600">{order.items.length} article(s)</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={() => onGenerateInvoice(order.id)}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <FileText className="w-4 h-4" />
          Facture PDF
        </Button>

        {order.status === 'en_livraison' && (
          <Button
            onClick={() => onMarkDelivered(order.id)}
            size="sm"
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
          >
            <CheckCircle className="w-4 h-4" />
            Confirmer livraison
          </Button>
        )}
        {order.payment_status !== 'paid' && order.status !== 'annulee' && (
          <>
            <select className="h-9 rounded-md border px-2 text-sm" value={paymentMethod} onChange={event => setPaymentMethod(event.target.value)}>
              <option value="cash">Espèces</option>
              <option value="card">Carte</option>
              <option value="mobile_money">Mobile money</option>
            </select>
            <Button size="sm" onClick={() => onMarkPaid(order.id, paymentMethod)}>Confirmer paiement</Button>
          </>
        )}
        {order.status === 'annulee' && order.payment_status === 'paid' && (
          <Button size="sm" variant="outline" onClick={() => onRefund(order.id)}>Enregistrer le remboursement</Button>
        )}
        {canClose && (
          <Button size="sm" variant="outline" onClick={() => onClose(order.id)}>Clôturer</Button>
        )}
      </div>
    </motion.div>
  );
}
