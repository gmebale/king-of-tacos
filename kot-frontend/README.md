# King Of Tacos - Frontend

Application frontend React pour la gestion d'un restaurant de tacos avec interface client et administrateur.

## 🚀 Fonctionnalités

### Interface Client
- 🏠 Page d'accueil avec présentation du restaurant
- 🍽️ Menu interactif avec personnalisation des tacos
- 🛒 Panier intelligent avec gestion des quantités
- 📋 Processus de commande complet
- 👤 Gestion du profil utilisateur

### Interface Administrateur
- 📊 Dashboard avec statistiques en temps réel
- 📦 Gestion du stock et alertes de rupture
- 📋 Gestion des commandes (en attente, préparation, livraison)
- 👥 Gestion du personnel
- ⚙️ Paramètres système

## 🛠️ Technologies Utilisées

- **React 18** - Framework JavaScript
- **React Router** - Routing et navigation
- **TailwindCSS** - Framework CSS utilitaire
- **Framer Motion** - Animations et transitions
- **Axios** - Client HTTP
- **Zustand** - Gestion d'état (préparé)
- **React Hook Form** - Gestion des formulaires
- **Lucide React** - Icônes

## 📁 Structure du Projet

```
src/
├── components/
│   ├── common/          # Composants réutilisables
│   │   ├── ErrorBoundary.jsx
│   │   ├── LoadingSpinner.jsx
│   │   ├── Toast.jsx
│   │   └── Modal.jsx
│   └── [autres composants...]
├── hooks/               # Hooks personnalisés
│   ├── useCart.js       # Gestion du panier
│   ├── useAuth.js       # Authentification
│   ├── useApi.js        # Appels API
│   └── index.js         # Exports
├── services/            # Services métier
│   ├── api.service.js   # Configuration API
│   ├── auth.service.js  # Service auth
│   ├── storage.service.js # Gestion stockage
│   └── index.js         # Exports
├── Entities/            # Schémas de données
├── Pages/               # Pages de l'application
├── Layout.js            # Layout principal
└── index.css            # Styles globaux
```

## 🚀 Installation et Démarrage

### Prérequis
- Node.js (version 16+)
- npm ou yarn

### Installation
```bash
# Cloner le repository
git clone <repository-url>
cd kot-frontend

# Installer les dépendances
npm install

# Démarrer le serveur de développement
npm start
```

L'application sera accessible sur `http://localhost:3000`

### Build de production
```bash
npm run build
```

## 🔧 Configuration

### Variables d'environnement
Créer un fichier `.env` à la racine :

```env
REACT_APP_API_URL=http://localhost:3001/api
REACT_APP_ENVIRONMENT=development
```

### API Backend
L'application communique avec une API backend. Assurez-vous que le serveur backend soit démarré sur le port configuré.

## 🎨 Architecture et Patterns

### Hooks Personnalisés
- **`useCart`**: Gestion centralisée du panier avec localStorage
- **`useAuth`**: Gestion de l'authentification et sessions
- **`useApi`**: Interface unifiée pour les appels API

### Services
- **API Service**: Configuration Axios avec intercepteurs
- **Auth Service**: Méthodes d'authentification
- **Storage Service**: Abstraction localStorage/sessionStorage

### Composants
- **ErrorBoundary**: Gestion globale des erreurs
- **LoadingSpinner**: Indicateurs de chargement unifiés
- **Toast**: Système de notifications
- **Modal**: Composant modal générique

## 🧪 Tests

```bash
# Lancer les tests
npm test

# Tests avec couverture
npm test -- --coverage
```

## 📱 Fonctionnalités Responsive

L'application est entièrement responsive et optimisée pour :
- 📱 Mobiles (320px+)
- 📲 Tablettes (768px+)
- 💻 Desktop (1024px+)

## 🎯 Performance

### Optimisations Implémentées
- Code splitting avec `React.lazy`
- `React.memo` pour éviter les re-renders inutiles
- `useCallback` et `useMemo` pour l'optimisation
- Images optimisées et lazy loading

### Métriques Cibles
- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Cumulative Layout Shift**: < 0.1
- **First Input Delay**: < 100ms

## 🔒 Sécurité

- Authentification JWT
- Validation des données avec JSON Schema
- Protection CSRF
- Sanitisation des inputs

## 🌐 Internationalisation

Préparation pour le support multi-langue avec React i18next.

## 📊 Monitoring

Intégration préparée pour :
- Google Analytics
- Sentry (gestion d'erreurs)
- Performance monitoring

## 🤝 Contribution

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/AmazingFeature`)
3. Commit les changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📝 Licence

Ce projet est sous licence MIT - voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 📞 Support

Pour toute question ou problème :
- Ouvrir une issue sur GitHub
- Contacter l'équipe de développement

---

**King Of Tacos** - L'excellence culinaire à portée de clic ! 🌮
