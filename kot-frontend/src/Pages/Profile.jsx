
import React, { useState, useEffect } from "react";
import { User } from '../Entities/User';
import { motion } from "framer-motion";
import { User as UserIcon, LogOut, ArrowLeft, Edit, Save, X, Star } from "lucide-react";
import { Button } from '../Components/ui/button';
import { Input } from '../Components/ui/input';
import { Label } from '../Components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from "../Components/ui/card";
import { Badge } from "../Components/ui/badge";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from '../utils';
import LoyaltyCard from "../Components/LoyaltyCard";

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedPhone, setEditedPhone] = useState('');

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    setIsLoading(true);
    try {
      const currentUser = await User.me();
      setUser(currentUser);
      setEditedName(currentUser.full_name || '');
      setEditedPhone(currentUser.phone || '');
    } catch (error) {
      navigate(createPageUrl("Home"));
    }
    setIsLoading(false);
  };

  const handleLogout = async () => {
    await User.logout();
    navigate(createPageUrl("Home"));
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      await User.updateProfile({ full_name: editedName, phone: editedPhone });
      await loadUserData();
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating user:", error);
    }
  };

  const handleCancel = () => {
    setEditedName(user?.full_name || '');
    setEditedPhone(user?.phone || '');
    setIsEditing(false);
  };



  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Button
            variant="ghost"
            onClick={() => navigate(createPageUrl("Home"))}
            className="mb-4 text-amber-600 hover:text-amber-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour à l'accueil
          </Button>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-amber-600 to-yellow-500 bg-clip-text text-transparent">
            Mon Profil
          </h1>
          <p className="text-gray-600">Gérez vos informations et commandes</p>
        </motion.div>

        <div className="space-y-6">
          <Card className="border-2">
            <CardHeader className="bg-gradient-to-r from-amber-50 to-yellow-50">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-amber-600 rounded-full flex items-center justify-center">
                    <UserIcon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{user?.full_name}</p>
                    <p className="text-sm text-gray-600 font-normal">{user?.email}</p>
                  </div>
                </div>
                {!isEditing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleEdit}
                    className="text-amber-600 hover:text-amber-700"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="edit-name">Nom complet</Label>
                    <Input
                      id="edit-name"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className="rounded-xl border-2 focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-phone">Téléphone</Label>
                    <Input
                      id="edit-phone"
                      value={editedPhone}
                      onChange={(e) => setEditedPhone(e.target.value)}
                      className="rounded-xl border-2 focus:border-amber-400"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSave} className="bg-gradient-to-r from-yellow-400 to-amber-600 text-white rounded-xl">
                      <Save className="w-4 h-4 mr-2" />
                      Sauvegarder
                    </Button>
                    <Button onClick={handleCancel} variant="outline" className="rounded-xl">
                      <X className="w-4 h-4 mr-2" />
                      Annuler
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {user?.phone && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Téléphone</span>
                      <span className="font-semibold">{user.phone}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Points de fidélité</span>
                    <span className="font-semibold flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-500" />
                      {user?.loyalty_points || 0} points
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Rôle</span>
                    <Badge className="bg-amber-100 text-amber-800 border-amber-300">
                      {user?.role === "admin" ? "Administrateur" : "Client"}
                    </Badge>
                  </div>
                </div>
              )}

              <div className="mt-6 pt-6 border-t space-y-3">
                {user?.role === "admin" && (
                  <Button
                    onClick={() => navigate(createPageUrl("AdminDashboard"))}
                    variant="outline"
                    className="w-full border-2 border-amber-400 text-amber-600 hover:bg-amber-50 rounded-xl"
                  >
                    Accéder à l'administration
                  </Button>
                )}
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  className="w-full border-2 border-red-300 text-red-600 hover:bg-red-50 rounded-xl"
                >
                  <LogOut className="mr-2 w-4 h-4" />
                  Se déconnecter
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Loyalty Card */}
          <LoyaltyCard />


        </div>
      </div>


    </div>
  );
}
