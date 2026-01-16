# Intégration Paiement (PayPal & Stripe)

Guide pratique pour ajouter PayPal et Stripe comme moyens de paiement **uniquement pour les commandes en livraison ou à récupérer (pickup / emporter)** dans le projet King Of Tacos.

## 1) Prérequis
- Compte PayPal Business avec accès API (client_id, client_secret).
- Compte Stripe avec clés `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, et secret de webhook.
- URL publiques (ou tunnel type ngrok) pour tester les webhooks en local.
- Base déjà migrée (Prisma + MySQL) et backend lancé sur `PORT` attendu par le frontend.

## 2) Modifications de schéma (Prisma)
Ajoutez les méthodes de paiement et un état de paiement pour tracer le flux.

```prisma
// prisma/schema.prisma
enum PaymentMethod {
  cash
  card
  mobile_money
  loyalty_points
  paypal
  stripe
}

enum PaymentStatus {
  pending
  requires_action
  paid
  failed
  refunded
}

model Order {
  id               String         @id @default(cuid())
  payment_method   PaymentMethod?
  payment_status   PaymentStatus? @default(pending)
  payment_provider_id String?     // id PayPal order ou Stripe PaymentIntent
  payment_receipt_url String?     // URL de reçu Stripe/PayPal
  ...
}
```

Puis appliquez :
```bash
cd kot-backend
npm run db:generate
npm run db:migrate
```

## 3) Variables d’environnement
Créer/compléter `kot-backend/.env` :
```env
PAYPAL_CLIENT_ID=xxx
PAYPAL_CLIENT_SECRET=xxx
PAYPAL_API_BASE=https://api-m.sandbox.paypal.com   # prod: https://api-m.paypal.com

STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:5000
```

Créer/compléter `kot-frontend/.env` :
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
REACT_APP_PAYPAL_CLIENT_ID=xxx
```

## 4) Règles métier (à respecter dans le code)
- Les paiements **PayPal/Stripe ne sont proposés que si `order_type` ∈ {`livraison`, `emporter`/`pickup`}**.
- Les commandes `sur_place` restent hors flux CB en ligne (afficher un message ou masquer les boutons).
- Le montant à payer provient du calcul serveur (ne jamais faire confiance au montant du frontend).
- `pay_on_delivery` reste autorisé uniquement pour `order_type = livraison` (déjà codé côté backend).

## 5) Backend — endpoints à ajouter (Express)
Chemin suggéré : `kot-backend/routes/payments.js`, monté sous `/api/payments`.

### 5.1 PayPal
- `POST /api/payments/paypal/create`
  - Body: `orderId` (id interne) ou payload panier.
  - Actions: recalcul montant côté serveur → appel PayPal Orders v2 `POST /v2/checkout/orders` (intent `CAPTURE`) → stocker `payment_provider_id` + `payment_method=paypal` + `payment_status=pending` → retourner `approveUrl` (links rel=approve) et `paypalOrderId`.
- `POST /api/payments/paypal/webhook`
  - Vérifier la signature (headers PayPal + certificats).
  - Gérer au minimum `CHECKOUT.ORDER.APPROVED` et `PAYMENT.CAPTURE.COMPLETED`.
  - Mettre à jour `payment_status=paid`, `status=en_preparation` (ou logique métier), `payment_receipt_url`.

### 5.2 Stripe (PaymentIntent)
- `POST /api/payments/stripe/create-intent`
  - Body: `orderId` (ou panier).
  - Actions: recalcul montant → `stripe.paymentIntents.create({ amount, currency:'usd'| 'eur', metadata:{orderId}, automatic_payment_methods:{enabled:true} })` → stocker `payment_provider_id`, `payment_method=stripe`, `payment_status=pending` → retourner `clientSecret`.
- `POST /api/payments/stripe/webhook`
  - Vérifier la signature via `stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET)`.
  - Gérer `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`.
  - Mettre à jour `payment_status` (+ éventuellement `status` de commande).

### 5.3 Points de vigilance backend
- Toujours recalculez le total à partir des `items` stockés en base (pas depuis le payload du client).
- Bloquer la création d’un paiement si `order_type` n’est pas livraison/pickup.
- Utiliser l’idempotency pour Stripe (`Idempotency-Key`) et vérifier l’état courant avant d’écraser.
- Journaliser les événements de webhook (table dédiée ou logs structurés).

## 6) Frontend — intégration (React)
Fichier clé actuel : `src/Pages/Payment.jsx`.

### 6.1 Affichage conditionnel
- Afficher les boutons PayPal/Stripe seulement si `formData.order_type` est `livraison` ou `emporter`.
- Pour `sur_place`, masquer et afficher un texte: « Paiement sur place uniquement ».

### 6.2 PayPal (Smart Buttons)
1. Charger le SDK PayPal via `<script src="https://www.paypal.com/sdk/js?client-id=...&currency=EUR"></script>` (ou composant React dédié).
2. Au `createOrder`, appeler votre endpoint `/api/payments/paypal/create` pour récupérer `paypalOrderId`.
3. Au `onApprove`, appeler `/api/payments/paypal/capture` (optionnel) ou laisser le webhook finaliser, puis rediriger vers la page succès.

### 6.3 Stripe (PaymentIntent + Elements)
1. Installer `@stripe/stripe-js` et `@stripe/react-stripe-js`.
2. Dans `Payment.jsx`, au clic « Procéder au paiement »:
   - Créer d’abord la commande (si ce n’est pas déjà fait) ou récupérer son `orderId`.
   - Appeler `/api/payments/stripe/create-intent` → obtenir `clientSecret`.
   - Afficher `Stripe Elements` (CardElement ou PaymentElement) puis `stripe.confirmCardPayment(clientSecret)`.
3. Sur succès, vider le panier + rediriger vers la page succès.
4. Sur échec, afficher l’erreur et permettre un nouveau paiement (status `requires_action`).

### 6.4 États UI
- Bouton désactivé pendant la soumission (`isSubmitting` existe déjà).
- Messages spécifiques selon `payment_status` (paid / failed / pending).

## 7) Flux conseillé (happy path)
1. Checkout → Payment page.
2. L’utilisateur choisit livraison/pickup → voit PayPal + Stripe.
3. Frontend envoie la commande (`POST /api/orders`) pour persister les items.
4. Frontend appelle le provider choisi (PayPal create order ou Stripe create-intent).
5. Le client paie → webhook confirme → backend marque `payment_status=paid` et avance le `status` de commande.
6. Frontend affiche la page succès; back-office voit la commande « payée ».

## 8) Tests à réaliser
- Livraison + PayPal (sandbox) : succès, annulation, montant incorrect.
- Pickup + Stripe : succès, carte refusée, 3DS (requires_action).
- Commande `sur_place` : vérifier que PayPal/Stripe sont masqués/refusés côté backend.
- Webhooks: rejouer avec payload signé + payload falsifié.
- Montant recalculé ≠ montant front : la requête doit échouer.

## 9) Sécurité & conformité
- Ne jamais exposer les clés secrètes au frontend.
- Forcer HTTPS en production; valider les signatures de webhook.
- Conserver les journaux de paiement (montant, devise, orderId, providerId, état).
- Prévoir la gestion des remboursements (Stripe `refunds.create`, PayPal `captures/{id}/refund`).

## 10) Déploiement
- Ajouter les env vars de section 3 sur vos environnements (dev/stage/prod).
- Ouvrir le port webhook (ou configurer via Stripe/PayPal Dashboard).
- Vérifier CORS sur `/api/payments/*` et `/api/orders`.
- Mettre à jour la documentation produit et former l’équipe caisse.

---

Ce guide couvre la mise en place complète de PayPal et Stripe pour les commandes en livraison ou à récupérer. Adaptez les libellés (`emporter`/`pickup`) à ce qui est utilisé dans vos formulaires et validez chaque scénario via sandbox avant la mise en production.

