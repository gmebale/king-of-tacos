import React, { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Save, RotateCcw, History } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api.service';
import { useAuthContext } from '../contexts/AuthContext';
import { Badge } from '../Components/ui/badge';
import { Button } from '../Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../Components/ui/card';
import { Switch } from '../Components/ui/switch';
import AdminStaff from './AdminStaff';

export default function AdminAccess() {
  const { user } = useAuthContext();
  const [accounts, setAccounts] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [viewMode, setViewMode] = useState('accounts');
  const [draft, setDraft] = useState({});
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const activeAccount = accounts.find(account => String(account.id) === String(selectedAccountId));
  const groups = useMemo(() => permissions.reduce((result, permission) => {
    (result[permission.module] ||= []).push(permission);
    return result;
  }, {}), [permissions]);

  const load = async () => {
    setLoading(true);
    try {
      const [matrix, history, accountResponse] = await Promise.all([api.get('/users/access/roles'), api.get('/users/access/audit'), api.get('/users/access/users')]);
      setPermissions(matrix.data.permissions);
      setAudit(history.data);
      setAccounts(accountResponse.data);
      setSelectedAccountId(current => accountResponse.data.some(account => String(account.id) === String(current)) ? current : String(accountResponse.data[0]?.id || ''));
      setDraft(accountResponse.data.find(account => String(account.id) === String(selectedAccountId))?.permissions || accountResponse.data[0]?.permissions || {});
    } catch (error) {
      toast.error(error.response?.data?.message || 'Impossible de charger les droits d’accès.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (activeAccount) setDraft(activeAccount.permissions || {}); }, [activeAccount]);

  const save = async () => {
    if (!activeAccount) return;
    setSaving(true);
    try {
      await api.put(`/users/access/users/${activeAccount.id}`, { permissions: draft });
      toast.success(`Droits du compte « ${activeAccount.full_name} » enregistrés.`);
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Impossible d’enregistrer les droits.');
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== 'admin') return <div className="p-8 text-center">Accès réservé à la Direction.</div>;
  if (viewMode === 'staff') return <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-8"><Button variant="outline" onClick={() => setViewMode('accounts')}>Retour aux autorisations</Button><AdminStaff /></div>;

  return <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
    <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
      <div><div className="mb-2 flex items-center gap-2 text-amber-700"><ShieldCheck className="h-5 w-5" /> Gestion détaillée des accès</div>
        <h1 className="text-3xl font-bold text-gray-900">Personnel et droits d’accès</h1>
        <p className="mt-2 max-w-3xl text-gray-600">Les autorisations individuelles remplacent celles du profil et sont appliquées côté serveur. Chaque changement est journalisé.</p>
      </div>
      <div className="flex gap-2"><Button variant="outline" onClick={() => setDraft(activeAccount?.permissions || {})} disabled={!activeAccount}><RotateCcw className="mr-2 h-4 w-4" />Réinitialiser</Button>
        <Button onClick={save} disabled={loading || saving || !activeAccount} className="bg-amber-500 hover:bg-amber-600"><Save className="mr-2 h-4 w-4" />{saving ? 'Enregistrement…' : 'Enregistrer'}</Button></div>
    </header>

    <div className="flex flex-wrap gap-2"><Button variant={viewMode === 'staff' ? 'default' : 'outline'} onClick={() => setViewMode('staff')}>Gérer les comptes</Button><Button variant={viewMode === 'accounts' ? 'default' : 'outline'} onClick={() => { setViewMode('accounts'); setDraft(activeAccount?.permissions || {}); }}>Droits par compte</Button></div>

    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <Card className="h-fit"><CardHeader><CardTitle>Comptes du personnel</CardTitle></CardHeader><CardContent className="space-y-2">
        {accounts.map(account => <button key={account.id} type="button" onClick={() => setSelectedAccountId(String(account.id))} className={`w-full rounded-lg border p-3 text-left transition ${String(selectedAccountId) === String(account.id) ? 'border-amber-500 bg-yellow-100 text-slate-900 ring-1 ring-amber-300' : 'hover:bg-gray-50'}`}><span className="block font-semibold">{account.full_name}</span><span className="mt-1 block text-xs text-gray-500">{account.staff_code} · {account.role} · {account.is_active ? 'Actif' : 'Désactivé'}</span></button>)}
        {!accounts.length && <p className="text-sm text-gray-500">Aucun compte staff.</p>}
      </CardContent></Card>

      <div className="space-y-4">
        {Object.entries(groups).map(([group, entries]) => <Card key={group}><CardHeader className="pb-3"><CardTitle className="text-lg">{group}</CardTitle></CardHeader><CardContent className="divide-y">
          <div className="flex items-center justify-between gap-4 border-b py-3"><div><div className="font-semibold text-gray-900">Activer / désactiver le module</div><div className="text-xs text-gray-500">Pour ce compte uniquement</div></div><Switch checked={entries.every(permission => draft[permission.code] === true)} disabled={!activeAccount || activeAccount.role === 'admin' || loading} onCheckedChange={checked => setDraft(current => ({ ...current, ...Object.fromEntries(entries.map(permission => [permission.code, checked])) }))} aria-label={`Activer le module ${group}`} /></div>
          {entries.map(permission => <div key={permission.code} className="flex items-center justify-between gap-4 py-3">
            <div><div className="font-medium text-gray-800">{permission.label}</div><code className="text-xs text-gray-400">{permission.code}</code></div>
            <Switch checked={draft[permission.code] === true} disabled={activeAccount?.role === 'admin' || loading} onCheckedChange={checked => setDraft(current => ({ ...current, [permission.code]: checked }))} aria-label={permission.label} />
          </div>)}
        </CardContent></Card>)}
        {loading && <p className="py-8 text-center text-gray-500">Chargement des autorisations…</p>}
      </div>
    </div>

    <Card><CardHeader><CardTitle className="flex items-center gap-2"><History className="h-5 w-5" />Historique des changements de droits</CardTitle></CardHeader><CardContent>
      {!audit.length ? <p className="text-sm text-gray-500">Aucun changement de droits enregistré.</p> : <div className="space-y-3">{audit.slice(0, 20).map(entry => <div key={entry.id} className="flex flex-col justify-between gap-1 border-b pb-3 text-sm sm:flex-row"><span>{entry.details} <Badge variant="outline">{entry.user?.full_name || 'Utilisateur'}</Badge></span><time className="text-gray-500">{new Date(entry.created_at).toLocaleString('fr-FR')}</time></div>)}</div>}
    </CardContent></Card>
  </div>;
}
