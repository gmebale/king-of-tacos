import React, { useState, useEffect } from "react";
import { User } from "../Entities/User";
import { motion } from "framer-motion";
import { Plus, Search, Shield, User as UserIcon } from "lucide-react";
import { Button } from "../Components/ui/button";
import { Input } from "../Components/ui/input";
import { Badge } from "../Components/ui/badge";
import { Card, CardContent } from "../Components/ui/card";
import { Avatar, AvatarFallback } from "../Components/ui/avatar";

export default function AdminStaff() {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchQuery]);

  const loadUsers = async () => {
    setIsLoading(true);
    const data = await User.list();
    setUsers(data);
    setIsLoading(false);
  };

  const filterUsers = () => {
    let filtered = users;

    if (searchQuery) {
      filtered = filtered.filter(u =>
        u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredUsers(filtered);
  };

  const getRoleColor = (role) => {
    return role === "admin"
      ? "bg-purple-100 text-purple-800 border-purple-300"
      : "bg-blue-100 text-blue-800 border-blue-300";
  };

  const getRoleLabel = (role) => {
    return role === "admin" ? "Administrateur" : "Client";
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
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
              Gérez les utilisateurs et leurs rôles
            </p>
          </div>
        </div>
      </motion.div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            placeholder="Rechercher un utilisateur..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-12 rounded-xl border-2 focus:border-amber-400"
          />
        </div>
      </div>

      {/* Users Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
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
              <Card className="border-2 hover:border-amber-400 transition-all hover:shadow-xl">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <Avatar className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-amber-600">
                      <AvatarFallback className="text-white font-bold text-lg">
                        {getInitials(user.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="font-bold text-lg mb-1">{user.full_name}</h3>
                      <p className="text-sm text-gray-600 mb-2">{user.email}</p>
                      <Badge className={`border ${getRoleColor(user.role)}`}>
                        {user.role === "admin" && <Shield className="w-3 h-3 mr-1" />}
                        {getRoleLabel(user.role)}
                      </Badge>
                    </div>
                  </div>

                  {user.phone && (
                    <div className="text-sm text-gray-600 mb-2">
                      📞 {user.phone}
                    </div>
                  )}

                  <div className="text-xs text-gray-500">
                    Inscrit le {new Date(user.created_date).toLocaleDateString("fr-FR")}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      <div className="mt-8 p-6 bg-blue-50 border-2 border-blue-200 rounded-2xl">
        <div className="flex items-start gap-3">
          <Shield className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-bold text-blue-900 mb-2">Gestion des utilisateurs</h3>
            <p className="text-sm text-blue-800">
              Pour inviter de nouveaux utilisateurs ou modifier leurs rôles, rendez-vous dans la section 
              <span className="font-semibold"> Dashboard → Données → Utilisateurs</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}