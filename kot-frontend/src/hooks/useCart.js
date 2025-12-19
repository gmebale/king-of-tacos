import { useState, useEffect, useCallback } from 'react';

const CART_STORAGE_KEY = 'kingoftacos_cart';

export const useCart = () => {
  const [cart, setCart] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Charger le panier depuis localStorage
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem(CART_STORAGE_KEY);
      if (savedCart) {
        let parsedCart = JSON.parse(savedCart);
        // Migrate old cart format to new format if necessary
        parsedCart = parsedCart.map(item => {
          if (item.product) {
            // Already in new format
            return item;
          } else {
            // Old format: migrate to new format
            const { id, name, price, displayPrice, image_url, quantity, customizations, customizationSummary } = item;
            return {
              product: { id, name, price, displayPrice, image_url },
              quantity,
              customizations: customizations || {},
              customizationSummary: customizationSummary || '',
              subtotal: quantity * (displayPrice || price || 0)
            };
          }
        });
        setCart(parsedCart);
      }
    } catch (error) {
      console.error('Erreur lors du chargement du panier:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sauvegarder le panier dans localStorage
  const saveCart = useCallback((newCart) => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(newCart));
      setCart(newCart);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du panier:', error);
    }
  }, []);

  // Ajouter un produit au panier
  const addToCart = useCallback((product, quantity = 1, customizations = {}, customizationSummary = '') => {
    const newCart = [...cart];
    const existingItemIndex = newCart.findIndex(
      item => item.product.id === product.id &&
      JSON.stringify(item.customizations) === JSON.stringify(customizations)
    );

    if (existingItemIndex > -1) {
      newCart[existingItemIndex].quantity += quantity;
      newCart[existingItemIndex].subtotal = newCart[existingItemIndex].quantity * (product.displayPrice || product.price);
    } else {
      newCart.push({
        product,
        quantity,
        customizations,
        customizationSummary,
        subtotal: quantity * (product.displayPrice || product.price)
      });
    }

    saveCart(newCart);
  }, [cart, saveCart]);

  // Supprimer un produit du panier
  const removeFromCart = useCallback((productId, customizations = {}) => {
    const newCart = cart.filter(
      item => !(item.product.id === productId &&
      JSON.stringify(item.customizations) === JSON.stringify(customizations))
    );
    saveCart(newCart);
  }, [cart, saveCart]);

  // Modifier la quantité d'un produit
  const updateQuantity = useCallback((productId, quantity, customizations = {}) => {
    if (quantity <= 0) {
      removeFromCart(productId, customizations);
      return;
    }

    const newCart = cart.map(item => {
      if (item.product.id === productId &&
          JSON.stringify(item.customizations) === JSON.stringify(customizations)) {
        return {
          ...item,
          quantity,
          subtotal: quantity * (item.product.displayPrice || item.product.price)
        };
      }
      return item;
    });

    saveCart(newCart);
  }, [cart, saveCart, removeFromCart]);

  // Vider le panier
  const clearCart = useCallback(() => {
    saveCart([]);
  }, [saveCart]);

  // Calculer le total
  const getTotal = useCallback(() => {
    return cart.reduce((total, item) => total + item.subtotal, 0);
  }, [cart]);

  // Obtenir le nombre total d'articles
  const getTotalItems = useCallback(() => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  }, [cart]);

  return {
    cart,
    isLoading,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getTotal,
    getTotalItems
  };
};
