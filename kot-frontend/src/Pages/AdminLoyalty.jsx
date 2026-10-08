import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../Components/ui/card';
import { Button } from '../Components/ui/button';
import { Input } from '../Components/ui/input';
import { Label } from '../Components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../Components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../Components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../Components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../Components/ui/table';
import { Badge } from '../Components/ui/badge';
import { Textarea } from '../Components/ui/textarea';
import { toast } from 'react-hot-toast';
import api from '../services/api.service';
import { useAuthContext } from '../contexts/AuthContext';
import {
  Star,
  Plus,
  Edit,
  Trash2,
  Award,
  Users,
  Tag,
  Calendar,
  DollarSign,
  Percent,
  Medal,
  Trophy,
  Crown
} from 'lucide-react';

const TIER_ICONS = { star: Star, medal: Medal, trophy: Trophy, crown: Crown };
const DEFAULT_TIERS = [
  { level: 1, title: 'Niveau 1', icon: 'star', threshold_points: '' },
  { level: 2, title: 'Niveau 2', icon: 'medal', threshold_points: '' },
  { level: 3, title: 'Niveau 3', icon: 'trophy', threshold_points: '' }
];

export default function AdminLoyalty() {
  const { user: currentUser } = useAuthContext();
  const [activeTab, setActiveTab] = useState('rewards');
  const [rewards, setRewards] = useState([]);
  const [users, setUsers] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [promos, setPromos] = useState([]);
  const [products, setProducts] = useState([]);
  const [pointHistory, setPointHistory] = useState([]);
  const [tiers, setTiers] = useState(DEFAULT_TIERS);
  const [manualPoints, setManualPoints] = useState({ points: '', reason: '' });
  const [loading, setLoading] = useState(true);

  // Form states
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedReward, setSelectedReward] = useState('');
  const [showRewardDialog, setShowRewardDialog] = useState(false);
  const [showPromoDialog, setShowPromoDialog] = useState(false);
  const [editingReward, setEditingReward] = useState(null);
  const [editingPromo, setEditingPromo] = useState(null);

  // Reward form
  const [rewardForm, setRewardForm] = useState({
    name: '',
    description: '',
    type: 'free_delivery',
    points_required: '',
    quantity_limit: '',
    expires_at: '',
    discount_percent: '',
    gifted_product_id: '',
    tier_level: '',
    is_active: true
  });

  // Promo form
  const [promoForm, setPromoForm] = useState({
    code: '',
    description: '',
    type: 'percentage',
    value: '',
    min_order_amount: '',
    max_uses: '',
    expires_at: '',
    is_active: true
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const results = await Promise.allSettled([
        api.get('/loyalty/admin/rewards'),
        api.get('/loyalty/admin/users'),
        api.get('/loyalty/admin/redemptions'),
        api.get('/loyalty/admin/promos'),
        api.get('/products'),
        api.get('/loyalty/admin/point-history'),
        api.get('/loyalty/admin/tiers')
    ]);
    const [rewardsRes, usersRes, redemptionsRes, promosRes, productsRes, historyRes, tiersRes] = results;
    if (rewardsRes.status === 'fulfilled') setRewards(rewardsRes.value.data || []);
    if (usersRes.status === 'fulfilled') setUsers(usersRes.value.data || []);
    if (redemptionsRes.status === 'fulfilled') setRedemptions(redemptionsRes.value.data || []);
    if (promosRes.status === 'fulfilled') setPromos(promosRes.value.data || []);
    if (productsRes.status === 'fulfilled') setProducts((productsRes.value.data || []).filter(product => product.available));
    if (historyRes.status === 'fulfilled') setPointHistory(historyRes.value.data || []);
    if (tiersRes.status === 'fulfilled' && tiersRes.value.data?.length === 3) setTiers(tiersRes.value.data);
    if (results.some(result => result.status === 'rejected')) toast.error('Certaines données fidélité n’ont pas pu être chargées.');
    setLoading(false);
  };

  const saveTiers = async () => {
    try {
      const payload = tiers.map(tier => ({ ...tier, threshold_points: tier.threshold_points === '' ? null : Number(tier.threshold_points) }));
      const response = await api.put('/loyalty/admin/tiers', { tiers: payload });
      setTiers(response.data);
      toast.success('Les trois niveaux de fidélité ont été enregistrés.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Impossible d’enregistrer les niveaux.');
    }
  };

  const handleCreateReward = async () => {
    try {
      const payload = { ...rewardForm, expires_at: new Date(rewardForm.expires_at).toISOString() };
      await api.post('/loyalty/admin/rewards', payload);
      toast.success('Récompense créée avec succès');
      setShowRewardDialog(false);
      resetRewardForm();
      loadData();
    } catch (error) {
      console.error('Error creating reward:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de la création de la récompense');
    }
  };

  const handleUpdateReward = async () => {
    try {
      const payload = { ...rewardForm, expires_at: new Date(rewardForm.expires_at).toISOString() };
      await api.put(`/loyalty/admin/rewards/${editingReward.id}`, payload);
      toast.success('Récompense mise à jour avec succès');
      setShowRewardDialog(false);
      setEditingReward(null);
      resetRewardForm();
      loadData();
    } catch (error) {
      console.error('Error updating reward:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de la mise à jour de la récompense');
    }
  };

  const handleDeleteReward = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette récompense ?')) return;

    try {
      await api.delete(`/loyalty/admin/rewards/${id}`);
      toast.success('Récompense supprimée avec succès');
      loadData();
    } catch (error) {
      console.error('Error deleting reward:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de la suppression de la récompense');
    }
  };

  const handleGrantReward = async () => {
    if (!selectedUser || !selectedReward) {
      toast.error('Veuillez sélectionner un utilisateur et une récompense');
      return;
    }

    try {
      await api.post(`/loyalty/admin/grant/${selectedUser}/${selectedReward}`);
      toast.success('Récompense attribuée avec succès');
      setSelectedUser('');
      setSelectedReward('');
      loadData();
    } catch (error) {
      console.error('Error granting reward:', error);
      toast.error('Erreur lors de l\'attribution de la récompense');
    }
  };

  const handleManualPoints = async () => {
    if (!selectedUser || !manualPoints.points || !manualPoints.reason.trim()) return toast.error('Choisissez un client, un nombre de points et un motif.');
    try {
      await api.post(`/loyalty/admin/points/${selectedUser}`, manualPoints);
      toast.success('Solde de points mis à jour');
      setManualPoints({ points: '', reason: '' });
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Impossible de modifier les points');
    }
  };

  const handleCreatePromo = async () => {
    try {
      const payload = {
        ...promoForm,
        value: promoForm.type === 'free_delivery' ? 0 : promoForm.value,
        min_order_amount: promoForm.min_order_amount
      };
      await api.post('/loyalty/admin/promos', payload);
      toast.success('Code promo créé avec succès');
      setShowPromoDialog(false);
      resetPromoForm();
      loadData();
    } catch (error) {
      console.error('Error creating promo:', error);
      toast.error('Erreur lors de la création du code promo');
    }
  };

  const handleUpdatePromo = async () => {
    try {
      const payload = {
        ...promoForm,
        value: promoForm.type === 'free_delivery' ? 0 : promoForm.value,
        min_order_amount: promoForm.min_order_amount
      };
      await api.put(`/loyalty/admin/promos/${editingPromo.id}`, payload);
      toast.success('Code promo mis à jour avec succès');
      setShowPromoDialog(false);
      setEditingPromo(null);
      resetPromoForm();
      loadData();
    } catch (error) {
      console.error('Error updating promo:', error);
      toast.error('Erreur lors de la mise à jour du code promo');
    }
  };

  const handleDeletePromo = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce code promo ?')) return;

    try {
      await api.delete(`/loyalty/admin/promos/${id}`);
      toast.success('Code promo supprimé avec succès');
      loadData();
    } catch (error) {
      console.error('Error deleting promo:', error);
      toast.error('Erreur lors de la suppression du code promo');
    }
  };

  const resetRewardForm = () => {
    setRewardForm({
      name: '',
      description: '',
      type: 'free_delivery',
      points_required: '',
      quantity_limit: '',
      expires_at: '',
      discount_percent: '',
      gifted_product_id: '',
      tier_level: '',
      is_active: true
    });
  };

  const resetPromoForm = () => {
    setPromoForm({
      code: '',
      description: '',
      type: 'percentage',
      value: '',
      min_order_amount: '',
      max_uses: '',
      expires_at: '',
      is_active: true
    });
  };

  const openEditReward = (reward) => {
    const expiryDate = reward.expires_at ? new Date(reward.expires_at) : null;
    const tier = tiers.find(item => item.level === reward.tier_level);
    if (expiryDate) expiryDate.setMinutes(expiryDate.getMinutes() - expiryDate.getTimezoneOffset());
    setEditingReward(reward);
    setRewardForm({
      name: reward.name,
      description: reward.description || '',
      type: reward.type,
      points_required: (tier?.threshold_points ?? reward.points_required).toString(),
      quantity_limit: reward.quantity_limit?.toString() || '',
      expires_at: expiryDate ? expiryDate.toISOString().slice(0, 16) : '',
      discount_percent: reward.discount_percent?.toString() || '',
      gifted_product_id: reward.gifted_product_id?.toString() || '',
      tier_level: reward.tier_level?.toString() || '',
      is_active: reward.is_active
    });
    setShowRewardDialog(true);
  };

  const openEditPromo = (promo) => {
    setEditingPromo(promo);
    setPromoForm({
      code: promo.code,
      description: promo.description || '',
      type: promo.type,
      value: promo.type === 'fixed_amount' ? (promo.value / 100).toString() : promo.value.toString(),
      min_order_amount: promo.min_order_amount ? (promo.min_order_amount / 100).toString() : '',
      max_uses: promo.max_uses?.toString() || '',
      expires_at: promo.expires_at ? new Date(promo.expires_at).toISOString().split('T')[0] : '',
      is_active: promo.is_active
    });
    setShowPromoDialog(true);
  };

  const getRewardTypeLabel = (type) => {
    const labels = {
      free_delivery: 'Livraison gratuite',
      gifted_product: 'Produit offert',
      discount: 'Réduction',
      custom: 'Personnalisé'
    };
    return labels[type] || type;
  };

  const getPromoTypeLabel = (type) => {
    const labels = {
      percentage: 'Pourcentage',
      fixed_amount: 'Montant fixe',
      free_delivery: 'Livraison gratuite'
    };
    return labels[type] || type;
  };

  const stats = {
    users: users.length,
    activePromos: promos.filter(p => p.is_active).length,
    redemptions: redemptions.length
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestion Fidélité</h1>
          <p className="text-gray-600">Gérez les récompenses et codes promo</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Utilisateurs</CardDescription>
            <CardTitle className="text-3xl">{stats.users}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Promos actives</CardDescription>
            <CardTitle className="text-3xl">{stats.activePromos}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Échanges cumulés</CardDescription>
            <CardTitle className="text-3xl">{stats.redemptions}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="tiers" className="flex items-center gap-2"><Star className="w-4 h-4" />Niveaux</TabsTrigger>
          <TabsTrigger value="rewards" className="flex items-center gap-2">
            <Award className="w-4 h-4" />
            Récompenses
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Utilisateurs
          </TabsTrigger>
          <TabsTrigger value="promos" className="flex items-center gap-2">
            <Tag className="w-4 h-4" />
            Codes Promo
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Historique
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tiers" className="space-y-6">
          {currentUser?.role === 'admin' && <Card>
            <CardHeader><CardTitle>Jauge et paliers de récompense</CardTitle><CardDescription>Les seuils sont comparés au solde actuel du client. Un échange réduit son solde et peut donc faire redescendre sa jauge. Les récompenses de palier restent à réclamer par le client.</CardDescription></CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                {tiers.map((tier, index) => {
                  const TierIcon = TIER_ICONS[tier.icon] || Star;
                  return <div key={tier.level} className="space-y-3 rounded-lg border p-4">
                    <div className="flex items-center gap-2 font-semibold"><TierIcon className="h-5 w-5 text-amber-500" />Palier {tier.level}</div>
                    <div><Label htmlFor={`tier-title-${tier.level}`}>Nom</Label><Input id={`tier-title-${tier.level}`} value={tier.title} onChange={e => setTiers(old => old.map(item => item.level === tier.level ? { ...item, title: e.target.value } : item))} /></div>
                    <div><Label htmlFor={`tier-threshold-${tier.level}`}>Solde requis (points)</Label><Input id={`tier-threshold-${tier.level}`} type="number" min="1" step="1" value={tier.threshold_points ?? ''} onChange={e => setTiers(old => old.map(item => item.level === tier.level ? { ...item, threshold_points: e.target.value } : item))} placeholder={index === 0 ? 'Ex. 100' : 'Entier supérieur au palier précédent'} /></div>
                    <div><Label htmlFor={`tier-icon-${tier.level}`}>Icône</Label><Select value={tier.icon} onValueChange={value => setTiers(old => old.map(item => item.level === tier.level ? { ...item, icon: value } : item))}><SelectTrigger id={`tier-icon-${tier.level}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="star">Étoile</SelectItem><SelectItem value="medal">Médaille</SelectItem><SelectItem value="trophy">Trophée</SelectItem><SelectItem value="crown">Couronne</SelectItem></SelectContent></Select></div>
                  </div>;
                })}
              </div>
              <p className="text-sm text-gray-500">Renseignez les trois seuils en ordre croissant. Les récompenses non associées à un palier restent accessibles avec leurs règles actuelles.</p>
              <Button onClick={saveTiers}>Enregistrer les niveaux</Button>
            </CardContent>
          </Card>}
        </TabsContent>

        <TabsContent value="rewards" className="space-y-6">
          {currentUser?.role === 'admin' && <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Récompenses de Fidélité</CardTitle>
                  <CardDescription>Gérez les récompenses disponibles pour les utilisateurs</CardDescription>
                </div>
                <Button
                  onClick={() => { resetRewardForm(); setEditingReward(null); setShowRewardDialog(true); }}
                  className="bg-amber-500 hover:bg-amber-600 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nouvelle Récompense
                </Button>
                <Dialog open={showRewardDialog} onOpenChange={setShowRewardDialog}>
                  <DialogContent className="max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{editingReward ? 'Modifier la Récompense' : 'Nouvelle Récompense'}</DialogTitle>
                      <DialogDescription>
                        Configurez les détails de la récompense de fidélité
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="name">Nom</Label>
                        <Input
                          id="name"
                          value={rewardForm.name}
                          onChange={(e) => setRewardForm({...rewardForm, name: e.target.value})}
                          placeholder="Ex: Livraison gratuite"
                        />
                      </div>
                      <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          value={rewardForm.description}
                          onChange={(e) => setRewardForm({...rewardForm, description: e.target.value})}
                          placeholder="Description de la récompense"
                        />
                      </div>
                      <div>
                        <Label htmlFor="type">Type</Label>
                        <Select value={rewardForm.type} onValueChange={(value) => setRewardForm({...rewardForm, type: value})}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="free_delivery">Livraison gratuite</SelectItem>
                            <SelectItem value="gifted_product">Produit offert</SelectItem>
                            <SelectItem value="discount">Réduction</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="points">{rewardForm.tier_level ? 'Coût de réclamation (points)' : 'Points requis'}</Label>
                        <Input
                          id="points"
                          type="number"
                          value={rewardForm.points_required}
                          onChange={(e) => setRewardForm({...rewardForm, points_required: e.target.value})}
                          placeholder="100"
                          disabled={Boolean(rewardForm.tier_level)}
                        />
                        {rewardForm.tier_level && <p className="mt-1 text-xs text-gray-500">Ce coût est automatiquement égal au seuil du palier et sera débité lorsque le client réclamera la récompense.</p>}
                      </div>
                      <div>
                        <Label htmlFor="reward-tier">Palier requis (facultatif)</Label>
                        <Select value={rewardForm.tier_level || 'none'} onValueChange={value => {
                          const selectedTier = tiers.find(tier => tier.level.toString() === value);
                          setRewardForm(current => ({
                            ...current,
                            tier_level: value === 'none' ? '' : value,
                            points_required: selectedTier?.threshold_points != null ? String(selectedTier.threshold_points) : current.points_required
                          }));
                        }}>
                          <SelectTrigger id="reward-tier"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="none">Aucun palier</SelectItem>{tiers.map(tier => <SelectItem key={tier.level} value={tier.level.toString()} disabled={!Number.isInteger(Number(tier.threshold_points)) || Number(tier.threshold_points) < 1}>{tier.title} · seuil {tier.threshold_points || 'à configurer'}</SelectItem>)}</SelectContent>
                        </Select>
                        <p className="mt-1 text-xs text-gray-500">Le palier définit à la fois le seuil de déblocage et le coût débité lors de la réclamation.</p>
                      </div>
                      <div>
                        <Label htmlFor="reward-limit">Quantité totale disponible</Label>
                        <Input id="reward-limit" type="number" min="1" required value={rewardForm.quantity_limit} onChange={e => setRewardForm({ ...rewardForm, quantity_limit: e.target.value })} />
                      </div>
                      <div>
                        <Label htmlFor="reward-expiry">Date et heure d’expiration</Label>
                        <Input id="reward-expiry" type="datetime-local" required value={rewardForm.expires_at} onChange={e => setRewardForm({ ...rewardForm, expires_at: e.target.value })} />
                      </div>
                      {rewardForm.type === 'discount' && <div>
                        <Label htmlFor="reward-percent">Remise générée (%)</Label>
                        <Input id="reward-percent" type="number" min="1" max="100" required value={rewardForm.discount_percent} onChange={e => setRewardForm({ ...rewardForm, discount_percent: e.target.value })} />
                        <p className="text-xs text-gray-500">Un code à usage unique, réservé au client, sera généré automatiquement.</p>
                      </div>}
                      {rewardForm.type === 'gifted_product' && <div>
                        <Label htmlFor="reward-product">Produit offert</Label>
                        <Select value={rewardForm.gifted_product_id} onValueChange={value => setRewardForm({ ...rewardForm, gifted_product_id: value })}>
                          <SelectTrigger><SelectValue placeholder="Choisir le produit offert" /></SelectTrigger>
                          <SelectContent>{products.map(product => <SelectItem key={product.id} value={product.id.toString()}>{product.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>}
                      <div className="flex items-center gap-2">
                        <input
                          id="reward-active"
                          type="checkbox"
                          className="h-4 w-4"
                          checked={rewardForm.is_active}
                          onChange={(e) => setRewardForm({ ...rewardForm, is_active: e.target.checked })}
                        />
                        <Label htmlFor="reward-active">Activer la récompense</Label>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowRewardDialog(false)}>
                        Annuler
                      </Button>
                      <Button onClick={editingReward ? handleUpdateReward : handleCreateReward}>
                        {editingReward ? 'Modifier' : 'Créer'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Palier</TableHead>
                    <TableHead>Points / disponibilité</TableHead>
                    <TableHead>Expiration</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rewards.map((reward) => (
                    <TableRow key={reward.id}>
                      <TableCell className="font-medium">{reward.name}</TableCell>
                      <TableCell>{getRewardTypeLabel(reward.type)}</TableCell>
                      <TableCell>{reward.tier?.title || 'Classique'}</TableCell>
                      <TableCell>{reward.points_required} pts · {reward.quantity_claimed}/{reward.quantity_limit ?? '—'}</TableCell>
                      <TableCell>{reward.expires_at ? new Date(reward.expires_at).toLocaleDateString('fr-FR') : 'À configurer'}</TableCell>
                      <TableCell>
                        <Badge variant={reward.is_active ? 'default' : 'secondary'}>
                          {reward.is_active ? 'Actif' : 'Inactif'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEditReward(reward)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDeleteReward(reward.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>}
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          {currentUser?.role === 'admin' && <Card>
            <CardHeader>
              <CardTitle>Attribuer une Récompense</CardTitle>
              <CardDescription>Sélectionnez un utilisateur et une récompense à attribuer</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <Label htmlFor="user">Utilisateur</Label>
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un utilisateur" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.full_name} - {user.loyalty_points || 0} points
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Label htmlFor="reward">Récompense</Label>
                  <Select value={selectedReward} onValueChange={setSelectedReward}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une récompense" />
                    </SelectTrigger>
                    <SelectContent>
                      {rewards.filter(r => r.is_active).map((reward) => (
                        <SelectItem key={reward.id} value={reward.id}>
                          {reward.name} ({reward.points_required} points)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleGrantReward} disabled={!selectedUser || !selectedReward}>
                  <Award className="w-4 h-4 mr-2" />
                  Attribuer
                </Button>
              </div>
            </CardContent>
          </Card>}

          <Card>
            <CardHeader>
              <CardTitle>Utilisateurs et Points de Fidélité</CardTitle>
              <CardDescription>Seuls les comptes clients inscrits participent au programme.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentUser?.role === 'admin' && <div className="grid gap-3 md:grid-cols-4 items-end rounded-lg bg-gray-50 p-4">
                <div><Label>Client</Label><Select value={selectedUser} onValueChange={setSelectedUser}><SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger><SelectContent>{users.map(user => <SelectItem key={user.id} value={user.id.toString()}>{user.full_name} · {user.loyalty_points} pts</SelectItem>)}</SelectContent></Select></div>
                <div><Label htmlFor="manual-points">Points (+ ou −)</Label><Input id="manual-points" type="number" step="1" value={manualPoints.points} onChange={e => setManualPoints({ ...manualPoints, points: e.target.value })} placeholder="Ex. 20 ou -5" /></div>
                <div><Label htmlFor="manual-reason">Motif obligatoire</Label><Input id="manual-reason" value={manualPoints.reason} onChange={e => setManualPoints({ ...manualPoints, reason: e.target.value })} placeholder="Encouragement, correction…" /></div>
                <Button onClick={handleManualPoints} disabled={!selectedUser || !manualPoints.points || !manualPoints.reason.trim()}>Ajuster les points</Button>
              </div>}
            </CardContent>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Points</TableHead>
                    <TableHead>Date d'inscription</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                          <Star className="w-3 h-3 mr-1" />
                          {user.loyalty_points}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(user.created_at).toLocaleDateString('fr-FR')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card><CardHeader><CardTitle>Journal des ajustements manuels</CardTitle><CardDescription>Qui a modifié le solde, pour quel client, avec quel motif.</CardDescription></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Client</TableHead><TableHead>Admin</TableHead><TableHead>Variation</TableHead><TableHead>Motif</TableHead></TableRow></TableHeader><TableBody>{pointHistory.map(entry => <TableRow key={entry.id}><TableCell>{new Date(entry.created_at).toLocaleString('fr-FR')}</TableCell><TableCell>{entry.user.full_name}</TableCell><TableCell>{entry.actor?.full_name || '—'}</TableCell><TableCell>{entry.points > 0 ? '+' : ''}{entry.points}</TableCell><TableCell>{entry.reason}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
        </TabsContent>

        <TabsContent value="promos" className="space-y-6">
          {currentUser?.role === 'admin' && <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Codes Promo</CardTitle>
                  <CardDescription>Gérez les codes promotionnels</CardDescription>
                </div>
                <Button
                  onClick={() => { resetPromoForm(); setEditingPromo(null); setShowPromoDialog(true); }}
                  className="bg-amber-500 hover:bg-amber-600 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Créer un code
                </Button>
                <Dialog open={showPromoDialog} onOpenChange={setShowPromoDialog}>
                  <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-auto">
                    <DialogHeader>
                      <DialogTitle>{editingPromo ? 'Modifier le Code Promo' : 'Nouveau Code Promo'}</DialogTitle>
                      <DialogDescription>
                        Configurez les détails du code promotionnel
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-1">
                          <Label htmlFor="code">Code</Label>
                          <Input
                            id="code"
                            value={promoForm.code}
                            onChange={(e) => setPromoForm({...promoForm, code: e.target.value.toUpperCase()})}
                            placeholder="WELCOME10"
                          />
                        </div>
                        <div className="md:col-span-1">
                          <Label htmlFor="promo-type">Type</Label>
                          <Select
                            value={promoForm.type}
                            onValueChange={(value) =>
                              setPromoForm({
                                ...promoForm,
                                type: value,
                                value: value === 'free_delivery' ? 0 : promoForm.value
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percentage">Pourcentage (%)</SelectItem>
                              <SelectItem value="fixed_amount">Montant fixe (€)</SelectItem>
                              <SelectItem value="free_delivery">Livraison gratuite</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {promoForm.type !== 'free_delivery' && (
                          <div className="md:col-span-1">
                            <Label htmlFor="value">Valeur {promoForm.type === 'percentage' ? '(%)' : '(€)'}</Label>
                            <Input
                              id="value"
                              type="number"
                              value={promoForm.value}
                              onChange={(e) => setPromoForm({...promoForm, value: e.target.value})}
                              placeholder={promoForm.type === 'percentage' ? '10' : '5.00'}
                            />
                          </div>
                        )}
                        <div className="md:col-span-1">
                          <Label htmlFor="min-order">Montant minimum (€)</Label>
                          <Input
                            id="min-order"
                            type="number"
                            value={promoForm.min_order_amount}
                            onChange={(e) => setPromoForm({...promoForm, min_order_amount: e.target.value})}
                            placeholder="15.00"
                          />
                        </div>
                        <div className="md:col-span-1">
                          <Label htmlFor="max-uses">Utilisations max</Label>
                          <Input
                            id="max-uses"
                            type="number"
                            value={promoForm.max_uses}
                            onChange={(e) => setPromoForm({...promoForm, max_uses: e.target.value})}
                            placeholder="100"
                          />
                        </div>
                        <div className="md:col-span-1">
                          <Label htmlFor="expires">Date d'expiration</Label>
                          <Input
                            id="expires"
                            type="date"
                            value={promoForm.expires_at}
                            onChange={(e) => setPromoForm({...promoForm, expires_at: e.target.value})}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <Label htmlFor="promo-description">Description</Label>
                          <Textarea
                            id="promo-description"
                            value={promoForm.description}
                            onChange={(e) => setPromoForm({...promoForm, description: e.target.value})}
                            placeholder="Description du code promo"
                          />
                        </div>
                        <div className="md:col-span-2 flex items-center gap-2">
                          <input
                            id="promo-active"
                            type="checkbox"
                            className="h-4 w-4"
                            checked={promoForm.is_active}
                            onChange={(e) => setPromoForm({ ...promoForm, is_active: e.target.checked })}
                          />
                          <Label htmlFor="promo-active">Activer le code</Label>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowPromoDialog(false)}>
                        Annuler
                      </Button>
                      <Button onClick={editingPromo ? handleUpdatePromo : handleCreatePromo}>
                        {editingPromo ? 'Modifier' : 'Créer'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Valeur</TableHead>
                    <TableHead>Utilisations</TableHead>
                    <TableHead>Expiration</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {promos.map((promo) => (
                    <TableRow key={promo.id}>
                      <TableCell className="font-mono font-medium">{promo.code}</TableCell>
                      <TableCell>{promo.description}</TableCell>
                      <TableCell>{getPromoTypeLabel(promo.type)}</TableCell>
                      <TableCell>
                        {promo.type === 'free_delivery' ? (
                          'Livraison gratuite'
                        ) : promo.type === 'percentage' ? (
                          <span className="flex items-center">
                            <Percent className="w-3 h-3 mr-1" />
                            {promo.value}%
                          </span>
                        ) : (
                          <span className="flex items-center">
                            <DollarSign className="w-3 h-3 mr-1" />
                            {(promo.value / 100).toFixed(2)}€
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{promo.used_count}/{promo.max_uses || '∞'}</TableCell>
                      <TableCell>
                        {promo.expires_at ? new Date(promo.expires_at).toLocaleDateString('fr-FR') : 'Aucune'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={promo.is_active ? 'default' : 'secondary'}>
                          {promo.is_active ? 'Actif' : 'Inactif'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEditPromo(promo)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDeletePromo(promo.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>}
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Historique des Échanges</CardTitle>
              <CardDescription>Liste de tous les échanges de récompenses</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Récompense</TableHead>
                    <TableHead>Points utilisés</TableHead>
                    <TableHead>État / code</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {redemptions.map((redemption) => (
                    <TableRow key={redemption.id}>
                      <TableCell className="font-medium">
                        {redemption.user.full_name} ({redemption.user.email})
                      </TableCell>
                      <TableCell>{redemption.reward.name}</TableCell>
                      <TableCell>{redemption.points_used}</TableCell>
                      <TableCell>{redemption.status === 'used' ? 'Utilisée' : redemption.status === 'expired' ? 'Expirée' : 'En attente'}{redemption.promoCode?.code ? ` · ${redemption.promoCode.code}` : ''}</TableCell>
                      <TableCell>{new Date(redemption.created_at).toLocaleDateString('fr-FR')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
