# Fiche technique — KOT App (Kot-Frontend / Kot-Backend)

## 1) Vue d’ensemble
Application fullstack composée de :
- **Front-end** (React) : pages de type `Menu`, `Cart` (dossier `kot-frontend/`).
- **Back-end** (Node.js/Express) : API REST sous `/api/*` (dossier `kot-backend/`).
- **Base de données** : **MySQL** via **Prisma** (`kot-backend/prisma/schema.prisma`).
- **Auth** : Passport (Google OAuth) + Apple Sign-in + JWT (register/login/me…).
- **Paiements** : Stripe (PaymentIntents + webhook) + PayPal (Orders + webhook) + “mobile money” (admin).
- **Caisse & Reporting** : sessions de caisse, workflow de commandes, génération PDF (factures + rapports).

---

## 2) Back-end — Entrée & routage

### `kot-backend/server.js`
Rôle :
- Initialise Express + CORS.
- Initialise session `express-session` + Passport (serialize/deserialize).
- Configure middleware :
  - `express.raw({ type: 'application/json' })` **spécifique Stripe webhook** sur `/api/payments/stripe/webhook`.
  - JSON standard sur le reste des routes.
- Serve les fichiers statiques :
  - `/uploads` → dossier local `uploads/`.
- Crée `PrismaClient` et branche les routes :
  - `/api/auth` → `routes/auth.js`
  - `/api/products` → `routes/products.js`
  - `/api/orders` → `routes/orders.js`
  - `/api/users` → `routes/users.js`
  - `/api/upload` → `routes/upload.js`
  - `/api/finance` → `routes/finance.js`
  - `/api/kitchen` → `routes/kitchen.js`
  - `/api/cashier` → `routes/cashier.js`
  - `/api/loyalty` → `routes/loyalty.js`
  - `/api/settings` → `routes/settings.js`
  - `/api/payments` → `routes/payments.js`
  - `/api/reviews` → `routes/reviews.js`

**Points d’attention (code)**
- `app.use(session(...))` + `passport.initialize()/passport.session()` apparaissent **deux fois** dans `server.js` (même logique avec configs différentes). Risque de comportements inattendus.

---

## 3) Modèle de données (Prisma / MySQL)

### `kot-backend/prisma/schema.prisma`
#### Enums clés
- `Role`: `client`, `staff`, `admin`
- `OrderStatus`: `en_attente`, `en_preparation`, `prete`, `en_livraison`, `livree`, `annulee`
- `PaymentMethod`: `cash`, `card`, `mobile_money`, `loyalty_points`, `paypal`, `stripe`
- `PaymentStatus`: `pending`, `requires_action`, `paid`, `failed`, `refunded`
- `Category`: `tacos`, `burritos`, `burger`, `boissons`, `accompagnements`, `desserts`, `options`
- `RewardType`: `free_delivery`, `gifted_product`, `discount`, `custom`
- `PromoType`: `percentage`, `fixed_amount`, `free_delivery`
- `ReviewStatus`: `pending`, `published`, `hidden`

#### Modèles principaux
- **User**
  - champs : email, password (nullable), google_id, apple_id, full_name, phone, role, loyalty_points, is_active…
  - relations : `orders`, `loyaltyRedemptions`, `reviews`
- **Product**
  - price en centimes, discount_percentage, catégorie, stock, stock_alert_threshold, image
  - `customization: Json?` (configuration UI/option)
  - relations : `optionFor` / `options` via `ProductOption`
- **Order**
  - `id: String @id @default(cuid())`
  - total_amount (centimes), status (OrderStatus), payment_method/status/provider…
  - info client : name/phone/email/type/delivery_address/pickup_time/notes
  - relations : `items`, `reviews`
- **OrderItem**
  - order_id, product_name, quantity, price (centimes)
  - `customization: Json?` + `customizationSummary: String?`
- **ProductOption**
  - relie un produit principal à un produit “option” (size/meat/sauce/etc.)
  - flags : `required`, `maxQuantity`, `optionType`
- **ProductCustomizationRule**
  - règles de personnalisation : par type d’option + maxQuantity, includedCount, extraPrice
- **LoyaltyReward / LoyaltyRedemption**
- **PromoCode**
- **Review**
- **CashRegisterSession**
  - opening/closing balance, current_balance
  - total_revenue + breakdown par moyen de paiement
- **Settings**
  - table clé-valeur (ex: restaurant_name, currency…).

---

## 4) Auth & identité

### `kot-backend/routes/auth.js`
#### Google OAuth
- `GET /api/auth/google` : démarre Google OAuth
- `GET /api/auth/google/callback`
  - crée/liait l’utilisateur via `google_id`
  - génère un **JWT** 24h
  - redirige vers : `${FRONTEND_URL}/login?token=${token}`

#### Apple Sign-in
- `POST /api/auth/apple`
  - vérifie `identityToken` (apple-signin-auth)
  - crée/liait via `apple_id` ou email
  - renvoie `{ token, user: { id, email, full_name, role } }`

#### Register/Login JWT
- `POST /api/auth/register` : bcrypt hash password
- `POST /api/auth/login` : compare password hash
- `GET /api/auth/me` : profil courant via `authenticateToken`
- `PUT /api/auth/profile` : full_name / phone
- `PUT /api/auth/change-password` : currentPassword + newPassword
- `POST /api/auth/logout` : “logout” côté client (token removal)

---

## 5) Produits & options dynamiques

### `kot-backend/routes/products.js`

#### Lecture
- `GET /api/products`
  - liste products triées `created_at desc`
  - renvoie : id, name, description, price, discount_percentage, category, available, image, stock, customization…
- `GET /api/products/:id`
- `GET /api/products/categories/list`
- `GET /api/products/:id/options`
  - renvoie `optionGroups` dynamiques basés sur la relation `ProductOption`
  - calcule `maxQuantity`, `includedCount`, `extraPrice` via `ProductCustomizationRule`
  - renvoie aussi `rules` (debug)

#### Admin CRUD
- `POST /api/products` (admin)
  - valide `category` via `CategoryModel`
  - si la catégorie est un des types supportés (tacos/burritos/burger),
    initialise automatiquement des options grâce à `CUSTOM_OPTION_TEMPLATES`.
  - **Auto-attach** : dépend des **noms exacts** des produits option existants
- `PUT /api/products/:id` (admin)
  - accepte `category` en string / objet `{name}` / number id
- `DELETE /api/products/:id` (admin)
  - supprime d’abord les `product_options` (liens dans les deux sens), puis le produit.

**Auto-attach templates**
- `CUSTOM_OPTION_TEMPLATES` définit :
  - sets de noms d’options (meat/sauce/extra/side/size…)
  - `required`, `maxQuantity`, `optionType`
- Fonction `attachTemplateOptions(tx, productId, categoryName)`
  - mappe les noms → IDs existants, puis `createMany(..., skipDuplicates: true)`

---

## 6) Commandes

### `kot-backend/routes/orders.js`

#### Lecture
- `GET /api/orders` (admin/staff)
  - inclut `user` et `items`
  - boucle sur chaque item :
    - recherche `Product` par `item.product_name`
    - applique un `formatCustomization()` pour construire :
      - `customizationSummary`
- `GET /api/orders/my-orders` (user connecté)
- `GET /api/orders/:id`
  - contrôle permissions (owner ou admin/staff)
  - ajoute `productCustomization` (customization JSON produit)

#### Création
- `POST /api/orders`
  - accepte un guest ou user :
    - tente de lire `Authorization: Bearer <token>` et vérifie JWT_SECRET
  - crée `Order` + `OrderItem` :
    - stocke `customization` + `customizationSummary` venant du client

#### Update
- `PUT /api/orders/:id`
  - permissions :
    - owner : seulement si status `en_attente`
    - admin/staff : peut mettre à jour `status`
  - si `items` fourni : suppression complète puis recréation `OrderItem`
  - si status devient `prete` ou `livree` :
    - incrémente `loyalty_points` (+5) pour le user lié

---

## 7) Paiements

### `kot-backend/routes/payments.js`

#### PayPal
- `POST /api/payments/paypal/create`
  - calcule montant via `order.items` (somme price*qty)
  - restreint `order_type` aux types autorisés (`livraison`, `emporter`, `pickup`)
  - obtient access token via client_id/client_secret
  - crée une commande PayPal (CAPTURE)
  - met à jour l’Order :
    - `payment_method='paypal'`, `payment_status='pending'`, `payment_provider_id=paypalOrder.id`

- `POST /api/payments/paypal/webhook`
  - extrait `orderId` depuis `reference_id`/supplementary data
  - sur `PAYMENT.CAPTURE.COMPLETED` :
    - `payment_status='paid'` + `status='en_preparation'`
  - sur `CHECKOUT.ORDER.APPROVED` :
    - `payment_status='requires_action'`

#### Stripe
- `POST /api/payments/stripe/create-intent`
  - crée PaymentIntent (amount en centimes) avec `metadata.orderId`
  - met à jour Order :
    - `payment_method='stripe'`, `payment_status='pending'`, `payment_provider_id=paymentIntent.id`

- `POST /api/payments/stripe/webhook`
  - vérifie signature Stripe avec `STRIPE_WEBHOOK_SECRET`
  - switch sur événements :
    - `payment_intent.succeeded` → `paid` + `status='en_preparation'` (via markOrderPayment)
    - `payment_intent.payment_failed` → `failed`
    - `charge.refunded` → `refunded`

#### Mobile money (admin)
- `GET /api/payments/mobile-money?status=...`
- `PUT /api/payments/mobile-money/:id/approve`
- `PUT /api/payments/mobile-money/:id/reject`
  - reject met `status='annulee'` et `payment_status='failed'`.

---

## 8) Cashier (caisse, workflow, factures, reporting)

### `kot-backend/routes/cashier.js`

#### Session de caisse
- `GET /api/cashier/session` (admin)
  - renvoie session ouverte si `closed_at: null`

- `POST /api/cashier/session/open` (admin)
  - ouverture avec `opening_balance >= 0`
  - refuse si session déjà ouverte
  - refuse si une fermeture a eu lieu **dans la journée** (limite “open seulement demain”)
  - crée `CashRegisterSession(opening_balance, current_balance)`

- `POST /api/cashier/session/close` (admin)
  - `closing_balance >= 0`
  - calcule revenue + breakdown à partir des orders :
    - fenêtre `opened_at .. now`
    - statuses `['livree','prete']`
  - met à jour `CashRegisterSession` :
    - `closed_at`, `closing_balance`, `total_revenue`, breakdown paiements

#### Vue commandes caisse
- `GET /api/cashier/orders` (admin)
  - renvoie orders dont status != `en_attente`
  - ajoute pour chaque item :
    - `customizationFormatted`
    - `customizationDetails`
  - renvoie `customer_address` (compat frontend)

#### Facture PDF
- `GET /api/cashier/invoice/:orderId` (admin)
  - génère facture PDF via pdfkit
  - tire `restaurant_name` + `currency` depuis `Settings`
  - numéro :
    - `order.order_code` ou `KOT-<prefix>`
  - tableau basé sur `item.product_name` :
    - lookup `Product` par nom
    - total basé sur `product.price` * qty
  - si produit manquant → erreur 400

#### Reporting ventes
- `GET /api/cashier/reports/:period` (admin)
  - calcule :
    - totalRevenue, totalOrders, totalItems, averageOrderValue
    - paymentBreakdown
    - topProducts (top 10)
    - catégorie → produits
    - ventes par utilisateur
- `GET /api/cashier/reports/:period/pdf` (admin)
  - PDF structuré : résumé, paiements, utilisateurs, catégories/produits

#### Workflow paiement + livraison
- `PUT /api/cashier/orders/:id/pay` (admin)
  - set `payment_method` (default cash)
  - si payment_method cash :
    - incrémente caisse (current_balance, total_revenue, cash_payments)

- `PUT /api/cashier/orders/:id/deliver` (admin)
  - si pas encore de paiement :
    - marque cash et update caisse
  - met order `status='livree'`
  - ajoute loyalty points (+5) si user_id présent

---

## 9) Points forts, limites & risques

### Points forts
- **Architecture fullstack claire** : back-end Express + front-end React, séparation en routes spécialisées (`auth`, `products`, `orders`, `payments`, `cashier`, etc.).
- **Modélisation riche Prisma** : états de commande et paiement explicites via enums, relations produit/options/commandes bien structurées.
- **Fonctionnalités métier complètes côté back-office** :
  - caisse (open/close),
  - workflow commande (pay/deliver),
  - génération PDF (factures et rapports).
- **Support multi-paiement** :
  - Stripe via PaymentIntents + webhook,
  - PayPal via Orders + webhook,
  - mobile money (workflow admin).
- **Options de personnalisation** : `ProductOption` + `ProductCustomizationRule` permettent de générer dynamiquement des groupes d’options et contraintes (required/maxQuantity/includedCount/extraPrice).

### Limites / risques
- **Fragilité due aux noms de produits**
  - `products.js` (auto-attach templates) : la création de `ProductOption` dépend d’**IDs retrouvés via `Product.name`** correspondant aux noms “template”.
  - `cashier.js` (factures / reporting partiellement) : lookup des prix et catégories basés sur `item.product_name` → risque si noms changent ou si données clients sont incohérentes.
- **Incohérence de calcul des montants**
  - Selon les endpoints, le total peut venir de `order.total_amount` ou être recomposé via `items.price * quantity` (ex : PayPal calcule sur items, certaines factures/reportings recompilent différemment).
  - Risque : divergences entre montants affichés/encaissés vs montants stockés, surtout si les prix des items changent après coup.
- **Double initialisation de sessions/Passport**
  - `server.js` contient des appels `app.use(session(...))` et `passport.initialize()/passport.session()` **à deux endroits**, avec des configs potentiellement différentes.
  - Risque : bugs difficiles à reproduire (session cookie, user attaché différemment, middlewares redondants).
- **N+1 queries et coût de performance potentiel**
  - Certains endpoints bouclent sur `orders/items` puis relisent `Product` par item (ex : personnalisation dans `cashier.js`, formatage dans `orders.js`).
  - Un preload existe déjà dans certains rapports (`buildSalesReport`), mais la facture PDF et certaines boucles restent potentiellement lourdes.
- **Exposition de données “debug”**
  - `GET /api/products/:id/options` renvoie `rules` “pour debug” en plus des `optionGroups`.
  - Risque : exposer des détails internes à l’UI/utilisateurs finaux.
- **PDF facture ne reflète pas la personnalisation dans le total**
  - Le PDF calcule le total à partir de `product.price` uniquement (prix base), sans intégrer `customizationSummary` ni la logique `priceModifier/extraPrice`.
  - Risque : facture inexacte si les options changent le prix.

### Risques sécurité (à surveiller)
- **JWT + Stripe/PayPal webhooks**
  - Les webhooks reposent sur la validation signature (Stripe) et sur extraction de metadata (PayPal). Il faut vérifier que l’extraction `orderId` est robuste dans tous les payloads.
- **Gestion du “guest order”**
  - `orders.js` tente de vérifier JWT en lisant `Authorization` manuellement (au lieu d’un middleware standard) : risque d’incohérences de logique/validation et d’erreurs de type.

### Recommandations d’amélioration (priorisées)
1) **Supprimer la double initialisation session/Passport dans `server.js`** et factoriser en un seul bloc.
2) **Éviter les dépendances au `Product.name`** pour les calculs/lookup :
   - stocker plus de références (ex: `productId`) dans `OrderItem` ou versionner les données.
3) **Unifier la source de vérité des montants**
   - soit `order.total_amount` (corrigé à la création/update),
   - soit un recalcul systématique depuis `OrderItem` (mais alors recalcul partout).
4) **Aligner factures/PDF avec la logique de prix de personnalisation**
   - intégrer `priceModifier`, `includedCount`, `extraPrice` dans le calcul affiché.
5) **Optimiser les accès Prisma**
   - preload des produits/options avant boucles (surtout `customization` et facture).
6) **Retirer `rules` du payload public** (ou contrôler via rôle/admin/feature flag).
