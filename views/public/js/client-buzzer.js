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
const buzzedFirstStyle = 'buzzed-first';

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
 * L'autre équipe vient de buzzer : un appui est encore envoyé au serveur
 * Pendant un court instant pour afficher l'écart à l'écran (sans prendre la main)
 */
let lateBuzzUntil = 0;
const lateBuzzWindow = 2000;

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
 * @param {*} buzzedFirst Indique si notre équipe a buzzé en premier (écran aux couleurs de l'équipe)
 */
const displayState = function (locked, message, buzzedFirst) {
    isLocked = locked;
    $buzzButton.toggleClass(lockBuzzerStyle, locked);
    $buzzerMessage.text(message);
    $('body').toggleClass(buzzedFirstStyle, !!buzzedFirst);
}

/**
 * Affiche l'état du buzzer envoyé par le serveur
 * @param {*} locked Les buzzers sont bloqués
 * @param {*} buzzTeam L'équipe ayant buzzé (ou null)
 * @param {*} lockedOutTeams Les équipes s'étant trompées (elles ont perdu la main)
 */
const displayServerState = function (locked, buzzTeam, lockedOutTeams) {
    lockedOutTeams = lockedOutTeams || [];
    const lockedOut = lockedOutTeams.indexOf(teamName) !== -1;
    if (buzzTeam === teamName)
        displayState(true, 'À vous !', true);
    else if (buzzTeam)
        displayState(true, teamLabels[buzzTeam] + ' a buzzé');
    else if (!locked && lockedOut)
        displayState(true, "Raté… la main passe à l'autre équipe");
    else if (!locked && lockedOutTeams.length)
        displayState(false, 'À vous la main ! Buzzez !');
    else if (!locked)
        displayState(false, 'Buzzez !');
    else
        displayState(true, 'En attente…');
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
        // Sauf juste après le buzz de l'autre équipe : le serveur mesure l'écart
        if (isLocked) {
            if (Date.now() < lateBuzzUntil) {
                lateBuzzUntil = 0;
                socket.emit(messages.messageClientSendBuzz, teamName);
            }
            return;
        }
        vibrate(50);
        socket.emit(messages.messageClientSendBuzz, teamName);
    });
}

/**
 * Initialise la socket et ecoute les eventuelles messages
 */
const initSocketAndListenEvents = function () {
    socket = io();
    /**
     * Etat du buzzer (envoyé à chaque changement)
     */
    socket.on(messages.messageToClientReceiveStateBuzzer, displayServerState);
    /**
     * Une équipe a buzzé
     */
    socket.on(messages.messageToClientReceiveBuzz, function (buzzTeam) {
        if (buzzTeam === teamName)
            vibrate([100, 50, 100]);
        else
            lateBuzzUntil = Date.now() + lateBuzzWindow;
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
        socket.emit(messages.messageClientRegisterBuzzer, teamName);
        socket.emit(messages.messageClientNeedStateBuzzer);
    });
}

// Par défaut on bloque le bouton au démarrage
displayState(true, 'Connexion…');

initEvents();

initSocketAndListenEvents();

keepScreenAwake();
