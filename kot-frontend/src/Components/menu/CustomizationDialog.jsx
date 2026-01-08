import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Minus, Check } from 'lucide-react';
import { Button } from '../ui/button.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog.jsx';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group.jsx';
import { Checkbox } from '../ui/checkbox.jsx';
import { Label } from '../ui/label.jsx';
import { Badge } from '../ui/badge.jsx';
import { formatCustomization } from '../../utils/customization.js';

export default function CustomizationDialog({ open, onOpenChange, product, onConfirm }) {
  const [selections, setSelections] = useState({});
  const [quantity, setQuantity] = useState(1);
  const [totalPrice, setTotalPrice] = useState(product.price);

  const customization = product.customization || { isConfigurable: false };

  useEffect(() => {
    if (open && customization.isConfigurable) {
      // Initialize selections with defaults
      const initialSelections = {};
      customization.optionGroups?.forEach(group => {
        if (group.type === 'single') {
          // Find default option or first option
          const defaultOption = group.options.find(opt => opt.default) || group.options[0];
          if (defaultOption) {
            initialSelections[group.id] = defaultOption.id;
          }
        } else {
          // Multiple selection - initialize empty array
          initialSelections[group.id] = [];
        }
      });
      setSelections(initialSelections);
      calculatePrice(initialSelections);
    }
  }, [open, customization]);

  const calculatePrice = (currentSelections) => {
    if (!customization.isConfigurable) {
      setTotalPrice(product.price);
      return;
    }

    let price = customization.basePrice || product.price;

    customization.optionGroups?.forEach(group => {
      const groupSelections = currentSelections[group.id];

      if (group.type === 'single' && groupSelections) {
        const selectedOption = group.options.find(opt => opt.id === groupSelections);
        if (selectedOption) {
          price += selectedOption.priceModifier || 0;
        }
      } else if (group.type === 'multiple' && Array.isArray(groupSelections)) {
        let selectedCount = groupSelections.length;

        // Handle included count and extra pricing
        if (group.includedCount && group.extraPrice) {
          const extraCount = Math.max(0, selectedCount - group.includedCount);
          const includedOptions = groupSelections.slice(0, group.includedCount);
          const extraOptions = groupSelections.slice(group.includedCount);

          // Add price modifiers for all selected options
          groupSelections.forEach(optionId => {
            const option = group.options.find(opt => opt.id === optionId);
            if (option) {
              price += option.priceModifier || 0;
            }
          });

          // Add extra price for options beyond included count
          price += extraCount * (group.extraPrice || 0);
        } else {
          // Simple multiple selection
          groupSelections.forEach(optionId => {
            const option = group.options.find(opt => opt.id === optionId);
            if (option) {
              price += option.priceModifier || 0;
            }
          });
        }
      }
    });

    setTotalPrice(price);
  };

  const handleSelectionChange = (groupId, optionId, checked = null) => {
    const newSelections = { ...selections };
    const group = customization.optionGroups?.find(g => g.id === groupId);

    if (group.type === 'single') {
      newSelections[groupId] = optionId;
    } else {
      // Multiple selection
      if (!Array.isArray(newSelections[groupId])) {
        newSelections[groupId] = [];
      }

      if (checked === null) {
        // Toggle
        const index = newSelections[groupId].indexOf(optionId);
        if (index > -1) {
          newSelections[groupId].splice(index, 1);
        } else {
          newSelections[groupId].push(optionId);
        }
      } else {
        if (checked) {
          if (!newSelections[groupId].includes(optionId)) {
            newSelections[groupId].push(optionId);
          }
        } else {
          const index = newSelections[groupId].indexOf(optionId);
          if (index > -1) {
            newSelections[groupId].splice(index, 1);
          }
        }
      }

      // Apply min/max constraints
      if (group.minSelections && newSelections[groupId].length < group.minSelections) {
        // Don't allow below minimum
        return;
      }
      if (group.maxSelections && newSelections[groupId].length > group.maxSelections) {
        // Don't allow above maximum
        return;
      }
    }

    setSelections(newSelections);
    calculatePrice(newSelections);
  };

  const isValidSelection = () => {
    if (!customization.isConfigurable) return true;

    return customization.optionGroups?.every(group => {
      if (!group.required) return true;

      if (group.type === 'single') {
        return selections[group.id];
      } else {
        const selected = selections[group.id] || [];
        return selected.length >= (group.minSelections || 1);
      }
    });
  };

  const handleConfirm = () => {
    if (!isValidSelection()) return;

    const customizationSummary = formatCustomization(selections, product.customization);

    // Créer l'objet pour le panier
    const cartItem = {
      product: {
        id: product.id,
        name: product.name,
        price: product.price,
        displayPrice: totalPrice,
        image_url: product.image
      },
      quantity,
      customization: selections,
      customizationConfig: product.customization,
      customizationSummary,
      subtotal: totalPrice * quantity
    };

    // Ajouter au panier
    onConfirm(cartItem);
    onOpenChange(false);
  };


  const renderOptionGroup = (group) => {
    const selectedValue = selections[group.id];

    return (
      <div key={group.id} className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-gray-900">{group.name}</h4>
          {group.required && <Badge variant="secondary">Requis</Badge>}
        </div>

        {group.type === 'single' ? (
          <RadioGroup
            value={selectedValue || ''}
            onValueChange={(value) => handleSelectionChange(group.id, value)}
            className="space-y-2"
          >
            {group.options.map(option => (
              <div key={option.id} className="flex items-center space-x-2">
                <RadioGroupItem value={option.id} id={`${group.id}-${option.id}`} />
                <Label
                  htmlFor={`${group.id}-${option.id}`}
                  className="flex-1 cursor-pointer"
                >
                  <div className="flex justify-between items-center">
                    <span>{option.name}</span>
                    {option.priceModifier !== 0 && (
                      <span className={`text-sm ${option.priceModifier > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {option.priceModifier > 0 ? '+' : ''}{option.priceModifier} FCFA
                      </span>
                    )}
                  </div>
                  {option.description && (
                    <p className="text-sm text-gray-500 mt-1">{option.description}</p>
                  )}
                </Label>
              </div>
            ))}
          </RadioGroup>
        ) : (
          <div className="space-y-2">
            {group.options.map(option => {
              const isSelected = Array.isArray(selectedValue) && selectedValue.includes(option.id);
              const isExtra = group.includedCount && Array.isArray(selectedValue) &&
                            selectedValue.indexOf(option.id) >= group.includedCount;

              return (
                <div key={option.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${group.id}-${option.id}`}
                    checked={isSelected}
                    onCheckedChange={(checked) => handleSelectionChange(group.id, option.id, checked)}
                  />
                  <Label
                    htmlFor={`${group.id}-${option.id}`}
                    className="flex-1 cursor-pointer"
                  >
                    <div className="flex justify-between items-center">
                      <span>{option.name}</span>
                      <div className="flex items-center gap-2">
                        {isExtra && group.extraPrice && (
                          <Badge variant="outline" className="text-xs">
                            +{group.extraPrice} FCFA
                          </Badge>
                        )}
                        {option.priceModifier !== 0 && !isExtra && (
                          <span className={`text-sm ${option.priceModifier > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {option.priceModifier > 0 ? '+' : ''}{option.priceModifier} FCFA
                          </span>
                        )}
                      </div>
                    </div>
                  </Label>
                </div>
              );
            })}
            {group.includedCount && (
              <p className="text-sm text-gray-500">
                {group.includedCount} inclus{group.includedCount > 1 ? 's' : ''}, supplément de {group.extraPrice} FCFA chacun
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Personnaliser {product.name}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Product Info */}
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
            {product.image && (
              <img
                src={product.image}
                alt={product.name}
                className="w-16 h-16 object-cover rounded-lg"
              />
            )}
            <div>
              <h3 className="font-semibold">{product.name}</h3>
              {product.description && (
                <p className="text-sm text-gray-600">{product.description}</p>
              )}
            </div>
          </div>

          {/* Customization Options */}
          {customization.isConfigurable && customization.optionGroups?.map(group => (
            <div key={group.id} className="border-b pb-6 last:border-b-0">
              {renderOptionGroup(group)}
            </div>
          ))}

          {/* Quantity and Total */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-4">
              <span className="font-semibold">Quantité:</span>
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <span className="w-8 text-center font-semibold">{quantity}</span>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setQuantity(quantity + 1)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="text-right">
              <div className="text-2xl font-bold text-green-600">
                {totalPrice.toLocaleString()} FCFA
              </div>
              {quantity > 1 && (
                <div className="text-sm text-gray-500">
                  {(totalPrice * quantity).toLocaleString()} FCFA total
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Annuler
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!isValidSelection()}
              className="flex-1 bg-gradient-to-r from-yellow-400 to-amber-600 hover:from-yellow-500 hover:to-amber-700"
            >
              <Check className="w-4 h-4 mr-2" />
              Ajouter au panier
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
