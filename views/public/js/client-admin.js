// Socket node
const socket = io();

// Noms des messages partagés avec le serveur (/js/messages-socket.js)
const messages = BQ_MESSAGES;

const teamLabels = {
    'team-mayo': 'Mayo',
    'team-ketchup': 'Ketchup'
};

const $buttonAddPointMayo = $('#button-add-point-mayo');
const $buttonRemovePointMayo = $('#button-remove-point-mayo');
const $buttonAddPointKetchup = $('#button-add-point-ketchup');
const $buttonRemovePointKetchup = $('#button-remove-point-ketchup');
const $buttonBuzzBadResponse = $('#button-buzz-bad-response');

const $buttonLockBuzzer = $('#button-lock-buzz');
const $buttonUnLockBuzzer = $('#button-unlock-buzz');
const $buttonReloadPart = $('#button-reload-part');

const $buttonNextTransition = $('#button-next-transition');
const $buttonPreviousTransition = $('#button-previous-transition');
const $transitionStatus = $('#transition-status');

const $modalReloadPartWarn = $('#modal-reload-part');
const $buzzerStatus = $('#buzzer-status');
const $connectionStatus = $('#connection-status');

/**
 * Actions de la télécommande (utilisées par les boutons et les raccourcis clavier)
 */
const actions = {
    addPointMayo: function () { socket.emit(messages.messageMayoTeam, messages.messageAdd); },
    removePointMayo: function () { socket.emit(messages.messageMayoTeam, messages.messageRemove); },
    addPointKetchup: function () { socket.emit(messages.messageKetchupTeam, messages.messageAdd); },
    removePointKetchup: function () { socket.emit(messages.messageKetchupTeam, messages.messageRemove); },
    badResponse: function () { socket.emit(messages.messageBuzzBadResponse); },
    lockBuzzer: function () { socket.emit(messages.messageLockBuzz); },
    unlockBuzzer: function () { socket.emit(messages.messageUnLockBuzz); },
    nextTransition: function () { socket.emit(messages.messageNextTransition); },
    previousTransition: function () { socket.emit(messages.messagePreviousTransition); }
};

/**
 * Raccourcis clavier : touche (en minuscule) -> [action, action avec Maj]
 */
const shortcuts = {
    'k': [actions.addPointKetchup, actions.removePointKetchup],
    'm': [actions.addPointMayo, actions.removePointMayo],
    'x': [actions.badResponse],
    'd': [actions.unlockBuzzer],
    'b': [actions.lockBuzzer],
    'n': [actions.nextTransition],
    'p': [actions.previousTransition]
};

const initEvents = function () {
    $buttonAddPointMayo.on('click', actions.addPointMayo);
    $buttonRemovePointMayo.on('click', actions.removePointMayo);
    $buttonAddPointKetchup.on('click', actions.addPointKetchup);
    $buttonRemovePointKetchup.on('click', actions.removePointKetchup);
    $buttonReloadPart.on('click', function () {
        socket.emit(messages.messageReloadPart);
        $modalReloadPartWarn.modal('hide');
    });
    $buttonLockBuzzer.on('click', actions.lockBuzzer);
    $buttonUnLockBuzzer.on('click', actions.unlockBuzzer);
    $buttonNextTransition.on('click', actions.nextTransition);
    $buttonPreviousTransition.on('click', actions.previousTransition);
    $buttonBuzzBadResponse.on('click', actions.badResponse);
}

/**
 * Initialise les raccourcis clavier
 */
const initShortcuts = function () {
    $(document).on('keydown', function (event) {
        // On ne gêne pas les combinaisons système ni la saisie
        if (event.ctrlKey || event.metaKey || event.altKey || event.repeat)
            return;
        if ($(event.target).is('input[type=text], input[type=password], textarea'))
            return;
        // Pas de raccourci tant que la modal de rechargement est ouverte
        if ($modalReloadPartWarn.hasClass('show'))
            return;
        const shortcut = shortcuts[event.key.toLowerCase()];
        if (!shortcut)
            return;
        const action = event.shiftKey && shortcut[1] ? shortcut[1] : shortcut[0];
        event.preventDefault();
        action();
    });
}

/**
 * Affiche l'état du buzzer et l'équipe ayant buzzé en premier
 * @param {*} isLocked Indique si le buzzer est bloqué
 * @param {*} teamName L'équipe ayant buzzé (ou null)
 */
const displayBuzzerState = function (isLocked, teamName) {
    let text = isLocked ? 'Buzzer bloqué' : 'Buzzer débloqué';
    let style = isLocked ? 'badge-secondary' : 'badge-success';
    if (teamName && teamLabels[teamName]) {
        text = teamLabels[teamName] + ' a buzzé !';
        style = teamName === 'team-mayo' ? 'badge-warning' : 'badge-danger';
    }
    $buzzerStatus.text(text)
        .removeClass('badge-secondary badge-success badge-warning badge-danger')
        .addClass(style);
}

/**
 * Affiche la transition en cours et la suivante
 * @param {*} state { current, next, hasPrevious }
 */
const displayTransitionState = function (state) {
    const current = state.current ? 'En cours : ' + state.current : 'Aucune transition jouée';
    const next = state.next ? 'Suivante : ' + state.next : 'Fin de partie';
    $transitionStatus.text(current + ' — ' + next);
    $buttonNextTransition.prop('disabled', !state.next);
    $buttonPreviousTransition.prop('disabled', !state.hasPrevious);
}

/**
 * Affiche l'état de la connexion au serveur
 */
const displayConnectionState = function (isConnected) {
    $connectionStatus.text(isConnected ? 'Connecté' : 'Déconnecté…')
        .toggleClass('badge-success', isConnected)
        .toggleClass('badge-danger', !isConnected);
}

/**
 * Ecoute les changements d'état du jeu
 */
const listenGameState = function () {
    let lastBuzzTeam = null;
    socket.on(messages.messageToClientReceiveStateBuzzer, function (isLocked, teamName) {
        lastBuzzTeam = teamName;
        displayBuzzerState(isLocked, teamName);
    });
    socket.on(messages.messageToClientLockBuzz, function () {
        displayBuzzerState(true, lastBuzzTeam);
    });
    socket.on(messages.messageToClientUnLockBuzz, function () {
        lastBuzzTeam = null;
        displayBuzzerState(false, null);
    });
    socket.on(messages.messageToClientReceiveBuzz, function (teamName) {
        lastBuzzTeam = teamName;
        displayBuzzerState(true, teamName);
    });
    socket.on(messages.messageToClientReceiveStateTransition, displayTransitionState);
    socket.on('disconnect', function () {
        displayConnectionState(false);
    });
    // Récupère l'état courant à la connexion (et à chaque reconnexion)
    socket.on('connect', function () {
        displayConnectionState(true);
        socket.emit(messages.messageClientNeedStateBuzzer);
        socket.emit(messages.messageClientNeedStateTransition);
    });
}

initEvents();

initShortcuts();

listenGameState();
