import React, { useState, useEffect } from "react";
import { User } from "../Entities/User";
import { motion } from "framer-motion";
import { Settings, Store, LogOut, Moon, Sun } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../Components/ui/card";
import { Button } from "../Components/ui/button";
import { Input } from "../Components/ui/input";
import { Label } from "../Components/ui/label";
import { Switch } from "../Components/ui/switch";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "../utils";

export default function AdminSettings() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [restaurantInfo, setRestaurantInfo] = useState({
    name: "King Of Tacos",
    address: "123 Rue de la Paix, Paris",
    phone: "01 23 45 67 89",
    email: "contact@kingoftacos.fr"
  });

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);
    } catch (error) {
      navigate(createPageUrl("Home"));
    }
  };

  const handleLogout = async () => {
    await User.logout();
    navigate(createPageUrl("Home"));
  };

  return (
    <div className="p-6 md:p-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
          Paramètres
        </h1>
        <p className="text-gray-600">
          Configurez votre restaurant et vos préférences
        </p>
      </motion.div>

      <div className="max-w-4xl space-y-6">
        {/* Restaurant Info */}
        <Card className="border-2">
          <CardHeader className="bg-gradient-to-r from-amber-50 to-yellow-50">
            <CardTitle className="flex items-center gap-2">
              <Store className="w-5 h-5 text-amber-600" />
              Informations du Restaurant
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="restaurant-name">Nom du restaurant</Label>
              <Input
                id="restaurant-name"
                value={restaurantInfo.name}
                onChange={(e) => setRestaurantInfo({...restaurantInfo, name: e.target.value})}
                className="rounded-xl border-2 focus:border-amber-400"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Adresse</Label>
              <Input
                id="address"
                value={restaurantInfo.address}
                onChange={(e) => setRestaurantInfo({...restaurantInfo, address: e.target.value})}
                className="rounded-xl border-2 focus:border-amber-400"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  value={restaurantInfo.phone}
                  onChange={(e) => setRestaurantInfo({...restaurantInfo, phone: e.target.value})}
                  className="rounded-xl border-2 focus:border-amber-400"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={restaurantInfo.email}
                  onChange={(e) => setRestaurantInfo({...restaurantInfo, email: e.target.value})}
                  className="rounded-xl border-2 focus:border-amber-400"
                />
              </div>
            </div>

            <Button className="bg-gradient-to-r from-yellow-400 to-amber-600 hover:from-yellow-500 hover:to-amber-700 text-white rounded-xl">
              Sauvegarder
            </Button>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card className="border-2">
          <CardHeader className="bg-gradient-to-r from-amber-50 to-yellow-50">
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-amber-600" />
              Préférences
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex items-center justify-between p-4 border-2 rounded-xl">
              <div className="flex items-center gap-3">
                {darkMode ? <Moon className="w-5 h-5 text-gray-600" /> : <Sun className="w-5 h-5 text-amber-600" />}
                <div>
                  <p className="font-semibold">Mode sombre</p>
                  <p className="text-sm text-gray-500">Activer le thème sombre</p>
                </div>
              </div>
              <Switch
                checked={darkMode}
                onCheckedChange={setDarkMode}
              />
            </div>
          </CardContent>
        </Card>

        {/* Account */}
        <Card className="border-2">
          <CardHeader className="bg-gradient-to-r from-amber-50 to-yellow-50">
            <CardTitle>Compte administrateur</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {user && (
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="font-semibold text-lg mb-1">{user.full_name}</p>
                <p className="text-gray-600">{user.email}</p>
              </div>
            )}

            <Button
              onClick={handleLogout}
              variant="outline"
              className="w-full border-2 border-red-300 text-red-600 hover:bg-red-50 rounded-xl"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Se déconnecter
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}