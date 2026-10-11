import React, { useState, useEffect } from "react";
import { Product } from "../Entities/Product";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart, Plus, Minus, Search, Filter, ArrowLeft } from "lucide-react";
import { Button } from "../Components/ui/button";
import { Input } from "../Components/ui/input";
import { Badge } from "../Components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "../Components/ui/tabs";
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
      setProducts(productsData.filter(p => p.category?.is_menu_visible !== false));
      setCategories(categoriesData.filter(cat => cat.is_menu_visible !== false));
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

  const addToCart = (productOrBatch) => {
    const additions = Array.isArray(productOrBatch)
      ? productOrBatch
      : [{ product: productOrBatch, quantity: 1 }];
    const newCart = [...cart];

    additions.forEach(({ product, quantity = 1 }) => {
      const existingIndex = newCart.findIndex(item =>
        item.id === product.id &&
        JSON.stringify(item.customization || {}) === JSON.stringify(product.customization || {})
      );

      // Calculate final price with discount
      const finalPrice = product.discount_percentage > 0
        ? product.price * (1 - product.discount_percentage / 100)
        : product.price;
      const cartProduct = {
        ...product,
        displayPrice: product.displayPrice || finalPrice,
        originalPrice: product.price
      };

      if (existingIndex >= 0) {
        const existing = newCart[existingIndex];
        newCart[existingIndex] = { ...existing, quantity: existing.quantity + quantity };
      } else {
        newCart.push({ ...cartProduct, quantity });
      }
    });

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
  const cleanMenuText = value => String(value || '').replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '').replace(/\s+/g, ' ').trim();

  return (
    <div className="min-h-screen pb-32">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
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
          <h1 className="mb-4 text-3xl font-bold bg-gradient-to-r from-amber-600 to-yellow-500 bg-clip-text text-transparent sm:text-4xl md:text-5xl">
            Menu de King Of Tacos à Libreville
          </h1>
          <p className="text-gray-600 text-lg">
            Découvrez nos tacos, burgers, burritos et accompagnements à Libreville.
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

          <div className="sticky top-0 z-30 -mx-4 bg-amber-50/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 md:static md:mx-0 md:bg-transparent md:p-0">
            <Tabs value={category} onValueChange={setCategory}>
              <TabsList className="flex h-auto w-max min-w-full justify-start gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1 scrollbar-hide md:w-full md:flex-wrap md:overflow-visible">
                <TabsTrigger value="all" className="shrink-0 rounded-lg px-4 py-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-400 data-[state=active]:to-amber-500 data-[state=active]:text-white">
                  Tous
                </TabsTrigger>
                {categories.map(cat => (
                  <TabsTrigger
                    key={cat.id}
                    value={cat.name}
                    className="shrink-0 rounded-lg px-4 py-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-400 data-[state=active]:to-amber-500 data-[state=active]:text-white"
                  >
                    {cleanMenuText(cat.displayName || cat.name)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Products Grid */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-80 bg-gray-100 rounded-3xl animate-pulse" />
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mb-8 grid grid-cols-1 gap-0 md:grid-cols-2 md:gap-6 lg:grid-cols-3"
            >
              {filteredProducts.map((product) => {
                // Find cart item for this product, considering customizations
                const matchingCartItems = cart.filter(item => item.id === product.id);
                const cartItem = matchingCartItems.length
                  ? { quantity: matchingCartItems.reduce((sum, item) => sum + item.quantity, 0) }
                  : null;
                return (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={addToCart}
                    cartItem={cartItem}
                    onUpdateQuantity={updateQuantity}
                    cleanText={cleanMenuText}
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
