t-frontend ko# TODO - Redémarrage Développement King Of Tacos

## Étape 1: Configuration XAMPP/MySQL
- [x] Installer XAMPP si nécessaire
- [x] Démarrer MySQL dans XAMPP
- [x] Créer la base de données "king_of_tacos" dans phpMyAdmin

## Étape 2: Réinitialisation de la Base de Données
- [x] Supprimer les migrations Prisma existantes (non nécessaire, DB existante)
- [x] Réinitialiser le schéma Prisma (non nécessaire)

## Étape 3: Application du Schéma Prisma
- [x] Générer le client Prisma
- [x] Pousser le schéma vers la base de données

## Étape 4: Amorçage des Données
- [ ] Exécuter le script seed.js pour ajouter des données initiales

## Étape 5: Ajout de Nouvelles Fonctionnalités

### Admin Side
- [x] Mode Cuisine : Interface pour cuisiniers pour gérer les commandes et modifier les statuts
- [x] Mode Caisse : Génération de factures par commande et rapports de ventes (jour/semaine/mois/année)
- [x] Filtres Finance : Ajouter des filtres par utilisateurs, produits, etc. dans le mode finance
- [ ] Gestion Personnel : Ajouter/modifier/supprimer du personnel avec rôles et accès automatiques
- [x] Système Fidélité Admin : Gestion des récompenses (commandes gratuites, livraisons gratuites, etc.)

### User Side
- [x] Système Fidélité User : Points basés sur les dépenses, visibles sur le profil
- [x] Page Commandes : Lien navbar pour voir commandes récentes, statut, recommander, avis

## Étapes de Suivi
- [ ] Tester la connexion à la base de données
- [ ] Vérifier le déploiement local
- [ ] Valider le fonctionnement de l'application
