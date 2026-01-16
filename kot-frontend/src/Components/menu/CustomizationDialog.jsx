import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, Minus, Check } from 'lucide-react';
import { Button } from '../ui/button.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog.jsx';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group.jsx';
import { Checkbox } from '../ui/checkbox.jsx';
import { Label } from '../ui/label.jsx';
import { Badge } from '../ui/badge.jsx';

export default function CustomizationDialog({ open, onOpenChange, product, optionGroups, onConfirm }) {
  const [selections, setSelections] = useState({});
  const [quantity, setQuantity] = useState(1);
  const [totalPrice, setTotalPrice] = useState(product.price);

  // Use optionGroups from props, or fallback to product.customization.optionGroups
  const effectiveOptionGroups = optionGroups || product.customization?.optionGroups || [];

  const customization = { isConfigurable: true, optionGroups: effectiveOptionGroups };

  const calculatePrice = useCallback((currentSelections) => {
    if (!effectiveOptionGroups || effectiveOptionGroups.length === 0) {
      setTotalPrice(product.price);
      return;
    }

    let price = product.price;

    effectiveOptionGroups.forEach(group => {
      const groupSelections = currentSelections[group.id];

      if (group.type === 'single' && groupSelections) {
        const selectedOption = group.options.find(opt => opt.id === groupSelections);
        if (selectedOption) {
          const optionPrice = selectedOption.priceModifier !== undefined ? selectedOption.priceModifier : selectedOption.price;
          if (group.priceBehavior === 'replace') {
            // Replace base price with product.price + modifier (for sizes)
            price = product.price + optionPrice;
          } else {
            // Add to price (default behavior)
            price += optionPrice;
          }
        }
      } else if (group.type === 'multiple' && Array.isArray(groupSelections)) {
        groupSelections.forEach(optionId => {
          const option = group.options.find(opt => opt.id === optionId);
          if (option) {
            const optionPrice = option.priceModifier !== undefined ? option.priceModifier : option.price;
            price += optionPrice;
          }
        });
      }
    });

    setTotalPrice(price);
  }, [effectiveOptionGroups, product.price]);

  useEffect(() => {
    if (open && optionGroups) {
      // Initialize selections with defaults
      const initialSelections = {};
      optionGroups.forEach(group => {
        if (group.type === 'single') {
          // Find first option as default
          const firstOption = group.options[0];
          if (firstOption) {
            initialSelections[group.id] = firstOption.id;
          }
        } else {
          // Multiple selection - initialize empty array
          initialSelections[group.id] = [];
        }
      });
      setSelections(initialSelections);
      calculatePrice(initialSelections);
    }
  }, [open, optionGroups, calculatePrice]);

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

      // Apply constraints
      if (group.required && newSelections[groupId].length === 0) {
        // Don't allow empty if required
        return;
      }
      if (group.maxQuantity && newSelections[groupId].length > group.maxQuantity) {
        // Don't allow more than max
        newSelections[groupId] = newSelections[groupId].slice(0, group.maxQuantity);
      }
    }

    setSelections(newSelections);
    calculatePrice(newSelections);
  };

  const isValidSelection = () => {
    if (!effectiveOptionGroups || effectiveOptionGroups.length === 0) return true;

    return effectiveOptionGroups.every(group => {
      if (!group.required) return true;

      if (group.type === 'single') {
        return selections[group.id];
      } else {
        const selected = selections[group.id] || [];
        return selected.length > 0;
      }
    });
  };

  const handleConfirm = () => {
    if (!isValidSelection()) return;

    // Create customization summary
    const customizationSummary = effectiveOptionGroups.map(group => {
      const selected = selections[group.id];
      if (group.type === 'single' && selected) {
        const option = group.options.find(opt => opt.id === selected);
        return `${group.name}: ${option?.name || selected}`;
      } else if (group.type === 'multiple' && selected?.length > 0) {
        const optionNames = selected.map(id => group.options.find(opt => opt.id === id)?.name || id);
        return `${group.name}: ${optionNames.join(', ')}`;
      }
      return null;
    }).filter(Boolean).join(' | ');

    // Créer l'objet produit personnalisé pour le panier
    const customizedProduct = {
      ...product,
      customization: selections,
      customizationConfig: { optionGroups },
      customizationSummary,
      displayPrice: totalPrice
    };

    // Ajouter au panier
    onConfirm(customizedProduct, quantity);
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
      <DialogContent className="max-w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
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
