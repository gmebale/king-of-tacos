import React, { useState, useEffect } from "react";
import { User } from "../Entities/User";
import { motion } from "framer-motion";
import { 
  Plus, 
  Search, 
  Shield, 
  User as UserIcon, 
  Edit, 
  Save, 
  X, 
  Trash2, 
  Ban, 
  CheckCircle,
  Filter,
  Star
} from "lucide-react";
import { Button } from "../Components/ui/button";
import { Input } from "../Components/ui/input";
import { Badge } from "../Components/ui/badge";
import { Card, CardContent } from "../Components/ui/card";
import { Avatar, AvatarFallback } from "../Components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../Components/ui/dialog";
import { Label } from "../Components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../Components/ui/select";
import { Switch } from "../Components/ui/switch";
import toast from "react-hot-toast";

const PAGE_PERMISSIONS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "orders", label: "Commandes" },
  { key: "kitchen", label: "Cuisine" },
  { key: "cashier", label: "Caisse" },
  { key: "stock", label: "Stock" },
  { key: "finance", label: "Finance" },
  { key: "settings", label: "Paramètres" },
  { key: "staff", label: "Personnel" },
  { key: "reviews", label: "Avis" },
  { key: "customers", label: "Clients" }
];

const ROLE_OPTIONS = [
  { value: "client", label: "Client" },
  { value: "staff", label: "Staff" },
  { value: "serveur", label: "Serveur" },
  { value: "caissier", label: "Caissier" },
  { value: "cuisinier", label: "Cuisinier" },
  { value: "bar", label: "Bar" },
  { value: "manager", label: "Manager" },
  { value: "admin", label: "Administrateur" }
];

const createDefaultPermissions = () => ({
  dashboard: true,
  orders: false,
  kitchen: false,
  cashier: false,
  stock: false,
  finance: false,
  settings: false,
  staff: false,
  reviews: false,
  customers: false
});

export default function AdminStaff() {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  
  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  
  // Form states
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    full_name: "",
    phone: "",
    role: "client",
    pagePermissions: createDefaultPermissions()
  });
  
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isToggling, setIsToggling] = useState(null);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchQuery, roleFilter, statusFilter]);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await User.list();
      setUsers(data);
    } catch (error) {
      toast.error("Erreur lors du chargement des utilisateurs");
    } finally {
      setIsLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = users;

    if (searchQuery) {
      filtered = filtered.filter(u =>
        u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (roleFilter !== "all") {
      filtered = filtered.filter(u => u.role === roleFilter);
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(u => 
        statusFilter === "active" ? u.is_active : !u.is_active
      );
    }

    setFilteredUsers(filtered);
  };

  const getRoleColor = (role) => {
    switch (role) {
      case "admin":
        return "bg-purple-100 text-purple-800 border-purple-300";
      case "manager":
        return "bg-indigo-100 text-indigo-800 border-indigo-300";
      case "serveur":
        return "bg-cyan-100 text-cyan-800 border-cyan-300";
      case "caissier":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "cuisinier":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "bar":
        return "bg-pink-100 text-pink-800 border-pink-300";
      case "staff":
        return "bg-green-100 text-green-800 border-green-300";
      default:
        return "bg-blue-100 text-blue-800 border-blue-300";
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case "admin":
        return "Administrateur";
      case "manager":
        return "Manager";
      case "serveur":
        return "Serveur";
      case "caissier":
        return "Caissier";
      case "cuisinier":
        return "Cuisinier";
      case "bar":
        return "Bar";
      case "staff":
        return "Staff";
      default:
        return "Client";
    }
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.full_name) {
      toast.error("Email et nom complet sont requis");
      return;
    }

    if (!newUser.password) {
      toast.error("Un mot de passe est requis pour créer un utilisateur");
      return;
    }

    setIsCreating(true);
    try {
      await User.create({
        ...newUser,
        pagePermissions: newUser.pagePermissions || createDefaultPermissions()
      });
      toast.success("Utilisateur créé avec succès");
      setIsCreateDialogOpen(false);
      setNewUser({
        email: "",
        password: "",
        full_name: "",
        phone: "",
        role: "client",
        pagePermissions: createDefaultPermissions()
      });
      loadUsers();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditUser = (user) => {
    const normalizedPermissions = {
      ...createDefaultPermissions(),
      ...(user.pagePermissions || {})
    };
    setEditingUser({
      ...user,
      pagePermissions: normalizedPermissions
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUser.email || !editingUser.full_name) {
      toast.error("Email et nom complet sont requis");
      return;
    }

    setIsUpdating(true);
    try {
      await User.update(editingUser.id, {
        full_name: editingUser.full_name,
        phone: editingUser.phone,
        role: editingUser.role,
        is_active: editingUser.is_active,
        password: editingUser.password || undefined,
        pagePermissions: editingUser.pagePermissions || createDefaultPermissions()
      });
      toast.success("Utilisateur mis à jour avec succès");
      setIsEditDialogOpen(false);
      setEditingUser(null);
      loadUsers();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteClick = (user) => {
    setDeletingUser(user);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteUser = async () => {
    setIsDeleting(true);
    try {
      await User.delete(deletingUser.id);
      toast.success("Utilisateur supprimé avec succès");
      setIsDeleteDialogOpen(false);
      setDeletingUser(null);
      loadUsers();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleActive = async (user) => {
    setIsToggling(user.id);
    try {
      await User.toggleActive(user.id);
      toast.success(`Utilisateur ${!user.is_active ? 'activé' : 'désactivé'} avec succès`);
      loadUsers();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsToggling(null);
    }
  };

  return (
    <div className="p-6 md:p-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              Gestion du Personnel
            </h1>
            <p className="text-gray-600">
              Gérez les utilisateurs, leurs rôles et leurs accès
            </p>
          </div>
          <Button 
            onClick={() => setIsCreateDialogOpen(true)}
            className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-xl shadow-lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nouvel Utilisateur
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Créer un nouvel utilisateur</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@example.com"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="password">Mot de passe *</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mot de passe"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="full_name">Nom complet *</Label>
                  <Input
                    id="full_name"
                    placeholder="Jean Dupont"
                    value={newUser.full_name}
                    onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input
                    id="phone"
                    placeholder="+221 77 123 45 67"
                    value={newUser.phone}
                    onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="role">Rôle</Label>
                  <Select
                    value={newUser.role}
                    onValueChange={(value) => setNewUser({ ...newUser, role: value })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((roleOption) => (
                        <SelectItem key={roleOption.value} value={roleOption.value}>
                          {roleOption.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="pt-2">
                  <Label>Permissions d’accès</Label>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    {PAGE_PERMISSIONS.map((permission) => (
                      <div key={permission.key} className="flex items-center justify-between rounded-lg border p-2">
                        <span className="text-sm text-gray-700">{permission.label}</span>
                        <Switch
                          checked={!!newUser.pagePermissions?.[permission.key]}
                          onCheckedChange={(checked) =>
                            setNewUser((prev) => ({
                              ...prev,
                              pagePermissions: {
                                ...(prev.pagePermissions || createDefaultPermissions()),
                                [permission.key]: checked
                              }
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleCreateUser}
                  disabled={isCreating}
                  className="bg-amber-500 hover:bg-amber-600"
                >
                  {isCreating ? "Création..." : "Créer"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      {/* Filters */}
      <div className="mb-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            placeholder="Rechercher un utilisateur..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-12 rounded-xl border-2 focus:border-amber-400"
          />
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-500" />
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Tous les rôles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les rôles</SelectItem>
                {ROLE_OPTIONS.map((roleOption) => (
                  <SelectItem key={roleOption.value} value={roleOption.value}>
                    {roleOption.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="active">Actifs</SelectItem>
                <SelectItem value="inactive">Inactifs</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Users Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
          ))
        ) : filteredUsers.length === 0 ? (
          <div className="col-span-full text-center py-20">
            <UserIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Aucun utilisateur trouvé</p>
          </div>
        ) : (
          filteredUsers.map((user) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Card className={`border-2 transition-all hover:shadow-xl ${
                !user.is_active ? 'opacity-60 bg-gray-50' : 'hover:border-amber-400'
              }`}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <Avatar className={`w-16 h-16 ${
                      !user.is_active ? 'bg-gray-400' : 'bg-gradient-to-br from-yellow-400 to-amber-600'
                    }`}>
                      <AvatarFallback className="text-white font-bold text-lg">
                        {getInitials(user.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-bold text-lg truncate">{user.full_name}</h3>
                        {!user.is_active && (
                          <Badge className="bg-red-100 text-red-800 border-red-300">
                            <Ban className="w-3 h-3 mr-1" />
                            Inactif
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2 truncate">{user.email}</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge className={`border ${getRoleColor(user.role)}`}>
                          {user.role === "admin" && <Shield className="w-3 h-3 mr-1" />}
                          {getRoleLabel(user.role)}
                        </Badge>
                        {user.loyalty_points > 0 && (
                          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                            <Star className="w-3 h-3 mr-1" />
                            {user.loyalty_points} pts
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {user.phone && (
                    <div className="text-sm text-gray-600 mb-3">
                      📞 {user.phone}
                    </div>
                  )}

                  <div className="text-xs text-gray-500 mb-4">
                    Inscrit le {new Date(user.created_at).toLocaleDateString("fr-FR")}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditUser(user)}
                      className="flex-1"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Modifier
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleActive(user)}
                      disabled={isToggling === user.id}
                      className={`flex-1 ${
                        user.is_active 
                          ? 'text-orange-600 hover:text-orange-700' 
                          : 'text-green-600 hover:text-green-700'
                      }`}
                    >
                      {isToggling === user.id ? (
                        "..."
                      ) : user.is_active ? (
                        <>
                          <Ban className="w-4 h-4 mr-1" />
                          Désactiver
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Activer
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteClick(user)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier l'utilisateur</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="edit-email">Email *</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editingUser.email}
                  disabled
                  className="mt-1 bg-gray-100"
                />
              </div>
              <div>
                <Label htmlFor="edit-full_name">Nom complet *</Label>
                <Input
                  id="edit-full_name"
                  value={editingUser.full_name}
                  onChange={(e) => setEditingUser({ ...editingUser, full_name: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit-phone">Téléphone</Label>
                <Input
                  id="edit-phone"
                  value={editingUser.phone || ""}
                  onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit-role">Rôle</Label>
                <Select
                  value={editingUser.role}
                  onValueChange={(value) => setEditingUser({ ...editingUser, role: value })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((roleOption) => (
                      <SelectItem key={roleOption.value} value={roleOption.value}>
                        {roleOption.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-2">
                <Label>Permissions d’accès</Label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {PAGE_PERMISSIONS.map((permission) => (
                    <div key={permission.key} className="flex items-center justify-between rounded-lg border p-2">
                      <span className="text-sm text-gray-700">{permission.label}</span>
                      <Switch
                        checked={!!editingUser.pagePermissions?.[permission.key]}
                        onCheckedChange={(checked) =>
                          setEditingUser((prev) => ({
                            ...prev,
                            pagePermissions: {
                              ...(prev.pagePermissions || createDefaultPermissions()),
                              [permission.key]: checked
                            }
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="edit-password">Nouveau mot de passe (laisser vide pour ne pas changer)</Label>
                <Input
                  id="edit-password"
                  type="password"
                  placeholder="Nouveau mot de passe"
                  value={editingUser.password || ""}
                  onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div className="flex items-center justify-between pt-2">
                <Label htmlFor="edit-active">Compte actif</Label>
                <Switch
                  id="edit-active"
                  checked={editingUser.is_active}
                  onCheckedChange={(checked) => setEditingUser({ ...editingUser, is_active: checked })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                setEditingUser(null);
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={handleUpdateUser}
              disabled={isUpdating}
              className="bg-amber-500 hover:bg-amber-600"
            >
              {isUpdating ? "Mise à jour..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
          </DialogHeader>
          {deletingUser && (
            <div className="py-4">
              <p className="text-gray-700 mb-4">
                Êtes-vous sûr de vouloir supprimer l'utilisateur <strong>{deletingUser.full_name}</strong> ({deletingUser.email}) ?
              </p>
              <p className="text-sm text-red-600 font-semibold">
                Cette action est irréversible et supprimera toutes les données associées à cet utilisateur.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setDeletingUser(null);
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={handleDeleteUser}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600"
            >
              {isDeleting ? "Suppression..." : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
