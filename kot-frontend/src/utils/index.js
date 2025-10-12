/**
 * Create a page URL from a page name
 * @param {string} pageName - The name of the page
 * @returns {string} The URL path for the page
 */
export function createPageUrl(pageName) {
  const routes = {
    Home: '/',
    Menu: '/menu',
    Cart: '/cart',
    Checkout: '/checkout',
    Payment: '/payment',
    OrderSuccess: '/order-success',
    Profile: '/profile',
    Login: '/login',
    Register: '/register',
    AdminDashboard: '/admin/dashboard',
    AdminOrders: '/admin/orders',
    AdminFinance: '/admin/finance',
    AdminStock: '/admin/stock',
    AdminStaff: '/admin/staff',
    AdminSettings: '/admin/settings'
  };

  return routes[pageName] || '/';
}
