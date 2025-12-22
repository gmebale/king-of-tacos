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
import { Card } from "../ui/card";
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

  const meats = [
    "Boeuf",
    "Poulet",
    "Porc",
    "Agneau",
    "Végétarien"
  ];

  const accompagnements = [
    { id: "frites_simple", name: "Frites simple", price: 50000 } ,
    { id: "frites_cheddar", name: "Frites au cheddar", price: 70000 } ,
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
    if (selectedSize) {
      total += selectedSize.price;
    }

    const allExtras = [...suppléments, ...accompagnements];
    customization.extras.forEach(extraId => {
      const extra = allExtras.find(e => e.id === extraId);
      if (extra) {
        total += extra.price;
      }
    });

    if (customization.gratin) {
      total += 500;
    }

    const sauceCount = customization.sauces.length;
    if (sauceCount > 2) {
      total += (sauceCount - 2) * 500;
    }

    return total * customization.quantity;
  };

  const handleSizeChange = (sizeId) => {
    const newSize = sizes.find(s => s.id === sizeId);
    const currentMeatCount = sizes.find(s => s.id === customization.size)?.meatCount || 1;
    const newMeatCount = newSize.meatCount;

    let newMeats = [...customization.selectedMeats];

    if (newMeatCount > currentMeatCount) {
      // Add slots with default meat
      for (let i = currentMeatCount; i < newMeatCount; i++) {
        newMeats.push("Boeuf");
      }
    } else if (newMeatCount < currentMeatCount) {
      newMeats = newMeats.slice(0, newMeatCount);
    }

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

  const handleConfirm = () => {
    const unitPrice = calculateTotalPrice() / customization.quantity;
    onConfirm({
      ...product,
      displayPrice: unitPrice,
      customization: customization,
      customizationSummary: getCustomizationSummary()
    }, customization.quantity);
    onOpenChange(false);
  };

  const getCustomizationSummary = () => {
    const parts = [];
    const selectedSize = sizes.find(s => s.id === customization.size);
    if (selectedSize) {
      parts.push(`Taille ${selectedSize.name}`);
    }
    if (customization.selectedMeats && customization.selectedMeats.length > 0) {
      parts.push(`Viandes: ${customization.selectedMeats.join(", ")}`);
    }
    if (customization.gratin) {
      parts.push("Gratiné");
    }
    if (customization.sauces.length > 0) {
      const sauceNames = customization.sauces.map(id => 
        sauces.find(s => s.id === id)?.name
      ).filter(Boolean);
      parts.push(`Sauces: ${sauceNames.join(", ")}`);
    }
    return parts.join(" • ");
  };

  const totalPrice = calculateTotalPrice();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <span>🌮</span>
            Personnalisez votre {product?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Taille */}
          <div className="space-y-3">
            <Label className="text-lg font-semibold">Choisissez la taille *</Label>
            <RadioGroup value={customization.size} onValueChange={handleSizeChange}>
              <div className="grid md:grid-cols-2 gap-3">
                {sizes.map((size) => (
                  <motion.div
                    key={size.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <label className={`flex items-center justify-between p-4 border-2 rounded-xl cursor-pointer transition-all ${
                      customization.size === size.id
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-gray-200 hover:border-amber-300'
                    }`}>
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value={size.id} id={size.id} />
                        <div>
                          <p className="font-semibold">{size.name}</p>
                          <p className="text-sm text-gray-600">{size.description}</p>
                        </div>
                      </div>
                      {size.price > 0 && (
                        <Badge variant="outline" className="ml-2">
                          +{size.price.toLocaleString()} FCFA
                        </Badge>
                      )}
                    </label>
                  </motion.div>
                ))}
              </div>
            </RadioGroup>
          </div>

          {/* Choix des viandes */}
          <div className="space-y-3">
            <Label className="text-lg font-semibold">Choix des viandes ({sizes.find(s => s.id === customization.size)?.meatCount || 1})</Label>
            <div className="space-y-2">
              {Array.from({ length: sizes.find(s => s.id === customization.size)?.meatCount || 1 }).map((_, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="w-20 text-sm font-medium">Viande {index + 1}:</span>
                  <select
                    value={customization.selectedMeats[index] || "Boeuf"}
                    onChange={(e) => {
                      const newMeats = [...customization.selectedMeats];
                      newMeats[index] = e.target.value;
                      setCustomization({ ...customization, selectedMeats: newMeats });
                    }}
                    className="flex-1 p-2 border rounded-lg focus:border-amber-400"
                  >
                    {meats.map((meat) => (
                      <option key={meat} value={meat}>{meat}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Accompagnements */}
          <div className="space-y-3">
            <Label className="text-lg font-semibold">accompagnements</Label>
            <div className="grid md:grid-cols-2 gap-3">
              {accompagnements.map((extra) => (
                <motion.div
                  key={extra.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <label className={`flex items-center justify-between p-4 border-2 rounded-xl cursor-pointer transition-all ${
                    customization.extras.includes(extra.id)
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-gray-200 hover:border-amber-300'
                  }`}>
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={customization.extras.includes(extra.id)}
                        onCheckedChange={() => handleExtraToggle(extra.id)}
                      />
                      <span className="font-medium">{extra.name}</span>
                    </div>
                    <Badge variant="outline">
                      +{(extra.price / 100).toLocaleString()} FCFA
                    </Badge>
                  </label>
                </motion.div>
              ))}
            </div>
          </div>

          {/*Suppléments */}
          <div className="space-y-3">
            <Label className="text-lg font-semibold">Suppléments</Label>
            <div className="grid md:grid-cols-2 gap-3">
              {suppléments.map((extra) => (
                <motion.div
                  key={extra.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <label className={`flex items-center justify-between p-4 border-2 rounded-xl cursor-pointer transition-all ${
                    customization.extras.includes(extra.id)
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-gray-200 hover:border-amber-300'
                  }`}>
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={customization.extras.includes(extra.id)}
                        onCheckedChange={() => handleExtraToggle(extra.id)}
                      />
                      <span className="font-medium">{extra.name}</span>
                    </div>
                    <Badge variant="outline">
                      +{extra.price.toLocaleString()} FCFA
                    </Badge>
                  </label>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Gratiné */}
          <div className="space-y-3">
            <Label className="text-lg font-semibold">Options</Label>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <label className={`flex items-center justify-between p-4 border-2 rounded-xl cursor-pointer transition-all ${
                customization.gratin
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-gray-200 hover:border-amber-300'
              }`}>
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={customization.gratin}
                    onCheckedChange={(checked) => setCustomization({ ...customization, gratin: checked })}
                  />
                  <div>
                    <p className="font-semibold">🧀 Gratiné</p>
                    <p className="text-sm text-gray-600">Fromage fondu au four</p>
                  </div>
                </div>
                <Badge variant="outline">+500 FCFA</Badge>
              </label>
            </motion.div>
          </div>

          {/* Sauces */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-lg font-semibold">Sauces (2 incluses, +500 FCFA à partir de la 3e) *</Label>
              <Badge variant="outline">{customization.sauces.length}</Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {sauces.map((sauce) => (
                <motion.div
                  key={sauce.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <button
                    type="button"
                    onClick={() => handleSauceToggle(sauce.id)}
                    className={`w-full p-3 border-2 rounded-xl transition-all ${
                      customization.sauces.includes(sauce.id)
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-gray-200 hover:border-amber-300'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-2xl">{sauce.icon}</span>
                      <span className="text-xs font-medium text-center">{sauce.name}</span>
                      {customization.sauces.includes(sauce.id) && (
                        <Check className="w-4 h-4 text-amber-600" />
                      )}
                    </div>
                  </button>
                </motion.div>
              ))}
            </div>
            {customization.sauces.length === 0 && (
              <p className="text-sm text-red-500">* Veuillez sélectionner au moins une sauce</p>
            )}
          </div>

          {/* Quantité */}
          <div className="space-y-3">
            <Label className="text-lg font-semibold">Quantité</Label>
            <div className="flex items-center gap-4">
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => setCustomization({ ...customization, quantity: Math.max(1, customization.quantity - 1) })}
                className="rounded-xl border-2 border-amber-400"
              >
                <Minus className="w-4 h-4" />
              </Button>
              <span className="text-2xl font-bold w-12 text-center">
                {customization.quantity}
              </span>
              <Button
                type="button"
                size="icon"
                onClick={() => setCustomization({ ...customization, quantity: customization.quantity + 1 })}
                className="rounded-xl bg-gradient-to-r from-yellow-400 to-amber-600"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

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