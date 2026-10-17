import React, { useState, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "./utils";
import { useAuthContext } from "./contexts/AuthContext";
import {
  Home,
  UtensilsCrossed,
  ShoppingCart,
  User as UserIcon,
  LayoutDashboard,
  ChefHat,
  Coffee,
  Package,
  PackageCheck,
  Receipt,
  Users,
  Settings,
  LogOut,
  Star,
  Menu as MenuIcon,
  X,
  TrendingUp,
  MessageSquare,
  Smartphone,
  ShieldCheck,
  BookOpen
} from "lucide-react";
import { Button } from "./Components/ui/button";
import { motion } from "framer-motion";


export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthContext();
  const hasPagePermission = (key) => user?.role === 'admin' || user?.pagePermissions?.[key] === true;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  const updateCartCount = useCallback(() => {
    let cart = [];
    try {
      cart = JSON.parse(localStorage.getItem('kingoftacos_cart') || '[]');
    } catch (error) {
      console.error('Impossible de lire le panier enregistré:', error);
    }
    const total = Array.isArray(cart)
      ? cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
      : 0;
    setCartCount(total);
  }, []);

  useEffect(() => {
    updateCartCount();
    window.addEventListener('cart-updated', updateCartCount);
    window.addEventListener('storage', updateCartCount);
    return () => {
      window.removeEventListener('cart-updated', updateCartCount);
      window.removeEventListener('storage', updateCartCount);
    };
  }, [location.pathname, updateCartCount]);

  const handleLogout = async () => {
    await logout();
    navigate(createPageUrl("Home"));
  };

  const isAdminPage = location.pathname.includes('/admin');
  const isAuthPage = currentPageName === "Auth";

  if (isAuthPage) {
    return <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-yellow-50">{children}</div>;
  }

  const clientNavItems = [
    { name: "Accueil", path: "Home", icon: Home },
    { name: "Menu", path: "Menu", icon: UtensilsCrossed },
    { name: "Commandes", path: "OrdersPage", icon: PackageCheck },
    { name: "Panier", path: "Cart", icon: ShoppingCart, badge: cartCount },
    { name: user ? "Profil" : "Connexion", path: user ? "Profile" : "Login", icon: UserIcon }
  ];

  const adminNavItems = [
    { name: "Dashboard", path: "AdminDashboard", permission: "dashboard", icon: LayoutDashboard },
    { name: "Prendre une commande", path: "NewRestaurantOrder", permission: "orders", icon: ShoppingCart },
    { name: "Commandes", path: "AdminOrders", permission: "orders", icon: ShoppingCart },
    { name: "Cuisine chaude", path: "KitchenHotMode", station: "cuisine_chaude", icon: ChefHat },
    { name: "Cuisine froide", path: "KitchenColdMode", station: "cuisine_froide", icon: ChefHat },
    { name: "Bar", path: "BarMode", station: "bar", icon: Coffee },
    { name: "Caissier", path: "CashierMode", permission: "cashier", icon: Receipt },
    { name: "Finances", path: "AdminFinance", permission: "finance", icon: TrendingUp },
    { name: "Dépenses", path: "AdminExpenses", permission: "finance", icon: Receipt },
    { name: "Mobile Money", path: "AdminMobileMoney", permission: "cashier", icon: Smartphone },
    { name: "Stock", path: "AdminStock", permission: "stock", icon: Package },
    { name: user?.role === 'admin' ? "Personnel et droits" : "Personnel", path: user?.role === 'admin' ? "AdminAccess" : "AdminStaff", permission: "staff", icon: ShieldCheck },
    { name: "Fidélité", path: "AdminLoyalty", permission: "loyalty", icon: Star },
    { name: "Avis", path: "AdminReviews", permission: "reviews", icon: MessageSquare },
    { name: "Paramètres", path: "AdminSettings", permission: "settings", icon: Settings },
    { name: "Guide d’utilisation", path: "AdminGuide", staffOnly: true, icon: BookOpen }
  ];

  const canAccessAdminNavItem = (item) => {
    if (item.staffOnly) return user?.role && user.role !== 'client';
    if (!item.station) return hasPagePermission(item.permission);
    if (item.station === "bar") return hasPagePermission("bar");
    const permission = item.station === "cuisine_chaude" ? "kitchen_hot" : "kitchen_cold";
    return hasPagePermission(permission);
  };

  if (isAdminPage) {
    return (
      <div className="flex h-screen h-[100dvh] bg-gray-50">
        <style>{`
          :root {
            --king-gold: #D4AF37;
            --king-dark: #1A1A1A;
            --king-beige: #F5F1E8;
          }
        `}</style>

        {/* Sidebar */}
        <aside className={`fixed lg:static lg:top-0 top-16 left-0 bottom-0 transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 flex flex-col w-64 bg-gradient-to-b from-gray-900 to-black text-white border-r border-gray-800 z-[60]`}>
          <div className="p-6 border-b border-gray-800">
            <Link to={createPageUrl("Home")} className="flex items-center gap-3">
              <img src="/Images/LOGO-KING-OF-TACOS.jpg" alt="" className="h-10 w-10 rounded-xl bg-white object-contain" />
              <div>
                <h1 className="text-xl font-bold">King Of Tacos</h1>
                <p className="text-xs text-gray-400">Admin</p>
              </div>
            </Link>
          </div>

          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {adminNavItems.filter((item) => (item.serverOnly ? user?.role === "serveur" : canAccessAdminNavItem(item)) && (item.path !== 'AdminAccess' || user?.role === "admin")).map((item) => {
              const isActive = location.pathname === createPageUrl(item.path);
              return (
                <Link
                  key={item.path}
                  to={createPageUrl(item.path)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive 
                      ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-900 shadow-lg'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-800">
            <Button
              variant="ghost"
              className="w-full justify-start text-gray-300 hover:bg-gray-800"
              onClick={handleLogout}
            >
              <LogOut className="w-5 h-5 mr-3" />
              Déconnexion
            </Button>
          </div>
        </aside>

        {/* Header for small/medium screens */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-lg border-b border-gray-200 h-16 flex items-center justify-between px-4">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <MenuIcon className="w-6 h-6" />
          </Button>
          <div className="flex items-center gap-2">
            <img src="/Images/LOGO-KING-OF-TACOS.jpg" alt="" className="h-9 w-9 rounded-lg bg-white object-contain" />
            <h1 className="text-base font-bold sm:text-xl">King Of Tacos</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="w-5 h-5" />
          </Button>
        </div>

        {/* Overlay for mobile/medium */}
        <div className={`${sidebarOpen ? 'block' : 'hidden'} lg:hidden fixed inset-0 z-40 bg-black/50`} onClick={() => setSidebarOpen(false)} />

        {/* Main Content */}
        <main className="flex-1 overflow-auto lg:pt-0 pt-16">
          {children}
        </main>
      </div>
    );
  }

  // Client Layout
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-yellow-50">
      <style>{`
        :root {
          --king-gold: #D4AF37;
          --king-dark: #1A1A1A;
          --king-beige: #F5F1E8;
        }
      `}</style>

      {/* Desktop Header */}
      <header className="hidden md:block sticky top-0 z-50 bg-white/90 backdrop-blur-lg border-b border-gray-200">
        <div className="w-full px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to={createPageUrl("Home")} className="flex items-center gap-3">
              <img src="/Images/LOGO-KING-OF-TACOS.jpg" alt="" className="h-12 w-12 rounded-2xl bg-white object-contain shadow-sm" />
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-yellow-500 bg-clip-text text-transparent">
                  King Of Tacos
                </h1>
                <p className="text-xs text-gray-500">Le meilleur des tacos</p>
              </div>
            </Link>

            <nav className="flex items-center gap-2">
              {clientNavItems.map((item) => {
                const isActive = location.pathname === createPageUrl(item.path);
                return (
                  <Link
                    key={item.path}
                    to={createPageUrl(item.path)}
                    className={`relative flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-900 shadow-lg'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{item.name}</span>
                    {item.badge > 0 && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold"
                      >
                        {item.badge}
                      </motion.span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-pb">
        <div className="flex items-center px-2 py-3">
          {clientNavItems.map((item) => {
            const isActive = location.pathname === createPageUrl(item.path);
            return (
              <Link
                key={item.path}
                to={createPageUrl(item.path)}
                className={`relative flex min-w-0 flex-1 flex-col items-center gap-1 px-0.5 py-2 rounded-xl transition-all duration-200 ${
                  isActive ? 'text-amber-600' : 'text-gray-500'
                }`}
              >
                <item.icon className={`w-6 h-6 ${isActive ? 'scale-110' : ''}`} />
                <span className="whitespace-nowrap text-[10px] font-medium sm:text-xs">{item.name}</span>
                {item.badge > 0 && (
                  <span className="absolute top-0 right-2 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Main Content */}
      <main className="pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </main>

      <footer className="border-t border-gray-800 bg-black px-6 pt-8 pb-[calc(6rem+env(safe-area-inset-bottom))] text-sm text-gray-300 md:pb-8">
        <div className="flex w-full flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-semibold text-white">King Of Tacos</p>
            <p className="mt-1">Restaurant · Gabon</p>
          </div>
          <nav aria-label="Informations légales" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/mentions-legales" className="hover:text-amber-400">Mentions légales</Link>
            <Link to="/conditions-generales" className="hover:text-amber-400">Conditions générales</Link>
            <Link to="/confidentialite" className="hover:text-amber-400">Confidentialité</Link>
            <Link to="/livraison-annulation" className="hover:text-amber-400">Retrait, livraison et annulation</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
