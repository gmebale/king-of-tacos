# King Of Tacos - Full Stack Restaurant Management System

Un système complet de gestion de restaurant de tacos avec interface client et administrateur, backend opérationnel et base de données MySQL.

## 🌮 À Propos

King Of Tacos est une application web full-stack permettant de gérer un restaurant de tacos. Elle offre une expérience client fluide pour commander des tacos personnalisés et un panel d'administration complet pour gérer le stock, les commandes et le personnel.

## 🚀 Fonctionnalités

### Interface Client
- 🏠 Page d'accueil avec présentation du restaurant
- 🍽️ Menu interactif avec personnalisation des tacos
- 🛒 Panier intelligent avec gestion des quantités
- 📋 Processus de commande complet avec suivi des statuts
- 👤 Gestion du profil utilisateur (inscription, connexion, mise à jour)

### Interface Administrateur
- 📊 Dashboard avec statistiques en temps réel (revenus, commandes, stock)
- 📦 Gestion complète du stock avec alertes de rupture
- 📋 Gestion des commandes (en attente, préparation, livraison)
- 👥 Gestion du personnel (rôles admin/staff)
- ⚙️ Paramètres système et gestion des utilisateurs
- 📈 Rapports financiers avancés avec graphiques et filtres
- 💰 Système de points de fidélité pour les clients

### Fonctionnalités Techniques
- 🔐 Authentification JWT avec rôles utilisateurs
- 💾 Base de données opérationnelle MySQL via Prisma
- 🔄 API REST complète pour toutes les opérations
- 📱 Interface responsive (mobile, tablette, desktop)
- 🎨 Design moderne avec TailwindCSS et animations Framer Motion
- 📊 Graphiques interactifs avec Recharts
- 🔄 Mise à jour temps réel des données

## 📈 État du Développement

L'application **King Of Tacos** est actuellement **environ à 70-80% complète**. Les fonctionnalités core sont opérationnelles :

### ✅ Fonctionnalités Implémentées
- Interface client complète (menu, panier, commandes)
- Système d'authentification avec rôles
- Dashboard administrateur avec gestion des commandes et stock
- Système de rapports financiers avec graphiques
- Programme de fidélité basique
- API REST complète
- Interface responsive et moderne

### 🔄 En Cours / À Finaliser
- Migration Prisma pour les points de fidélité (nécessite exécution)
- Tests automatisés complets
- Optimisations de performance
- Documentation API étendue

### 🎯 Prochaines Étapes Immédiates
- Exécuter la migration Prisma pour `loyalty_points`
- Tester le système de finance en production
- Ajouter des tests unitaires et d'intégration
- Préparer pour le déploiement

## 🛠️ Technologies Utilisées

### Backend
- **Node.js** - Runtime JavaScript
- **Express.js** - Framework web
- **Prisma** - ORM et migrations base de données
- **MySQL** - Base de données relationnelle
- **JWT** - Authentification
- **bcryptjs** - Hashage des mots de passe
- **CORS** - Gestion des requêtes cross-origin

### Frontend
- **React 18** - Bibliothèque UI
- **React Router** - Routing et navigation
- **TailwindCSS** - Framework CSS utilitaire
- **Framer Motion** - Animations et transitions
- **Axios** - Client HTTP
- **React Hook Form** - Gestion des formulaires
- **Lucide React** - Icônes
- **Zustand** - Gestion d'état (préparé)

### Outils de Développement
- **Vite** - Build tool et dev server
- **ESLint** - Linting JavaScript
- **Prettier** - Formatage du code
- **Prisma Studio** - Interface graphique base de données

## 📁 Structure du Projet

```
king-of-tacos/
├── kot-backend/                 # API Backend
│   ├── prisma/
│   │   ├── schema.prisma       # Schéma base de données
│   │   └── migrations/         # Migrations Prisma
│   ├── routes/
│   │   ├── auth.js            # Authentification
│   │   ├── products.js        # Gestion produits
│   │   ├── orders.js          # Gestion commandes
│   │   └── users.js           # Gestion utilisateurs (admin)
│   ├── middleware/
│   │   └── auth.js            # Middleware JWT
│   ├── server.js              # Point d'entrée
│   ├── package.json
│   └── README.md
├── kot-frontend/                # Application Frontend
│   ├── public/
│   ├── src/
│   │   ├── components/         # Composants réutilisables
│   │   ├── pages/             # Pages de l'application
│   │   ├── entities/          # Classes métier
│   │   ├── services/          # Services API
│   │   ├── hooks/             # Hooks personnalisés
│   │   └── utils/             # Utilitaires
│   ├── package.json
│   └── README.md
└── README.md                    # Ce fichier
```

## 🚀 Installation et Démarrage

### Prérequis
- **Node.js** version 16 ou supérieure
- **XAMPP** avec MySQL démarré (ou tout serveur MySQL)
- **npm** ou **yarn**

### 1. Clonage du Repository
```bash
git clone <repository-url>
cd king-of-tacos
```

### 2. Configuration de la Base de Données
1. Démarrer XAMPP et activer MySQL
2. Créer une base de données nommée `king_of_tacos` dans phpMyAdmin
3. Noter les identifiants de connexion (généralement root/ vide)

### 3. Configuration Backend
```bash
cd kot-backend

# Installer les dépendances
npm install

# Créer le fichier .env
cp .env.example .env
# Éditer .env avec vos paramètres :
# DATABASE_URL="mysql://root:@localhost:3306/king_of_tacos"
# JWT_SECRET="votre-cle-secrete-très-longue-et-complexe"

# Générer le client Prisma
npm run db:generate

# Appliquer le schéma à la base de données
npm run db:push
```

### 4. Configuration Frontend
```bash
cd ../kot-frontend

# Installer les dépendances
npm install

# Créer le fichier .env (optionnel)
# REACT_APP_API_URL=http://localhost:5000/api
```

### 5. Démarrage des Services

#### Terminal 1 - Backend
```bash
cd kot-backend
npm run dev
```
Le backend sera accessible sur `http://localhost:5000`

#### Terminal 2 - Frontend
```bash
cd kot-frontend
npm start
```
Le frontend sera accessible sur `http://localhost:3000`

### 6. Création d'un Utilisateur Admin
Après le premier démarrage, créez un admin via une requête POST ou directement en base :

```bash
# Via curl
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@kingoftacos.com",
    "password": "admin123",
    "full_name": "Administrateur",
    "phone": "+221 77 123 45 67"
  }'
```

Puis mettez à jour le rôle en admin dans la base de données.

## 🔧 Configuration Avancée

### Variables d'Environnement Backend (.env)
```env
DATABASE_URL="mysql://username:password@localhost:3306/king_of_tacos"
JWT_SECRET="votre-cle-secrete-jwt-production"
PORT=5000
NODE_ENV=development
```

### Variables d'Environnement Frontend (.env)
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_ENVIRONMENT=development
```

### Configuration Prisma
Le schéma est défini dans `kot-backend/prisma/schema.prisma`. Pour des modifications :
```bash
# Créer une migration
npx prisma migrate dev --name nom-de-la-migration

# Appliquer les migrations
npx prisma migrate deploy
```

## 📡 API Endpoints

### Authentification
- `POST /api/auth/register` - Inscription
- `POST /api/auth/login` - Connexion
- `GET /api/auth/me` - Profil utilisateur
- `PUT /api/auth/profile` - Mise à jour profil
- `PUT /api/auth/change-password` - Changement mot de passe
- `POST /api/auth/logout` - Déconnexion

### Produits
- `GET /api/products` - Liste des produits
- `GET /api/products/:id` - Détail produit
- `POST /api/products` - Créer produit (admin)
- `PUT /api/products/:id` - Modifier produit (admin)
- `DELETE /api/products/:id` - Supprimer produit (admin)

### Commandes
- `GET /api/orders` - Liste commandes (admin/staff)
- `GET /api/orders/my-orders` - Mes commandes
- `GET /api/orders/:id` - Détail commande
- `POST /api/orders` - Créer commande
- `PUT /api/orders/:id` - Modifier statut (admin/staff)
- `DELETE /api/orders/:id` - Supprimer commande (admin)
- `GET /api/orders/filter` - Filtrer commandes (admin/staff)

### Utilisateurs (Admin)
- `GET /api/users` - Liste utilisateurs (admin)
- `GET /api/users/:id` - Détail utilisateur (admin)
- `PUT /api/users/:id` - Modifier utilisateur (admin)
- `DELETE /api/users/:id` - Supprimer utilisateur (admin)

## 🔒 Authentification et Autorisation

L'API utilise JWT pour l'authentification. Incluez le token dans les headers :
```
Authorization: Bearer <votre-token-jwt>
```

### Rôles Utilisateurs
- **client** : Accès aux commandes et profil
- **staff** : Gestion des commandes et statuts
- **admin** : Accès complet à toutes les fonctionnalités

## 🧪 Tests

### Tests API (Backend)
```bash
cd kot-backend
npm test
```

### Tests Frontend
```bash
cd kot-frontend
npm test
```

### Tests End-to-End
Utilisez Postman ou Insomnia pour tester les endpoints :
- Importez la collection `postman_collection.json`
- Configurez les variables d'environnement
- Testez les scénarios d'authentification et CRUD

## 📊 Prisma Studio

Pour visualiser et modifier les données :
```bash
cd kot-backend
npm run db:studio
```
Ouvre `http://localhost:5555`

## 🚀 Déploiement

### Backend
```bash
cd kot-backend
npm run build
npm start
```

### Frontend
```bash
cd kot-frontend
npm run build
# Servir le dossier build/ avec nginx/apache
```

### Docker (Optionnel)
```bash
# Build des images
docker-compose build

# Démarrage
docker-compose up
```

## 🔧 Scripts Disponibles

### Backend
- `npm start` - Production
- `npm run dev` - Développement (nodemon)
- `npm run db:generate` - Générer client Prisma
- `npm run db:push` - Pousser schéma DB
- `npm run db:migrate` - Créer/appliquer migrations
- `npm run db:studio` - Ouvrir Prisma Studio
- `npm test` - Tests

### Frontend
- `npm start` - Dev server
- `npm run build` - Build production
- `npm test` - Tests
- `npm run eject` - Éjecter CRA

## 🐛 Dépannage

### Problèmes Courants

**Erreur de connexion DB**
- Vérifiez que MySQL est démarré dans XAMPP
- Vérifiez les identifiants dans `.env`
- Vérifiez que la base `king_of_tacos` existe

**Erreur JWT**
- Vérifiez la variable `JWT_SECRET` dans `.env`
- Redémarrez le serveur après modification

**CORS errors**
- Vérifiez que le frontend appelle la bonne URL d'API
- Le backend accepte par défaut toutes les origines

**Prisma errors**
```bash
# Régénérer le client
npm run db:generate

# Reset la DB (attention, données perdues)
npm run db:push --force-reset
```

## 🤝 Contribution

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/AmazingFeature`)
3. Commit les changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

### Standards de Code
- Utiliser ESLint et Prettier
- Commits en anglais
- Tests pour les nouvelles fonctionnalités
- Documentation des endpoints API

## 📝 Licence

Ce projet est sous licence MIT - voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 📞 Support

Pour toute question :
- Ouvrir une issue sur GitHub
- Contacter l'équipe de développement
- Consulter la documentation API

## 🎯 Roadmap

### ✅ Version 1.0 (Actuelle - 70-80% Complète)
- [x] Système de commandes client complet
- [x] Dashboard administrateur avec gestion des commandes
- [x] Gestion du stock avec alertes
- [x] Système de rapports financiers avec graphiques
- [x] Authentification avec rôles (client/staff/admin)
- [x] Programme de fidélité basique
- [x] Interface responsive moderne

### 🔄 Version 1.1 (Prochaines Étapes Immédiates)
- [ ] Migration Prisma pour points de fidélité
- [ ] Tests automatisés complets
- [ ] Optimisations de performance
- [ ] Documentation API étendue

### 🚀 Version 2.0 (Perspectives d'Avenir)
- [ ] **Intégration Paiement** : Stripe/PayPal pour paiements en ligne sécurisés
- [ ] **Notifications Push** : Alertes temps réel pour statuts de commandes
- [ ] **Application Mobile** : React Native pour iOS/Android
- [ ] **Mode Hors-Ligne** : Fonctionnalité PWA avec synchronisation
- [ ] **Analytics Avancés** : Tableaux de bord détaillés, prédictions de ventes
- [ ] **Programme de Fidélité Évolué** : Récompenses, niveaux VIP, parrainage
- [ ] **Intégration Réseaux Sociaux** : Partage de commandes, avis clients
- [ ] **Système de Réservations** : Tables et événements spéciaux
- [ ] **Multi-Restaurants** : Gestion de plusieurs établissements
- [ ] **IA/ML** : Recommandations personnalisées, optimisation des stocks

### 🎨 Améliorations UI/UX
- [ ] **Thème Sombre** : Mode nuit pour confort visuel
- [ ] **Internationalisation (i18n)** : Support multi-langues
- [ ] **Accessibilité (WCAG)** : Conformité pour tous les utilisateurs
- [ ] **Performance PWA** : Installation comme app native
- [ ] **Animations Avancées** : Micro-interactions, transitions fluides
- [ ] **Design System** : Bibliothèque de composants cohérente

### 🔧 Améliorations Techniques
- [ ] **Tests End-to-End** : Cypress ou Playwright
- [ ] **Monitoring** : Logs, métriques, alertes
- [ ] **Sécurité** : Audit, chiffrement avancé
- [ ] **API GraphQL** : Alternative à REST pour flexibilité
- [ ] **Microservices** : Architecture évolutive
- [ ] **CI/CD** : Déploiement automatisé

---

**King Of Tacos** - L'excellence culinaire à portée de clic ! 🌮
