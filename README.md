# Présentation App Burger Quiz

<p align="center">
<img src="views/public/images/backgrounds/menus.svg" height="250"> 
</p>

:hamburger: Burger quiz est le jeu qui reprend les codes de la célèbre émission présentée par Alain Chabat. 

## Prérequis
Installer NodeJs **20.12 ou plus récent** : https://nodejs.org/fr/

## Installation

Cloner le répo :

```
git clone https://github.com/bin0use/app-burger-quiz.git
```

Se rendre à la base du répertoire où se trouve le fichier **'package.json'** puis lancer la commande :

```
npm install
```

## Lancement

Une fois que les dépendances ont été installées vous pouvez lancer l'application :

```
npm start
```

Par défaut le serveur écoute sur le port **3000**. 

### Variables d'environnement

| Variable | Rôle | Défaut |
|---|---|---|
| `PORT` | Port d'écoute du serveur | `3000` |
| `ADMIN_USERNAME` | Identifiant de la télécommande admin | `admin` |
| `ADMIN_PASSWORD` | Mot de passe de la télécommande admin | `burger2018` (un avertissement s'affiche au démarrage) |
| `SESSION_SECRET` | Secret de signature des sessions | généré aléatoirement à chaque démarrage |
| `STATE_FILE` | Fichier de sauvegarde de la partie (scores, transition en cours), vide pour désactiver | `data/state.json` |
| `PARTIES_FILE` | Fichier de stockage des parties et de leurs questions, vide pour les garder en mémoire | `data/parties.json` |

Exemple : `ADMIN_PASSWORD=monMotDePasse npm start`

La partie est sauvegardée à chaque modification : un redémarrage du serveur ne fait pas perdre les scores (les buzzers repartent bloqués).

### Docker

```
docker build -t app-burger-quiz .
docker run -p 3000:3000 -e ADMIN_PASSWORD=monMotDePasse app-burger-quiz
```

Vous pouvez à présent accèder à l'application via cette adressse : http://localhost:3000/ qui permet de choisir une équipe (Ketchup / Mayo) :

<p align="center">
<img src="https://user-images.githubusercontent.com/25900708/52507764-ce9d3500-2bf2-11e9-91ba-4518018d0a5f.png" height="300"> 
</p>

Ouvrir un second onglet puis taper l'adresse suivante : http://localhost:3000/game :

Vous arriverez sur une fenêtre permettant aux joueurs de flasher un **QR-Code** pour qu'ils puissent se rendre directement au choix des équipes :

<p align="center">
<img src="https://user-images.githubusercontent.com/25900708/80916842-8fa95100-8d5b-11ea-8a51-c097a5bee720.PNG" height="300"> 
</p>

Une fois que tout le monde est prêt vous pouvez cliquer sur le bouton : **Tout le monde est prêt!**. 

Vous arrivez enfin sur l'écran du jeu :blush: :
<p align="center">
<img src="https://user-images.githubusercontent.com/25900708/52507593-461e9480-2bf2-11e9-9882-60ca26b7a568.png" height="300"> 
</p>

Cette page est l'écran principal de l'application. 
En effet elle permet l'affichage des points de chacune des équipes, de lancer les différentes transitions (nuggets, sel & poivre, menus, addition, burger de la mort) enfin de pouvoir cheese buzzer :smiley:

Ouvrez enfin un dernier onglet : http://localhost:3000/admin. Cette page est protégée : vous serez redirigé vers http://localhost:3000/login pour vous authentifier (voir `ADMIN_USERNAME` / `ADMIN_PASSWORD`) :

<p align="center">
<img src="https://user-images.githubusercontent.com/25900708/52508059-977b5380-2bf3-11e9-8e7f-9c875a5a5718.png" height="300"> 
</p>

Cette page va permettre d'administrer le jeu. Vous allez pouvoir ajouter les points des différentes équipes lancer les transitions et de bloquer / débloquer les cheeses buzzer.

Dès qu'une équipe buzze, le serveur bloque tous les buzzers : seul le premier buzz est pris en compte et l'équipe concernée s'affiche sur la télécommande. Cliquez sur **Débloquer buzzer** pour la question suivante.

La télécommande indique aussi la transition en cours et la suivante, permet de revenir à la transition précédente et propose des raccourcis clavier :

| Touche | Action |
|---|---|
| `K` / `Maj+K` | Ajouter / retirer un point à Ketchup |
| `M` / `Maj+M` | Ajouter / retirer un point à Mayo |
| `X` | Mauvaise réponse |
| `D` / `B` | Débloquer / bloquer les buzzers |
| `N` / `P` | Transition suivante / précédente |
| `→` / `←` | Question suivante / précédente |

### Gestion des parties et des questions

Depuis la télécommande, le lien **Gérer les parties et questions** (http://localhost:3000/admin/parties) permet de :

* créer, renommer, dupliquer et supprimer des parties ;
* ajouter, modifier, supprimer et réordonner les questions de chaque manche (Nuggets, Sel ou Poivre, Les menus, L'addition, Burger de la mort), avec un thème optionnel et la réponse ;
* exporter une partie en JSON et la réimporter (sur un autre serveur par exemple).

Choisissez ensuite la partie dans la télécommande : à chaque transition, la première question de la manche s'affiche avec sa réponse, et les boutons **Précédente / Suivante** (ou les flèches `←` / `→`) permettent de naviguer. Les questions et réponses ne sont envoyées qu'aux télécommandes authentifiées, jamais aux buzzers ni à l'écran de jeu.

Sur les téléphones, le buzzer vibre, empêche la mise en veille de l'écran et indique l'état de la partie (en attente, à vous, connexion perdue…).

**NOTA**: Si vous êtes sous **Google Chrome** cliquer une première fois sur la fenêtre du jeu car vous aurez une erreur de type **'Uncaught (in promise) DOMException'** et l'animation ne se lancera pas.

## Développement

```
npm run lint   # ESLint
npm test       # tests (node:test)
```

La CI GitHub Actions lance le lint, les tests et `npm audit` sur Node 20, 22 et 24.

## Auteurs

* **Poutriquet Benjamin** - *Initial work* - [app-burger-quiz](https://github.com/BenjaminPoutriquet35800/app-burger-quiz)
* Voir aussi la liste des [contributeurs](https://github.com/BenjaminPoutriquet35800/app-burger-quiz/graphs/contributors) ayant participé à ce projet.




