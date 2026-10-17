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
const $selectParty = $('#select-party');
const $buttonNextQuestion = $('#button-next-question');
const $buttonPreviousQuestion = $('#button-previous-question');
const $questionStatus = $('#question-status');
const $questionContent = $('#question-content');
const $questionTheme = $('#question-theme');
const $questionText = $('#question-text');
const $questionAnswer = $('#question-answer');

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
    previousTransition: function () { socket.emit(messages.messagePreviousTransition); },
    nextQuestion: function () { socket.emit(messages.messageNextQuestion); },
    previousQuestion: function () { socket.emit(messages.messagePreviousQuestion); }
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
    'p': [actions.previousTransition],
    'arrowright': [actions.nextQuestion],
    'arrowleft': [actions.previousQuestion]
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
    $buttonNextQuestion.on('click', actions.nextQuestion);
    $buttonPreviousQuestion.on('click', actions.previousQuestion);
    $selectParty.on('change', function () {
        socket.emit(messages.messageSelectParty, $selectParty.val() || null);
    });
}

/**
 * Initialise les raccourcis clavier
 */
const initShortcuts = function () {
    $(document).on('keydown', function (event) {
        // On ne gêne pas les combinaisons système ni la saisie
        if (event.ctrlKey || event.metaKey || event.altKey || event.repeat)
            return;
        if ($(event.target).is('input[type=text], input[type=password], textarea, select'))
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
 * Affiche la partie sélectionnée et la question en cours (avec sa réponse)
 * @param {*} state { parties, activePartyId, round, index, total, question }
 */
const displayQuestionState = function (state) {
    $selectParty.find('option:not([value=""])').remove();
    state.parties.forEach(function (party) {
        $selectParty.append($('<option></option>')
            .val(party.id)
            .text(party.name + ' (' + party.questionsCount + ')'));
    });
    $selectParty.val(state.activePartyId || '');

    let status;
    if (!state.activePartyId)
        status = 'Choisissez une partie pour afficher les questions';
    else if (!state.round)
        status = 'Lancez une transition pour commencer la manche';
    else if (!state.total)
        status = state.round + ' : aucune question';
    else
        status = state.round + ' : question ' + (state.index + 1) + ' / ' + state.total;
    $questionStatus.text(status);

    const question = state.question;
    $questionContent.prop('hidden', !question);
    $questionTheme.text(question ? question.theme : '');
    $questionText.text(question ? question.question : '');
    $questionAnswer.text(question && question.answer ? 'Réponse : ' + question.answer : '');
    $buttonPreviousQuestion.prop('disabled', !question || state.index <= 0);
    $buttonNextQuestion.prop('disabled', !question || state.index >= state.total - 1);
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
    socket.on(messages.messageToClientReceiveStateQuestion, displayQuestionState);
    socket.on('disconnect', function () {
        displayConnectionState(false);
    });
    // Récupère l'état courant à la connexion (et à chaque reconnexion)
    socket.on('connect', function () {
        displayConnectionState(true);
        socket.emit(messages.messageClientNeedStateBuzzer);
        socket.emit(messages.messageClientNeedStateTransition);
        socket.emit(messages.messageClientNeedStateQuestion);
    });
}

initEvents();

initShortcuts();

listenGameState();
