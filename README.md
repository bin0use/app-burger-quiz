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
| `MEDIA_DIR` | Dossier des sons et vidéos des questions | `data/media` |

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

Dès qu'une équipe buzze, le serveur bloque tous les buzzers : seul le premier buzz est pris en compte. Le logo de l'équipe s'affiche en grand sur l'écran de jeu, avec l'écart de temps si l'autre équipe a buzzé juste après (« Ketchup : 0,12 s trop tard ! »). Sur le téléphone de l'équipe qui a la main, tout l'écran prend la couleur de l'équipe.

Ensuite, depuis la télécommande :

* **✔ Bonne réponse** (`Entrée`) : l'équipe qui a buzzé marque les points de la question, la réponse est révélée à l'écran et les buzzers sont bloqués ;
* **X Mauvaise réponse** : « pouet » à l'écran et **la main passe à l'autre équipe** (seul son buzzer est débloqué). Si les deux équipes se trompent, plus personne ne peut buzzer ;
* **↶ Annuler** (`Z` ou `Ctrl+Z`) : annule la dernière action (point, bonne / mauvaise réponse, blocage ou déblocage des buzzers), jusqu'à 30 actions.

Passer à la question ou à la manche suivante bloque les buzzers : cliquez sur **Débloquer buzzer** (`D`) une fois la question lue.

La télécommande affiche aussi :

* le nombre de **buzzers connectés** par équipe ;
* la question **en gros**, sa réponse, son barème et la **note de l'animateur** ;
* un **chrono** affiché en grand sur l'écran de jeu (60 s proposées pour l'addition, 30 s sinon) : lancer, mettre en pause, reprendre, masquer. Option : un chrono de réponse lancé automatiquement après chaque buzz (3 à 15 s). Une sonnerie retentit à la fin ;
* au **Burger de la mort**, un compteur de 10 bonnes réponses d'affilée sur l'écran de jeu : ✔ le fait avancer, X le remet à zéro ;
* l'**écran de victoire** (équipe gagnante, scores, confettis) ;
* **Démarrer la partie à l'écran** : ferme l'écran du QR code sur la TV sans aller cliquer dessus.

| Touche | Action |
|---|---|
| `Entrée` | Bonne réponse |
| `X` | Mauvaise réponse |
| `Z` / `Ctrl+Z` | Annuler la dernière action |
| `K` / `Maj+K` | Ajouter / retirer un point à Ketchup |
| `M` / `Maj+M` | Ajouter / retirer un point à Mayo |
| `D` / `B` | Débloquer / bloquer les buzzers |
| `N` / `P` | Transition suivante / précédente |
| `→` / `←` | Question suivante / précédente |
| `E` / `R` | Afficher / masquer la question à l'écran, révéler la réponse |
| `J` / `Maj+J` | Jouer le son / la vidéo de la question / de la réponse |
| `S` | Arrêter le son / la vidéo |
| `T` / `Maj+T` | Lancer ou mettre en pause / masquer le chrono |
| `V` | Afficher / masquer l'écran de victoire |
| `G` | Démarrer la partie à l'écran |

### Ecran de jeu sur une TV

Sur l'écran de jeu, le curseur disparait quand la souris ne bouge plus. `F` ou un double-clic passe en plein écran ou en sort.

Les navigateurs bloquent le son tant qu'on n'a pas cliqué sur la page, et le plein écran demande une action sur la page. Le plus simple est de lancer Chrome en mode kiosque, avec la lecture automatique autorisée :

```
chrome --kiosk --autoplay-policy=no-user-gesture-required http://localhost:3000/game
```

Sans ces options, cliquez une fois sur l'écran de jeu (par exemple sur **Tout le monde est prêt !**).

### Gestion des parties et des questions

Depuis la télécommande, le lien **Gérer les parties et questions** (http://localhost:3000/admin/parties) permet de :

* créer, renommer, dupliquer et supprimer des parties ;
* ajouter, modifier, supprimer et réordonner les questions de chaque manche (Nuggets, Sel ou Poivre, Les menus, L'addition, Burger de la mort), avec un thème optionnel (nom du menu…), jusqu'à 4 propositions et la réponse ;
* donner un barème à chaque question (1 à 10 miams, 1 par défaut), et ajouter une note de l'animateur (une blague, une précision…) visible seulement sur la télécommande ;
* joindre un son ou une vidéo à la question et / ou à la réponse (mp3, wav, ogg, m4a, mp4, webm, 100 Mo maximum) : blind test, extrait de film, générique… ;
* exporter une partie en JSON et la réimporter (sur un autre serveur par exemple);
* copier ou déplacer des questions vers une autre partie : cochez-les (ou **Sélectionner** sur l'en-tête d'un menu pour le prendre en entier, ou **Tout sélectionner** pour la manche), puis **Copier / déplacer vers une autre partie…**. Elles arrivent à la fin de leur manche avec leur thème, leurs propositions, leurs sons et vidéos.

Le dossier `parties/` contient des parties prêtes à importer (« Chalet 2025 », « Spécial années 90 », « Apéro gourmand », « Cinéma & séries »), ainsi qu'une **Réserve de thèmes** de plus de 2 700 questions, de quoi alimenter des dizaines de parties : 291 Nuggets, 73 séries Sel ou Poivre, 146 menus, 50 additions et 52 séries de 10 questions pour le Burger de la mort (« Burger n° 1 », « Burger n° 2 »…). Importez-la une fois, puis copiez dans vos parties les questions, menus ou séries dont vous avez besoin.

Plus de 130 questions de la réserve ont un son ou une image : blind tests (mélodies du domaine public : classique, comptines, hymnes, carillon de Big Ben…), morse, drapeaux, illusions d'optique, horloges, dés, comptage éclair, mots écrits en miroir, « dites la couleur, pas le mot »… Les images sont des vidéos de quelques secondes, jouées en plein écran avec **▶ Vidéo de la question** (`J`). Ces médias sont fournis dans `parties/media` : à l'import de la réserve, ils sont copiés automatiquement dans `MEDIA_DIR`.

Choisissez ensuite la partie dans la télécommande : à chaque transition, la première question de la manche s'affiche avec sa réponse, et les boutons **Précédente / Suivante** (ou les flèches `←` / `→`) permettent de naviguer. Comme dans l'émission, les questions des **Nuggets** et des **menus** s'affichent aussi sur l'écran de jeu (question, nom du menu et propositions). Pour **Sel ou Poivre**, rien ne s'affiche par défaut : **Afficher à l'écran** (`E`) montre seulement le thème et les propositions (« Johnny, Eddy ou les deux ? »), vous lisez la question. Pour **Les menus**, l'écran affiche d'abord les noms des menus (le thème des questions) : choisissez dans la télécommande le menu pris par l'équipe pour afficher ses questions, puis **Retour aux menus**. Un menu joué jusqu'à sa dernière question est verrouillé : il est barré et ne peut plus être pris par l'autre équipe. Le bouton 🔒 à côté de chaque menu le verrouille ou le déverrouille à la main (**Annuler** revient aussi sur un choix par erreur). Pour le **Burger de la mort**, la télécommande affiche la liste de toutes les questions et réponses (cliquer sur une question y va directement). Dès qu'une équipe atteint **25 points**, l'écran de victoire s'affiche automatiquement. Depuis la télécommande, **Masquer / Afficher à l'écran** (`E`) et **Révéler la réponse à l'écran** (`R`) : la bonne proposition est mise en avant, ou la réponse s'affiche sous la question. Tant qu'elle n'est pas révélée, la réponse n'est envoyée qu'aux télécommandes authentifiées, jamais aux buzzers ni à l'écran de jeu.

### L'écran de jeu

L'écran de jeu est dessiné en 16:9 et s'adapte à n'importe quelle TV ou vidéoprojecteur (`F` ou double-clic pour le plein écran) :

* un **bandeau** en haut avec les logos, noms et scores des équipes et la manche en cours ;
* les **plateaux** des deux équipes (burger, boisson, sauces, frites) se remplissent point par point, chaque élément gagné rebondit et brille aux couleurs de l'équipe ;
* la **question** s'affiche en bas de l'écran (les plateaux restent visibles), sa taille de texte s'adapte à sa longueur et les propositions arrivent une à une ;
* quand la réponse est révélée, un **roulement** passe sur les propositions avant d'allumer la bonne ;
* au **buzz**, l'écran passe aux couleurs de l'équipe avec son logo, puis une bordure à ses couleurs reste tant qu'elle a la main ; une mauvaise réponse affiche une grande croix ;
* le **chrono** est un anneau qui se vide, orange à mi-temps, rouge et clignotant sur les 5 dernières secondes ;
* après chaque transition, un **carton de manche** (numéro, nom et règles) s'affiche ; il disparait dès que le jeu reprend (question suivante, déblocage des buzzers…) ou avec `C` sur la télécommande ;
* **Les menus** s'affichent comme des cartes de restaurant (nombre de questions, tampon « Choisi par … ») : choisissez dans la télécommande l'équipe qui choisit (proposée automatiquement) avant le menu ;
* au **Burger de la mort**, une tour se construit étage par étage au centre de l'écran et s'effondre à la moindre erreur ;
* l'**écran de victoire** récapitule les points par manche et le nombre de fois où chaque équipe a buzzé en premier.

Polices (ambiance fidèle à l'émission) : **Bangers** pour les titres et noms d'équipes, **Fredoka** pour les questions, propositions et chiffres. Elles sont installées avec npm (`@fontsource`) et servies par l'application : la partie fonctionne sans connexion internet.

Quand la question en cours a un son ou une vidéo, quelle que soit la manche, la télécommande affiche les boutons **▶ Son / Vidéo de la question**, **▶ Son / Vidéo de la réponse** et **Stop** (`J`, `Maj+J`, `S`) : le média est joué sur l'écran de jeu (les vidéos en plein écran). Comme dans l'émission, un buzz coupe le son ou la vidéo en cours ; changer de question ou de manche l'arrête aussi. Les fichiers sont stockés dans `MEDIA_DIR` et supprimés une fois qu'aucune question ne les utilise. L'export d'une partie ne contient que la référence des médias : réimportée sur un autre serveur, la partie perd ses sons et vidéos.

Sur les téléphones, le buzzer vibre, empêche la mise en veille de l'écran et indique l'état de la partie (en attente, à vous, la main passe à l'autre équipe, connexion perdue…).

**NOTA** : sous **Google Chrome**, sans l'option `--autoplay-policy=no-user-gesture-required` (voir *Ecran de jeu sur une TV*), cliquez une première fois sur la fenêtre du jeu, sinon les vidéos et les sons ne se lancent pas.

## Développement

```
npm run lint   # ESLint
npm test       # tests (node:test)
```

La CI GitHub Actions lance le lint, les tests et `npm audit` sur Node 20, 22 et 24.

## Auteurs

* **Poutriquet Benjamin** - *Initial work* - [app-burger-quiz](https://github.com/BenjaminPoutriquet35800/app-burger-quiz)
* Voir aussi la liste des [contributeurs](https://github.com/BenjaminPoutriquet35800/app-burger-quiz/graphs/contributors) ayant participé à ce projet.




