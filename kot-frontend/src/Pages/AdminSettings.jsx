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
import { UploadFile } from '../integrations/Core';
import { resolveMediaUrl } from '../utils/media';

const ORDERING_DAYS = [
  ['Mon', 'Lundi'], ['Tue', 'Mardi'], ['Wed', 'Mercredi'], ['Thu', 'Jeudi'],
  ['Fri', 'Vendredi'], ['Sat', 'Samedi'], ['Sun', 'Dimanche']
];
const DEFAULT_ORDERING = {
  enabled: true,
  outside_hours_mode: 'closed',
  weekly: Object.fromEntries(ORDERING_DAYS.map(([key]) => [key, { active: false, open_time: '11:00', last_order_time: '21:30' }]))
};

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
  const [heroMedia, setHeroMedia] = useState({ media_url: '', media_type: '', overlay_opacity: 85 });
  const [uploadingHeroMedia, setUploadingHeroMedia] = useState(false);
  const [savingHeroMedia, setSavingHeroMedia] = useState(false);
  const [onlineOrdering, setOnlineOrdering] = useState(DEFAULT_ORDERING);
  const [onlineOrderingConfigured, setOnlineOrderingConfigured] = useState(false);
  const [savingOrdering, setSavingOrdering] = useState(false);

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
      const [response, paymentResponse, homepageResponse, orderingResponse] = await Promise.all([
        api.get('/settings/restaurant'),
        api.get('/settings/payment'),
        api.get('/settings/homepage'),
        api.get('/settings/online-ordering')
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
      setHeroMedia({
        media_url: homepageResponse.data.media_url || '',
        media_type: homepageResponse.data.media_type || '',
        overlay_opacity: Number.isInteger(Number(homepageResponse.data.overlay_opacity)) ? Number(homepageResponse.data.overlay_opacity) : 85
      });
      setOnlineOrdering({
        enabled: orderingResponse.data.enabled !== false,
        outside_hours_mode: orderingResponse.data.outside_hours_mode === 'next_opening' ? 'next_opening' : 'closed',
        weekly: Object.fromEntries(ORDERING_DAYS.map(([key]) => [key, {
          active: Boolean(orderingResponse.data.weekly?.[key]?.active),
          open_time: orderingResponse.data.weekly?.[key]?.open_time || '11:00',
          last_order_time: orderingResponse.data.weekly?.[key]?.last_order_time || '21:30'
        }]))
      });
      setOnlineOrderingConfigured(Boolean(orderingResponse.data.configured));
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

  const saveOnlineOrdering = async () => {
    try {
      setSavingOrdering(true);
      await api.put('/settings/online-ordering', onlineOrdering);
      setOnlineOrderingConfigured(true);
      toast.success('Horaires et règles de commande enregistrés');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Impossible d’enregistrer les horaires de commande');
    } finally {
      setSavingOrdering(false);
    }
  };

  const handleHeroMediaUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploadingHeroMedia(true);
    try {
      const uploaded = await UploadFile({ file });
      setHeroMedia(current => ({ ...current, media_url: uploaded.file_url, media_type: uploaded.media_type }));
      toast.success('Média téléversé. Pensez à enregistrer la bannière.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Impossible de téléverser ce média');
    } finally {
      setUploadingHeroMedia(false);
    }
  };

  const saveHeroMedia = async () => {
    try {
      setSavingHeroMedia(true);
      const response = await api.put('/settings/homepage', heroMedia);
      setHeroMedia(response.data);
      toast.success(heroMedia.media_url ? 'Bannière mise à jour' : 'Bannière supprimée');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Impossible de sauvegarder la bannière');
    } finally {
      setSavingHeroMedia(false);
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
                <Label htmlFor="opening_hours">Horaires affichés sur le site</Label>
                <Textarea
                  id="opening_hours"
                  value={settings.opening_hours}
                  onChange={(e) => handleInputChange('opening_hours', e.target.value)}
                  placeholder="Texte informatif pour les visiteurs"
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

      {user?.role === 'admin' && <Card className="max-w-3xl mb-8">
        <CardHeader>
          <CardTitle>Commandes en ligne</CardTitle>
          <p className="text-sm text-gray-500">Les horaires utilisent l’heure du Gabon (Africa/Libreville). La règle est aussi vérifiée par le serveur au moment de la commande.</p>
        </CardHeader>
        <CardContent className="space-y-5">
          {!onlineOrderingConfigured && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Aucun horaire n’est encore enregistré : les commandes restent ouvertes sans restriction horaire jusqu’à la première sauvegarde.</p>}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label htmlFor="online-ordering-enabled" className="text-base">Accepter les commandes en ligne</Label>
              <p className="text-sm text-gray-500">Désactivez ce bouton pour suspendre immédiatement les nouvelles commandes.</p>
            </div>
            <Switch id="online-ordering-enabled" checked={onlineOrdering.enabled} onCheckedChange={checked => setOnlineOrdering(current => ({ ...current, enabled: checked }))} />
          </div>
          <div>
            <Label htmlFor="outside-hours-mode">Après l’heure limite</Label>
            <select id="outside-hours-mode" className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm" value={onlineOrdering.outside_hours_mode} onChange={event => setOnlineOrdering(current => ({ ...current, outside_hours_mode: event.target.value }))}>
              <option value="closed">Refuser les commandes et afficher la prochaine ouverture</option>
              <option value="next_opening">Accepter et planifier au prochain créneau d’ouverture</option>
            </select>
          </div>
          <div className="space-y-2">
            <div className="hidden grid-cols-[100px_90px_1fr_1fr] gap-3 px-2 text-xs font-semibold text-gray-500 sm:grid">
              <span>Jour</span><span>Ouvert</span><span>Début</span><span>Dernière commande</span>
            </div>
            {ORDERING_DAYS.map(([key, label]) => {
              const day = onlineOrdering.weekly[key];
              return <div key={key} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[100px_90px_1fr_1fr] sm:items-center">
                <span className="font-medium">{label}</span>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={day.active} onChange={event => setOnlineOrdering(current => ({ ...current, weekly: { ...current.weekly, [key]: { ...current.weekly[key], active: event.target.checked } } }))} />Ouvert</label>
                <div><Label className="text-xs sm:hidden">Ouverture</Label><Input aria-label={`${label}, heure d’ouverture`} type="time" value={day.open_time} disabled={!day.active} onChange={event => setOnlineOrdering(current => ({ ...current, weekly: { ...current.weekly, [key]: { ...current.weekly[key], open_time: event.target.value } } }))} /></div>
                <div><Label className="text-xs sm:hidden">Dernière commande</Label><Input aria-label={`${label}, dernière commande`} type="time" value={day.last_order_time} disabled={!day.active} onChange={event => setOnlineOrdering(current => ({ ...current, weekly: { ...current.weekly, [key]: { ...current.weekly[key], last_order_time: event.target.value } } }))} /></div>
              </div>;
            })}
          </div>
          <div className="flex justify-end"><Button type="button" onClick={saveOnlineOrdering} disabled={savingOrdering}>{savingOrdering ? 'Enregistrement…' : 'Enregistrer les horaires'}</Button></div>
        </CardContent>
      </Card>}

      <Card className="max-w-2xl mb-8">
        <CardHeader>
          <CardTitle>Bannière de la page d’accueil</CardTitle>
          <p className="text-sm text-gray-500">Téléversez une image ou une vidéo. Images jusqu’à 10 Mo, vidéos jusqu’à 100 Mo.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {heroMedia.media_url && (
            <div className="relative aspect-video overflow-hidden rounded-xl border bg-gray-950">
              {heroMedia.media_type === 'video' ? (
                <video key={heroMedia.media_url} src={resolveMediaUrl(heroMedia.media_url)} controls muted playsInline className="h-full w-full object-cover" />
              ) : (
                <img src={resolveMediaUrl(heroMedia.media_url)} alt="Aperçu de la bannière" className="h-full w-full object-cover" />
              )}
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-100"
                style={{ opacity: heroMedia.overlay_opacity / 100 }}
              />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-xl font-black text-slate-900 drop-shadow-sm sm:text-3xl">
                King Of Tacos
              </div>
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
              onChange={handleHeroMediaUpload}
              disabled={uploadingHeroMedia}
              aria-label="Choisir une image ou une vidéo pour la bannière"
            />
            {heroMedia.media_url && (
              <Button type="button" variant="outline" onClick={() => setHeroMedia(current => ({ ...current, media_url: '', media_type: '' }))} disabled={savingHeroMedia}>
                Retirer
              </Button>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="hero-overlay-opacity">Opacité du voile blanc/jaune</Label>
              <span className="text-sm font-semibold text-amber-700">{heroMedia.overlay_opacity}%</span>
            </div>
            <Input
              id="hero-overlay-opacity"
              type="range"
              min="0"
              max="100"
              step="1"
              value={heroMedia.overlay_opacity}
              onChange={(event) => setHeroMedia(current => ({ ...current, overlay_opacity: Number(event.target.value) }))}
              disabled={savingHeroMedia}
            />
            <p className="text-xs text-gray-500">Une valeur élevée renforce le voile et la lisibilité du texte. Une valeur faible laisse davantage apparaître le média.</p>
          </div>
          <p className="text-xs text-gray-500">Formats pris en charge : JPG, PNG, WebP, MP4, WebM et MOV. L’aperçu s’adapte automatiquement au type de média.</p>
          <div className="flex justify-end">
            <Button type="button" onClick={saveHeroMedia} disabled={uploadingHeroMedia || savingHeroMedia}>
              {uploadingHeroMedia ? 'Téléversement…' : savingHeroMedia ? 'Sauvegarde…' : 'Enregistrer la bannière'}
            </Button>
          </div>
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
