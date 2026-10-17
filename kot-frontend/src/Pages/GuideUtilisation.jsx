import React from 'react';
import { BookOpen, Download, ExternalLink, ShieldCheck, ShoppingBag, ChefHat, Receipt, Package, Users, Settings, Star, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../Components/ui/card';

const sections = [
  {
    icon: ShoppingBag,
    title: 'Commandes et service',
    description: 'Parcours client, prise de commande au comptoir, suivi des statuts, préparation, service, retrait, livraison, transfert et annulation.'
  },
  {
    icon: ChefHat,
    title: 'Cuisine et bar',
    description: 'Files de production par poste, démarrage et fin de préparation, commandes prêtes et coordination avec le service.'
  },
  {
    icon: Receipt,
    title: 'Caisse, paiements et dépenses',
    description: 'Ouverture de session, fond de caisse, encaissement, clôture, écarts, remboursements, Mobile Money et dépenses de session.'
  },
  {
    icon: Package,
    title: 'Produits et stocks',
    description: 'Catalogue, catégories, formules et options, disponibilité, entrées, pertes, inventaires et corrections de stock.'
  },
  {
    icon: Users,
    title: 'Personnel et droits',
    description: 'Comptes, postes, activation, permissions par action et configuration des codes personnels par la Direction.'
  },
  {
    icon: Settings,
    title: 'Réglages du restaurant',
    description: 'Informations, horaires de commande en ligne, lieux de service, taxes, moyens de paiement et bannière d’accueil.'
  },
  {
    icon: Star,
    title: 'Fidélité et promotions',
    description: 'Niveaux, récompenses, points, attributions manuelles, codes promo et historique des échanges.'
  },
  {
    icon: MessageSquare,
    title: 'Avis et finances',
    description: 'Modération des avis, tableaux de ventes, résultats, charges, dépenses et rapports selon les permissions attribuées.'
  }
];

export default function GuideUtilisation() {
  return (
    <div className="min-h-full bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <Card className="overflow-hidden border-0 bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-lg">
          <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="max-w-2xl">
              <div className="mb-3 flex items-center gap-2 text-amber-300"><BookOpen className="h-5 w-5" /><span className="text-sm font-semibold uppercase tracking-wide">Centre d’aide équipe</span></div>
              <h1 className="text-3xl font-bold sm:text-4xl">Guide d’utilisation</h1>
              <p className="mt-3 text-slate-200">Retrouvez les procédures de chaque poste et les fonctionnalités de King Of Tacos dans un guide complet, consultable et téléchargeable.</p>
            </div>
            <a href="/output/pdf/guide-utilisation-king-of-tacos.pdf" download="Guide-utilisation-King-Of-Tacos.pdf" className="inline-flex h-10 shrink-0 items-center justify-center rounded-md bg-amber-400 px-4 py-2 text-sm font-medium text-slate-950 transition-colors hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2">
              <Download className="mr-2 h-4 w-4" />Télécharger le guide PDF
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Bien démarrer</CardTitle></CardHeader>
          <CardContent className="grid gap-4 text-sm leading-6 text-slate-600 md:grid-cols-3">
            <p><strong className="text-slate-900">1. Connectez-vous</strong><br />Utilisez votre compte personnel. Les écrans visibles dépendent de votre poste et des droits attribués.</p>
            <p><strong className="text-slate-900">2. Choisissez votre poste</strong><br />Le menu latéral regroupe les outils accessibles : commandes, production, caisse, stock ou gestion.</p>
            <p><strong className="text-slate-900">3. Respectez les contrôles</strong><br />Certaines actions nécessitent une permission précise et un code personnel à six caractères défini par la Direction.</p>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          {sections.map(({ icon: Icon, title, description }) => (
            <Card key={title} className="h-full transition-shadow hover:shadow-md">
              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-3 text-lg"><span className="rounded-lg bg-amber-100 p-2 text-amber-700"><Icon className="h-5 w-5" /></span>{title}</CardTitle></CardHeader>
              <CardContent className="text-sm leading-6 text-slate-600">{description}</CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3"><ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-amber-700" /><p className="text-sm leading-6 text-amber-950"><strong>Les droits sont indépendants.</strong> L’accès à un module ne donne pas automatiquement toutes ses actions. Si une opération est refusée ou si votre code manque, contactez la Direction.</p></div>
            <a href="/output/pdf/guide-utilisation-king-of-tacos.pdf" target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-amber-800 underline">Ouvrir le PDF <ExternalLink className="h-3.5 w-3.5" /></a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
