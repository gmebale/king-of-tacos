import React from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

const makeGroup = () => ({
  id: `group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name: '',
  type: 'multiple',
  minSelections: 0,
  maxSelections: null,
  includedCount: 0,
  extraPrice: 0,
  options: []
});

export default function ProductConfigurationEditor({ value, onChange, products, currentProductId }) {
  const config = value || { isConfigurable: true, optionGroups: [], recommendations: [] };
  const groups = Array.isArray(config.optionGroups) ? config.optionGroups : [];
  const setGroups = (nextGroups) => onChange({ ...config, isConfigurable: true, optionGroups: nextGroups });

  const updateGroup = (index, changes) => setGroups(groups.map((group, groupIndex) => groupIndex === index ? { ...group, ...changes } : group));
  const removeGroup = (index) => setGroups(groups.filter((_, groupIndex) => groupIndex !== index));
  const addGroup = () => setGroups([...groups, makeGroup()]);

  const updateOption = (groupIndex, optionIndex, changes) => {
    const next = groups.map((group, index) => index === groupIndex
      ? { ...group, options: group.options.map((option, itemIndex) => itemIndex === optionIndex ? { ...option, ...changes } : option) }
      : group);
    setGroups(next);
  };

  const addOption = (groupIndex) => {
    const next = [...groups];
    next[groupIndex] = { ...next[groupIndex], options: [...(next[groupIndex].options || []), { id: '', productId: null, name: '', priceModifier: 0 }] };
    setGroups(next);
  };

  const removeOption = (groupIndex, optionIndex) => {
    const next = [...groups];
    next[groupIndex] = { ...next[groupIndex], options: next[groupIndex].options.filter((_, index) => index !== optionIndex) };
    setGroups(next);
  };

  const selectableProducts = products.filter(item => item.id !== currentProductId);
  const recommendableProducts = selectableProducts.filter(item => !['modifier', 'configurable', 'combo'].includes(item.type) && !item.customization?.isConfigurable && !item.options?.length && item.category?.is_menu_visible !== false);
  const recommendationIds = (config.recommendations || []).map(String);

  return (
    <section className="space-y-4 rounded-xl border bg-white p-4">
      <div>
        <h3 className="font-semibold">Étapes de personnalisation</h3>
        <p className="text-sm text-gray-500">Créez des groupes de choix réutilisables dans le parcours : taille, accompagnement, boisson, supplément…</p>
      </div>

      {groups.map((group, groupIndex) => (
        <div key={group.id || groupIndex} className="space-y-3 rounded-lg border bg-gray-50 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Nom du groupe</Label>
              <Input value={group.name || ''} onChange={event => updateGroup(groupIndex, { name: event.target.value })} placeholder="Ex. Choisissez vos sauces" required />
            </div>
            <div className="space-y-1">
              <Label>Mode de choix</Label>
              <select className="h-10 w-full rounded-md border bg-white px-3 text-sm" value={group.type || 'multiple'} onChange={event => updateGroup(groupIndex, { type: event.target.value, minSelections: event.target.value === 'single' ? Math.min(1, Number(group.minSelections) || 0) : group.minSelections, maxSelections: event.target.value === 'single' ? 1 : group.maxSelections })}>
                <option value="single">Un seul choix</option>
                <option value="multiple">Plusieurs choix</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Choix minimum</Label>
              <Input type="number" min="0" step="1" value={group.minSelections ?? 0} onChange={event => updateGroup(groupIndex, { minSelections: Number(event.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label>Choix maximum (vide = sans limite)</Label>
              <Input type="number" min="1" step="1" value={group.type === 'single' ? 1 : group.maxSelections ?? ''} disabled={group.type === 'single'} onChange={event => updateGroup(groupIndex, { maxSelections: event.target.value ? Number(event.target.value) : null })} />
            </div>
            {group.type === 'multiple' && <>
              <div className="space-y-1">
                <Label>Choix inclus dans le prix</Label>
                <Input type="number" min="0" step="1" value={group.includedCount ?? 0} onChange={event => updateGroup(groupIndex, { includedCount: Number(event.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label>Supplément par choix au-delà</Label>
                <Input type="number" min="0" step="1" value={group.extraPrice ?? 0} onChange={event => updateGroup(groupIndex, { extraPrice: Number(event.target.value) })} />
              </div>
            </>}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Choix proposés</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => addOption(groupIndex)}>Ajouter un choix</Button>
            </div>
            {!group.options?.length && <p className="text-sm text-gray-500">Ajoutez au moins un choix à ce groupe.</p>}
            {group.options?.map((option, optionIndex) => (
              <div key={`${group.id}-${optionIndex}`} className="grid items-end gap-2 sm:grid-cols-[1fr_10rem_auto]">
                <div className="space-y-1">
                  <Label>Produit / option</Label>
                  <select className="h-10 w-full rounded-md border bg-white px-3 text-sm" value={option.productId ? String(option.productId) : ''} required onChange={event => {
                    const selected = selectableProducts.find(item => String(item.id) === event.target.value);
                    updateOption(groupIndex, optionIndex, selected ? { id: String(selected.id), productId: selected.id, name: selected.name } : { id: '', productId: null, name: '' });
                  }}>
                    <option value="">Choisir un élément du catalogue</option>
                    {selectableProducts.map(item => <option key={item.id} value={String(item.id)}>{item.name} · {Number(item.price || 0).toLocaleString()} FCFA</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Prix ajouté</Label>
                  <Input type="number" min="0" step="1" value={option.priceModifier ?? 0} onChange={event => updateOption(groupIndex, optionIndex, { priceModifier: Number(event.target.value) })} />
                </div>
                <Button type="button" variant="outline" onClick={() => removeOption(groupIndex, optionIndex)}>Retirer</Button>
              </div>
            ))}
          </div>
          <Button type="button" variant="ghost" className="text-red-600" onClick={() => removeGroup(groupIndex)}>Supprimer ce groupe</Button>
        </div>
      ))}

      <Button type="button" variant="outline" onClick={addGroup}>Ajouter un groupe de choix</Button>

      <div className="space-y-2 border-t pt-4">
        <Label>Suggestions associées</Label>
        <p className="text-sm text-gray-500">Choisissez les produits à proposer avec celui-ci. Ils seront ensuite classés selon les achats réels.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {recommendableProducts.map(item => (
            <label key={item.id} className="flex items-center gap-2 rounded-md border bg-white p-2 text-sm">
              <input type="checkbox" checked={recommendationIds.includes(String(item.id))} onChange={event => {
                const next = event.target.checked
                  ? [...recommendationIds, String(item.id)]
                  : recommendationIds.filter(id => id !== String(item.id));
                onChange({ ...config, recommendations: next });
              }} />
              <span>{item.name}</span>
            </label>
          ))}
        </div>
      </div>
    </section>
  );
}
