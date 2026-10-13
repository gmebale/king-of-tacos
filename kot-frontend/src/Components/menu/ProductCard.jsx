import React, { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Minus, ShoppingCart, TrendingDown, Star } from "lucide-react";
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import CustomizationDialog from './CustomizationDialog';
import { Product } from '../../Entities/Product';
import { toast } from 'react-hot-toast';
import { resolveMediaUrl } from '../../utils/media';

export default function ProductCard({ product, onAddToCart, cartItem, onUpdateQuantity, cleanText = value => value }) {
  const [showCustomization, setShowCustomization] = useState(false);
  const [productOptions, setProductOptions] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const quantity = cartItem?.quantity || 0;
  const isUnavailable = product.available === false;
  const imagePresentation = product.customization?.imagePresentation || {};
  const imagePosition = `${imagePresentation.x ?? 50}% ${imagePresentation.y ?? 50}%`;
  const imageScale = Math.max(100, Math.min(200, Number(imagePresentation.scale) || 100));
  const hasDiscount = product.discount_percentage > 0;
  const finalPrice = hasDiscount
    ? product.price * (1 - product.discount_percentage / 100)
    : product.price;

  const isConfigurable = ['configurable', 'combo'].includes(product.type) ||
    product.customization?.isConfigurable === true;

  const handleAddClick = async () => {
    if (isConfigurable) {
      setLoadingOptions(true);
      try {
        const [options, suggested] = await Promise.all([
          Product.getOptions(product.id),
          Product.getRecommendations(product.id).catch(() => [])
        ]);
        setProductOptions(options);
        setRecommendations(suggested);
        setShowCustomization(true);
      } catch (error) {
        console.error('Error loading options:', error);
        toast.error('Impossible de charger les choix de ce produit. Réessayez dans un instant.');
      } finally {
        setLoadingOptions(false);
      }
    } else {
      onAddToCart(product);
    }
  };

  const handleCustomizationConfirm = (customizedProduct, qty) => {
    const { selectedRecommendations = [], ...configuredProduct } = customizedProduct;
    onAddToCart([
      { product: configuredProduct, quantity: qty },
      ...selectedRecommendations.map(product => ({ product, quantity: qty }))
    ]);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ y: -5 }}
        transition={{ duration: 0.3 }}
      >
        <Card className={`group w-full min-w-0 flex flex-row overflow-hidden rounded-none border-x-0 border-t-0 border-b border-gray-200 shadow-none transition-all duration-300 md:flex-col md:rounded-xl md:border-2 md:hover:border-amber-400 md:hover:shadow-xl ${isUnavailable ? 'bg-gray-50' : 'bg-white'}`}>
          <div className="relative order-2 h-20 w-20 flex-none self-center overflow-hidden bg-gradient-to-br from-amber-50 to-yellow-100 sm:h-24 sm:w-24 md:order-none md:h-48 md:w-full md:self-auto">
            {product.image ? (
              <img
                src={resolveMediaUrl(product.image)}
                alt={cleanText(product.name)}
                className="h-full w-full object-cover transition-transform duration-300"
                style={{ objectPosition: imagePosition, transform: `scale(${imageScale / 100})` }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ShoppingCart className="w-16 h-16 text-amber-300" />
              </div>
            )}
            
            {isUnavailable && <>
              <div className="absolute inset-0 bg-white/50" />
              <Badge className="absolute inset-x-1 bottom-1 justify-center bg-gray-800 px-1 text-[9px] text-white sm:inset-x-auto sm:right-2 sm:bottom-2 sm:px-2 sm:text-xs">Indisponible</Badge>
            </>}
            {/* Badges */}
            <div className="absolute right-1 top-1 flex flex-col gap-1 sm:right-3 sm:top-3 sm:gap-2">
              {hasDiscount && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring" }}
                >
                  <Badge className="bg-red-500 text-white shadow-lg">
                    -{product.discount_percentage}%
                  </Badge>
                </motion.div>
              )}
              {!isUnavailable && product.stock < 5 && (
                <Badge className="bg-orange-500 text-white shadow-lg">
                  Stock faible
                </Badge>
              )}
            </div>
          </div>

          <CardContent className="flex min-w-0 flex-1 flex-col justify-center p-2.5 sm:p-4 md:flex-none md:p-6">
            <div className="mb-2 min-w-0 md:mb-4">
              <h3 className="mb-1 break-words text-base font-bold text-gray-900 sm:text-lg md:mb-2 md:text-xl">
                {cleanText(product.name)}
              </h3>
              {product.description && (
                <p className="line-clamp-2 text-xs text-gray-600 sm:text-sm">
                  {cleanText(product.description)}
                </p>
              )}
              {product.loyalty_points > 0 && <p className="mt-1 flex min-w-0 items-center gap-1 text-[11px] font-medium leading-tight text-amber-700 sm:text-sm"><Star className="h-3.5 w-3.5 flex-none" />{product.loyalty_points} pts fidélité / unité</p>}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 md:gap-3">
              <div>
                {hasDiscount ? (
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-green-600 sm:text-lg md:text-2xl">
                        {Math.round(finalPrice).toLocaleString()} FCFA
                      </span>
                    </div>
                    <span className="text-sm text-gray-500 line-through">
                      {(product.price ).toLocaleString()} FCFA
                    </span>
                  </div>
                ) : (
                  <span className="text-base font-bold bg-gradient-to-r from-amber-600 to-yellow-500 bg-clip-text text-transparent sm:text-lg md:text-2xl">
                    {(product.price ).toLocaleString()} FCFA
                  </span>
                )}
              </div>

              {isUnavailable ? (
                <span className="text-xs font-semibold text-gray-500 md:hidden">Indisponible</span>
              ) : isConfigurable ? (
                <div className="flex flex-col items-end gap-1">
                  <Button
                    onClick={handleAddClick}
                    disabled={loadingOptions || isUnavailable}
                    className="max-w-full rounded-lg bg-gradient-to-r from-amber-700 to-amber-800 px-2.5 text-xs text-white shadow-lg hover:from-amber-800 hover:to-amber-900 sm:rounded-xl sm:px-4 sm:text-base"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    {loadingOptions ? "Chargement…" : product.type === 'combo' ? "Composer le menu" : "Personnaliser"}
                  </Button>
                  {quantity > 0 && <span className="text-xs text-gray-500">{quantity} au panier</span>}
                </div>
              ) : quantity === 0 ? (
                <Button
                  onClick={handleAddClick}
                  className="max-w-full rounded-lg bg-gradient-to-r from-amber-700 to-amber-800 px-2.5 text-xs text-white shadow-lg hover:from-amber-800 hover:to-amber-900 sm:rounded-xl sm:px-4 sm:text-base"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {product.type === 'combo' ? "Composer le menu" : isConfigurable ? "Personnaliser" : "Ajouter"}
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => onUpdateQuantity(product.id, -1)}
                    className="rounded-xl border-amber-400 text-amber-600 hover:bg-amber-50"
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="text-lg font-bold w-8 text-center">
                    {quantity}
                  </span>
                  <Button
                    size="icon"
                    onClick={() => onUpdateQuantity(product.id, 1)}
                    disabled={isUnavailable}
                    className="rounded-xl bg-gradient-to-r from-amber-700 to-amber-800 text-white"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {isConfigurable && productOptions && (
        <CustomizationDialog
          open={showCustomization}
          onOpenChange={setShowCustomization}
          product={product}
          optionGroups={productOptions.optionGroups}
          recommendations={recommendations}
          onConfirm={handleCustomizationConfirm}
        />
      )}
    </>
  );
}
