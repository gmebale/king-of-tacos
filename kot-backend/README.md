# King Of Tacos - Backend

API backend pour l'application King Of Tacos, développée avec Express.js et Prisma.

## 🚀 Fonctionnalités

- **Authentification JWT** : Inscription, connexion, gestion du profil
- **Gestion des Produits** : CRUD complet (admin seulement)
- **Gestion des Commandes** : Création, mise à jour du statut, filtrage
- **Rôles utilisateurs** : Client, Staff, Admin
- **Base de données MySQL** via XAMPP

## 🛠️ Technologies Utilisées

- **Express.js** - Framework Node.js
- **Prisma** - ORM pour la base de données
- **MySQL** - Base de données
- **JWT** - Authentification
- **bcryptjs** - Hashage des mots de passe
- **CORS** - Gestion des requêtes cross-origin

## 📁 Structure du Projet

```
kot-backend/
├── prisma/
│   ├── schema.prisma          # Schéma de la base de données
│   └── migrations/            # Migrations Prisma
├── routes/
│   ├── auth.js                # Routes d'authentification
│   ├── products.js            # Routes des produits
│   └── orders.js              # Routes des commandes
├── middleware/
│   └── auth.js                # Middleware d'authentification
├── server.js                  # Point d'entrée de l'application
├── package.json
├── .env                       # Variables d'environnement
└── README.md
```

## 🚀 Installation et Démarrage

### Prérequis
- Node.js (version 16+)
- XAMPP (avec MySQL démarré)
- Base de données `king_of_tacos` créée dans phpMyAdmin

### Installation
```bash
# Installer les dépendances
npm install

# Générer le client Prisma
npm run db:generate

# Pousser le schéma vers la base de données
npm run db:push
```

### Démarrage
```bash
# Mode développement (avec nodemon)
npm run dev

# Mode production
npm start
```

L'API sera accessible sur `http://localhost:5000`

## 🔧 Configuration

### Variables d'environnement (.env)
```env
DATABASE_URL="mysql://root:@localhost:3306/king_of_tacos"
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
PORT=5000
```

### Base de données
Assurez-vous que XAMPP est démarré et que la base `king_of_tacos` existe.

## 📡 API Endpoints

### Authentification
- `POST /api/auth/register` - Inscription
- `POST /api/auth/login` - Connexion
- `GET /api/auth/me` - Profil utilisateur (auth requis)
- `PUT /api/auth/profile` - Mise à jour du profil (auth requis)
- `PUT /api/auth/change-password` - Changement de mot de passe (auth requis)
- `POST /api/auth/logout` - Déconnexion

### Produits
- `GET /api/products` - Liste des produits
- `GET /api/products/:id` - Détail d'un produit
- `POST /api/products` - Créer un produit (admin)
- `PUT /api/products/:id` - Modifier un produit (admin)
- `DELETE /api/products/:id` - Supprimer un produit (admin)

### Commandes
- `GET /api/orders` - Liste des commandes (admin/staff)
- `GET /api/orders/my-orders` - Mes commandes (auth requis)
- `GET /api/orders/:id` - Détail d'une commande
- `POST /api/orders` - Créer une commande (auth requis)
- `PUT /api/orders/:id` - Modifier le statut (admin/staff)
- `DELETE /api/orders/:id` - Supprimer une commande (admin)
- `GET /api/orders/filter` - Filtrer les commandes (admin/staff)

## 🔒 Authentification

L'API utilise JWT pour l'authentification. Incluez le token dans l'en-tête Authorization :

```
Authorization: Bearer <your-jwt-token>
```

## 🧪 Tests

Utilisez Postman ou un outil similaire pour tester les endpoints.

### Exemple de création d'utilisateur admin
Après avoir poussé le schéma, vous pouvez créer un utilisateur admin directement dans la base ou via une requête POST.

## 📊 Prisma Studio

Pour visualiser et modifier les données :

```bash
npm run db:studio
```

Ouvre une interface web sur `http://localhost:5555`

## 🔧 Scripts Disponibles

- `npm start` - Démarre le serveur en production
- `npm run dev` - Démarre le serveur en développement (avec nodemon)
- `npm run db:generate` - Génère le client Prisma
- `npm run db:push` - Pousse le schéma vers la DB
- `npm run db:migrate` - Crée et applique des migrations
- `npm run db:studio` - Ouvre Prisma Studio

## 🚨 Gestion d'Erreurs

L'API retourne des erreurs standardisées :
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

## 🔒 Sécurité

- Mots de passe hashés avec bcrypt
- Tokens JWT avec expiration
- Validation des rôles utilisateur
- Protection contre les injections SQL via Prisma

## 📞 Support

Pour toute question, consultez la documentation ou ouvrez une issue.

---

**King Of Tacos** - L'excellence culinaire à portée d'API ! 🌮
