import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../Components/ui/card';
import { Button } from '../Components/ui/button';
import { Input } from '../Components/ui/input';
import { Label } from '../Components/ui/label';
import { Textarea } from '../Components/ui/textarea';
import { Switch } from '../Components/ui/switch';
import { toast } from 'react-hot-toast';
import api from '../services/api.service';

const AdminSettings = () => {
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
    mobile_money_mobicash_enabled: true
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingPayments, setSavingPayments] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

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
        mobile_money_mobicash_enabled: paymentResponse.data.mobile_money_mobicash_enabled ?? true
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
              <Label className="text-base">Mobicash</Label>
              <Switch
                checked={paymentSettings.mobile_money_mobicash_enabled}
                onCheckedChange={() => handlePaymentToggle('mobile_money_mobicash_enabled')}
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
    </div>
  );
};

export default AdminSettings;
