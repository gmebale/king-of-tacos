import React, { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import api from '../../services/api.service';

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
  const [savedSteps, setSavedSteps] = useState([]);
  const [selectedSavedStep, setSelectedSavedStep] = useState('');
  const [savingStep, setSavingStep] = useState(false);
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

  useEffect(() => {
    api.get('/products/customization-steps')
      .then(response => setSavedSteps(Array.isArray(response.data) ? response.data : []))
      .catch(error => console.error('Error loading saved customization steps:', error));
  }, []);

  const newGroupId = () => `group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const groupForTemplate = (group) => {
    const { templateId, templateUpdatedAt, ...templateGroup } = group;
    return templateGroup;
  };

  const addSavedStep = () => {
    const template = savedSteps.find(step => step.id === selectedSavedStep);
    if (!template) return;
    setGroups([...groups, {
      ...template.group,
      id: newGroupId(),
      templateId: template.id,
      templateUpdatedAt: template.updatedAt,
      options: (template.group.options || []).map(option => ({ ...option }))
    }]);
    setSelectedSavedStep('');
  };

  const saveAsNewStep = async (groupIndex) => {
    const group = groups[groupIndex];
    const name = window.prompt('Nom de cette étape réutilisable :', group.name || '');
    if (name === null) return;
    setSavingStep(true);
    try {
      const response = await api.post('/products/customization-steps', { name, group: groupForTemplate(group) });
      setSavedSteps(current => [...current, response.data].sort((a, b) => a.name.localeCompare(b.name, 'fr')));
      updateGroup(groupIndex, { templateId: response.data.id, templateUpdatedAt: response.data.updatedAt });
      window.alert('Étape enregistrée. Les produits déjà configurés ne sont pas modifiés.');
    } catch (error) {
      window.alert(error.response?.data?.message || 'Impossible d’enregistrer cette étape.');
    } finally {
      setSavingStep(false);
    }
  };

  const updateSavedStep = async (groupIndex) => {
    const group = groups[groupIndex];
    const template = savedSteps.find(step => step.id === group.templateId);
    if (!template) return;
    if (!window.confirm(`Mettre à jour « ${template.name} » pour ses prochaines utilisations ? Les produits déjà configurés ne changeront pas.`)) return;
    setSavingStep(true);
    try {
      const response = await api.put(`/products/customization-steps/${template.id}`, { name: template.name, group: groupForTemplate(group) });
      setSavedSteps(current => current.map(step => step.id === template.id ? response.data : step));
      updateGroup(groupIndex, { templateUpdatedAt: response.data.updatedAt });
      window.alert('Modèle mis à jour pour les prochaines utilisations.');
    } catch (error) {
      window.alert(error.response?.data?.message || 'Impossible de mettre à jour ce modèle.');
    } finally {
      setSavingStep(false);
    }
  };

  const applyLatestSavedStep = (groupIndex) => {
    const currentGroup = groups[groupIndex];
    const template = savedSteps.find(step => step.id === currentGroup.templateId);
    if (!template) return;
    setGroups(groups.map((group, index) => index === groupIndex ? {
      ...template.group,
      id: currentGroup.id || newGroupId(),
      templateId: template.id,
      templateUpdatedAt: template.updatedAt,
      options: (template.group.options || []).map(option => ({ ...option }))
    } : group));
  };

  const deleteSavedStep = async () => {
    const template = savedSteps.find(step => step.id === selectedSavedStep);
    if (!template || !window.confirm(`Supprimer « ${template.name} » de la bibliothèque ? Les produits déjà configurés ne changeront pas.`)) return;
    try {
      await api.delete(`/products/customization-steps/${template.id}`);
      setSavedSteps(current => current.filter(step => step.id !== template.id));
      setGroups(groups.map(group => {
        if (group.templateId !== template.id) return group;
        const { templateId, templateUpdatedAt, ...localGroup } = group;
        return localGroup;
      }));
      setSelectedSavedStep('');
    } catch (error) {
      window.alert(error.response?.data?.message || 'Impossible de supprimer ce modèle.');
    }
  };

  return (
    <section className="space-y-4 rounded-xl border bg-white p-4">
      <div>
        <h3 className="font-semibold">Étapes de personnalisation</h3>
        <p className="text-sm text-gray-500">Créez des groupes de choix réutilisables dans le parcours : taille, accompagnement, boisson, supplément…</p>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 sm:flex-row">
        <select
          className="h-10 min-w-0 flex-1 rounded-md border bg-white px-3 text-sm"
          value={selectedSavedStep}
          onChange={event => setSelectedSavedStep(event.target.value)}
          aria-label="Étape enregistrée à ajouter"
        >
          <option value="">Ajouter une étape enregistrée…</option>
          {savedSteps.map(step => <option key={step.id} value={step.id}>{step.name}</option>)}
        </select>
        <Button type="button" variant="outline" disabled={!selectedSavedStep} onClick={addSavedStep}>Ajouter l’étape</Button>
        <Button type="button" variant="ghost" disabled={!selectedSavedStep} onClick={deleteSavedStep} className="text-red-600">Supprimer le modèle</Button>
      </div>
      {!savedSteps.length && <p className="text-xs text-gray-500">Aucune étape enregistrée pour le moment. Configurez une étape ci-dessous puis enregistrez-la.</p>}

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
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" disabled={savingStep} onClick={() => saveAsNewStep(groupIndex)}>Enregistrer comme modèle</Button>
            {(() => {
              const linkedTemplate = savedSteps.find(step => step.id === group.templateId);
              if (!linkedTemplate) return null;
              return <>
                <Button type="button" variant="outline" disabled={savingStep} onClick={() => updateSavedStep(groupIndex)}>Mettre à jour le modèle</Button>
                {group.templateUpdatedAt !== linkedTemplate.updatedAt && (
                  <Button type="button" variant="outline" onClick={() => applyLatestSavedStep(groupIndex)}>Appliquer la version du modèle</Button>
                )}
              </>;
            })()}
            <Button type="button" variant="ghost" className="text-red-600" onClick={() => removeGroup(groupIndex)}>Supprimer ce groupe</Button>
          </div>
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
