const crypto = require('crypto');

// Identifiants par défaut (à surcharger via ADMIN_USERNAME / ADMIN_PASSWORD)
const defaultUsername = 'admin';
const defaultPassword = 'burger2018';

const username = process.env.ADMIN_USERNAME || defaultUsername;
const password = process.env.ADMIN_PASSWORD || defaultPassword;

/**
 * Comparaison en temps constant de deux chaînes
 */
const safeEqual = function (a, b) {
    const hashA = crypto.createHash('sha256').update(String(a)).digest();
    const hashB = crypto.createHash('sha256').update(String(b)).digest();
    return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Vérifie les identifiants de l'admin
 */
const check = function (user, pass) {
    // Le nom d'utilisateur n'est pas sensible à la casse
    const userOk = safeEqual(String(user).toLowerCase(), username.toLowerCase());
    const passOk = safeEqual(pass, password);
    return userOk && passOk;
}

/**
 * Indique si le mot de passe par défaut est toujours utilisé
 */
const isUsingDefaultPassword = function () {
    return password === defaultPassword;
}

module.exports = { check, isUsingDefaultPassword }
