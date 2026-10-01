import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Minus, Plus, ShoppingBag } from 'lucide-react';
import { Button } from '../ui/button.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog.jsx';
import { Badge } from '../ui/badge.jsx';

const money = value => `${Math.round(Number(value) || 0).toLocaleString()} FCFA`;

export default function CustomizationDialog({ open, onOpenChange, product, optionGroups = [], recommendations = [], onConfirm }) {
  const [selections, setSelections] = useState({});
  const [selectedRecommendations, setSelectedRecommendations] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [step, setStep] = useState(0);
  const groups = Array.isArray(optionGroups) ? optionGroups : [];
  const basePrice = Math.round((Number(product?.price) || 0) * (1 - (Number(product?.discount_percentage) || 0) / 100));

  useEffect(() => {
    if (!open) return;
    setSelections({});
    setSelectedRecommendations([]);
    setQuantity(1);
    setStep(0);
  }, [open, product?.id]);

  const selectedCount = (group) => {
    const value = selections[group.id];
    return group.type === 'single' ? (value ? 1 : 0) : Array.isArray(value) ? value.length : 0;
  };

  const getMin = group => Math.max(0, Number(group.minSelections ?? (group.required ? 1 : 0)) || 0);
  const getMax = group => group.type === 'single' ? 1 : (group.maxSelections ?? group.maxQuantity ?? null);

  const valid = groups.every(group => selectedCount(group) >= getMin(group) && (getMax(group) == null || selectedCount(group) <= Number(getMax(group))));
  const stepsCount = groups.length + (recommendations.length ? 1 : 0);

  const unitPrice = useMemo(() => {
    let price = basePrice;
    groups.forEach(group => {
      const selection = selections[group.id];
      if (group.type === 'single') {
        const option = group.options?.find(item => String(item.id) === String(selection));
        if (option) price += Number(option.priceModifier ?? option.price) || 0;
        return;
      }
      const selectedIds = Array.isArray(selection) ? selection : [];
      const includedCount = Math.max(0, Number(group.includedCount) || 0);
      selectedIds.forEach((id, index) => {
        if (includedCount > 0 && index < includedCount) return;
        const option = group.options?.find(item => String(item.id) === String(id));
        if (!option) return;
        price += includedCount > 0 && Number(group.extraPrice) > 0
          ? Number(group.extraPrice)
          : Number(option.priceModifier ?? option.price) || 0;
      });
    });
    return Math.max(0, Math.round(price));
  }, [basePrice, groups, selections]);
  const estimatedTotal = unitPrice * quantity + recommendations
    .filter(item => selectedRecommendations.includes(item.id))
    .reduce((sum, item) => sum + Math.round(item.price * (1 - (item.discount_percentage || 0) / 100)) * quantity, 0);

  const changeSelection = (group, optionId, checked) => {
    if (group.type === 'single') {
      setSelections(current => ({ ...current, [group.id]: String(optionId) }));
      return;
    }
    setSelections(current => {
      const selected = Array.isArray(current[group.id]) ? current[group.id] : [];
      const id = String(optionId);
      if (selected.includes(id)) return { ...current, [group.id]: selected.filter(value => value !== id) };
      const max = getMax(group);
      if (max != null && selected.length >= Number(max)) return current;
      return { ...current, [group.id]: [...selected, id] };
    });
  };

  const summary = groups.map(group => {
    const value = selections[group.id];
    const ids = group.type === 'single' ? (value ? [value] : []) : Array.isArray(value) ? value : [];
    const names = ids.map(id => group.options?.find(option => String(option.id) === String(id))?.name).filter(Boolean);
    return names.length ? `${group.name}: ${names.join(', ')}` : null;
  }).filter(Boolean).join(' · ');

  const handleConfirm = () => {
    if (!valid) return;
    onConfirm({
      ...product,
      customization: selections,
      customizationConfig: { isConfigurable: true, optionGroups: groups },
      customizationSummary: summary,
      displayPrice: unitPrice,
      selectedRecommendations: recommendations.filter(item => selectedRecommendations.includes(item.id))
    }, quantity);
    onOpenChange(false);
  };

  const currentGroup = groups[step];
  const currentSelection = currentGroup ? selections[currentGroup.id] : null;
  const maxReached = currentGroup && currentGroup.type !== 'single' && getMax(currentGroup) != null && selectedCount(currentGroup) >= Number(getMax(currentGroup));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!flex max-h-[92vh] max-w-2xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-5 pr-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">
            {product?.type === 'combo' ? 'Composer votre menu' : 'Personnaliser'}
          </p>
          <DialogTitle className="text-2xl">{product?.name}</DialogTitle>
          {product?.description && <p className="text-sm text-gray-500">{product.description}</p>}
        </DialogHeader>

        {groups.length > 0 ? (
          <>
            <div className="border-b px-6 py-4">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="font-medium">Étape {step + 1} sur {stepsCount}</span>
                <span className="text-gray-500">{step < groups.length ? groups[step]?.name : 'Pour compléter'}</span>
              </div>
              <div className="flex gap-1.5" aria-label="Progression de la personnalisation">
                {Array.from({ length: stepsCount }, (_, index) => (
                  <button key={index} type="button" aria-label={`Étape ${index + 1}`} onClick={() => setStep(index)} className={`h-1.5 flex-1 rounded-full ${index <= step ? 'bg-amber-500' : 'bg-gray-200'}`} />
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {step < groups.length && currentGroup && <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">{currentGroup.name}</h3>
                    <p className="text-sm text-gray-500">
                      {getMin(currentGroup) > 0 ? `Choisissez au moins ${getMin(currentGroup)}` : 'Étape facultative'}
                      {getMax(currentGroup) != null ? ` · ${getMax(currentGroup)} maximum` : ''}
                    </p>
                  </div>
                  {getMin(currentGroup) > 0 && <Badge variant="secondary">Obligatoire</Badge>}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(currentGroup.options || []).map(option => {
                    const chosen = currentGroup.type === 'single'
                      ? String(currentSelection || '') === String(option.id)
                      : Array.isArray(currentSelection) && currentSelection.includes(String(option.id));
                    const disabled = currentGroup.type !== 'single' && !chosen && maxReached;
                    const included = currentGroup.type !== 'single' && Number(currentGroup.includedCount) > 0 &&
                      Array.isArray(currentSelection) && currentSelection.indexOf(String(option.id)) < Number(currentGroup.includedCount);
                    const price = currentGroup.type === 'multiple' && Number(currentGroup.includedCount) > 0
                      ? included ? 0 : Number(currentGroup.extraPrice) || Number(option.priceModifier ?? option.price) || 0
                      : Number(option.priceModifier ?? option.price) || 0;
                    return (
                      <button key={option.id} type="button" disabled={disabled} onClick={() => changeSelection(currentGroup, option.id, !chosen)} className={`flex min-h-16 items-center gap-3 rounded-xl border p-3 text-left transition ${chosen ? 'border-amber-500 bg-amber-50 ring-1 ring-amber-300' : 'border-gray-200 bg-white hover:border-amber-300'} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}>
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${chosen ? 'border-amber-600 bg-amber-500 text-white' : 'border-gray-300 bg-white'}`}>
                          {chosen && <Check className="h-3.5 w-3.5" />}
                        </span>
                        <span className="min-w-0 flex-1 font-medium">{option.name}</span>
                        <span className={`shrink-0 text-sm ${price > 0 ? 'font-semibold text-amber-700' : 'text-gray-500'}`}>
                          {price > 0 ? `+ ${money(price)}` : included ? 'Inclus' : 'Sans supplément'}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {currentGroup.options?.length === 0 && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Aucun choix n’est configuré pour cette étape.</p>}
                {Number(currentGroup.includedCount) > 0 && <p className="text-sm text-gray-500">{currentGroup.includedCount} choix inclus, puis {money(currentGroup.extraPrice)} par choix supplémentaire.</p>}
              </section>}
              {step === groups.length && recommendations.length > 0 && <section className="space-y-4">
                <div>
                  <h3 className="text-xl font-semibold">À ajouter avec votre commande ?</h3>
                  <p className="text-sm text-gray-500">Suggestions choisies par le restaurant et classées selon les ventes. Cette étape est facultative.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {recommendations.map(item => {
                    const checked = selectedRecommendations.includes(item.id);
                    const price = Math.round(item.price * (1 - (item.discount_percentage || 0) / 100));
                    return <button key={item.id} type="button" onClick={() => setSelectedRecommendations(current => checked ? current.filter(id => id !== item.id) : [...current, item.id])} className={`flex items-center gap-3 rounded-xl border p-3 text-left ${checked ? 'border-amber-500 bg-amber-50 ring-1 ring-amber-300' : 'border-gray-200 bg-white hover:border-amber-300'}`}>
                      {item.image ? <img src={item.image} alt="" className="h-14 w-14 rounded-lg object-cover" /> : <span className="h-14 w-14 rounded-lg bg-amber-50" />}
                      <span className="min-w-0 flex-1"><span className="block font-medium">{item.name}</span><span className="text-sm text-amber-700">{money(price)}</span></span>
                      <span className={`flex h-5 w-5 items-center justify-center rounded border ${checked ? 'border-amber-600 bg-amber-500 text-white' : 'border-gray-300'}`}>{checked && <Check className="h-3.5 w-3.5" />}</span>
                    </button>;
                  })}
                </div>
              </section>}
            </div>

            <div className="flex items-center justify-between border-t bg-white px-6 py-4">
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
                  <ChevronLeft className="mr-1 h-4 w-4" /> Retour
                </Button>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="outline" size="icon" aria-label="Diminuer la quantité" onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus className="h-4 w-4" /></Button>
                  <span className="w-7 text-center font-semibold">{quantity}</span>
                  <Button type="button" variant="outline" size="icon" aria-label="Augmenter la quantité" onClick={() => setQuantity(Math.min(99, quantity + 1))}><Plus className="h-4 w-4" /></Button>
                </div>
              </div>
              {step < stepsCount - 1 ? (
                <Button type="button" onClick={() => setStep(step + 1)} disabled={selectedCount(currentGroup) < getMin(currentGroup)}>
                  Continuer <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : <Button type="button" onClick={handleConfirm} disabled={!valid}>
                <ShoppingBag className="mr-2 h-4 w-4" /> Ajouter · {money(estimatedTotal)}
              </Button>}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between gap-4 px-6 py-5">
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="icon" onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus className="h-4 w-4" /></Button>
              <span className="w-8 text-center font-semibold">{quantity}</span>
              <Button type="button" variant="outline" size="icon" onClick={() => setQuantity(Math.min(99, quantity + 1))}><Plus className="h-4 w-4" /></Button>
            </div>
              <Button type="button" onClick={handleConfirm}><ShoppingBag className="mr-2 h-4 w-4" /> Ajouter · {money(unitPrice * quantity)}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
