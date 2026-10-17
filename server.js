const path = require('path');

const confServer = require('./config/config-server');
const { createServer } = require('./app/create-server');
const starter = require('./config/starter');

// Fichier de sauvegarde de la partie (STATE_FILE vide : pas de sauvegarde)
const stateFile = process.env.STATE_FILE !== undefined
  ? process.env.STATE_FILE
  : path.join(confServer.rootDir, 'data/state.json');

const { httpServer } = createServer({
  stateFile: stateFile,
  sessionSecret: process.env.SESSION_SECRET
});

const port = process.env.PORT || confServer.network.port;

httpServer.listen(port, () => starter.messagesToDisplayWhenServerStart(port));
