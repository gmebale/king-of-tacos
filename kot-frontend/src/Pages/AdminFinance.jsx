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
  LineChart,
  Line,
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
      const [revenueRes, productsRes, customersRes, locationsRes, serversRes] = await Promise.all([
        api.get('/finance/revenue', { params }),
        api.get('/finance/top-products', { params }),
        api.get('/finance/top-customers', { params }),
        api.get('/finance/top-locations', { params }),
        api.get('/finance/top-servers', { params })
      ]);

      setRevenueData(revenueRes.data || []);
      setTopProducts(productsRes.data || []);
      setTopCustomers(customersRes.data || []);
      setTopLocations(locationsRes.data || []);
      setTopServers(serversRes.data || []);
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
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => [`${value.toLocaleString()} FCFA`, '']} />
              <Legend />
              <Line
                type="monotone"
                dataKey="actualRevenue"
                stroke="#10b981"
                strokeWidth={2}
                name="Revenus réels"
              />
              <Line
                type="monotone"
                dataKey="lostRevenue"
                stroke="#ef4444"
                strokeWidth={2}
                name="Manque à gagner"
              />
              <Line
                type="monotone"
                dataKey="netRevenue"
                stroke="#3b82f6"
                strokeWidth={2}
                name="Revenus nets"
              />
            </LineChart>
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
                    <TableCell className="font-medium">{{ salon_principal: 'Salon principal', terrasse: 'Terrasse', vip: 'Espace VIP', bar: 'Bar', non_renseigne: 'Lieu non renseigné' }[location.location]}</TableCell>
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
