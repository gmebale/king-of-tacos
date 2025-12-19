# Guide de Mise à Jour du Repository GitHub - King Of Tacos

Ce guide explique étape par étape comment pousser vos mises à jour locales vers le repository GitHub `https://github.com/gmebale/king-of-tacos`.

## Prérequis

- **Git** installé sur votre système
- **GitHub CLI** (recommandé pour une expérience optimale)
- Un compte GitHub avec accès au repository
- Vos modifications locales validées et testées

## Étape 1 : Vérifier l'Installation de GitHub CLI

GitHub CLI (`gh`) facilite grandement les interactions avec GitHub. Vérifions s'il est installé :

### Sur Windows (avec winget ou Chocolatey)
```bash
# Avec winget (recommandé)
winget install --id GitHub.cli

# Ou avec Chocolatey
choco install gh
```

### Sur macOS
```bash
# Avec Homebrew
brew install gh
```

### Sur Linux
```bash
# Ubuntu/Debian
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install gh
```

### Vérification de l'installation
```bash
gh --version
```

Si GitHub CLI n'est pas installé, vous pouvez continuer avec Git traditionnel, mais certaines étapes seront différentes.

## Étape 2 : Authentification avec GitHub

### Avec GitHub CLI
```bash
gh auth login
```
Suivez les instructions à l'écran pour vous connecter à votre compte GitHub.

### Avec Git traditionnel
Si vous utilisez des clés SSH :
```bash
# Vérifier vos clés SSH
ssh -T git@github.com

# Si nécessaire, générer une nouvelle clé
ssh-keygen -t ed25519 -C "votre-email@github.com"
# Puis ajouter la clé publique à votre compte GitHub
```

## Étape 3 : Vérifier l'État du Repository Local

Avant de pousser, vérifiez l'état de votre repository :

```bash
# Vérifier le statut
git status

# Voir les différences
git diff

# Voir les fichiers stagés
git diff --staged
```

## Étape 4 : Ajouter les Modifications

Ajoutez vos fichiers modifiés à l'index Git :

```bash
# Ajouter tous les fichiers modifiés
git add .

# Ou ajouter des fichiers spécifiques
git add CHANGELOG.md
git add README.md
# etc.
```

## Étape 5 : Créer un Commit

Créez un commit avec un message descriptif :

```bash
# Commit avec un message
git commit -m "Mise à jour du changelog et ajout du guide GitHub

- Traduction du CHANGELOG.md en français
- Ajout du guide de mise à jour GitHub
- Documentation des nouvelles fonctionnalités"
```

### Bonnes Pratiques pour les Messages de Commit
- Commencez par un verbe à l'impératif (Ajout, Correction, Mise à jour)
- Soyez descriptif mais concis
- Utilisez le présent
- Référencez les issues si applicable (`#123`)

## Étape 6 : Pousser vers GitHub

### Si vous travaillez sur la branche principale (main/master)
```bash
# Pousser vers la branche principale
git push origin main
```

### Si vous travaillez sur une branche de fonctionnalité
```bash
# Créer et basculer vers une nouvelle branche
git checkout -b feature/nom-de-la-fonctionnalite

# Pousser la branche
git push -u origin feature/nom-de-la-fonctionnalite
```

## Étape 7 : Créer une Pull Request (si nécessaire)

Si vous avez poussé vers une branche de fonctionnalité, créez une Pull Request :

### Avec GitHub CLI
```bash
# Créer une PR
gh pr create --title "Titre de la PR" --body "Description des changements"

# Ou ouvrir dans le navigateur
gh pr create --web
```

### Via l'Interface Web GitHub
1. Allez sur https://github.com/gmebale/king-of-tacos
2. Cliquez sur "Pull requests"
3. Cliquez sur "New pull request"
4. Sélectionnez votre branche
5. Ajoutez un titre et une description
6. Cliquez sur "Create pull request"

## Étape 8 : Fusionner la Pull Request (si applicable)

Une fois la PR créée et révisée :

### Avec GitHub CLI
```bash
# Fusionner la PR
gh pr merge
```

### Via l'Interface Web
1. Allez dans la PR
2. Cliquez sur "Merge pull request"
3. Confirmez la fusion

## Commandes Utiles Supplémentaires

### Annuler des modifications
```bash
# Annuler les changements non stagés
git checkout -- fichier

# Annuler les changements stagés
git reset HEAD fichier

# Annuler le dernier commit (garder les changements)
git reset --soft HEAD~1

# Annuler le dernier commit (supprimer les changements)
git reset --hard HEAD~1
```

### Synchroniser avec le repository distant
```bash
# Récupérer les dernières modifications
git pull origin main

# En cas de conflits, résoudre puis :
git add .
git commit -m "Résoudre les conflits de fusion"
git push origin main
```

### Gérer les branches
```bash
# Lister les branches
git branch -a

# Supprimer une branche locale
git branch -d nom-branche

# Supprimer une branche distante
git push origin --delete nom-branche
```

## Dépannage

### Erreur "Permission denied"
- Vérifiez que vous êtes authentifié avec GitHub
- Assurez-vous d'avoir les droits d'écriture sur le repository

### Erreur "Non-fast-forward"
```bash
# Récupérer les dernières modifications
git pull --rebase origin main
```

### Erreur "Repository not found"
- Vérifiez l'URL du repository
- Assurez-vous que le repository existe et que vous y avez accès

## Bonnes Pratiques

1. **Commits fréquents** : Commitez souvent avec des messages clairs
2. **Branches de fonctionnalité** : Utilisez des branches pour les nouvelles fonctionnalités
3. **Pull Requests** : Utilisez les PR pour la révision de code
4. **Synchronisation** : Tirez régulièrement les modifications du repository distant
5. **Messages descriptifs** : Écrivez des messages de commit informatifs

## Support

Si vous rencontrez des problèmes :
- Consultez la documentation Git : https://git-scm.com/doc
- Documentation GitHub CLI : https://cli.github.com/manual/
- Issues du repository : https://github.com/gmebale/king-of-tacos/issues

---

**Repository GitHub** : https://github.com/gmebale/king-of-tacos
**Dernière mise à jour** : Octobre 2024
