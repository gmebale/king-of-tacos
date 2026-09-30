import React, { useEffect, useState } from 'react';
import { Award, Gift, Star } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import api from '../services/api.service';

export default function LoyaltyCard() {
  const [points, setPoints] = useState(0);
  const [rewards, setRewards] = useState([]);
  const [claimed, setClaimed] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [pointResponse, rewardResponse, claimedResponse, historyResponse] = await Promise.all([
        api.get('/loyalty/points'), api.get('/loyalty/rewards'), api.get('/loyalty/my-rewards'), api.get('/loyalty/history')
      ]);
      setPoints(pointResponse.data.points || 0);
      setRewards(rewardResponse.data || []);
      setClaimed(claimedResponse.data || []);
      setHistory(historyResponse.data || []);
    } catch (error) {
      console.error('Unable to load loyalty data:', error);
      toast.error('Les informations fidélité sont temporairement indisponibles.');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const claim = async reward => {
    try {
      await api.post(`/loyalty/redeem/${reward.id}`);
      toast.success('Récompense ajoutée à votre espace.');
      await load();
    } catch (error) { toast.error(error.response?.data?.message || 'Impossible de réclamer cette récompense.'); }
  };

  if (loading) return <Card><CardContent className="p-6">Chargement de la fidélité…</CardContent></Card>;

  return <div className="space-y-6">
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Star className="h-5 w-5 text-amber-500" />Programme de fidélité</CardTitle></CardHeader>
      <CardContent><p className="text-3xl font-bold text-amber-700">{points} points</p><p className="mt-1 text-sm text-gray-600">Les points sont crédités après paiement et clôture de la commande, selon les produits achetés.</p></CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Gift className="h-5 w-5" />Récompenses disponibles</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {!rewards.length && <p className="text-sm text-gray-500">Aucune récompense disponible pour le moment.</p>}
        {rewards.map(reward => {
          const available = reward.available_quantity == null ? 0 : reward.available_quantity;
          const canClaim = points >= reward.points_required && available > 0;
          return <div key={reward.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><h3 className="font-semibold">{reward.name}</h3><p className="text-sm text-gray-600">{reward.description}</p>
              <p className="mt-1 text-sm font-medium text-amber-700">{reward.points_required} points · {available} disponible(s)</p>
              {reward.type === 'discount' && <p className="text-sm">Remise de {reward.discount_percent}% · code valable jusqu’au {new Date(reward.expires_at).toLocaleDateString('fr-FR')}</p>}
              {reward.type === 'gifted_product' && <p className="text-sm">Produit offert : {reward.giftedProduct?.name || '—'} · à ajouter au panier</p>}
              {reward.type === 'free_delivery' && <p className="text-sm">Code de livraison gratuite valable jusqu’au {new Date(reward.expires_at).toLocaleDateString('fr-FR')}</p>}
            </div>
            <Button onClick={() => claim(reward)} disabled={!canClaim}>{available < 1 ? 'Épuisée' : points < reward.points_required ? 'Points insuffisants' : 'Réclamer'}</Button>
          </div>;
        })}
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Award className="h-5 w-5" />Mes récompenses réclamées</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {!claimed.length && <p className="text-sm text-gray-500">Vous n’avez pas de récompense en attente.</p>}
        {claimed.map(item => <div key={item.id} className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="font-medium">{item.reward.name}</p><p className="text-sm text-gray-600">Expire le {item.expires_at ? new Date(item.expires_at).toLocaleDateString('fr-FR') : '—'}</p>
            {item.reward.type === 'gifted_product' && <p className="text-sm">Ajoutez {item.reward.giftedProduct?.name} au panier, la gratuité s’appliquera automatiquement.</p>}
          </div>
          {item.promoCode && <Badge className="w-fit font-mono text-base">{item.promoCode.code}</Badge>}
        </div>)}
      </CardContent>
    </Card>

    {history.length > 0 && <Card><CardHeader><CardTitle>Historique des récompenses</CardTitle></CardHeader><CardContent className="space-y-2">
      {history.map(item => <div key={item.id} className="flex flex-col gap-2 border-b py-2 last:border-0 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{item.reward?.name}</p><p className="text-xs text-gray-500">{new Date(item.created_at).toLocaleString('fr-FR')}</p>{item.promoCode?.code && <p className="font-mono text-sm">Code : {item.promoCode.code}</p>}</div><Badge variant="secondary">{item.status === 'used' ? 'Utilisée' : item.status === 'expired' ? 'Expirée' : 'En attente'} · -{item.points_used} pts</Badge></div>)}
    </CardContent></Card>}
  </div>;
}
