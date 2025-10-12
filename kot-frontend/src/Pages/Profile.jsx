
import React, { useState, useEffect } from "react";
import { User } from '../Entities/User';
import { Order } from '../Entities/Order';
import { motion } from "framer-motion";
import { User as UserIcon, LogOut, Clock, CheckCircle, ArrowLeft, Edit, Save, X, Star } from "lucide-react";
import { Button } from '../Components/ui/button';
import { Input } from '../Components/ui/input';
import { Label } from '../Components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from "../Components/ui/card";
import { Badge } from "../Components/ui/badge";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from '../utils';
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import EditOrderDialog from '../Components/EditOrderDialog';

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedPhone, setEditedPhone] = useState('');
  const [editingOrder, setEditingOrder] = useState(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

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

      const userOrders = await Order.myOrders();
      setOrders(userOrders);
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
      await User.update({ full_name: editedName, phone: editedPhone });
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

  const handleEditOrder = (order) => {
    setEditingOrder(order);
    setIsEditDialogOpen(true);
  };

  const handleEditDialogClose = () => {
    setIsEditDialogOpen(false);
    setEditingOrder(null);
  };

  const handleEditDialogSave = () => {
    loadUserData();
    handleEditDialogClose();
  };

  const handleCancelOrder = async (orderId) => {
    if (window.confirm('Êtes-vous sûr de vouloir annuler cette commande ?')) {
      try {
        await Order.update(orderId, { status: 'annulee' });
        await loadUserData();
      } catch (error) {
        console.error("Error canceling order:", error);
        alert('Erreur lors de l\'annulation de la commande');
      }
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      en_attente: "bg-yellow-100 text-yellow-800 border-yellow-300",
      en_preparation: "bg-blue-100 text-blue-800 border-blue-300",
      prete: "bg-green-100 text-green-800 border-green-300",
      en_livraison: "bg-purple-100 text-purple-800 border-purple-300",
      livree: "bg-gray-100 text-gray-800 border-gray-300",
      annulee: "bg-red-100 text-red-800 border-red-300"
    };
    return colors[status] || colors.en_attente;
  };

  const getStatusLabel = (status) => {
    const labels = {
      en_attente: "En attente",
      en_preparation: "En préparation",
      prete: "Prête",
      en_livraison: "En livraison",
      livree: "Livrée",
      annulee: "Annulée"
    };
    return labels[status] || status;
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

          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-6 h-6 text-amber-600" />
                Historique des commandes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">Aucune commande pour le moment</p>
                  <Button
                    onClick={() => navigate(createPageUrl("Menu"))}
                    className="bg-gradient-to-r from-yellow-400 to-amber-600 text-white rounded-xl"
                  >
                    Commander maintenant
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <motion.div
                      key={order.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-4 border-2 rounded-xl hover:border-amber-400 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-semibold text-lg">
                            Commande #{order.id.slice(-6)}
                          </p>
                          <p className="text-sm text-gray-500">
                            {format(new Date(order.created_date), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                          </p>
                        </div>
                        <Badge className={`border ${getStatusColor(order.status)}`}>
                          {getStatusLabel(order.status)}
                        </Badge>
                      </div>

                      <div className="space-y-1 mb-3">
                        {order.items?.map((item, idx) => (
                          <p key={idx} className="text-sm text-gray-700">
                            {item.quantity}x {item.product_name}
                          </p>
                        ))}
                      </div>

                      <div className="flex justify-between items-center pt-3 border-t">
                        <span className="text-gray-600">Total</span>
                        <span className="text-xl font-bold bg-gradient-to-r from-amber-600 to-yellow-500 bg-clip-text text-transparent">
                          {order.total_amount?.toLocaleString()} FCFA
                        </span>
                      </div>

                      {order.status === 'en_attente' && (
                        <div className="flex gap-2 mt-3 pt-3 border-t">
                          <Button
                            size="sm"
                            onClick={() => handleEditOrder(order)}
                            className="bg-gradient-to-r from-yellow-400 to-amber-600 text-white rounded-xl"
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Modifier
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleCancelOrder(order.id)}
                            variant="outline"
                            className="border-2 border-red-300 text-red-600 hover:bg-red-50 rounded-xl"
                          >
                            <X className="w-4 h-4 mr-1" />
                            Annuler
                          </Button>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {editingOrder && (
        <EditOrderDialog
          order={editingOrder}
          isOpen={isEditDialogOpen}
          onClose={handleEditDialogClose}
          onSave={handleEditDialogSave}
        />
      )}
    </div>
  );
}
