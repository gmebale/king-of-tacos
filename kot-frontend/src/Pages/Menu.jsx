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
  const [category, setCategory] = useState("");
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
      const visibleProducts = productsData.filter(p => p.category?.is_menu_visible !== false);
      const configuredCategories = categoriesData.filter(cat => cat.is_menu_visible !== false);
      const inferredCategories = [...new Map(visibleProducts
        .filter(product => product.category?.name)
        .map(product => [product.category.name, product.category])).values()];
      const visibleCategories = configuredCategories.length ? configuredCategories : inferredCategories;
      setProducts(visibleProducts);
      setCategories(visibleCategories);
      setCategory(current => visibleCategories.some(cat => cat.name === current) ? current : (visibleCategories[0]?.name || ''));
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

    filtered = filtered.filter(p => p.category?.name === category);

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
  const categoryLabel = value => {
    const label = cleanMenuText(value);
    const knownLabels = {
      'accompagnements': 'Nos accompagnements',
      'boissons': 'Nos boissons',
      'burger': 'Nos burgers',
      'burgers': 'Nos burgers',
      'burrito': 'Nos burritos',
      'burritos': 'Nos burritos',
      'dessert': 'Nos desserts',
      'desserts': 'Nos desserts',
      'taco': 'Nos tacos',
      'tacos': 'Nos tacos',
      'menu adulte': 'Nos menus adultes',
      'menu enfant': 'Nos menus enfants',
      'snacking': 'Nos snacks'
    };
    return knownLabels[label.toLocaleLowerCase('fr-FR')] || (/^(nos|notre|à l’unité|à l'unité)\b/i.test(label) ? label : `Nos ${label.toLocaleLowerCase('fr-FR')}`);
  };
  const selectedCategory = categories.find(item => item.name === category);

  return (
    <div className="min-h-screen overflow-x-clip bg-gray-100 pb-32">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 text-center sm:mb-8"
        >
          <Button
            variant="ghost"
            onClick={() => navigate(createPageUrl("Home"))}
            className="mx-auto mb-3 text-amber-700 hover:text-amber-800 sm:mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour à l'accueil
          </Button>
          <h1 className="mb-2 text-2xl font-bold leading-tight bg-gradient-to-r from-amber-600 to-yellow-500 bg-clip-text text-transparent sm:mb-4 sm:text-4xl md:text-5xl">
            Le menu King Of Tacos
          </h1>
          <p className="text-sm leading-relaxed text-gray-600 sm:text-lg">
            À Libreville, nous préparons nos recettes avec soin. Choisissez une catégorie et découvrez notre menu.
          </p>
        </motion.div>

        {/* Search & Filters */}
        <div className="mb-4 space-y-3 sm:mb-8 sm:space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder="Rechercher un produit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 rounded-xl border-2 pl-12 focus:border-amber-400 sm:h-12 sm:rounded-2xl"
            />
          </div>

          <div className="sticky top-0 z-30 -mx-4 min-w-0 overflow-hidden bg-amber-50/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 md:static md:mx-0 md:bg-transparent md:p-0">
            <Tabs value={category} onValueChange={setCategory}>
              <TabsList className="flex h-auto w-full min-w-0 max-w-full justify-start gap-1 overflow-x-auto overflow-y-hidden rounded-xl border border-gray-200 bg-white p-1 scrollbar-hide md:justify-center md:flex-wrap md:overflow-visible">
                {categories.map(cat => (
                  <TabsTrigger
                    key={cat.id}
                    value={cat.name}
                    className="shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-400 data-[state=active]:to-amber-500 data-[state=active]:text-slate-900 sm:px-4 sm:py-2 sm:text-sm"
                  >
                    {categoryLabel(cat.displayName || cat.name)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </div>

        {selectedCategory && <div className="mb-4 flex items-end justify-between gap-3 md:mb-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">{categoryLabel(selectedCategory.displayName || selectedCategory.name)}</h2>
            <p className="mt-1 text-sm text-slate-600">Nous avons {filteredProducts.length} proposition{filteredProducts.length > 1 ? 's' : ''} pour vous.</p>
          </div>
        </div>}

        {/* Products Grid */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-80 bg-gray-100 rounded-3xl animate-pulse" />
              ))}
            </div>
          ) : (
            filteredProducts.length > 0 ? <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mb-8 grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3"
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
            </motion.div> : <p className="rounded-2xl border border-gray-200 bg-white px-5 py-8 text-center text-gray-600">
              {categories.length ? 'Nous n’avons pas trouvé de produit dans cette catégorie.' : 'Notre menu sera bientôt disponible.'}
            </p>
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
