import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  Calendar,
  Users,
  Package,
  Printer,
  Download,
  Star,
  Filter,
  X
} from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar
} from "recharts";
import api from "../services/api.service";
import { Card, CardContent, CardHeader, CardTitle } from "../Components/ui/card";
import { Button } from "../Components/ui/button";
import { Input } from "../Components/ui/input";
import { Label } from "../Components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../Components/ui/table";
import { Badge } from "../Components/ui/badge";
import { MapPin } from "lucide-react";
import { Link } from "react-router-dom";

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function AdminFinance() {
  const [revenueData, setRevenueData] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const [topLocations, setTopLocations] = useState([]);
  const [topServers, setTopServers] = useState([]);
  const [profitSummary, setProfitSummary] = useState(null);
  const [filterOptions, setFilterOptions] = useState({ locations: [], servers: [] });
  const [selectedLocation, setSelectedLocation] = useState("all");
  const [selectedServer, setSelectedServer] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return formatDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [endDate, setEndDate] = useState(() => formatDateInput(new Date()));

  useEffect(() => {
    api.get('/finance/filter-options')
      .then(response => setFilterOptions(response.data || { locations: [], servers: [] }))
      .catch(error => console.error('Error loading finance filter options:', error));
  }, []);

  useEffect(() => {
    loadFinanceData();
  }, [startDate, endDate, selectedLocation, selectedServer]);

  useEffect(() => {
    const interval = setInterval(loadFinanceData, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, [startDate, endDate, selectedLocation, selectedServer]);

  const loadFinanceData = async () => {
    setIsLoading(true);
    try {
      const params = {
        start_date: startDate,
        end_date: endDate,
        ...(selectedLocation !== 'all' ? { service_location: selectedLocation } : {}),
        ...(selectedServer !== 'all' ? { server_id: selectedServer } : {})
      };
      const [revenueRes, productsRes, customersRes, locationsRes, serversRes, profitRes] = await Promise.all([
        api.get('/finance/revenue', { params }),
        api.get('/finance/top-products', { params }),
        api.get('/finance/top-customers', { params }),
        api.get('/finance/top-locations', { params }),
        api.get('/finance/top-servers', { params }),
        api.get('/finance/profit-summary', { params: { start_date: startDate, end_date: endDate } })
      ]);

      setRevenueData(revenueRes.data || []);
      setTopProducts(productsRes.data || []);
      setTopCustomers(customersRes.data || []);
      setTopLocations(locationsRes.data || []);
      setTopServers(serversRes.data || []);
      setProfitSummary(profitRes.data || null);
    } catch (error) {
      console.error('Error loading finance data:', error);
    }
    setIsLoading(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const totalRevenue = revenueData.reduce((sum, day) => sum + day.actualRevenue, 0);
  const totalLostRevenue = revenueData.reduce((sum, day) => sum + day.lostRevenue, 0);
  const netRevenue = totalRevenue - totalLostRevenue;
  const locationName = slug => filterOptions.locations.find(location => location.value === slug)?.label || slug;

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              Finances
            </h1>
            <p className="text-gray-600">
              Analyse des revenus et performances
            </p>
          </div>
          <Button onClick={handlePrint} className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
            <Printer className="w-4 h-4 mr-2" />
            Imprimer le rapport
          </Button>
          <Link to="/admin/finance/expenses"><Button variant="outline">Gérer les dépenses</Button></Link>
        </div>

      {/* Combined filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="start-date">Date de début</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="end-date">Date de fin</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="location-filter">Lieu</Label>
                <select id="location-filter" value={selectedLocation} onChange={event => setSelectedLocation(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="all">Tous les lieux</option>
                  {filterOptions.locations.map(location => <option key={location.value} value={location.value}>{location.label}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="server-filter">Serveur</Label>
                <select id="server-filter" value={selectedServer} onChange={event => setSelectedServer(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="all">Tous les serveurs</option>
                  {filterOptions.servers.map(server => <option key={server.id} value={server.id}>{server.full_name}</option>)}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Revenue Chart */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Évolution des revenus</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => [`${value.toLocaleString()} FCFA`, '']} />
              <Legend />
              <Bar dataKey="actualRevenue" fill="#10b981" name="Revenus réels" />
              <Bar dataKey="lostRevenue" fill="#ef4444" name="Manque à gagner" />
              <Bar dataKey="netRevenue" fill="#3b82f6" name="Revenus nets" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Chiffre d'affaires net
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-700 mb-2">
              {netRevenue.toLocaleString()} FCFA
            </div>
            <div className="text-sm text-gray-600">
              Revenus réels - Manque à gagner
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Revenus totaux
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700 mb-2">
              {totalRevenue.toLocaleString()} FCFA
            </div>
            <div className="text-sm text-gray-600">
              Commandes non annulées ou remboursées
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-red-600" />
              Manque à gagner
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-700 mb-2">
              {totalLostRevenue.toLocaleString()} FCFA
            </div>
            <div className="text-sm text-gray-600">
              Commandes annulées et remboursées
            </div>
          </CardContent>
        </Card>
      </div>

      <section className="mb-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Résultat après taxes et charges</h2>
            <p className="text-sm text-gray-500">Période sélectionnée, toutes zones et tous serveurs confondus.</p>
          </div>
          <Link to="/admin/finance/expenses" className="text-sm font-medium text-blue-700 underline">Ouvrir l’onglet Dépenses</Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[
            ['Ventes TTC', profitSummary?.revenueWithTax],
            ['Taxes incluses', profitSummary?.taxTotal],
            ['Ventes hors taxes', profitSummary?.salesBeforeTax],
            ['Coût du stock vendu', profitSummary?.costOfGoodsSold],
            ['Charges courantes', profitSummary?.operatingExpenses],
            ['Bénéfice estimé', profitSummary?.netProfit],
            ['Achats de stock payés', profitSummary?.stockPurchases]
          ].map(([label, value]) => (
            <Card key={label}><CardHeader className="pb-2"><CardTitle className="text-sm text-gray-600">{label}</CardTitle></CardHeader><CardContent><p className={`text-2xl font-bold ${label === 'Bénéfice estimé' ? 'text-green-700' : 'text-gray-900'}`}>{Number(value || 0).toLocaleString()} FCFA</p></CardContent></Card>
          ))}
        </div>
        {profitSummary?.uncostedQuantity > 0 && <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-800">Coût d’achat manquant pour {profitSummary.uncostedQuantity} article(s) vendu(s). Le bénéfice affiché est incomplet pour ces articles.</p>}
        {profitSummary?.taxBreakdown?.length > 0 && (
          <Card className="mt-5">
            <CardHeader><CardTitle className="text-base">Taxes collectées par taux</CardTitle></CardHeader>
            <CardContent><Table><TableHeader><TableRow><TableHead>Taxe</TableHead><TableHead className="text-right">Taux</TableHead><TableHead className="text-right">Montant</TableHead></TableRow></TableHeader><TableBody>
              {profitSummary.taxBreakdown.map(tax => <TableRow key={tax.id}><TableCell>{tax.name}</TableCell><TableCell className="text-right">{tax.rate.toFixed(2)} %</TableCell><TableCell className="text-right">{Number(tax.amount).toLocaleString()} FCFA</TableCell></TableRow>)}
            </TableBody></Table></CardContent>
          </Card>
        )}
      </section>



      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-600" />
              Top Produits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead className="text-right">Quantité</TableHead>
                  <TableHead className="text-right">Revenus</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProducts.map((product, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="text-right">{product.quantity}</TableCell>
                    <TableCell className="text-right">{product.revenue.toLocaleString()} FCFA</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Top Customers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-600" />
              Top Clients
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Commandes</TableHead>
                  <TableHead className="text-right">Dépenses</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topCustomers.map((customer, index) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{customer.name}</div>
                        <div className="text-sm text-gray-500">{customer.email}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{customer.orderCount}</TableCell>
                    <TableCell className="text-right">{customer.totalSpent.toLocaleString()} FCFA</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary" className="flex items-center gap-1 w-fit ml-auto">
                        <Star className="w-3 h-3" />
                        {customer.loyaltyPoints}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-teal-600" />
              Top lieux
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lieu</TableHead>
                  <TableHead className="text-right">Commandes</TableHead>
                  <TableHead className="text-right">Chiffre d’affaires</TableHead>
                  <TableHead className="text-right">Manque à gagner</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topLocations.map(location => (
                  <TableRow key={location.location}>
                    <TableCell className="font-medium">{location.location === 'non_renseigne' ? 'Lieu non renseigné' : locationName(location.location)}</TableCell>
                    <TableCell className="text-right">{location.orders}</TableCell>
                    <TableCell className="text-right">{location.revenue.toLocaleString()} FCFA</TableCell>
                    <TableCell className="text-right text-red-600">{location.lostRevenue.toLocaleString()} FCFA</TableCell>
                  </TableRow>
                ))}
                {!topLocations.length && <TableRow><TableCell colSpan={4} className="text-center text-gray-500">Aucune donnée pour ces filtres</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-600" />
              Top serveurs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serveur</TableHead>
                  <TableHead className="text-right">Commandes</TableHead>
                  <TableHead className="text-right">Chiffre d’affaires</TableHead>
                  <TableHead className="text-right">Manque à gagner</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topServers.map(server => (
                  <TableRow key={server.id}>
                    <TableCell className="font-medium">{server.name}</TableCell>
                    <TableCell className="text-right">{server.orders}</TableCell>
                    <TableCell className="text-right">{server.revenue.toLocaleString()} FCFA</TableCell>
                    <TableCell className="text-right text-red-600">{server.lostRevenue.toLocaleString()} FCFA</TableCell>
                  </TableRow>
                ))}
                {!topServers.length && <TableRow><TableCell colSpan={4} className="text-center text-gray-500">Aucune donnée pour ces filtres</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
