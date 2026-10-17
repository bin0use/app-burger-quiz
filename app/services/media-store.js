const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

/**
 * Formats acceptés : type MIME -> [type de média, extension]
 */
const mimeTypes = {
    'audio/mpeg': ['audio', 'mp3'],
    'audio/mp3': ['audio', 'mp3'],
    'audio/wav': ['audio', 'wav'],
    'audio/wave': ['audio', 'wav'],
    'audio/x-wav': ['audio', 'wav'],
    'audio/ogg': ['audio', 'ogg'],
    'audio/aac': ['audio', 'aac'],
    'audio/mp4': ['audio', 'm4a'],
    'audio/x-m4a': ['audio', 'm4a'],
    'audio/webm': ['audio', 'weba'],
    'video/mp4': ['video', 'mp4'],
    'video/webm': ['video', 'webm'],
    'video/ogg': ['video', 'ogv']
};

/**
 * Types de média possibles
 */
const mediaTypes = ['audio', 'video'];

/**
 * Taille maximum d'un fichier
 */
const maxSize = 100 * 1024 * 1024;

/**
 * Nom des fichiers enregistrés : identifiant aléatoire + extension
 */
const filePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{2,4}$/;

/**
 * Durée pendant laquelle un fichier non utilisé est conservé
 * (laisse le temps d'enregistrer la question après l'envoi du fichier)
 */
const pruneDelay = 60 * 60 * 1000;

/**
 * Type MIME sans paramètres (ex : "audio/mpeg; charset=...")
 */
const baseMimeType = function (mimeType) {
    return typeof mimeType === 'string' ? mimeType.split(';')[0].trim().toLowerCase() : '';
}

const isAcceptedType = function (mimeType) {
    return Object.prototype.hasOwnProperty.call(mimeTypes, baseMimeType(mimeType));
}

const isValidFileName = function (file) {
    return typeof file === 'string' && filePattern.test(file);
}

/**
 * Se charge de stocker les sons et vidéos des questions dans un dossier
 * @param {*} dir Le dossier (si absent, un dossier temporaire est utilisé)
 */
const createMediaStore = function (dir) {
    dir = dir || fs.mkdtempSync(path.join(os.tmpdir(), 'bq-media-'));
    fs.mkdirSync(dir, { recursive: true });

    return {
        dir: dir,
        /**
         * Enregistre un fichier, renvoie { file, type } (null si format refusé)
         * @param {*} buffer Le contenu du fichier
         * @param {*} mimeType Son type MIME
         */
        save: function (buffer, mimeType) {
            const format = mimeTypes[baseMimeType(mimeType)];
            if (!format || !buffer || !buffer.length)
                return null;
            const file = crypto.randomUUID() + '.' + format[1];
            fs.writeFileSync(path.join(dir, file), buffer);
            return { file: file, type: format[0] };
        },
        exists: function (file) {
            return isValidFileName(file) && fs.existsSync(path.join(dir, file));
        },
        /**
         * Supprime les fichiers qui ne sont plus utilisés par aucune question
         * @param {*} usedFiles Les fichiers encore utilisés (Set)
         */
        prune: function (usedFiles) {
            const limit = Date.now() - pruneDelay;
            fs.readdirSync(dir).forEach(function (file) {
                if (!isValidFileName(file) || usedFiles.has(file))
                    return;
                const filePath = path.join(dir, file);
                try {
                    if (fs.statSync(filePath).mtimeMs < limit)
                        fs.unlinkSync(filePath);
                } catch (error) {
                    console.log(`Impossible de supprimer le média ${file} : ${error.message}`);
                }
            });
        }
    };
}

module.exports = { createMediaStore, isAcceptedType, isValidFileName, mediaTypes, maxSize, pruneDelay };
