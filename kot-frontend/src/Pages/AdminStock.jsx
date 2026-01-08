import React, { useState, useEffect } from "react";
import { Product } from "../Entities/Product";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Edit, Trash2, AlertCircle, TrendingDown, Eye, EyeOff } from "lucide-react";
import { Button } from "../Components/ui/button";
import { Input } from "../Components/ui/input";
import { Badge } from "../Components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../Components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "../Components/ui/tabs";

import ProductFormDialog from "../Components/admin/ProductFormDialog";

export default function AdminStock() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, searchQuery, categoryFilter]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [productsData, categoriesData] = await Promise.all([
        Product.list(),
        Product.getCategories()
      ]);
      setProducts(productsData);
      setCategories(categoriesData);
    } catch (err) {
      setError('Erreur de chargement des données. Vérifiez la connexion au serveur.');
      console.error('Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const data = await Product.list();
      setProducts(data);
    } catch (err) {
      setError('Erreur de chargement des produits. Vérifiez la connexion au serveur.');
      console.error('Error loading products:', err);
    }
  };

  const filterProducts = () => {
    let filtered = products;

    if (categoryFilter !== "all") {
      filtered = filtered.filter(p => {
        const catName = typeof p.category === 'string' ? p.category : p.category?.name;
        return catName === categoryFilter;
      });
    }

    if (searchQuery) {
      filtered = filtered.filter(p => {
        const catLabel = getCategoryLabel(p.category).toLowerCase();
        return p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
               catLabel.includes(searchQuery.toLowerCase());
      });
    }

    setFilteredProducts(filtered);
  };

  const handleSave = async (productData) => {
    if (editingProduct) {
      await Product.update(editingProduct.id, productData);
    } else {
      await Product.create(productData);
    }
    setShowDialog(false);
    setEditingProduct(null);
    loadProducts();
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setShowDialog(true);
  };

  const handleDelete = async (productId) => {
    if (window.confirm("⚠️ Êtes-vous sûr de vouloir supprimer ce produit ? Cette action est irréversible.")) {
      await Product.delete(productId);
      loadProducts();
    }
  };

  const toggleAvailability = async (product) => {
    await Product.update(product.id, { available: !product.available });
    loadProducts();
  };

  const getCategoryLabel = (category) => {
    if (!category) return "❓ Non catégorisé";
    
    // Handle both string (old) and object (new) formats
    const categoryName = typeof category === 'string' ? category : category.name;
    
    const labels = {
      tacos: "🌮 Tacos",
      burritos: "🌯 Burritos",
      burger: "🍔 Burgers",
      boissons: "🥤 Boissons",
      desserts: "🍰 Desserts",
      accompagnements: "🍟 Accompagnements",
      options: "⚙️ Options"
    };
    return labels[categoryName] || (typeof category === 'object' ? category.displayName || category.name : category);
  };

  const getCategoryColor = (categoryName) => {
    const colors = {
      tacos: "bg-amber-500",
      burritos: "bg-blue-500",
      burger: "bg-red-500",
      boissons: "bg-purple-500",
      desserts: "bg-green-500",
      accompagnements: "bg-orange-500",
      options: "bg-gray-500"
    };
    return colors[categoryName] || "bg-gray-500";
  };

  const getFinalPrice = (product) => {
    if (product.discount_percentage > 0) {
      return product.price * (1 - product.discount_percentage / 100);
    }
    return product.price;
  };

  const stats = {
    total: products.length,
    lowStock: products.filter(p => p.stock <= p.stock_alert_threshold).length,
    withDiscount: products.filter(p => p.discount_percentage > 0).length
  };

  // Dynamically calculate stats for each category
  categories.forEach(cat => {
    stats[cat.name] = products.filter(p => p.category?.name === cat.name).length;
  });

  return (
    <div className="p-6 md:p-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              Gestion des Produits
            </h1>
            <p className="text-gray-600">
              Gérez votre catalogue, prix, stocks et promotions
            </p>
          </div>
          <Button
            onClick={() => {
              setEditingProduct(null);
              setShowDialog(true);
            }}
            className="bg-gradient-to-r from-yellow-400 to-amber-600 hover:from-yellow-500 hover:to-amber-700 text-white rounded-xl shadow-lg"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nouveau produit
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl border-2 border-blue-200">
            <p className="text-sm text-gray-600 mb-1">Total</p>
            <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 p-4 rounded-xl border-2 border-amber-200">
            <p className="text-sm text-gray-600 mb-1">Tacos</p>
            <p className="text-2xl font-bold text-amber-600">{stats.tacos}</p>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-xl border-2 border-purple-200">
            <p className="text-sm text-gray-600 mb-1">Boissons</p>
            <p className="text-2xl font-bold text-purple-600">{stats.boissons}</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-xl border-2 border-green-200">
            <p className="text-sm text-gray-600 mb-1">Desserts</p>
            <p className="text-2xl font-bold text-green-600">{stats.desserts}</p>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-rose-50 p-4 rounded-xl border-2 border-red-200">
            <p className="text-sm text-gray-600 mb-1">Stock bas</p>
            <p className="text-2xl font-bold text-red-600">{stats.lowStock}</p>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-yellow-50 p-4 rounded-xl border-2 border-orange-200">
            <p className="text-sm text-gray-600 mb-1">En promo</p>
            <p className="text-2xl font-bold text-orange-600">{stats.withDiscount}</p>
          </div>
        </div>
      </motion.div>

      {/* Search & Filters */}
      <div className="mb-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            placeholder="Rechercher un produit par nom..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-12 rounded-xl border-2 focus:border-amber-400"
          />
        </div>

        <Tabs value={categoryFilter} onValueChange={setCategoryFilter}>
          <TabsList className="bg-white border-2 border-gray-200 overflow-x-auto">
            <TabsTrigger 
              value="all" 
              className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-400 data-[state=active]:to-amber-500 data-[state=active]:text-white"
            >
              Tous ({stats.total})
            </TabsTrigger>
            {categories.map(category => (
              <TabsTrigger
                key={category.id}
                value={category.name}
                className={`rounded-xl data-[state=active]:${getCategoryColor(category.name)} data-[state=active]:text-white`}
              >
                {getCategoryLabel(category)} ({stats[category.name] || 0})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden shadow-lg">
        <Table>
          <TableHeader>
            <TableRow className="bg-gradient-to-r from-amber-50 to-yellow-50">
              <TableHead className="font-bold text-left pl-5">Produit</TableHead>
              <TableHead className="font-bold text-left pl-6">Catégorie</TableHead>
              <TableHead className="font-bold text-left pl-4">Prix</TableHead>
              <TableHead className="font-bold text-left">Stock</TableHead>
              <TableHead className="font-bold text-left">Statut</TableHead>
              <TableHead className="font-bold text-right ml-15">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <div className="h-16 bg-gray-100 rounded animate-pulse" />
                    </TableCell>
                  </TableRow>
                ))
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <p className="text-red-500 text-lg">{error}</p>
                    <Button onClick={loadProducts} className="mt-4">Réessayer</Button>
                  </TableCell>
                </TableRow>
              ) : filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <p className="text-gray-500 text-lg">Aucun produit trouvé</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((product) => {
                  const finalPrice = getFinalPrice(product);
                  return (
                    <TableRow key={product.id} className="hover:bg-amber-50 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {product.image ? (
                            <img
                              src={product.image}
                              alt={product.name}
                              className="w-16 h-16 rounded-xl object-cover border-2 border-gray-200"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-amber-100 to-yellow-100 flex items-center justify-center border-2 border-amber-200">
                              <span className="text-2xl">📦</span>
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-base">{product.name}</p>
                            {product.description && (
                              <p className="text-sm text-gray-500 line-clamp-1">
                                {product.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-2">
                          {getCategoryLabel(product.category)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          {product.discount_percentage > 0 ? (
                            <>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-green-600 text-lg">
                                  {Math.round(finalPrice).toLocaleString()} FCFA
                                </span>
                                <Badge className="bg-red-500 text-white text-xs">
                                  -{product.discount_percentage}%
                                </Badge>
                              </div>
                              <span className="text-sm text-gray-500 line-through">
                                {(product.price ).toLocaleString()} FCFA
                              </span>
                            </>
                          ) : (
                            <span className="font-semibold text-amber-600 text-lg">
                              {(product.price ).toLocaleString()} FCFA
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {product.stock <= product.stock_alert_threshold && (
                            <AlertCircle className="w-4 h-4 text-red-500" />
                          )}
                          <span className={
                            product.stock <= product.stock_alert_threshold
                              ? "font-bold text-red-600"
                              : product.stock <= product.stock_alert_threshold * 2
                              ? "font-semibold text-orange-600"
                              : "font-semibold text-green-600"
                          }>
                            {product.stock}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={
                          product.available
                            ? "bg-green-100 text-green-800 border-green-300"
                            : "bg-gray-100 text-gray-800 border-gray-300"
                        }>
                          {product.available ? "✅ Disponible" : "❌ Indisponible"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => toggleAvailability(product)}
                            className="hover:bg-amber-50 text-amber-600"
                            title={product.available ? "Masquer" : "Afficher"}
                          >
                            {product.available ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEdit(product)}
                            className="hover:bg-blue-50 text-blue-600"
                            title="Modifier"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDelete(product.id)}
                            className="hover:bg-red-50 text-red-600"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </AnimatePresence>
          </TableBody>
        </Table>
      </div>

      <ProductFormDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        product={editingProduct}
        onSave={handleSave}
      />
    </div>
  );
}