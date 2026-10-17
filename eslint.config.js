const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
    {
        ignores: ['node_modules/', 'data/', 'coverage/']
    },
    js.configs.recommended,
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: globals.node
        }
    },
    {
        // Scripts chargés directement par les navigateurs
        files: ['views/public/js/**/*.js'],
        languageOptions: {
            sourceType: 'script',
            globals: {
                ...globals.browser,
                ...globals.jquery,
                io: 'readonly',
                BQ_MESSAGES: 'readonly'
            }
        }
    },
    {
        // Fichier partagé entre node et les navigateurs
        files: ['config/messages-socket.js'],
        languageOptions: {
            sourceType: 'script',
            globals: {
                ...globals.node,
                ...globals.browser
            }
        }
    }
];
