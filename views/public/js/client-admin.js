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
const $buttonGoodAnswer = $('#button-good-answer');
const $buttonUndo = $('#button-undo');
const $buttonStartGame = $('#button-start-game');
const $buttonToggleVictory = $('#button-toggle-victory');
const $buzzersKetchup = $('#buzzers-ketchup');
const $buzzersMayo = $('#buzzers-mayo');
const $deathBurgerPanel = $('#death-burger-panel');
const $deathBurgerCount = $('#death-burger-count');
const $timerDisplay = $('#timer-display');
const $inputTimerSeconds = $('#input-timer-seconds');
const $buttonTimerStart = $('#button-timer-start');
const $buttonTimerReset = $('#button-timer-reset');
const $selectBuzzTimer = $('#select-buzz-timer');

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
const $questionChoices = $('#question-choices');
const $questionAnswer = $('#question-answer');
const $questionPoints = $('#question-points');
const $questionNote = $('#question-note');
const $screenControls = $('#screen-controls');
const $buttonToggleScreenQuestion = $('#button-toggle-screen-question');
const $buttonToggleRevealAnswer = $('#button-toggle-reveal-answer');
const $mediaControls = $('#media-controls');
const $buttonPlayQuestionMedia = $('#button-play-question-media');
const $buttonPlayAnswerMedia = $('#button-play-answer-media');
const $buttonStopMedia = $('#button-stop-media');
const $menusChoice = $('#menus-choice');
const $menusList = $('#menus-list');
const $menusBack = $('#menus-back');
const $buttonBackToMenus = $('#button-back-to-menus');
const $menusTeam = $('#menus-team');
const $buttonToggleRoundCard = $('#button-toggle-round-card');
const $deathBurgerQuestions = $('#death-burger-questions');
const $deathBurgerQuestionsList = $('#death-burger-questions-list');

const $buzzerStatus = $('#buzzer-status');
const $connectionStatus = $('#connection-status');

/**
 * Etat du jeu utile à la télécommande
 */
let buzzTeam = null;
let deathBurgerActive = false;
let timer = { visible: false, running: false, remaining: 0, endsAt: 0 };
let currentRoundKey = null;
/**
 * Les menus : équipe qui choisit (proposée automatiquement, modifiable)
 */
let menusTeam = null;
let menusTeamChosen = false;
let points = { 'team-mayo': 0, 'team-ketchup': 0 };

/**
 * Actions de la télécommande (utilisées par les boutons et les raccourcis clavier)
 */
const actions = {
    addPointMayo: function () { socket.emit(messages.messageMayoTeam, messages.messageAdd); },
    removePointMayo: function () { socket.emit(messages.messageMayoTeam, messages.messageRemove); },
    addPointKetchup: function () { socket.emit(messages.messageKetchupTeam, messages.messageAdd); },
    removePointKetchup: function () { socket.emit(messages.messageKetchupTeam, messages.messageRemove); },
    badResponse: function () { socket.emit(messages.messageBuzzBadResponse); },
    goodAnswer: function () {
        if (!$buttonGoodAnswer.prop('disabled'))
            socket.emit(messages.messageGoodAnswer);
    },
    undo: function () { socket.emit(messages.messageUndo); },
    toggleTimer: function () {
        if (timer.running)
            socket.emit(messages.messageTimerPause);
        else
            socket.emit(messages.messageTimerStart, parseInt($inputTimerSeconds.val(), 10));
    },
    resetTimer: function () { socket.emit(messages.messageTimerReset); },
    toggleVictory: function () { socket.emit(messages.messageToggleVictory); },
    startGame: function () { socket.emit(messages.messageStartGame); },
    lockBuzzer: function () { socket.emit(messages.messageLockBuzz); },
    unlockBuzzer: function () { socket.emit(messages.messageUnLockBuzz); },
    nextTransition: function () { socket.emit(messages.messageNextTransition); },
    previousTransition: function () { socket.emit(messages.messagePreviousTransition); },
    nextQuestion: function () { socket.emit(messages.messageNextQuestion); },
    previousQuestion: function () { socket.emit(messages.messagePreviousQuestion); },
    toggleScreenQuestion: function () { socket.emit(messages.messageToggleScreenQuestion); },
    toggleRevealAnswer: function () { socket.emit(messages.messageToggleRevealAnswer); },
    playQuestionMedia: function () { socket.emit(messages.messagePlayMedia, 'questionMedia'); },
    playAnswerMedia: function () { socket.emit(messages.messagePlayMedia, 'answerMedia'); },
    stopMedia: function () { socket.emit(messages.messageStopMedia); },
    backToMenus: function () { socket.emit(messages.messageBackToMenus); },
    toggleRoundCard: function () {
        if (!$buttonToggleRoundCard.prop('disabled'))
            socket.emit(messages.messageToggleRoundCard);
    }
};

/**
 * Raccourcis clavier : touche (en minuscule) -> [action, action avec Maj]
 */
const shortcuts = {
    'k': [actions.addPointKetchup, actions.removePointKetchup],
    'm': [actions.addPointMayo, actions.removePointMayo],
    'enter': [actions.goodAnswer],
    'x': [actions.badResponse],
    'z': [actions.undo],
    't': [actions.toggleTimer, actions.resetTimer],
    'v': [actions.toggleVictory],
    'g': [actions.startGame],
    'd': [actions.unlockBuzzer],
    'b': [actions.lockBuzzer],
    'n': [actions.nextTransition],
    'p': [actions.previousTransition],
    'arrowright': [actions.nextQuestion],
    'arrowleft': [actions.previousQuestion],
    'c': [actions.toggleRoundCard],
    'e': [actions.toggleScreenQuestion],
    'r': [actions.toggleRevealAnswer],
    'j': [actions.playQuestionMedia, actions.playAnswerMedia],
    's': [actions.stopMedia]
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
    $buttonGoodAnswer.on('click', actions.goodAnswer);
    $buttonUndo.on('click', actions.undo);
    $buttonTimerStart.on('click', actions.toggleTimer);
    $buttonTimerReset.on('click', actions.resetTimer);
    $buttonToggleVictory.on('click', actions.toggleVictory);
    $buttonStartGame.on('click', actions.startGame);
    $selectBuzzTimer.on('change', function () {
        socket.emit(messages.messageSetBuzzTimer, parseInt($selectBuzzTimer.val(), 10));
    });
    $buttonNextQuestion.on('click', actions.nextQuestion);
    $buttonPreviousQuestion.on('click', actions.previousQuestion);
    $buttonToggleScreenQuestion.on('click', actions.toggleScreenQuestion);
    $buttonToggleRevealAnswer.on('click', actions.toggleRevealAnswer);
    $buttonPlayQuestionMedia.on('click', actions.playQuestionMedia);
    $buttonPlayAnswerMedia.on('click', actions.playAnswerMedia);
    $buttonStopMedia.on('click', actions.stopMedia);
    $buttonBackToMenus.on('click', actions.backToMenus);
    $menusList.on('click', '.button-select-menu', function () {
        socket.emit(messages.messageSelectMenu, $(this).data('menu'), menusTeam);
        menusTeamChosen = false;
    });
    $menusTeam.on('click', 'button', function () {
        menusTeamChosen = true;
        displayMenusTeam($(this).data('team'));
    });
    $buttonToggleRoundCard.on('click', actions.toggleRoundCard);
    $menusList.on('click', '.button-lock-menu', function () {
        socket.emit(messages.messageToggleMenuLock, $(this).data('menu'));
    });
    $deathBurgerQuestionsList.on('click', 'li', function () {
        socket.emit(messages.messageGoToQuestion, $(this).data('index'));
    });
    $selectParty.on('change', function () {
        socket.emit(messages.messageSelectParty, $selectParty.val() || null);
    });
}

/**
 * Initialise les raccourcis clavier
 */
const initShortcuts = function () {
    $(document).on('keydown', function (event) {
        if ($(event.target).is('input[type=text], input[type=password], input[type=number], textarea, select'))
            return;
        // Ctrl+Z (Cmd+Z sur Mac) : annuler
        if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'z') {
            event.preventDefault();
            actions.undo();
            return;
        }
        // On ne gêne pas les combinaisons système ni la saisie
        if (event.ctrlKey || event.metaKey || event.altKey || event.repeat)
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
 * @param {*} lockedOutTeams Les équipes s'étant trompées (elles ont perdu la main)
 */
const displayBuzzerState = function (isLocked, teamName, lockedOutTeams) {
    lockedOutTeams = lockedOutTeams || [];
    buzzTeam = teamName && teamLabels[teamName] ? teamName : null;
    let text = isLocked ? 'Buzzer bloqué' : 'Buzzer débloqué';
    let style = isLocked ? 'badge-secondary' : 'badge-success';
    if (buzzTeam) {
        text = teamLabels[buzzTeam] + ' a buzzé !';
        style = buzzTeam === 'team-mayo' ? 'badge-warning' : 'badge-danger';
    } else if (!isLocked && lockedOutTeams.length) {
        const others = Object.keys(teamLabels).filter(function (team) { return lockedOutTeams.indexOf(team) === -1; });
        text = 'Main à ' + others.map(function (team) { return teamLabels[team]; }).join(', ');
    } else if (isLocked && lockedOutTeams.length) {
        text = 'Personne n\'a trouvé';
    }
    $buzzerStatus.text(text)
        .removeClass('badge-secondary badge-success badge-warning badge-danger')
        .addClass(style);
    displayGoodAnswerButton();
}

/**
 * Bonne réponse possible : une équipe a buzzé, ou Burger de la mort
 */
const displayGoodAnswerButton = function () {
    $buttonGoodAnswer.prop('disabled', !buzzTeam && !deathBurgerActive)
        .attr('title', buzzTeam
            ? 'Bonne réponse de ' + teamLabels[buzzTeam] + ' (Entrée)'
            : 'Bonne réponse (Entrée)');
}

/**
 * Compteur du Burger de la mort
 * @param {*} state { active, count, total }
 */
const displayDeathBurger = function (state) {
    deathBurgerActive = state.active;
    $deathBurgerPanel.prop('hidden', !state.active);
    $deathBurgerCount.text(state.count + ' / ' + state.total);
    displayGoodAnswerButton();
}

/**
 * Chrono : décompte local à partir du temps restant envoyé par le serveur
 * @param {*} state { visible, running, duration, remaining }
 */
const displayTimer = function (state) {
    timer = {
        visible: state.visible,
        running: state.running,
        remaining: state.remaining,
        endsAt: Date.now() + state.remaining
    };
    $buttonTimerStart.html(state.running ? '&#10074;&#10074; Pause' : (state.visible && state.remaining > 0 ? '&#9654; Reprendre' : '&#9654; Lancer'))
        .toggleClass('btn-success', !state.running)
        .toggleClass('btn-warning', state.running);
    renderTimer();
}

const renderTimer = function () {
    if (!timer.visible) {
        $timerDisplay.text('--');
        return;
    }
    const remaining = timer.running ? Math.max(timer.endsAt - Date.now(), 0) : timer.remaining;
    $timerDisplay.text(Math.ceil(remaining / 1000) + ' s');
}

/**
 * Etat réservé à la télécommande
 * @param {*} state { canUndo, buzzers, buzzTimerSeconds, victoryVisible, gameStarted }
 */
const displayAdminState = function (state) {
    $buttonUndo.prop('disabled', !state.canUndo);
    $buzzersKetchup.text('Ketchup : ' + state.buzzers['team-ketchup']);
    $buzzersMayo.text('Mayo : ' + state.buzzers['team-mayo']);
    $selectBuzzTimer.val(String(state.buzzTimerSeconds));
    $buttonToggleVictory.val(state.victoryVisible ? "Masquer l'écran de victoire" : "Afficher l'écran de victoire");
    $buttonStartGame.val(state.gameStarted ? 'Partie démarrée à l\'écran' : 'Démarrer la partie à l\'écran')
        .toggleClass('btn-primary', !state.gameStarted)
        .toggleClass('btn-outline-primary', state.gameStarted);
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
 * Affiche le bouton de lecture d'un son / d'une vidéo (masqué si absent)
 * @param {*} $button Le bouton
 * @param {*} media { file, type, name } ou null
 * @param {*} target 'de la question' / 'de la réponse'
 */
const displayMediaButton = function ($button, media, target) {
    $button.prop('hidden', !media);
    if (!media)
        return;
    $button.text('\u25B6 ' + (media.type === 'video' ? 'Vidéo ' : 'Son ') + target)
        .attr('title', media.name || '');
}

/**
 * Les menus : boutons de choix du menu (ceux verrouillés sont désactivés)
 * Et de verrouillage / déverrouillage à la main
 * @param {*} menus { current, list: [{ name, played }] } ou null hors de la manche
 */
const displayMenus = function (menus) {
    const choosing = !!menus && menus.current === null;
    // Equipe qui choisit : l'autre équipe que celle du dernier menu, sinon celle qui a le moins de points
    if (choosing && !menusTeamChosen) {
        const chosen = menus.list.filter(function (menu) { return menu.team; });
        if (chosen.length)
            displayMenusTeam(chosen[chosen.length - 1].team === 'team-mayo' ? 'team-ketchup' : 'team-mayo');
        else
            displayMenusTeam(points['team-mayo'] < points['team-ketchup'] ? 'team-mayo' : 'team-ketchup');
    }
    $menusChoice.prop('hidden', !choosing || !menus.list.length);
    $menusBack.prop('hidden', !menus || menus.current === null);
    $menusList.empty();
    if (!choosing)
        return;
    menus.list.forEach(function (menu, index) {
        const $select = $('<button type="button" class="btn btn-lg button-select-menu"></button>')
            .addClass(menu.played ? 'btn-outline-secondary' : 'btn-primary')
            .prop('disabled', menu.played)
            .data('menu', menu.name)
            .text((menu.name || 'Menu ' + (index + 1)) + ' (' + menu.count + ')'
                + (menu.team ? ' — ' + teamLabels[menu.team] : '') + (menu.played ? ' (verrouillé)' : ''));
        const $lock = $('<button type="button" class="btn btn-lg button-lock-menu"></button>')
            .addClass(menu.played ? 'btn-secondary' : 'btn-outline-primary')
            .data('menu', menu.name)
            .attr('title', menu.played ? 'Déverrouiller le menu' : 'Verrouiller le menu')
            .html(menu.played ? '&#128275;' : '&#128274;');
        $menusList.append($('<div class="btn-group mr-2 mb-2"></div>').append($select, $lock));
    });
}

/**
 * Les menus : équipe qui choisit le prochain menu
 */
const displayMenusTeam = function (team) {
    menusTeam = team;
    $menusTeam.find('button').each(function () {
        const active = $(this).data('team') === team;
        $(this).toggleClass('active', active)
            .toggleClass('btn-danger', active && team === 'team-ketchup')
            .toggleClass('btn-warning', active && team === 'team-mayo');
    });
}

/**
 * Carton de manche à l'écran
 * @param {*} state { visible, number, label, rules }
 */
const displayRoundCard = function (state) {
    $buttonToggleRoundCard.prop('disabled', !state.label)
        .text(state.visible ? 'Masquer le carton de manche' : 'Afficher le carton de manche');
}

/**
 * Burger de la mort : toutes les questions et réponses, la question en cours en avant
 * @param {*} list [{ question, answer }] ou null hors de la manche
 * @param {*} index L'index de la question en cours
 */
const displayDeathBurgerQuestions = function (list, index) {
    $deathBurgerQuestions.prop('hidden', !list || !list.length);
    $deathBurgerQuestionsList.empty();
    (list || []).forEach(function (item, position) {
        $deathBurgerQuestionsList.append($('<li class="list-group-item list-group-item-action py-1"></li>')
            .toggleClass('active', position === index)
            .data('index', position)
            .append($('<span></span>').text((position + 1) + '. ' + item.question))
            .append($('<strong class="ml-2"></strong>').text(item.answer ? '→ ' + item.answer : '')));
    });
    // La question en cours reste visible dans la liste (sans faire défiler la page)
    const current = $deathBurgerQuestionsList.children('.active').get(0);
    if (current)
        $deathBurgerQuestionsList.scrollTop(current.offsetTop - $deathBurgerQuestionsList.height() / 2);
}

/**
 * Affiche la partie sélectionnée et la question en cours (avec sa réponse)
 * @param {*} state { parties, activePartyId, round, index, total, question, menus }
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
    else if (state.menus && state.menus.current === null)
        status = state.menus.list.length ? state.round + ' : choisissez un menu' : state.round + ' : aucune question';
    else if (state.menus)
        status = state.round + ' — ' + (state.menus.current || 'Menu') + ' : question ' + (state.index + 1) + ' / ' + state.total;
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
    $questionPoints.text(question ? question.points + (question.points > 1 ? ' miams' : ' miam') : '');
    $questionNote.prop('hidden', !question || !question.note).text(question && question.note ? question.note : '');
    // Nouvelle manche : la durée du chrono proposée est celle de la manche
    if (state.roundKey !== currentRoundKey) {
        currentRoundKey = state.roundKey;
        $inputTimerSeconds.val(state.timerSeconds);
    }
    $questionChoices.empty();
    (question && question.choices ? question.choices : []).forEach(function (choice) {
        $questionChoices.append($('<li></li>').text(choice));
    });

    displayMenus(state.menus);
    displayDeathBurgerQuestions(state.list, state.index);
    // Nuggets, Sel ou Poivre et menus : la question (ou ses propositions, ou les noms des menus) s'affiche aussi sur l'écran de jeu
    const choosingMenu = !!(state.menus && state.menus.current === null && state.menus.list.length);
    $screenControls.prop('hidden', !(question || choosingMenu) || !state.questionsOnScreen);
    $buttonToggleScreenQuestion.text(state.screenVisible ? "Masquer de l'écran" : "Afficher à l'écran");
    $buttonToggleRevealAnswer.text(state.answerRevealed ? "Cacher la réponse à l'écran" : "Révéler la réponse à l'écran")
        .prop('disabled', !state.screenVisible || !question || !question.answer);
    // Son / vidéo : joué sur l'écran de jeu, quelle que soit la manche
    const questionMedia = question ? question.questionMedia : null;
    const answerMedia = question ? question.answerMedia : null;
    $mediaControls.prop('hidden', !questionMedia && !answerMedia);
    displayMediaButton($buttonPlayQuestionMedia, questionMedia, 'de la question');
    displayMediaButton($buttonPlayAnswerMedia, answerMedia, 'de la réponse');
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
    socket.on(messages.messageToClientReceiveStateBuzzer, displayBuzzerState);
    socket.on(messages.messageToClientReceiveStateAdmin, displayAdminState);
    socket.on(messages.messageToClientReceiveDeathBurger, displayDeathBurger);
    socket.on(messages.messageToClientReceiveTimer, displayTimer);
    socket.on(messages.messageToClientReceiveStateTransition, displayTransitionState);
    socket.on(messages.messageToClientReceiveStateQuestion, displayQuestionState);
    socket.on(messages.messageToClientReceiveRoundCard, displayRoundCard);
    socket.on(messages.messageToClientMayo, function (value) { points['team-mayo'] = value; });
    socket.on(messages.messageToClientKetchup, function (value) { points['team-ketchup'] = value; });
    socket.on(messages.messageToClientReceivePoints, function (mayo, ketchup) {
        points = { 'team-mayo': mayo, 'team-ketchup': ketchup };
    });
    socket.on('disconnect', function () {
        displayConnectionState(false);
    });
    // Récupère l'état courant à la connexion (et à chaque reconnexion)
    socket.on('connect', function () {
        displayConnectionState(true);
        socket.emit(messages.messageClientNeedStateBuzzer);
        socket.emit(messages.messageClientNeedStateTransition);
        socket.emit(messages.messageClientNeedStateQuestion);
        socket.emit(messages.messageClientNeedStateAdmin);
        socket.emit(messages.messageClientsNeedPointsInformations);
    });
    setInterval(renderTimer, 250);
}

initEvents();

initShortcuts();

listenGameState();
