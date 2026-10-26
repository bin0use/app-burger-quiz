const path = require('path');

const confServer = require('./config/config-server');
const { createServer } = require('./app/create-server');
const starter = require('./config/starter');

// Fichier de sauvegarde de la partie (STATE_FILE vide : pas de sauvegarde)
const stateFile = process.env.STATE_FILE !== undefined
  ? process.env.STATE_FILE
  : path.join(confServer.rootDir, 'data/state.json');

// Fichier de stockage des parties et questions (PARTIES_FILE vide : en mémoire uniquement)
const partiesFile = process.env.PARTIES_FILE !== undefined
  ? process.env.PARTIES_FILE
  : path.join(confServer.rootDir, 'data/parties.json');

// Dossier des sons et vidéos des questions
const mediaDir = process.env.MEDIA_DIR || path.join(confServer.rootDir, 'data/media');

const { httpServer } = createServer({
  stateFile: stateFile,
  partiesFile: partiesFile,
  mediaDir: mediaDir,
  mediaLibraryDir: path.join(confServer.rootDir, 'parties/media'),
  sessionSecret: process.env.SESSION_SECRET
});

const port = process.env.PORT || confServer.network.port;

httpServer.listen(port, () => starter.messagesToDisplayWhenServerStart(port));
