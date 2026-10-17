const $buzzButton = $('#buzz-button');
const $inputHiddenTeam = $('#team-hf-val');
const $buzzerMessage = $('#buzzer-message');

let socket = null;

// Noms des messages partagés avec le serveur (/js/messages-socket.js)
const messages = BQ_MESSAGES;

/**
 * Les styles css
 */
const lockBuzzerStyle = 'lock-buzz-button';

const teamLabels = {
    'team-mayo': 'Mayo',
    'team-ketchup': 'Ketchup'
};

const teamName = $inputHiddenTeam.val();

/**
 * Indique si le buzzer est bloqué
 */
let isLocked = true;

/**
 * Fait vibrer le téléphone si possible
 * @param {*} pattern durée(s) de vibration en ms
 */
const vibrate = function (pattern) {
    if (navigator.vibrate)
        navigator.vibrate(pattern);
}

/**
 * Met à jour l'affichage du buzzer
 * @param {*} locked Indique si le buzzer est bloqué
 * @param {*} message Le message à afficher sous le buzzer
 */
const displayState = function (locked, message) {
    isLocked = locked;
    $buzzButton.toggleClass(lockBuzzerStyle, locked);
    $buzzerMessage.text(message);
}

/**
 * Message à afficher suivant l'équipe ayant buzzé
 * @param {*} buzzTeam L'équipe ayant buzzé (ou null)
 */
const messageForBuzz = function (buzzTeam) {
    if (!buzzTeam)
        return 'En attente…';
    if (buzzTeam === teamName)
        return 'Vous avez buzzé !';
    return teamLabels[buzzTeam] + ' a buzzé';
}

/**
 * Empêche l'écran du téléphone de se mettre en veille pendant la partie
 */
const keepScreenAwake = function () {
    if (!('wakeLock' in navigator))
        return;
    const request = function () {
        navigator.wakeLock.request('screen').catch(function (error) {
            console.log('Wake lock impossible : ' + error);
        });
    }
    request();
    // Le verrou est relâché quand la page est masquée : on le redemande au retour
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible')
            request();
    });
}

/**
 * Initialise les events
 */
const initEvents = function () {
    $buzzButton.on('click', function () {
        // Si le bouton est bloqué on emet rien
        if (isLocked)
            return;
        vibrate(50);
        socket.emit(messages.messageClientSendBuzz, teamName);
    });
}

/**
 * Initialise la socket et ecoute les eventuelles messages
 */
const initSocketAndListenEvents = function () {
    socket = io();
    socket.on(messages.messageToClientReceiveStateBuzzer, function (buzzerIsLocked, buzzTeam) {
        if (buzzerIsLocked)
            displayState(true, messageForBuzz(buzzTeam));
        else
            displayState(false, 'Buzzez !');
    });
    /**
     * Bloquer le buzzer
     */
    socket.on(messages.messageToClientLockBuzz, function () {
        displayState(true, 'En attente…');
    });
    /**
     * Débloquer le buzzer
     */
    socket.on(messages.messageToClientUnLockBuzz, function () {
        displayState(false, 'Buzzez !');
    });
    /**
     * Une équipe a buzzé
     */
    socket.on(messages.messageToClientReceiveBuzz, function (buzzTeam) {
        displayState(true, messageForBuzz(buzzTeam));
        if (buzzTeam === teamName)
            vibrate([100, 50, 100]);
    });
    /**
     * Connexion perdue : on bloque le buzzer en attendant la reconnexion
     */
    socket.on('disconnect', function () {
        displayState(true, 'Connexion perdue…');
    });
    /**
     * On souhaite connaitre l'état du buzzer
     * Dès que l'on se connecte (ou se reconnecte) sur la page
     */
    socket.on('connect', function () {
        socket.emit(messages.messageClientNeedStateBuzzer);
    });
}

// Par défaut on bloque le bouton au démarrage
displayState(true, 'Connexion…');

initEvents();

initSocketAndListenEvents();

keepScreenAwake();
