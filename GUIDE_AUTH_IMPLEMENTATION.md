 # Guide d'Implémentation Authentification Google et iCloud

## Architecture Actuelle

### Backend (Node.js/Express + Prisma)
- **Middleware d'authentification** : `authenticateToken`, `requireRole`
- **Gestion JWT** : Tokens stockés côté client, vérification via middleware
- **Modèle User** : email, password, full_name, phone, role
- **Routes auth** : /login, /register, /me, /profile, /change-password

### 
Frontend (React)
- **AuthService** : Gestion des appels API d'authentification
- **AuthContext** : État global d'authentification
- **Hook useAuth** : Logique métier d'authentification
- **Page Login** : Formulaire email/mot de passe

## 1. Implémentation Google OAuth

### Backend - Configuration

#### 1. Installation des dépendances
```bash
npm install passport passport-google-oauth20 express-session
```

#### 2. Variables d'environnement (.env)
```env
GOOGLE_CLIENT_ID=votre_client_id_google
GOOGLE_CLIENT_SECRET=votre_client_secret_google
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback
SESSION_SECRET=votre_session_secret
FRONTEND_URL=http://localhost:3000
```

#### 3. Configuration Passport (routes/auth.js)
```javascript
const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Configuration Passport Google Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_REDIRECT_URI
},
async (accessToken, refreshToken, profile, done) => {
  try {
    // Recherche ou création d'utilisateur
    let user = await prisma.user.findUnique({
      where: { google_id: profile.id }
    });

    if (!user) {
      // Vérifier si l'email existe déjà
      const existingUser = await prisma.user.findUnique({
        where: { email: profile.emails[0].value }
      });

      if (existingUser) {
        // Lier le compte Google existant
        user = await prisma.user.update({
          where: { id: existingUser.id },
          data: { google_id: profile.id }
        });
      } else {
        // Créer nouveau utilisateur
        user = await prisma.user.create({
          data: {
            google_id: profile.id,
            email: profile.emails[0].value,
            full_name: profile.displayName,
            password: null
          }
        });
      }
    }
    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
}));

// Routes Google OAuth
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  (req, res) => {
    // Génération token JWT
    const token = jwt.sign(
      { userId: req.user.id, email: req.user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    // Redirection avec token
    res.redirect(`${process.env.FRONTEND_URL}/login?token=${token}`);
  }
);

// ... autres routes existantes (login, register, etc.)
```

#### 4. Configuration serveur (server.js)
```javascript
const express = require('express');
const session = require('express-session');
const passport = require('passport');
require('./routes/auth'); // Charger la configuration Passport

const app = express();

// Configuration session (nécessaire pour Passport)
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24h
  }
}));

// Initialisation Passport
app.use(passport.initialize());
app.use(passport.session());

// ... autres middlewares et routes
```

#### 5. Schéma Prisma (schema.prisma)
```prisma
model User {
  id             Int      @id @default(autoincrement())
  email          String   @unique
  password       String?
  google_id      String?  @unique  // AJOUTER
  full_name      String
  phone          String?
  role           Role     @default(client)
  loyalty_points Int      @default(0)

  created_at     DateTime @default(now())
  updated_at     DateTime @updatedAt

  orders         Order[]
  loyaltyRedemptions   LoyaltyRedemption[]

  @@map("users")
}
```

### Frontend - Configuration

#### 1. Service d'authentification (services/auth.service.js)
```javascript
class AuthService {
  // ... méthodes existantes

  async googleLogin(token) {
    try {
      if (token) {
        localStorage.setItem('auth_token', token);
        // Dispatch event pour notifier changement état auth
        window.dispatchEvent(new CustomEvent('auth-change'));
        // Récupérer infos utilisateur après stockage token
        const user = await this.me();
        return user;
      }
      throw new Error('No token provided');
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Erreur connexion Google');
    }
  }
}
```

#### 2. Page Login (Pages/Login.jsx)
```javascript
export default function Login() {
  // ... état existant

  useEffect(() => {
    // Vérifier token Google OAuth dans paramètres URL
    const urlParams = new URLSearchParams(location.search);
    const token = urlParams.get('token');

    if (token) {
      // Gestion connexion Google
      authService.googleLogin(token)
        .then(() => {
          // Nettoyer URL
          navigate(createPageUrl('Login'), { replace: true });
          // Rediriger vers page souhaitée
          navigate(from, { replace: true });
        })
        .catch((error) => {
          setError(error.message || 'Erreur connexion Google');
        });
    }
  }, [location.search, navigate, from]);

  const handleGoogleLogin = () => {
    // Redirection vers OAuth Google
    window.location.href = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/auth/google`;
  };

  // ... JSX existant

  return (
    // ... JSX existant
    <div className="mt-4">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-gray-300" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">Ou</span>
        </div>
      </div>

      <div className="mt-4">
        <Button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full bg-white border-2 border-gray-300 hover:bg-gray-50 text-gray-700 py-3 rounded-xl text-lg font-semibold shadow-lg flex items-center justify-center gap-3"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Se connecter avec Google
        </Button>
      </div>
    </div>
  );
}
```

### Setup Google Cloud Console

1. **Créer un projet** : https://console.cloud.google.com/
2. **Activer Google+ API** : APIs & Services > Library > Google+ API
3. **Créer credentials OAuth 2.0** :
   - Type : Web Application
   - URI de redirection : `http://localhost:5000/api/auth/google/callback`
4. **Récupérer** : Client ID et Client Secret

## 2. Implémentation iCloud (Sign in with Apple)

### Backend - Configuration

#### 1. Installation dépendances
```bash
npm install apple-signin-auth
```

#### 2. Variables d'environnement (.env)
```env
APPLE_CLIENT_ID=com.votreapp.bundleid
APPLE_TEAM_ID=votre_team_id
APPLE_KEY_ID=votre_key_id
APPLE_PRIVATE_KEY_PATH=path/to/AuthKey.p8
```

#### 3. Routes iCloud (routes/auth.js)
```javascript
const appleSignin = require('apple-signin-auth');

// Route Sign in with Apple
router.post('/apple', async (req, res) => {
  try {
    const { identityToken, authorizationCode } = req.body;

    // Vérifier le token Apple
    const appleUser = await appleSignin.verifyIdToken(identityToken, {
      audience: process.env.APPLE_CLIENT_ID,
      ignoreExpiration: true, // Pour développement
    });

    // Recherche ou création utilisateur
    let user = await prisma.user.findUnique({
      where: { apple_id: appleUser.sub }
    });

    if (!user) {
      const existingUser = await prisma.user.findUnique({
        where: { email: appleUser.email }
      });

      if (existingUser) {
        user = await prisma.user.update({
          where: { id: existingUser.id },
          data: { apple_id: appleUser.sub }
        });
      } else {
        user = await prisma.user.create({
          data: {
            apple_id: appleUser.sub,
            email: appleUser.email,
            full_name: appleUser.email.split('@')[0], // Nom temporaire
            password: null
          }
        });
      }
    }

    // Générer token JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Apple auth error:', error);
    res.status(500).json({ message: 'Erreur authentification Apple' });
  }
});
```

#### 4. Schéma Prisma
```prisma
model User {
  id             Int      @id @default(autoincrement())
  email          String   @unique
  password       String?
  google_id      String?  @unique
  apple_id       String?  @unique  // AJOUTER
  full_name      String
  phone          String?
  role           Role     @default(client)
  loyalty_points Int      @default(0)

  created_at     DateTime @default(now())
  updated_at     DateTime @updatedAt

  orders         Order[]
  loyaltyRedemptions   LoyaltyRedemption[]

  @@map("users")
}
```

### Frontend - Configuration

#### 1. Service d'authentification
```javascript
class AuthService {
  // ... méthodes existantes

  async appleLogin(identityToken, authorizationCode) {
    try {
      const response = await api.post('/auth/apple', {
        identityToken,
        authorizationCode
      });
      const { token, user } = response.data;

      if (token) {
        localStorage.setItem('auth_token', token);
        window.dispatchEvent(new CustomEvent('auth-change'));
      }

      return user;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Erreur connexion Apple');
    }
  }
}
```

#### 2. Page Login
```javascript
export default function Login() {
  // ... état existant

  useEffect(() => {
    // Charger le script Apple Sign In
    const script = document.createElement('script');
    script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
    script.async = true;
    document.head.appendChild(script);

    script.onload = () => {
      // Configuration Apple Sign In
      window.AppleID.auth.init({
        clientId: process.env.REACT_APP_APPLE_CLIENT_ID,
        scope: 'email name',
        redirectURI: process.env.REACT_APP_APPLE_REDIRECT_URI,
        state: 'origin:web',
        usePopup: true
      });
    };

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  const handleAppleLogin = async () => {
    try {
      const response = await window.AppleID.auth.signIn();

      // Envoyer tokens au backend
      const user = await authService.appleLogin(
        response.authorization.id_token,
        response.authorization.code
      );

      navigate(from, { replace: true });
    } catch (error) {
      setError('Erreur connexion Apple');
    }
  };

  // ... JSX existant

  return (
    // ... JSX existant
    <div className="mt-4">
      <Button
        type="button"
        onClick={handleAppleLogin}
        className="w-full bg-black border-2 border-gray-300 hover:bg-gray-900 text-white py-3 rounded-xl text-lg font-semibold shadow-lg flex items-center justify-center gap-3"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
        </svg>
        Se connecter avec Apple
      </Button>
    </div>
  );
}
```

### Setup Apple Developer

1. **S'inscrire** : Apple Developer Program ($99/an)
2. **Créer App ID** : Certificates, Identifiers & Profiles > Identifiers
   - Activer "Sign In with Apple"
3. **Générer clé privée** :
   - Type : Sign in with Apple
   - Télécharger AuthKey.p8
4. **Récupérer** : Team ID, Key ID, Bundle ID

## Gestion des comptes liés

### Liaison automatique
Si un utilisateur s'inscrit avec OAuth mais que l'email existe déjà :
- Lier automatiquement le compte OAuth au compte existant
- Ne pas créer de doublon

### Migration comptes existants
Pour les utilisateurs existants souhaitant lier OAuth :
```javascript
// Route pour lier compte Google
router.post('/link-google', authenticateToken, async (req, res) => {
  // Logique similaire à la stratégie Google
  // Mais mise à jour du compte existant au lieu de création
});
```

## Sécurité

### Tokens JWT
- **Expiration** : 24h pour sessions normales
- **Refresh tokens** : Implémenter pour sessions longues
- **Signature** : Clé secrète forte en production

### Variables d'environnement
- **Production** : Utiliser secrets sécurisés
- **Développement** : Variables locales uniquement

### CORS
- Configurer correctement pour les redirections OAuth
- Autoriser uniquement les domaines de confiance

## Tests

### Backend
```bash
# Tests routes OAuth
curl -X GET "http://localhost:5000/api/auth/google"
curl -X POST "http://localhost:5000/api/auth/apple" \
  -H "Content-Type: application/json" \
  -d '{"identityToken":"...","authorizationCode":"..."}'
```

### Frontend
- Tester boutons OAuth
- Vérifier gestion erreurs
- Tester liaison comptes existants

## Déploiement

### Variables production
```env
NODE_ENV=production
GOOGLE_REDIRECT_URI=https://votredomaine.com/api/auth/google/callback
FRONTEND_URL=https://votredomaine.com
SESSION_SECRET=votre_secret_prod
```

### HTTPS obligatoire
- OAuth Google/Apple requiert HTTPS en production
- Configurer certificats SSL

Ce guide fournit une implémentation complète et sécurisée des authentifications Google et iCloud pour votre application King of Tacos.
