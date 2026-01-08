import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Checkbox } from "../ui/checkbox";
import { Badge } from "../ui/badge";
import { motion } from "framer-motion";
import { Check, Plus, Minus } from "lucide-react";

export default function TacosCustomizationDialog({ open, onOpenChange, product, onConfirm }) {
  const [customization, setCustomization] = useState({
    size: "M",
    extras: [],
    gratin: false,
    sauces: [],
    quantity: 1,
    selectedMeats: ["Boeuf", "Boeuf"]
  });

  const sizes = [
    { id: "S", name: "SOLO", price: 0, description: "1 viande", meatCount: 1 },
    { id: "M", name: "DOBLE", price: 100000, description: "2 viandes", meatCount: 2 },
    { id: "L", name: "TRIO", price: 200000, description: "3 viandes", meatCount: 3 },
    { id: "XL", name: "PATRON", price: 400000, description: "4 viandes", meatCount: 4 }
  ];

  const meats = ["Boeuf", "Poulet", "Porc", "Agneau", "Végétarien"];

  const accompagnements = [
    { id: "frites_simple", name: "Frites simple", price: 50000 },
    { id: "frites_cheddar", name: "Frites au cheddar", price: 70000 },
    { id: "frites_paprika", name: "Frites au paprika", price: 70000 },
    { id: "alloco", name: "Alloco", price: 60000 },
    { id: "riz_blanc", name: "Riz Blanc", price: 50000 }
  ];

  const suppléments = [
    { id: "oeuf", name: "Oeuf", price: 30000 },
    { id: "poulet_pane", name: "Poulet Pané (Nuggets)", price: 120000 },
    { id: "poulet_braise", name: "Poulet Braisé", price: 120000 },
    { id: "cordon_bleu", name: "Cordon Bleu", price: 130000 },
    { id: "boeuf_marine", name: "Boeuf mariné", price: 150000 },
    { id: "des_poisson", name: "Dés de poisson", price: 140000 },
    { id: "crevettes_marinees", name: "Crevettes marinées", price: 160000 }
  ];

  const sauces = [
    { id: "algerienne", name: "Algérienne", icon: "🌶️" },
    { id: "blanche", name: "Blanche", icon: "🥛" },
    { id: "harissa", name: "Harissa", icon: "🔥" },
    { id: "ketchup", name: "Ketchup", icon: "🍅" },
    { id: "mayonnaise", name: "Mayonnaise", icon: "🥚" },
    { id: "bbq", name: "BBQ", icon: "🍖" },
    { id: "samourai", name: "Samouraï", icon: "⚔️" },
    { id: "curry", name: "Curry", icon: "🍛" }
  ];

  useEffect(() => {
    if (open) {
      setCustomization({
        size: "M",
        extras: [],
        gratin: false,
        sauces: [],
        quantity: 1,
        selectedMeats: ["Boeuf", "Boeuf"]
      });
    }
  }, [open, product]);

  const calculateTotalPrice = () => {
    let total = product.displayPrice || product.price;

    const selectedSize = sizes.find(s => s.id === customization.size);
    if (selectedSize) total += selectedSize.price;

    const allExtras = [...suppléments, ...accompagnements];
    customization.extras.forEach(extraId => {
      const extra = allExtras.find(e => e.id === extraId);
      if (extra) total += extra.price;
    });

    if (customization.gratin) total += 500;

    const sauceCount = customization.sauces.length;
    if (sauceCount > 2) total += (sauceCount - 2) * 500;

    return total * customization.quantity;
  };

  const handleSizeChange = (sizeId) => {
    const newSize = sizes.find(s => s.id === sizeId);
    const currentMeatCount = sizes.find(s => s.id === customization.size)?.meatCount || 1;
    const newMeatCount = newSize.meatCount;

    let newMeats = [...customization.selectedMeats];
    if (newMeatCount > currentMeatCount) {
      for (let i = currentMeatCount; i < newMeatCount; i++) newMeats.push("Boeuf");
    } else newMeats = newMeats.slice(0, newMeatCount);

    setCustomization({ ...customization, size: sizeId, selectedMeats: newMeats });
  };

  const handleExtraToggle = (extraId) => {
    const newExtras = customization.extras.includes(extraId)
      ? customization.extras.filter(id => id !== extraId)
      : [...customization.extras, extraId];
    setCustomization({ ...customization, extras: newExtras });
  };

  const handleSauceToggle = (sauceId) => {
    const newSauces = customization.sauces.includes(sauceId)
      ? customization.sauces.filter(id => id !== sauceId)
      : [...customization.sauces, sauceId];
    setCustomization({ ...customization, sauces: newSauces });
  };

  const getCustomizationSummary = () => {
    const parts = [];
    const selectedSize = sizes.find(s => s.id === customization.size);
    if (selectedSize) parts.push(`Taille ${selectedSize.name}`);
    if (customization.selectedMeats.length > 0) parts.push(`Viandes: ${customization.selectedMeats.join(", ")}`);
    if (customization.gratin) parts.push("Gratiné");
    if (customization.sauces.length > 0) {
      const sauceNames = customization.sauces.map(id => sauces.find(s => s.id === id)?.name).filter(Boolean);
      parts.push(`Sauces: ${sauceNames.join(", ")}`);
    }
    if (customization.extras.length > 0) {
      parts.push(`Extras: ${customization.extras.join(", ")}`);
    }
    return parts.join(" • ");
  };

  const handleConfirm = () => {
    const unitPrice = calculateTotalPrice() / customization.quantity;

    const cartItem = {
      product: {
        id: product.id,
        name: product.name,
        price: product.price,
        displayPrice: unitPrice,
        image_url: product.image
      },
      quantity: customization.quantity,
      customization: customization,
      customizationConfig: product.customization,
      customizationSummary: getCustomizationSummary(),
      subtotal: unitPrice * customization.quantity
    };

    onConfirm(cartItem);
    onOpenChange(false);
  };

  const totalPrice = calculateTotalPrice();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <span>🌮</span> Personnalisez votre {product?.name}
          </DialogTitle>
        </DialogHeader>

        {/* ... ici tu gardes tout le reste de l'UI comme avant ... */}

        <DialogFooter className="border-t pt-4">
          <div className="w-full space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">Total</span>
              <span className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-yellow-500 bg-clip-text text-transparent">
                {totalPrice.toLocaleString()} FCFA
              </span>
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1 border-2"
              >
                Annuler
              </Button>
              <Button
                type="button"
                onClick={handleConfirm}
                disabled={customization.sauces.length === 0}
                className="flex-1 bg-gradient-to-r from-yellow-400 to-amber-600 hover:from-yellow-500 hover:to-amber-700 text-white"
              >
                Ajouter au panier
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}