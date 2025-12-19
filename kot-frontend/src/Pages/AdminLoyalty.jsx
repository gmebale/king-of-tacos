import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../Components/ui/card';
import { Button } from '../Components/ui/button';
import { Input } from '../Components/ui/input';
import { Label } from '../Components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../Components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../Components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../Components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../Components/ui/table';
import { Badge } from '../Components/ui/badge';
import { Textarea } from '../Components/ui/textarea';
import { toast } from 'react-hot-toast';
import { api } from '../services';
import {
  Star,
  Plus,
  Edit,
  Trash2,
  Award,
  Users,
  Gift,
  Tag,
  Calendar,
  DollarSign,
  Percent
} from 'lucide-react';

export default function AdminLoyalty() {
  const [activeTab, setActiveTab] = useState('rewards');
  const [rewards, setRewards] = useState([]);
  const [users, setUsers] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [promos, setPromos] = useState([]);
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
    points_required: ''
  });

  // Promo form
  const [promoForm, setPromoForm] = useState({
    code: '',
    description: '',
    type: 'percentage',
    value: '',
    min_order_amount: '',
    max_uses: '',
    expires_at: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [rewardsRes, usersRes, redemptionsRes, promosRes] = await Promise.all([
        api.get('/loyalty/admin/rewards'),
        api.get('/loyalty/admin/users'),
        api.get('/loyalty/admin/redemptions'),
        api.get('/loyalty/admin/promos')
      ]);

      setRewards(rewardsRes.data);
      setUsers(usersRes.data);
      setRedemptions(redemptionsRes.data);
      setPromos(promosRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReward = async () => {
    try {
      await api.post('/loyalty/admin/rewards', rewardForm);
      toast.success('Récompense créée avec succès');
      setShowRewardDialog(false);
      resetRewardForm();
      loadData();
    } catch (error) {
      console.error('Error creating reward:', error);
      toast.error('Erreur lors de la création de la récompense');
    }
  };

  const handleUpdateReward = async () => {
    try {
      await api.put(`/loyalty/admin/rewards/${editingReward.id}`, rewardForm);
      toast.success('Récompense mise à jour avec succès');
      setShowRewardDialog(false);
      setEditingReward(null);
      resetRewardForm();
      loadData();
    } catch (error) {
      console.error('Error updating reward:', error);
      toast.error('Erreur lors de la mise à jour de la récompense');
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
      toast.error('Erreur lors de la suppression de la récompense');
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

  const handleCreatePromo = async () => {
    try {
      await api.post('/loyalty/admin/promos', promoForm);
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
      await api.put(`/loyalty/admin/promos/${editingPromo.id}`, promoForm);
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
      points_required: ''
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
      expires_at: ''
    });
  };

  const openEditReward = (reward) => {
    setEditingReward(reward);
    setRewardForm({
      name: reward.name,
      description: reward.description || '',
      type: reward.type,
      points_required: reward.points_required.toString()
    });
    setShowRewardDialog(true);
  };

  const openEditPromo = (promo) => {
    setEditingPromo(promo);
    setPromoForm({
      code: promo.code,
      description: promo.description || '',
      type: promo.type,
      value: promo.value.toString(),
      min_order_amount: promo.min_order_amount?.toString() || '',
      max_uses: promo.max_uses?.toString() || '',
      expires_at: promo.expires_at ? new Date(promo.expires_at).toISOString().split('T')[0] : ''
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
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

        <TabsContent value="rewards" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Récompenses de Fidélité</CardTitle>
                  <CardDescription>Gérez les récompenses disponibles pour les utilisateurs</CardDescription>
                </div>
                <Dialog open={showRewardDialog} onOpenChange={setShowRewardDialog}>
                  <DialogTrigger asChild>
                    <Button onClick={() => { resetRewardForm(); setEditingReward(null); }}>
                      <Plus className="w-4 h-4 mr-2" />
                      Nouvelle Récompense
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
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
                            <SelectItem value="custom">Personnalisé</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="points">Points requis</Label>
                        <Input
                          id="points"
                          type="number"
                          value={rewardForm.points_required}
                          onChange={(e) => setRewardForm({...rewardForm, points_required: e.target.value})}
                          placeholder="100"
                        />
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
                    <TableHead>Points requis</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rewards.map((reward) => (
                    <TableRow key={reward.id}>
                      <TableCell className="font-medium">{reward.name}</TableCell>
                      <TableCell>{getRewardTypeLabel(reward.type)}</TableCell>
                      <TableCell>{reward.points_required}</TableCell>
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
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <Card>
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
                          {user.full_name} - {user.loyalty_points} points
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
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Utilisateurs et Points de Fidélité</CardTitle>
              <CardDescription>Liste de tous les utilisateurs avec leurs points</CardDescription>
            </CardHeader>
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
        </TabsContent>

        <TabsContent value="promos" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Codes Promo</CardTitle>
                  <CardDescription>Gérez les codes promotionnels</CardDescription>
                </div>
                <Dialog open={showPromoDialog} onOpenChange={setShowPromoDialog}>
                  <DialogTrigger asChild>
                    <Button onClick={() => { resetPromoForm(); setEditingPromo(null); }}>
                      <Plus className="w-4 h-4 mr-2" />
                      Nouveau Code
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>{editingPromo ? 'Modifier le Code Promo' : 'Nouveau Code Promo'}</DialogTitle>
                      <DialogDescription>
                        Configurez les détails du code promotionnel
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="code">Code</Label>
                        <Input
                          id="code"
                          value={promoForm.code}
                          onChange={(e) => setPromoForm({...promoForm, code: e.target.value.toUpperCase()})}
                          placeholder="WELCOME10"
                        />
                      </div>
                      <div>
                        <Label htmlFor="promo-description">Description</Label>
                        <Textarea
                          id="promo-description"
                          value={promoForm.description}
                          onChange={(e) => setPromoForm({...promoForm, description: e.target.value})}
                          placeholder="Description du code promo"
                        />
                      </div>
                      <div>
                        <Label htmlFor="promo-type">Type</Label>
                        <Select value={promoForm.type} onValueChange={(value) => setPromoForm({...promoForm, type: value})}>
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
                        <div>
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
                      <div>
                        <Label htmlFor="min-order">Montant minimum (€)</Label>
                        <Input
                          id="min-order"
                          type="number"
                          value={promoForm.min_order_amount}
                          onChange={(e) => setPromoForm({...promoForm, min_order_amount: e.target.value})}
                          placeholder="15.00"
                        />
                      </div>
                      <div>
                        <Label htmlFor="max-uses">Utilisations max</Label>
                        <Input
                          id="max-uses"
                          type="number"
                          value={promoForm.max_uses}
                          onChange={(e) => setPromoForm({...promoForm, max_uses: e.target.value})}
                          placeholder="100"
                        />
                      </div>
                      <div>
                        <Label htmlFor="expires">Date d'expiration</Label>
                        <Input
                          id="expires"
                          type="date"
                          value={promoForm.expires_at}
                          onChange={(e) => setPromoForm({...promoForm, expires_at: e.target.value})}
                        />
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
                            {promo.value}€
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{promo.used_count}/{promo.max_uses || '∞'}</TableCell>
                      <TableCell>
                        {promo.expires_at ? new Date(promo.expires_at).toLocaleDateString('fr-FR') : 'Aucune'}
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
          </Card>
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
