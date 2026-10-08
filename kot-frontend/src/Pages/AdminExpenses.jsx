import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
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
  const [catalog, setCatalog] = useState([]);
  const [legacyExpenses, setLegacyExpenses] = useState([]);
  const [cashExpenses, setCashExpenses] = useState([]);
  const [startDate, setStartDate] = useState(() => localDateValue(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [endDate, setEndDate] = useState(() => localDateValue(new Date()));
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ expense_type: 'operating', category: '', description: '' });

  const loadCatalog = async () => {
    try {
      const response = await api.get('/finance/expense-catalog');
      setCatalog(response.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Impossible de charger le catalogue');
    }
  };

  const loadLegacyExpenses = async () => {
    try {
      const params = { start_date: startDate, end_date: endDate };
      const [legacyResponse, cashResponse] = await Promise.all([
        api.get('/finance/expenses', { params }),
        api.get('/finance/cash-expenses', { params })
      ]);
      setLegacyExpenses(legacyResponse.data || []);
      setCashExpenses(cashResponse.data || []);
    } catch (error) {
      toast.error('Impossible de charger l’ancien historique des dépenses');
    }
  };

  useEffect(() => { loadCatalog(); }, []);
  useEffect(() => { loadLegacyExpenses(); }, [startDate, endDate]);

  const submit = async event => {
    event.preventDefault();
    try {
      setSaving(true);
      await api.post('/finance/expense-catalog', form);
      toast.success('Poste ajouté au catalogue. Il sera comptabilisé lorsqu’il sera sélectionné en caisse.');
      setForm({ expense_type: 'operating', category: '', description: '' });
      await loadCatalog();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Impossible de créer ce poste');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async item => {
    try {
      await api.patch(`/finance/expense-catalog/${item.id}`, { active: !item.active });
      await loadCatalog();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Impossible de modifier ce poste');
    }
  };

  const amountText = value => `${Number(value || 0).toLocaleString('fr-GA', { maximumFractionDigits: 0 })} FCFA`;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dépenses</h1>
          <p className="text-gray-600">Gérez les postes disponibles pour les mouvements de caisse.</p>
        </div>
        <Link to="/admin/finance"><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Retour aux finances</Button></Link>
      </div>

      <Card>
        <CardHeader><CardTitle>Ajouter un poste au catalogue</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-4">
            <div><Label htmlFor="expense-type">Type</Label><select id="expense-type" className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm" value={form.expense_type} onChange={event => setForm({ ...form, expense_type: event.target.value })}><option value="operating">Dépense courante</option><option value="stock_purchase">Achat de stock</option></select></div>
            <div><Label htmlFor="expense-category">Catégorie</Label><Input id="expense-category" required maxLength={80} value={form.category} onChange={event => setForm({ ...form, category: event.target.value })} placeholder="Ex. Entretien, énergie" /></div>
            <div><Label htmlFor="expense-description">Libellé</Label><Input id="expense-description" required maxLength={255} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="Ex. Réparation réfrigérateur" /></div>
            <div className="flex items-end"><Button className="w-full" type="submit" disabled={saving}>{saving ? 'Ajout...' : 'Ajouter au catalogue'}</Button></div>
          </form>
          <p className="mt-3 text-sm text-gray-500">Créer un poste ne modifie ni la caisse, ni la comptabilité, ni le stock.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4"><div><CardTitle>Dépenses enregistrées en caisse</CardTitle><p className="mt-1 text-sm text-gray-500">Mouvements liés aux sessions de caisse et repris dans les rapports financiers.</p></div><div className="flex gap-2"><div><Label htmlFor="cash-expense-start">Du</Label><Input id="cash-expense-start" type="date" value={startDate} onChange={event => setStartDate(event.target.value)} /></div><div><Label htmlFor="cash-expense-end">Au</Label><Input id="cash-expense-end" type="date" value={endDate} onChange={event => setEndDate(event.target.value)} /></div></div></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Session</TableHead><TableHead>Type / catégorie</TableHead><TableHead>Description</TableHead><TableHead>Règlement</TableHead><TableHead>Produits reçus</TableHead><TableHead className="text-right">Montant</TableHead></TableRow></TableHeader>
            <TableBody>
              {cashExpenses.map(expense => <TableRow key={expense.id}><TableCell>{new Date(expense.expense_date).toLocaleString('fr-FR')}</TableCell><TableCell>#{expense.session_id}</TableCell><TableCell>{expense.expense_type === 'stock_purchase' ? 'Achat stock' : 'Dépense'} · {expense.category}</TableCell><TableCell>{expense.description}{expense.supplier && <div className="text-xs text-gray-500">{expense.supplier}</div>}</TableCell><TableCell>{expense.payment_method}</TableCell><TableCell>{expense.items?.map(line => `${line.quantity} × ${line.product.name}`).join(', ') || '—'}</TableCell><TableCell className="text-right">{amountText(expense.amount)}</TableCell></TableRow>)}
              {!cashExpenses.length && <TableRow><TableCell colSpan={7} className="py-8 text-center text-gray-500">Aucune dépense de caisse sur cette période.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Catalogue des dépenses</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Catégorie</TableHead><TableHead>Libellé</TableHead><TableHead>Type</TableHead><TableHead>État</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {catalog.map(item => <TableRow key={item.id}><TableCell>{item.category}</TableCell><TableCell>{item.description}</TableCell><TableCell>{item.expense_type === 'stock_purchase' ? 'Achat de stock' : 'Dépense courante'}</TableCell><TableCell>{item.active ? 'Actif' : 'Désactivé'}</TableCell><TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => toggleActive(item)}>{item.active ? 'Désactiver' : 'Réactiver'}</Button></TableCell></TableRow>)}
              {!catalog.length && <TableRow><TableCell colSpan={5} className="py-8 text-center text-gray-500">Aucun poste de dépense. Ajoutez-en un ci-dessus.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4"><div><CardTitle>Ancien historique</CardTitle><p className="mt-1 text-sm text-gray-500">Ces écritures antérieures sont conservées. Les nouvelles dépenses seront enregistrées depuis la caisse.</p></div><div className="flex gap-2"><div><Label htmlFor="expense-start">Du</Label><Input id="expense-start" type="date" value={startDate} onChange={event => setStartDate(event.target.value)} /></div><div><Label htmlFor="expense-end">Au</Label><Input id="expense-end" type="date" value={endDate} onChange={event => setEndDate(event.target.value)} /></div></div></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type / catégorie</TableHead><TableHead>Description</TableHead><TableHead>Produits</TableHead><TableHead className="text-right">Montant</TableHead></TableRow></TableHeader>
            <TableBody>
              {legacyExpenses.map(expense => <TableRow key={expense.id}><TableCell>{new Date(expense.expense_date).toLocaleDateString('fr-FR')}</TableCell><TableCell>{expense.expense_type === 'stock_purchase' ? 'Achat stock' : 'Charge'} · {expense.category}</TableCell><TableCell>{expense.description}{expense.supplier && <div className="text-xs text-gray-500">{expense.supplier}</div>}</TableCell><TableCell>{expense.items?.map(line => `${line.quantity} × ${line.product.name}`).join(', ') || '—'}</TableCell><TableCell className="text-right">{amountText(expense.amount)}</TableCell></TableRow>)}
              {!legacyExpenses.length && <TableRow><TableCell colSpan={5} className="py-8 text-center text-gray-500">Aucun ancien enregistrement sur cette période.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
