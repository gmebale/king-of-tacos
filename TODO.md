# TODO: Correction de l'affichage des détails de commande sur la page de paiement

## Problème identifié
- Les détails de personnalisation (taille, viande, sauces, suppléments) ne s'affichaient pas sur la page de paiement
- La configuration de personnalisation n'était pas préservée séparément des sélections dans le panier
- Les personnalisations vides ({}) étaient envoyées au backend au lieu de null

## Étape 1: Modifier CustomizationDialog.jsx
- [x] Ajouter `customizationConfig` pour préserver la configuration originale
- [x] Générer un `customizationSummary` et le passer à `onConfirm`

## Étape 2: Mettre à jour useCart.js
- [x] Ajouter le stockage de `customizationConfig` dans les items du panier
- [x] Utiliser la bonne propriété pour les personnalisations

## Étape 3: Mettre à jour Checkout.jsx
- [x] Afficher les personnalisations dans le récapitulatif de commande
- [x] Importer `formatCustomization` et l'utiliser correctement

## Étape 4: Mettre à jour Payment.jsx
- [x] Corriger l'affichage des personnalisations en utilisant `item.customization` et `item.customizationConfig`
- [x] Envoyer null au lieu de {} pour les personnalisations vides

## Étape 5: Mettre à jour formatCustomization
- [x] Afficher les valeurs par défaut quand aucune sélection n'est faite
- [x] Améliorer la logique d'affichage des personnalisations

## Étape 6: Tester les modifications
- [x] Vérifier que les détails de commande s'affichent correctement sur la page de paiement (avec valeurs par défaut si aucune sélection)
- [x] Tester le flux complet : personnalisation → panier → checkout → paiement
- [x] Vérifier que les données envoyées au backend sont correctes (customization object envoyé)
- [x] Support ajouté pour le format de personnalisation des tacos (TacosCustomizationDialog)
