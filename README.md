# NOVA Cuisine — application test connectable

Cette version est une application privée de test. Elle affiche la photo source, collecte les choix de cuisine et appelle un moteur de rendu depuis le serveur sécurisé. La clé n'est jamais exposée dans le navigateur.

## Installation

1. Installez une version récente de Node.js sur votre ordinateur.
2. Ouvrez ce dossier dans un terminal.
3. Lancez `npm install`.
4. Copiez `.env.example` sous le nom `.env`.
5. Dans `.env`, ajoutez votre nouvelle clé de rendu et l'adresse de votre endpoint privé.
6. Lancez `npm start`.
7. Ouvrez `http://localhost:3000` dans votre navigateur.

## Résultat attendu du moteur visuel

Le serveur envoie :
- `input.image` : la photo en base64 ;
- `input.prompt` : le brief détaillé issu du configurateur.

Le moteur doit répondre avec une image dans l'un des champs suivants :
- `output` ;
- `image` ;
- `url`.

Si votre moteur répond avec une tâche asynchrone, adaptez seulement la fonction `callVisualEngine` dans `server.js` pour attendre le résultat final.

## Sécurité

- Ne placez pas la clé dans `public/index.html`.
- Ne partagez pas le fichier `.env`.
- La clé qui a déjà été affichée doit être révoquée et remplacée avant toute utilisation.

Généré par Limova
