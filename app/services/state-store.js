const fs = require('fs');
const path = require('path');

/**
 * Se charge de sauvegarder / restaurer l'état de la partie dans un fichier JSON
 * Permet de ne pas perdre la partie si le serveur redémarre
 * @param {*} filePath Le chemin du fichier (si absent, aucune persistance)
 */
const createStateStore = function (filePath) {
    /**
     * Restaure l'état sauvegardé, null si aucun état exploitable
     */
    const load = function () {
        if (!filePath || !fs.existsSync(filePath))
            return null;
        try {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (error) {
            console.log(`Impossible de lire l'état de la partie (${filePath}) : ${error.message}`);
            return null;
        }
    }

    /**
     * Sauvegarde l'état (écriture dans un fichier temporaire puis renommage)
     * @param {*} state L'état à sauvegarder
     */
    const save = function (state) {
        if (!filePath)
            return;
        try {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            const tmpFile = filePath + '.tmp';
            fs.writeFileSync(tmpFile, JSON.stringify(state));
            fs.renameSync(tmpFile, filePath);
        } catch (error) {
            console.log(`Impossible de sauvegarder l'état de la partie (${filePath}) : ${error.message}`);
        }
    }

    return { load, save };
}

module.exports = { createStateStore };
