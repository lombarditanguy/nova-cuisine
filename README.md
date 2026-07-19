# NOVA Cuisine — projet Vercel vérifié

## Fichiers à déposer à la racine du dépôt GitHub
- `index.html`
- `package.json`
- `api/render.js`
- `api/prediction.js`

Ne créez pas de `vercel.json`, `server.js` ou `serveur.js`.

## Variable à ajouter dans Vercel
Dans Project Settings → Environment Variables :
- Nom : `REPLICATE_API_TOKEN`
- Valeur : votre nouveau jeton Replicate
- Environnements : Production, Preview et Development

## Déploiement
Une fois ces quatre fichiers présents sur la branche `main`, Vercel détecte automatiquement :
- la page statique `index.html`
- les deux fonctions dans `/api`

Le site appelle `/api/render`, puis suit le rendu via `/api/prediction`.
