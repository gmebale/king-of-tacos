import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "./utils";
import { useAuthContext } from "./contexts/AuthContext";
import {
  Home,
  UtensilsCrossed,
  ShoppingCart,
  User as UserIcon,
  LayoutDashboard,
  Package,
  Users,
  Settings,
  LogOut,
  Menu as MenuIcon,
  X,
  TrendingUp
} from "lucide-react";
import { Button } from "./Components/ui/button";
import { motion } from "framer-motion";


export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthContext();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    updateCartCount();
  }, []);

  const updateCartCount = () => {
    const cart = JSON.parse(localStorage.getItem('kingoftacos_cart') || '[]');
    const total = cart.reduce((sum, item) => sum + item.quantity, 0);
    setCartCount(total);
  };

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
    { name: "Panier", path: "Cart", icon: ShoppingCart, badge: cartCount },
    { name: user ? "Profil" : "Connexion", path: user ? "Profile" : "Login", icon: UserIcon }
  ];

  const adminNavItems = [
    { name: "Dashboard", path: "AdminDashboard", icon: LayoutDashboard },
    { name: "Commandes", path: "AdminOrders", icon: ShoppingCart },
    { name: "Finances", path: "AdminFinance", icon: TrendingUp },
    { name: "Stock", path: "AdminStock", icon: Package },
    { name: "Personnel", path: "AdminStaff", icon: Users },
    { name: "Paramètres", path: "AdminSettings", icon: Settings }
  ];

  if (isAdminPage) {
    return (
      <div className="flex h-screen bg-gray-50">
        <style>{`
          :root {
            --king-gold: #D4AF37;
            --king-dark: #1A1A1A;
            --king-beige: #F5F1E8;
          }
        `}</style>

        {/* Sidebar */}
        <aside className={`fixed lg:static lg:top-0 top-16 left-0 h-full transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:flex lg:flex-col w-64 bg-gradient-to-b from-gray-900 to-black text-white border-r border-gray-800 z-[60]`}>
          <div className="p-6 border-b border-gray-800">
            <Link to={createPageUrl("Home")} className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-amber-600 rounded-xl flex items-center justify-center">
                <UtensilsCrossed className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">King Of Tacos</h1>
                <p className="text-xs text-gray-400">Admin</p>
              </div>
            </Link>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {adminNavItems.map((item) => {
              const isActive = location.pathname === createPageUrl(item.path);
              return (
                <Link
                  key={item.path}
                  to={createPageUrl(item.path)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive 
                      ? 'bg-gradient-to-r from-yellow-500 to-amber-600 text-white shadow-lg' 
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
          <h1 className="text-xl font-bold">King Of Tacos</h1>
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
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to={createPageUrl("Home")} className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg">
                <UtensilsCrossed className="w-7 h-7 text-white" />
              </div>
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
                        ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white shadow-lg'
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
        <div className="flex items-center justify-around px-2 py-3">
          {clientNavItems.map((item) => {
            const isActive = location.pathname === createPageUrl(item.path);
            return (
              <Link
                key={item.path}
                to={createPageUrl(item.path)}
                className={`relative flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-200 ${
                  isActive ? 'text-amber-600' : 'text-gray-500'
                }`}
              >
                <item.icon className={`w-6 h-6 ${isActive ? 'scale-110' : ''}`} />
                <span className="text-xs font-medium">{item.name}</span>
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
      <main className="pb-20 md:pb-0">
        {children}
      </main>
    </div>
  );
}