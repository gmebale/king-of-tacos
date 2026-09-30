import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'react-hot-toast';
import api from '../../services/api.service';

const EMPTY_FORM = {
  name: '',
  displayName: '',
  preparation_station: 'cuisine_chaude',
  is_menu_visible: true,
  display_order: 0
};

const STATIONS = [
  { value: 'cuisine_chaude', label: 'Cuisine chaude' },
  { value: 'cuisine_froide', label: 'Cuisine froide' },
  { value: 'bar', label: 'Bar' }
];

export default function CategoryManagementDialog({ open, onOpenChange, categories, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
      setEditingId(null);
    }
  }, [open]);

  const startEdit = (category) => {
    setEditingId(category.id);
    setForm({
      name: category.name,
      displayName: category.displayName || category.name,
      preparation_station: category.preparation_station || 'cuisine_chaude',
      is_menu_visible: category.is_menu_visible !== false,
      display_order: category.display_order || 0
    });
  };

  const saveCategory = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (editingId) await api.put(`/products/categories/${editingId}`, form);
      else await api.post('/products/categories', form);
      toast.success(editingId ? 'Catégorie mise à jour.' : 'Catégorie créée.');
      setForm(EMPTY_FORM);
      setEditingId(null);
      await onSaved();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Impossible d’enregistrer cette catégorie.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Catégories du catalogue</DialogTitle>
          <DialogDescription>Organisez le menu et affectez chaque catégorie à son poste de préparation.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {categories.map(category => (
            <div key={category.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <p className="font-medium">{category.displayName || category.name}</p>
                <p className="text-sm text-gray-500">
                  {STATIONS.find(station => station.value === category.preparation_station)?.label || 'Cuisine chaude'}
                  {category.is_menu_visible === false ? ' · Masquée du menu' : ''}
                </p>
              </div>
              <Button type="button" variant="outline" onClick={() => startEdit(category)}>Modifier</Button>
            </div>
          ))}
        </div>

        <form onSubmit={saveCategory} className="space-y-4 rounded-lg bg-gray-50 p-4">
          <h3 className="font-semibold">{editingId ? 'Modifier la catégorie' : 'Ajouter une catégorie'}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="category-display-name">Nom affiché</Label>
              <Input id="category-display-name" value={form.displayName} onChange={event => setForm({ ...form, displayName: event.target.value })} placeholder="Ex. Menus enfants" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category-name">Identifiant</Label>
              <Input id="category-name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value.toLowerCase().replace(/\s+/g, '_') })} placeholder="Ex. menus_enfants" required pattern="[a-z0-9_-]{2,60}" />
            </div>
            <div className="space-y-2">
              <Label>Poste de préparation</Label>
              <Select value={form.preparation_station} onValueChange={value => setForm({ ...form, preparation_station: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATIONS.map(station => <SelectItem key={station.value} value={station.value}>{station.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category-order">Ordre dans le menu</Label>
              <Input id="category-order" type="number" step="1" value={form.display_order} onChange={event => setForm({ ...form, display_order: Number(event.target.value) })} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_menu_visible} onChange={event => setForm({ ...form, is_menu_visible: event.target.checked })} />
            Afficher cette catégorie dans le menu client
          </label>
          <DialogFooter>
            {editingId && <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm(EMPTY_FORM); }}>Annuler la modification</Button>}
            <Button type="submit" disabled={saving}>{saving ? 'Enregistrement…' : editingId ? 'Enregistrer' : 'Créer la catégorie'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
