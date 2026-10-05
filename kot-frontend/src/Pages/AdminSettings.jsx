import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../Components/ui/card';
import { Button } from '../Components/ui/button';
import { Input } from '../Components/ui/input';
import { Label } from '../Components/ui/label';
import { Textarea } from '../Components/ui/textarea';
import { Switch } from '../Components/ui/switch';
import { toast } from 'react-hot-toast';
import api from '../services/api.service';
import { useAuthContext } from '../contexts/AuthContext';

const AdminSettings = () => {
  const { user } = useAuthContext();
  const [settings, setSettings] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    opening_hours: '',
    delivery_radius: '',
    minimum_order: ''
  });
  const [paymentSettings, setPaymentSettings] = useState({
    mobile_money_enabled: true,
    mobile_money_airtel_enabled: true,
    mobile_money_moov_enabled: true
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingPayments, setSavingPayments] = useState(false);
  const [locations, setLocations] = useState([]);
  const [newLocationName, setNewLocationName] = useState('');
  const [savingLocation, setSavingLocation] = useState(false);
  const [taxRates, setTaxRates] = useState([]);
  const [newTaxName, setNewTaxName] = useState('');
  const [newTaxPercentage, setNewTaxPercentage] = useState('');
  const [savingTax, setSavingTax] = useState(false);
  const [editingTaxId, setEditingTaxId] = useState(null);
  const [editingTaxName, setEditingTaxName] = useState('');
  const [editingTaxPercentage, setEditingTaxPercentage] = useState('');

  useEffect(() => {
    loadSettings();
    if (user?.role === 'admin') {
      loadLocations();
      loadTaxRates();
    }
  }, [user?.role]);

  const loadTaxRates = async () => {
    try {
      const response = await api.get('/settings/tax-rates/manage');
      setTaxRates(response.data || []);
    } catch (error) {
      console.error('Error loading tax rates:', error);
      toast.error('Erreur lors du chargement des taxes');
    }
  };

  const addTaxRate = async (event) => {
    event.preventDefault();
    try {
      setSavingTax(true);
      await api.post('/settings/tax-rates', { name: newTaxName.trim(), percentage: Number(newTaxPercentage) });
      setNewTaxName('');
      setNewTaxPercentage('');
      await loadTaxRates();
      toast.success('Taux de taxe ajouté');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Impossible d’ajouter ce taux');
    } finally {
      setSavingTax(false);
    }
  };

  const toggleTaxRate = async (rate) => {
    try {
      const response = await api.patch(`/settings/tax-rates/${rate.id}`, { active: !rate.active });
      setTaxRates(current => current.map(item => item.id === rate.id ? response.data : item));
      toast.success(rate.active ? 'Taux désactivé pour les nouvelles commandes' : 'Taux réactivé');
    } catch (error) {
      toast.error('Impossible de modifier ce taux');
    }
  };

  const editTaxRate = async (event, rate) => {
    event.preventDefault();
    try {
      const response = await api.patch(`/settings/tax-rates/${rate.id}`, {
        name: editingTaxName.trim(), percentage: Number(editingTaxPercentage)
      });
      setTaxRates(current => current.map(item => item.id === rate.id ? response.data : item));
      setEditingTaxId(null);
      toast.success('Taux modifié. Les commandes déjà enregistrées gardent leur ancien calcul.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Impossible de modifier ce taux');
    }
  };

  const loadLocations = async () => {
    try {
      const response = await api.get('/settings/locations/manage');
      setLocations(response.data || []);
    } catch (error) {
      console.error('Error loading restaurant locations:', error);
      toast.error('Erreur lors du chargement des lieux');
    }
  };

  const addLocation = async (event) => {
    event.preventDefault();
    const name = newLocationName.trim();
    if (!name) return;
    try {
      setSavingLocation(true);
      await api.post('/settings/locations', { name });
      setNewLocationName('');
      await loadLocations();
      toast.success('Lieu ajouté');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Impossible d’ajouter ce lieu');
    } finally {
      setSavingLocation(false);
    }
  };

  const toggleLocation = async (location) => {
    try {
      const response = await api.patch(`/settings/locations/${location.id}`, { active: !location.active });
      setLocations(current => current.map(item => item.id === location.id ? response.data : item));
      toast.success(location.active ? 'Lieu désactivé' : 'Lieu réactivé');
    } catch (error) {
      toast.error('Impossible de modifier ce lieu');
    }
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      const [response, paymentResponse] = await Promise.all([
        api.get('/settings/restaurant'),
        api.get('/settings/payment')
      ]);
      setSettings({
        name: response.data.name || '',
        address: response.data.address || '',
        phone: response.data.phone || '',
        email: response.data.email || '',
        opening_hours: response.data.opening_hours || '',
        delivery_radius: response.data.delivery_radius || '',
        minimum_order: response.data.minimum_order || ''
      });
      setPaymentSettings({
        mobile_money_enabled: paymentResponse.data.mobile_money_enabled ?? true,
        mobile_money_airtel_enabled: paymentResponse.data.mobile_money_airtel_enabled ?? true,
        mobile_money_moov_enabled: paymentResponse.data.mobile_money_moov_enabled ?? true
      });
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Erreur lors du chargement des paramètres');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePaymentToggle = (field) => {
    setPaymentSettings(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.put('/settings/restaurant', settings);
      toast.success('Paramètres sauvegardés avec succès');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Erreur lors de la sauvegarde des paramètres');
    } finally {
      setSaving(false);
    }
  };

  const handlePaymentSubmit = async () => {
    try {
      setSavingPayments(true);
      await api.put('/settings/payment', paymentSettings);
      toast.success('Paramètres de paiement sauvegardés');
    } catch (error) {
      console.error('Error saving payment settings:', error);
      toast.error('Erreur lors de la sauvegarde des paiements');
    } finally {
      setSavingPayments(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Paramètres du Restaurant</h1>
        <p className="text-gray-600 mt-2">Gérez les informations générales de votre restaurant</p>
      </div>

      <Card className="max-w-2xl mb-8">
        <CardHeader>
          <CardTitle>Informations du Restaurant</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">Nom du Restaurant</Label>
                <Input
                  id="name"
                  value={settings.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Entrez le nom du restaurant"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  value={settings.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="Entrez le numéro de téléphone"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={settings.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="Entrez l'adresse email"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address">Adresse</Label>
                <Textarea
                  id="address"
                  value={settings.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  placeholder="Entrez l'adresse complète"
                  rows={3}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="opening_hours">Horaires d'ouverture</Label>
                <Textarea
                  id="opening_hours"
                  value={settings.opening_hours}
                  onChange={(e) => handleInputChange('opening_hours', e.target.value)}
                  placeholder="Ex: Lundi-Vendredi: 11h-22h, Samedi-Dimanche: 12h-23h"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="delivery_radius">Rayon de livraison (km)</Label>
                <Input
                  id="delivery_radius"
                  type="number"
                  value={settings.delivery_radius}
                  onChange={(e) => handleInputChange('delivery_radius', e.target.value)}
                  placeholder="Ex: 5"
                  min="0"
                  step="0.1"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="minimum_order">Commande minimum (€)</Label>
                <Input
                  id="minimum_order"
                  type="number"
                  value={settings.minimum_order}
                  onChange={(e) => handleInputChange('minimum_order', e.target.value)}
                  placeholder="Ex: 10"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="flex justify-end pt-6">
              <Button
                type="submit"
                disabled={saving}
                className="px-8"
              >
                {saving ? 'Sauvegarde...' : 'Sauvegarder'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Moyens de paiement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Mobile money</Label>
              <p className="text-sm text-gray-500">Activer/désactiver le paiement mobile money</p>
            </div>
            <Switch
              checked={paymentSettings.mobile_money_enabled}
              onCheckedChange={() => handlePaymentToggle('mobile_money_enabled')}
            />
          </div>

          <div className="space-y-4 pl-4 border-l border-gray-200">
            <div className="flex items-center justify-between">
              <Label className="text-base">AIRTEL Money</Label>
              <Switch
                checked={paymentSettings.mobile_money_airtel_enabled}
                onCheckedChange={() => handlePaymentToggle('mobile_money_airtel_enabled')}
                disabled={!paymentSettings.mobile_money_enabled}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-base">Moov Money</Label>
              <Switch
                checked={paymentSettings.mobile_money_moov_enabled}
                onCheckedChange={() => handlePaymentToggle('mobile_money_moov_enabled')}
                disabled={!paymentSettings.mobile_money_enabled}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handlePaymentSubmit} disabled={savingPayments}>
              {savingPayments ? 'Sauvegarde...' : 'Sauvegarder'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {user?.role === 'admin' && <Card className="max-w-2xl mt-8">
        <CardHeader>
          <CardTitle>Lieux de service</CardTitle>
          <p className="text-sm text-gray-500">Les lieux actifs sont proposés aux serveurs pour les commandes sur place.</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <form onSubmit={addLocation} className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="new-location">Ajouter un lieu</Label>
              <Input id="new-location" value={newLocationName} onChange={event => setNewLocationName(event.target.value)} maxLength={80} placeholder="Ex. Jardin" />
            </div>
            <Button type="submit" disabled={savingLocation || !newLocationName.trim()} className="self-end">
              {savingLocation ? 'Ajout...' : 'Ajouter'}
            </Button>
          </form>
          <div className="divide-y rounded-lg border">
            {locations.map(location => (
              <div key={location.id} className="flex items-center justify-between gap-4 p-3">
                <div>
                  <p className="font-medium">{location.name}</p>
                  <p className="text-xs text-gray-500">{location.active ? 'Actif' : 'Inactif'}</p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => toggleLocation(location)}>
                  {location.active ? 'Désactiver' : 'Réactiver'}
                </Button>
              </div>
            ))}
            {!locations.length && <p className="p-4 text-sm text-gray-500">Aucun lieu configuré.</p>}
          </div>
        </CardContent>
      </Card>}

      {user?.role === 'admin' && <Card className="max-w-2xl mt-8">
        <CardHeader>
          <CardTitle>Taux de taxe</CardTitle>
          <p className="text-sm text-gray-500">Créez les taux ici, puis associez un ou plusieurs taux aux produits dans Stock.</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <form onSubmit={addTaxRate} className="grid sm:grid-cols-[1fr_150px_auto] gap-3 items-end">
            <div>
              <Label htmlFor="tax-name">Nom du taux</Label>
              <Input id="tax-name" value={newTaxName} onChange={event => setNewTaxName(event.target.value)} maxLength={80} placeholder="Ex. Taxe locale" required />
            </div>
            <div>
              <Label htmlFor="tax-percentage">Pourcentage</Label>
              <Input id="tax-percentage" type="number" min="0" max="100" step="0.01" value={newTaxPercentage} onChange={event => setNewTaxPercentage(event.target.value)} placeholder="Ex. 18" required />
            </div>
            <Button type="submit" disabled={savingTax}>{savingTax ? 'Ajout...' : 'Ajouter'}</Button>
          </form>
          <div className="divide-y rounded-lg border">
            {taxRates.map(rate => (
              <div key={rate.id} className="flex items-center justify-between gap-4 p-3">
                {editingTaxId === rate.id ? (
                  <form onSubmit={event => editTaxRate(event, rate)} className="grid flex-1 gap-2 sm:grid-cols-[1fr_130px_auto_auto]">
                    <Input aria-label="Nom du taux" value={editingTaxName} onChange={event => setEditingTaxName(event.target.value)} maxLength={80} required />
                    <Input aria-label="Pourcentage du taux" type="number" min="0" max="100" step="0.01" value={editingTaxPercentage} onChange={event => setEditingTaxPercentage(event.target.value)} required />
                    <Button type="submit" size="sm">Enregistrer</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditingTaxId(null)}>Annuler</Button>
                  </form>
                ) : <div className="flex-1">
                  <p className="font-medium">{rate.name} — {rate.percentage}%</p>
                  <p className="text-xs text-gray-500">{rate.active ? 'Actif pour les nouvelles commandes' : 'Inactif'}</p>
                </div>}
                {editingTaxId !== rate.id && <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => { setEditingTaxId(rate.id); setEditingTaxName(rate.name); setEditingTaxPercentage(String(rate.percentage)); }}>Modifier</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => toggleTaxRate(rate)}>{rate.active ? 'Désactiver' : 'Réactiver'}</Button>
                </div>}
              </div>
            ))}
            {!taxRates.length && <p className="p-4 text-sm text-gray-500">Aucun taux configuré.</p>}
          </div>
        </CardContent>
      </Card>}
    </div>
  );
};

export default AdminSettings;
