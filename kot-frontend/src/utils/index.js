/**
 * Create a page URL from a page name
 * @param {string} pageName - The name of the page
 * @returns {string} The URL path for the page
 */
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
    OrdersPage: '/orders-page',
    Profile: '/profile',
    Login: '/login',
    Register: '/register',
    AdminDashboard: '/admin/dashboard',
    AdminOrders: '/admin/orders',
    KitchenMode: '/admin/kitchen',
    CashierMode: '/admin/cashier',
    AdminFinance: '/admin/finance',
    AdminStock: '/admin/stock',
    AdminStaff: '/admin/staff',
    AdminLoyalty: '/admin/loyalty',
    AdminSettings: '/admin/settings',
    AdminReviews: '/admin/reviews'
  };

  return routes[pageName] || '/';
}

/**
 * Format customization details for display
 * @param {string|object} customizationFormatted - The formatted customization string or object from backend
 * @param {object} customizationDetails - Additional customization details (optional)
 * @returns {string} Formatted string for display
 */
export function formatCustomizationForDisplay(customizationFormatted, customizationDetails = null) {
  if (!customizationFormatted) return '';

  // If it's already a string, return it
  if (typeof customizationFormatted === 'string') {
    return customizationFormatted;
  }

  // If it's an object or array, format it properly
  if (typeof customizationFormatted === 'object') {
    if (Array.isArray(customizationFormatted)) {
      // Array of customization options
      return customizationFormatted.map(option => {
        if (typeof option === 'object' && option.name) {
          return option.name;
        }
        return String(option);
      }).join(', ');
    } else {
      // Single customization object
      if (customizationFormatted.name) {
        return customizationFormatted.name;
      }
      // Fallback: convert to string representation
      return JSON.stringify(customizationFormatted);
    }
  }

  // Fallback for other types
  return String(customizationFormatted);
}
