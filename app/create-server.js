const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const flash = require('connect-flash');
const { Passport } = require('passport');
const session = require('express-session');
const { Server } = require('socket.io');

const confServer = require('../config/config-server');
const { createPartyStore } = require('./services/party-store');
const { createMediaStore } = require('./services/media-store');

/**
 * Se charge de créer le serveur http, express et socket.io
 * @param {*} options.stateFile Fichier de sauvegarde de la partie (optionnel)
 * @param {*} options.sessionSecret Secret de signature des sessions (optionnel)
 * @param {*} options.partiesFile Fichier de stockage des parties et questions (optionnel)
 * @param {*} options.mediaDir Dossier des sons et vidéos des questions (optionnel, dossier temporaire sinon)
 */
const createServer = function (options) {
  options = options || {};
  const app = express();
  const httpServer = http.createServer(app);
  const io = new Server(httpServer);
  const passport = new Passport();

  // Nécessaire derrière un reverse proxy (Heroku...) pour que req.protocol soit correct
  app.set('trust proxy', 1);

  app.use(express.static(path.join(confServer.rootDir, 'views/public/')));
  // Librairies front installées via npm
  app.use('/vendors/jquery', express.static(path.dirname(require.resolve('jquery'))));
  app.use('/vendors/bootstrap', express.static(path.join(path.dirname(require.resolve('bootstrap/package.json')), 'dist')));
  app.use('/vendors/fonts/bangers', express.static(path.dirname(require.resolve('@fontsource/bangers/package.json'))));
  app.use('/vendors/fonts/fredoka', express.static(path.dirname(require.resolve('@fontsource-variable/fredoka/package.json'))));
  // Noms des messages socket partagés avec le serveur
  app.get('/js/messages-socket.js', function (req, res) {
    res.sendFile(path.join(confServer.rootDir, 'config/messages-socket.js'));
  });

  app.set('views', path.join(confServer.rootDir, 'views/'));
  app.set('view engine', 'ejs');
  app.use(express.urlencoded({
    extended: true
  }));
  // Corps JSON de l'API de gestion des parties (import compris)
  app.use(express.json({ limit: '1mb' }));

  // Secret de session : à définir via SESSION_SECRET, sinon généré à chaque démarrage
  const sessionMiddleware = session({
    secret: options.sessionSecret || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false
  });
  app.use(sessionMiddleware);
  app.use(passport.initialize());
  app.use(passport.session()); // persistent login sessions
  app.use(flash()); // use connect-flash for flash messages stored in session

  // Partage de la session express avec socket.io (permet d'identifier l'admin)
  io.engine.use(sessionMiddleware);

  // Configuration de passport
  require('../config/passport')(passport);

  // Sons et vidéos des questions, servis aux écrans de jeu
  const mediaStore = createMediaStore(options.mediaDir);
  app.use('/media', express.static(mediaStore.dir), function (req, res) {
    res.status(404).end();
  });

  // Parties et questions, partagées entre l'API admin et le jeu
  const partyStore = createPartyStore(options.partiesFile, { mediaExists: mediaStore.exists });

  // Les médias qui ne servent plus à aucune question sont supprimés
  const pruneMedia = function () {
    mediaStore.prune(partyStore.usedMedia());
  }
  partyStore.onChange(pruneMedia);
  pruneMedia();

  // On l'inject dans le router
  require('./routes')(app, passport, partyStore, mediaStore);

  // On déclare le jeu ici
  require('./game')(io, { stateFile: options.stateFile, partyStore: partyStore });

  return { app, httpServer, io };
}

module.exports = { createServer };
