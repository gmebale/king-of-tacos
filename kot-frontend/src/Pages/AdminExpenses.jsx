import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import api from '../services/api.service';
import { Button } from '../Components/ui/button';
import { Input } from '../Components/ui/input';
import { Label } from '../Components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../Components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../Components/ui/table';

function localDateValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function AdminExpenses() {
  const [products, setProducts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [startDate, setStartDate] = useState(() => localDateValue(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [endDate, setEndDate] = useState(() => localDateValue(new Date()));
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    expense_type: 'operating', category: '', description: '', amount: '', expense_date: localDateValue(new Date()),
    payment_method: 'cash', supplier: '', items: [{ product_id: '', quantity: 1, unit_cost: '' }]
  });

  useEffect(() => {
    api.get('/products').then(response => setProducts(response.data || []))
      .catch(() => toast.error('Impossible de charger les produits du stock'));
  }, []);

  useEffect(() => { loadExpenses(); }, [startDate, endDate]);

  const loadExpenses = async () => {
    try {
      const response = await api.get('/finance/expenses', { params: { start_date: startDate, end_date: endDate } });
      setExpenses(response.data || []);
    } catch (error) {
      console.error('Load expenses error:', error);
      toast.error('Impossible de charger les dépenses');
    }
  };

  const purchaseTotal = useMemo(() => form.items.reduce((sum, item) => {
    return sum + (Number(item.quantity) || 0) * (Number(item.unit_cost) || 0);
  }, 0), [form.items]);

  const updateLine = (index, field, value) => {
    setForm(current => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) }));
  };

  const submit = async event => {
    event.preventDefault();
    const payload = {
      ...form,
      amount: Number(form.amount),
      expense_date: new Date(`${form.expense_date}T12:00:00`).toISOString(),
      items: form.items.map(item => ({ product_id: Number(item.product_id), quantity: Number(item.quantity), unit_cost: Number(item.unit_cost) }))
    };
    try {
      setSaving(true);
      await api.post('/finance/expenses', payload);
      toast.success(form.expense_type === 'stock_purchase' ? 'Achat enregistré et stock mis à jour' : 'Dépense enregistrée');
      setForm(current => ({ ...current, category: '', description: '', amount: '', supplier: '', items: [{ product_id: '', quantity: 1, unit_cost: '' }] }));
      await loadExpenses();
      await api.get('/products').then(response => setProducts(response.data || []));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Impossible d’enregistrer la dépense');
    } finally {
      setSaving(false);
    }
  };

  const amountText = value => `${Number(value || 0).toLocaleString()} FCFA`;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dépenses</h1>
          <p className="text-gray-600">Charges du restaurant et achats de stock</p>
        </div>
        <Link to="/admin/finance"><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Retour aux finances</Button></Link>
      </div>

      <Card>
        <CardHeader><CardTitle>Enregistrer une dépense</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div><Label htmlFor="expense-type">Type</Label><select id="expense-type" className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm" value={form.expense_type} onChange={event => setForm({ ...form, expense_type: event.target.value })}><option value="operating">Charge courante</option><option value="stock_purchase">Achat de stock</option></select></div>
              <div><Label htmlFor="expense-date">Date</Label><Input id="expense-date" type="date" required value={form.expense_date} onChange={event => setForm({ ...form, expense_date: event.target.value })} /></div>
              <div><Label htmlFor="expense-payment">Moyen de paiement</Label><select id="expense-payment" className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm" value={form.payment_method} onChange={event => setForm({ ...form, payment_method: event.target.value })}><option value="cash">Espèces</option><option value="card">Carte</option><option value="mobile_money">Mobile money</option><option value="bank_transfer">Virement</option><option value="other">Autre</option></select></div>
              <div><Label htmlFor="expense-category">Catégorie</Label><Input id="expense-category" required maxLength={80} value={form.category} onChange={event => setForm({ ...form, category: event.target.value })} placeholder={form.expense_type === 'stock_purchase' ? 'Achats de stock' : 'Ex. Loyer, salaires, énergie'} /></div>
              <div><Label htmlFor="expense-supplier">Fournisseur (facultatif)</Label><Input id="expense-supplier" value={form.supplier} onChange={event => setForm({ ...form, supplier: event.target.value })} /></div>
              <div className="md:col-span-3"><Label htmlFor="expense-description">Description</Label><Input id="expense-description" required maxLength={255} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="Détail de la dépense" /></div>
            </div>

            {form.expense_type === 'operating' ? (
              <div className="max-w-sm"><Label htmlFor="expense-amount">Montant (FCFA)</Label><Input id="expense-amount" type="number" min="1" step="1" required value={form.amount} onChange={event => setForm({ ...form, amount: event.target.value })} /></div>
            ) : (
              <div className="space-y-3">
                <p className="rounded-md bg-blue-50 p-3 text-sm text-blue-800">L’achat augmente le stock et actualise son coût moyen. Si un produit a un stock initial sans coût enregistré, le coût du premier achat servira à valoriser ce stock.</p>
                <div className="flex items-center justify-between"><h3 className="font-semibold">Produits achetés</h3><Button type="button" variant="outline" size="sm" onClick={() => setForm(current => ({ ...current, items: [...current.items, { product_id: '', quantity: 1, unit_cost: '' }] }))}><Plus className="mr-1 h-4 w-4" />Ajouter un produit</Button></div>
                {form.items.map((item, index) => (
                  <div key={index} className="grid items-end gap-3 rounded-lg border p-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
                    <div><Label>Produit</Label><select required className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm" value={item.product_id} onChange={event => updateLine(index, 'product_id', event.target.value)}><option value="">Choisir un produit</option>{products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select></div>
                    <div><Label>Quantité</Label><Input type="number" min="1" step="1" required value={item.quantity} onChange={event => updateLine(index, 'quantity', event.target.value)} /></div>
                    <div><Label>Coût unitaire (FCFA)</Label><Input type="number" min="0" step="1" required value={item.unit_cost} onChange={event => updateLine(index, 'unit_cost', event.target.value)} /></div>
                    <Button type="button" variant="outline" size="icon" disabled={form.items.length === 1} onClick={() => setForm(current => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))} aria-label="Supprimer la ligne"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                <p className="text-right font-semibold">Total de l’achat : {amountText(purchaseTotal)}</p>
              </div>
            )}
            <div className="flex justify-end"><Button type="submit" disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4"><CardTitle>Historique</CardTitle><div className="flex gap-2"><div><Label htmlFor="expense-start">Du</Label><Input id="expense-start" type="date" value={startDate} onChange={event => setStartDate(event.target.value)} /></div><div><Label htmlFor="expense-end">Au</Label><Input id="expense-end" type="date" value={endDate} onChange={event => setEndDate(event.target.value)} /></div></div></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type / catégorie</TableHead><TableHead>Description</TableHead><TableHead>Produits</TableHead><TableHead className="text-right">Montant</TableHead></TableRow></TableHeader>
            <TableBody>
              {expenses.map(expense => <TableRow key={expense.id}><TableCell>{new Date(expense.expense_date).toLocaleDateString('fr-FR')}</TableCell><TableCell>{expense.expense_type === 'stock_purchase' ? 'Achat stock' : 'Charge'} · {expense.category}</TableCell><TableCell>{expense.description}{expense.supplier && <div className="text-xs text-gray-500">{expense.supplier}</div>}</TableCell><TableCell>{expense.items?.map(line => `${line.quantity} × ${line.product.name}`).join(', ') || '—'}</TableCell><TableCell className="text-right">{amountText(expense.amount)}</TableCell></TableRow>)}
              {!expenses.length && <TableRow><TableCell colSpan={5} className="py-8 text-center text-gray-500">Aucune dépense sur cette période.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
