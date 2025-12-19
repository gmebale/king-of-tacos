import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Star, Gift, Trophy, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import api from "../services/api.service";

export default function LoyaltyCard() {
  const [points, setPoints] = useState(0);
  const [rewards, setRewards] = useState([]);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLoyaltyData();
  }, []);

  const loadLoyaltyData = async () => {
    try {
      const [pointsRes, rewardsRes, historyRes] = await Promise.all([
        api.get('/loyalty/points'),
        api.get('/loyalty/rewards'),
        api.get('/loyalty/history')
      ]);

      setPoints(pointsRes.data.points);
      setRewards(rewardsRes.data);
      setHistory(historyRes.data);
    } catch (error) {
      console.error('Error loading loyalty data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const redeemReward = async (rewardId) => {
    try {
      await api.post(`/loyalty/redeem/${rewardId}`);
      await loadLoyaltyData(); // Refresh data
    } catch (error) {
      console.error('Error redeeming reward:', error);
    }
  };

  const getTierInfo = (points) => {
    if (points >= 1000) return { name: 'VIP', color: 'bg-purple-100 text-purple-800', icon: Trophy };
    if (points >= 500) return { name: 'Gold', color: 'bg-yellow-100 text-yellow-800', icon: Award };
    if (points >= 100) return { name: 'Silver', color: 'bg-gray-100 text-gray-800', icon: Star };
    return { name: 'Bronze', color: 'bg-orange-100 text-orange-800', icon: Star };
  };

  const tier = getTierInfo(points);
  const TierIcon = tier.icon;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Points Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TierIcon className="w-5 h-5" />
            Programme de Fidélité
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-2xl font-bold text-green-600">{points} points</p>
              <Badge className={`${tier.color} border`}>
                Niveau {tier.name}
              </Badge>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Prochaine récompense</p>
              <p className="text-sm font-medium">
                {points >= 1000 ? 'Maximum atteint !' : `${1000 - points} points`}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div
              className="bg-green-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min((points / 1000) * 100, 100)}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-600 text-center">
            {points}/1000 points pour le niveau VIP
          </p>
        </CardContent>
      </Card>

      {/* Available Rewards */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5" />
            Récompenses Disponibles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {rewards.map((reward) => (
              <motion.div
                key={reward.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div>
                  <h3 className="font-medium">{reward.name}</h3>
                  <p className="text-sm text-gray-600">{reward.description}</p>
                  <p className="text-sm font-medium text-green-600">
                    {reward.points_required} points
                  </p>
                </div>
                <Button
                  onClick={() => redeemReward(reward.id)}
                  disabled={points < reward.points_required}
                  size="sm"
                >
                  {points >= reward.points_required ? 'Échanger' : 'Insuffisant'}
                </Button>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Redemption History */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5" />
              Historique des Échanges
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {history.map((redemption) => (
                <div key={redemption.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                  <div>
                    <p className="font-medium">{redemption.reward.name}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(redemption.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    -{redemption.points_used} points
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
