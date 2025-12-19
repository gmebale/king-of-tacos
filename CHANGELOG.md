# Changelog - King Of Tacos

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.0] - 2024-10-XX

### Added
#### Backend Features
- **Authentication System**
  - JWT-based authentication with role management (client, staff, admin)
  - Google OAuth integration for seamless login
  - Password hashing with bcryptjs
  - User registration and login endpoints
  - Profile management (update profile, change password)

- **Product Management**
  - CRUD operations for products (admin only)
  - Product categories (tacos, boissons, desserts)
  - Stock management with alert thresholds
  - Discount percentage support
  - Image upload functionality (multer integration)

- **Order Management**
  - Guest and authenticated user order creation
  - Order status tracking (en_attente, en_preparation, prete, livree, annulee)
  - Order filtering and pagination
  - Customer information storage
  - Order notes and special instructions
  - Loyalty points assignment on order completion

- **User Management**
  - Admin CRUD operations for users
  - Role-based access control
  - User listing with pagination

- **Loyalty System**
  - Points accumulation (5 points per completed order)
  - Reward redemption system
  - Admin management of loyalty rewards
  - Promo code system with validation
  - Usage limits and expiration dates

- **Finance & Reporting**
  - Revenue tracking and statistics
  - Order analytics
  - Financial reports with date filtering

- **Kitchen & Cashier Interfaces**
  - Real-time order status updates
  - Kitchen order management
  - Cashier order processing

- **File Upload**
  - Image upload for products
  - Static file serving

#### Frontend Features
- **Client Interface**
  - Responsive menu display with categories
  - Product search and filtering
  - Shopping cart with local storage persistence
  - Order placement with customer details
  - User registration and login
  - Profile management
  - Order history tracking

- **Admin Dashboard**
  - Real-time statistics (revenue, orders, pending orders, stock alerts)
  - Recent orders widget
  - Low stock alerts
  - Revenue charts and analytics
  - User management interface
  - Product management with form dialogs
  - Order management and status updates
  - Loyalty and promo code administration

- **Kitchen Mode**
  - Order queue management
  - Status updates (en_attente → en_preparation → prete)
  - Real-time order refresh
  - Order details display

- **Cashier Mode**
  - Order processing interface
  - Status management
  - Customer information display

#### Database Schema
- **User Model**: Authentication, roles, loyalty points
- **Product Model**: Inventory management, pricing, categories
- **Order Model**: Complete order lifecycle tracking
- **OrderItem Model**: Order line items
- **LoyaltyReward Model**: Reward definitions
- **LoyaltyRedemption Model**: Redemption tracking
- **PromoCode Model**: Discount code management

#### Technical Infrastructure
- **API Endpoints**: Complete REST API with proper error handling
- **Middleware**: Authentication, role-based authorization, CORS
- **Database**: MySQL with Prisma ORM and migrations
- **Frontend**: React 18 with modern hooks, routing, and state management
- **Styling**: TailwindCSS with custom components and animations
- **Build Tools**: Vite for development, optimized production builds

### Technical Details
- **Backend**: Node.js, Express.js, Prisma, MySQL
- **Frontend**: React, React Router, Axios, Framer Motion
- **Authentication**: JWT + Google OAuth
- **Database**: MySQL with Prisma migrations
- **Deployment Ready**: Environment configuration, static file serving

### Known Issues
- Loyalty points migration needs to be executed
- Some tests are pending implementation
- Performance optimizations for large datasets

### Next Steps
- Execute Prisma migration for loyalty_points
- Implement comprehensive test suite
- Add performance monitoring
- Prepare for production deployment

---

## Types of changes
- `Added` for new features
- `Changed` for changes in existing functionality
- `Deprecated` for soon-to-be removed features
- `Removed` for now removed features
- `Fixed` for any bug fixes
- `Security` in case of vulnerabilities

[0.8.0]: https://github.com/gmebale/king-of-tacos/releases/tag/v0.8.0
