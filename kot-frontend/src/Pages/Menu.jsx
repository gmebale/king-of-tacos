import React, { useState, useEffect } from "react";
import { Product } from "../Entities/Product";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart, Plus, Minus, Search, Filter, ArrowLeft } from "lucide-react";
import { Button } from "../Components/ui/button";
import { Input } from "../Components/ui/input";
import { Badge } from "../Components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "../Components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../Components/ui/select";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "../utils";

import ProductCard from "../Components/menu/ProductCard";
import CartSummary from "../Components/menu/CartSummary";

export default function Menu() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [category, setCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
    loadCart();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [category, searchQuery, products]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [productsData, categoriesData] = await Promise.all([
        Product.list(),
        Product.getCategories()
      ]);
      setProducts(productsData.filter(p => p.available && p.category?.name !== "options" && p.category?.name !== "supp" && p.category?.name !== "viande" && p.category?.name !== "sauces" && p.category?.name !== "goûts"));
      // Filter out "options", "Suppléments", and "Viande" categories from the menu
      setCategories(categoriesData.filter(cat => cat.name !== "options" && cat.name !== "supp" && cat.name !== "viande" && cat.name !== "sauces" && cat.name !== "goûts"));
    } catch (err) {
      setError('Erreur de chargement des produits. Vérifiez la connexion au serveur.');
      console.error('Error loading products:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCart = () => {
    const savedCart = JSON.parse(localStorage.getItem('kingoftacos_cart') || '[]');
    setCart(savedCart);
  };

  const filterProducts = () => {
    let filtered = products;

    if (category !== "all") {
      filtered = filtered.filter(p => p.category?.name === category);
    }

    if (searchQuery) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredProducts(filtered);
  };

  const addToCart = (product) => {
    const existingItem = cart.find(item =>
      item.id === product.id &&
      JSON.stringify(item.customization || {}) === JSON.stringify(product.customization || {})
    );
    let newCart;

    // Calculate final price with discount
    const finalPrice = product.discount_percentage > 0
      ? product.price * (1 - product.discount_percentage / 100)
      : product.price;

    const cartProduct = {
      ...product,
      displayPrice: product.displayPrice || finalPrice, // Use existing displayPrice if set (for customizations), else finalPrice
      originalPrice: product.price
    };

    if (existingItem) {
      newCart = cart.map(item =>
        item.id === product.id &&
        JSON.stringify(item.customization || {}) === JSON.stringify(product.customization || {})
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
    } else {
      newCart = [...cart, { ...cartProduct, quantity: 1 }];
    }

    setCart(newCart);
    localStorage.setItem('kingoftacos_cart', JSON.stringify(newCart));
    window.dispatchEvent(new Event('storage'));
  };

  const updateQuantity = (productId, change, customization = null) => {
    const newCart = cart.map(item => {
      if (item.id === productId &&
          (!customization || JSON.stringify(item.customization || {}) === JSON.stringify(customization || {}))) {
        const newQuantity = Math.max(0, item.quantity + change);
        return { ...item, quantity: newQuantity };
      }
      return item;
    }).filter(item => item.quantity > 0);

    setCart(newCart);
    localStorage.setItem('kingoftacos_cart', JSON.stringify(newCart));
    window.dispatchEvent(new Event('storage'));
  };

  const cartTotal = cart.reduce((sum, item) => {
    const price = item.displayPrice || item.price;
    return sum + (price * item.quantity);
  }, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen pb-32">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
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
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-amber-600 to-yellow-500 bg-clip-text text-transparent">
            Notre Menu
          </h1>
          <p className="text-gray-600 text-lg">
            Découvrez nos délicieux tacos et accompagnements
          </p>
        </motion.div>

        {/* Search & Filters */}
        <div className="mb-8 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder="Rechercher un produit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-12 rounded-2xl border-2 focus:border-amber-400"
            />
          </div>

          {/* Category Filter - Desktop */}
          <div className="hidden md:block">
            <Tabs value={category} onValueChange={setCategory}>
              <TabsList className="bg-white border-2 border-gray-200 flex-wrap h-auto p-1">
                <TabsTrigger value="all" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-400 data-[state=active]:to-amber-500 data-[state=active]:text-white px-4 py-2">
                  Tous
                </TabsTrigger>
                {categories.map(cat => (
                  <TabsTrigger 
                    key={cat.id}
                    value={cat.name} 
                    className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-400 data-[state=active]:to-amber-500 data-[state=active]:text-white px-4 py-2"
                  >
                    {cat.displayName || cat.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {/* Category Filter - Mobile */}
          <div className="md:hidden">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full h-12 rounded-2xl border-2 focus:border-amber-400 bg-white">
                <SelectValue placeholder="Sélectionner une catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.name}>
                    {cat.displayName || cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Products Grid */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-80 bg-gray-100 rounded-3xl animate-pulse" />
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8"
            >
              {filteredProducts.map((product) => {
                // Find cart item for this product, considering customizations
                const cartItem = cart.find(item => item.id === product.id);
                return (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={addToCart}
                    cartItem={cartItem}
                    onUpdateQuantity={updateQuantity}
                  />
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {error && !isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <p className="text-red-500 text-lg">{error}</p>
            <Button onClick={loadData} className="mt-4">Réessayer</Button>
          </motion.div>
        )}

        {filteredProducts.length === 0 && !isLoading && !error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <p className="text-gray-500 text-lg">Aucun produit trouvé</p>
          </motion.div>
        )}
      </div>

      {/* Fixed Cart Summary */}
      {cart.length > 0 && (
        <CartSummary
          cart={cart}
          cartTotal={cartTotal}
          cartCount={cartCount}
          onCheckout={() => navigate(createPageUrl("Cart"))}
        />
      )}
    </div>
  );
}
