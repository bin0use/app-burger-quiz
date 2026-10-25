const Team = require('./models/team');
const { transitionsList, deathBurgerRound } = require('./models/rounds');
const messages = require('../config/messages-socket');
const { createStateStore } = require('./services/state-store');
const { createPartyStore, mediaFields } = require('./services/party-store');

/**
 * Noms d'équipes acceptés pour le buzz
 */
const validTeamNames = ['team-mayo', 'team-ketchup'];

/**
 * Salle socket.io regroupant les télécommandes admin
 * (les questions et réponses ne sont envoyées qu'à elles)
 */
const adminRoom = 'admins';

/**
 * Nombre de bonnes réponses d'affilée pour gagner le Burger de la mort
 */
const deathBurgerTotal = 10;

/**
 * Nombre d'actions mémorisées pour « Annuler »
 */
const historySize = 30;

/**
 * Délai (ms) pendant lequel le buzz de l'autre équipe est chronométré
 * Pour afficher l'écart avec le premier buzz
 */
const buzzGapWindow = 2000;

/**
 * Durées acceptées pour le chrono (en secondes)
 */
const timerMaxSeconds = 600;
const buzzTimerMaxSeconds = 60;

/**
 * @param {*} io Le serveur socket.io
 * @param {*} options.stateFile Fichier de sauvegarde de la partie (optionnel)
 * @param {*} options.partyStore Stockage des parties et questions (optionnel)
 */
module.exports = function (io, options) {
    options = options || {};
    const store = createStateStore(options.stateFile);
    const partyStore = options.partyStore || createPartyStore(null);

    const teamMayo = new Team('mayo');
    const teamKetchup = new Team('ketchup');
    const teams = { 'team-mayo': teamMayo, 'team-ketchup': teamKetchup };
    const pointsMessages = {
        'team-mayo': messages.messageToClientMayo,
        'team-ketchup': messages.messageToClientKetchup
    };
    /**
     * Etat du buzzer
     */
    let buzzerIsLock = true;
    /**
     * Equipe ayant buzzé en premier depuis le dernier déblocage
     */
    let firstBuzzTeam = null;
    let firstBuzzAt = 0;
    let buzzGapSent = false;
    /**
     * Equipes s'étant trompées depuis le dernier déblocage :
     * la main passe à l'autre équipe, leurs buzzers restent bloqués
     */
    let lockedOutTeams = [];
    /**
     * Index de la dernière transition jouée (-1 : aucune)
     */
    let transitionIndex = -1;
    /**
     * Partie (jeu de questions) sélectionnée par l'admin
     */
    let activePartyId = null;
    /**
     * Index de la question en cours dans la manche en cours
     */
    let questionIndex = 0;
    /**
     * Question affichée sur l'écran de jeu (Nuggets, menus) et réponse révélée
     */
    let screenQuestionVisible = true;
    let answerRevealed = false;
    /**
     * Bonnes réponses d'affilée au Burger de la mort
     */
    let deathCount = 0;
    /**
     * Etats précédents pour « Annuler » (points, buzzer, Burger de la mort, réponse révélée)
     */
    let history = [];
    /**
     * Chrono affiché sur l'écran de jeu
     * remaining : temps restant (ms) quand il est en pause, endsAt : fin prévue quand il tourne
     */
    const timer = { duration: 0, remaining: 0, endsAt: null, visible: false, fromBuzz: false, timeout: null };
    /**
     * Chrono de réponse lancé automatiquement après un buzz (0 : désactivé)
     */
    let buzzTimerSeconds = 0;
    /**
     * Ecran de victoire affiché, partie lancée depuis la télécommande
     */
    let victoryVisible = false;
    let gameStarted = false;

    /**
     * Restaure la partie sauvegardée (le buzzer repart toujours bloqué)
     */
    const restoreState = function () {
        const state = store.load();
        if (!state)
            return;
        teamMayo.setPoints(state.mayo);
        teamKetchup.setPoints(state.ketchup);
        if (Number.isInteger(state.transitionIndex)
            && state.transitionIndex >= -1
            && state.transitionIndex < transitionsList.length)
            transitionIndex = state.transitionIndex;
        if (typeof state.activePartyId === 'string' && partyStore.get(state.activePartyId))
            activePartyId = state.activePartyId;
        if (Number.isInteger(state.questionIndex) && state.questionIndex >= 0)
            questionIndex = state.questionIndex;
        if (Number.isInteger(state.deathCount) && state.deathCount >= 0 && state.deathCount <= deathBurgerTotal)
            deathCount = state.deathCount;
        clampQuestionIndex();
    }

    const saveState = function () {
        store.save({
            mayo: teamMayo.points,
            ketchup: teamKetchup.points,
            transitionIndex: transitionIndex,
            activePartyId: activePartyId,
            questionIndex: questionIndex,
            deathCount: deathCount
        });
    }

    /**
     * Indique si la socket appartient à un admin authentifié
     * (session express partagée avec socket.io)
     */
    const isAdmin = function (socket) {
        const session = socket.request.session;
        return !!(session && session.passport && session.passport.user);
    }

    /**
     * Ecoute un message réservé à l'admin : ignoré pour les autres clients
     */
    const onAdminMessage = function (socket, message, handler) {
        socket.on(message, function () {
            if (!isAdmin(socket))
                return;
            handler.apply(null, arguments);
        });
    }

    /**
     * Informations sur les transitions pour la télécommande
     */
    const transitionState = function () {
        const current = transitionsList[transitionIndex];
        const next = transitionsList[transitionIndex + 1];
        return {
            current: current ? current.label : null,
            next: next ? next.label : null,
            hasPrevious: transitionIndex > 0
        };
    }

    /**
     * Questions de la manche en cours pour la partie active
     */
    const currentRoundQuestions = function () {
        const transition = transitionsList[transitionIndex];
        if (!activePartyId || !transition)
            return [];
        return partyStore.questionsOfRound(activePartyId, transition.round);
    }

    /**
     * Garde l'index de question dans les bornes de la manche en cours
     */
    const clampQuestionIndex = function () {
        const count = currentRoundQuestions().length;
        questionIndex = Math.min(Math.max(questionIndex, 0), Math.max(count - 1, 0));
    }

    /**
     * Informations sur les questions pour la télécommande (contient les réponses !)
     */
    const questionState = function () {
        const party = activePartyId ? partyStore.get(activePartyId) : null;
        const transition = transitionsList[transitionIndex];
        const questions = currentRoundQuestions();
        const question = questions[questionIndex];
        return {
            parties: partyStore.list().map(function (summary) {
                return { id: summary.id, name: summary.name, questionsCount: summary.questionsCount };
            }),
            activePartyId: party ? party.id : null,
            round: transition ? transition.label : null,
            roundKey: transition ? transition.round : null,
            timerSeconds: transition ? transition.timerSeconds : 30,
            index: questionIndex,
            total: questions.length,
            // Questions créées avant le barème et les notes : 1 point, pas de note
            question: question ? Object.assign({ points: 1, note: '' }, question) : null,
            questionsOnScreen: !!(transition && transition.questionsOnScreen),
            screenMode: transition ? transition.screenMode : null,
            screenVisible: screenQuestionVisible,
            answerRevealed: answerRevealed
        };
    }

    /**
     * Question affichée sur l'écran de jeu (null : rien à afficher)
     * La réponse n'est envoyée qu'une fois révélée par l'admin
     */
    const screenQuestion = function () {
        const transition = transitionsList[transitionIndex];
        const question = currentRoundQuestions()[questionIndex];
        if (!question || !transition.questionsOnScreen || !screenQuestionVisible)
            return null;
        const choices = question.choices || [];
        // Sel ou Poivre : la question est lue par l'animateur, seuls le thème et les propositions s'affichent
        const onlyChoices = transition.screenMode === 'choices';
        if (onlyChoices && !choices.length && !question.theme)
            return null;
        return {
            round: transition.label,
            theme: question.theme,
            question: onlyChoices ? '' : question.question,
            choices: choices,
            points: question.points || 1,
            answer: answerRevealed ? question.answer : null
        };
    }

    /**
     * Envoie l'état des questions à toutes les télécommandes
     * Et la question à afficher aux écrans de jeu
     */
    const emitQuestionState = function () {
        io.to(adminRoom).emit(messages.messageToClientReceiveStateQuestion, questionState());
        io.emit(messages.messageToClientReceiveScreenQuestion, screenQuestion());
    }

    /**
     * Nouvelle question : affichée à l'écran, réponse cachée, son ou vidéo arrêté
     */
    const resetScreenQuestion = function () {
        screenQuestionVisible = true;
        answerRevealed = false;
        io.emit(messages.messageToClientStopMedia);
    }

    /**
     * Question en cours (null si aucune)
     */
    const currentQuestion = function () {
        return currentRoundQuestions()[questionIndex] || null;
    }

    const isDeathBurgerRound = function () {
        const transition = transitionsList[transitionIndex];
        return !!(transition && transition.round === deathBurgerRound);
    }

    /**
     * Envoie l'état du buzzer à tous les clients :
     * bloqué, équipe ayant buzzé, équipes ayant perdu la main
     */
    const emitBuzzerState = function (target) {
        (target || io).emit(messages.messageToClientReceiveStateBuzzer, buzzerIsLock, firstBuzzTeam, lockedOutTeams.slice());
    }

    const emitPoints = function () {
        io.emit(messages.messageToClientMayo, teamMayo.points);
        io.emit(messages.messageToClientKetchup, teamKetchup.points);
    }

    /**
     * Compteur du Burger de la mort (affiché pendant la manche)
     */
    const deathBurgerState = function () {
        return { active: isDeathBurgerRound(), count: deathCount, total: deathBurgerTotal };
    }

    const emitDeathBurger = function (target) {
        (target || io).emit(messages.messageToClientReceiveDeathBurger, deathBurgerState());
    }

    /**
     * Ecran de victoire : équipe gagnante (null en cas d'égalité) et scores
     */
    const victoryState = function () {
        let winner = null;
        if (teamMayo.points > teamKetchup.points)
            winner = 'team-mayo';
        else if (teamKetchup.points > teamMayo.points)
            winner = 'team-ketchup';
        return { visible: victoryVisible, winner: winner, mayo: teamMayo.points, ketchup: teamKetchup.points };
    }

    const emitVictory = function (target) {
        (target || io).emit(messages.messageToClientReceiveVictory, victoryState());
    }

    /**
     * Etat du chrono : remaining en ms, recalculé au moment de l'envoi
     */
    const timerState = function () {
        const running = timer.endsAt !== null;
        return {
            visible: timer.visible,
            running: running,
            duration: timer.duration,
            remaining: running ? Math.max(timer.endsAt - Date.now(), 0) : timer.remaining
        };
    }

    const emitTimer = function (target) {
        (target || io).emit(messages.messageToClientReceiveTimer, timerState());
    }

    const clearTimerTimeout = function () {
        if (timer.timeout)
            clearTimeout(timer.timeout);
        timer.timeout = null;
    }

    /**
     * Lance le chrono pour la durée donnée (en secondes)
     * Un chrono en pause reprend là où il s'était arrêté (sauf chrono de réponse après un buzz)
     */
    const startTimer = function (seconds, fromBuzz) {
        const isPaused = timer.endsAt === null && timer.visible && timer.remaining > 0;
        if (fromBuzz || !isPaused) {
            if (!Number.isInteger(seconds) || seconds <= 0 || seconds > timerMaxSeconds)
                return;
            timer.duration = seconds;
            timer.remaining = seconds * 1000;
        }
        clearTimerTimeout();
        timer.visible = true;
        timer.fromBuzz = !!fromBuzz;
        timer.endsAt = Date.now() + timer.remaining;
        timer.timeout = setTimeout(function () {
            timer.timeout = null;
            timer.endsAt = null;
            timer.remaining = 0;
            emitTimer();
            io.emit(messages.messageToClientTimerEnded);
        }, timer.remaining);
        // Ne retient pas le processus (arrêt du serveur, tests)
        timer.timeout.unref();
        emitTimer();
    }

    const pauseTimer = function () {
        if (timer.endsAt === null)
            return;
        clearTimerTimeout();
        timer.remaining = Math.max(timer.endsAt - Date.now(), 0);
        timer.endsAt = null;
        emitTimer();
    }

    const resetTimer = function () {
        if (!timer.visible && timer.endsAt === null)
            return;
        clearTimerTimeout();
        timer.endsAt = null;
        timer.remaining = 0;
        timer.visible = false;
        timer.fromBuzz = false;
        emitTimer();
    }

    /**
     * La question après un buzz est terminée : son chrono de réponse disparait
     */
    const stopBuzzTimer = function () {
        if (timer.fromBuzz)
            resetTimer();
    }

    /**
     * Nombre de buzzers connectés par équipe
     */
    const buzzersCount = function () {
        const counts = {};
        validTeamNames.forEach(function (team) { counts[team] = 0; });
        io.of('/').sockets.forEach(function (client) {
            if (client.data.buzzerTeam)
                counts[client.data.buzzerTeam]++;
        });
        return counts;
    }

    /**
     * Etat réservé à la télécommande
     */
    const adminState = function () {
        return {
            canUndo: history.length > 0,
            buzzers: buzzersCount(),
            buzzTimerSeconds: buzzTimerSeconds,
            victoryVisible: victoryVisible,
            gameStarted: gameStarted
        };
    }

    const emitAdminState = function () {
        io.to(adminRoom).emit(messages.messageToClientReceiveStateAdmin, adminState());
    }

    /**
     * Mémorise l'état avant une action de l'animateur (pour « Annuler »)
     */
    const pushHistory = function () {
        history.push({
            mayo: teamMayo.points,
            ketchup: teamKetchup.points,
            buzzerIsLock: buzzerIsLock,
            firstBuzzTeam: firstBuzzTeam,
            lockedOutTeams: lockedOutTeams.slice(),
            deathCount: deathCount,
            answerRevealed: answerRevealed
        });
        if (history.length > historySize)
            history.shift();
    }

    /**
     * Annule la dernière action de l'animateur
     */
    const undo = function () {
        const previous = history.pop();
        if (!previous)
            return;
        teamMayo.setPoints(previous.mayo);
        teamKetchup.setPoints(previous.ketchup);
        buzzerIsLock = previous.buzzerIsLock;
        firstBuzzTeam = previous.firstBuzzTeam;
        lockedOutTeams = previous.lockedOutTeams;
        deathCount = previous.deathCount;
        answerRevealed = previous.answerRevealed;
        saveState();
        emitPoints();
        emitBuzzerState();
        emitDeathBurger();
        emitQuestionState();
        if (victoryVisible)
            emitVictory();
        emitAdminState();
    }

    /**
     * Bonne réponse : l'équipe ayant buzzé (ou celle indiquée) marque les points de la question,
     * la réponse est révélée et les buzzers sont bloqués jusqu'à la question suivante
     * Au Burger de la mort, le compteur avance (même sans buzz)
     */
    const goodAnswer = function (teamName) {
        const team = teams[teamName] ? teamName : firstBuzzTeam;
        const deathRound = isDeathBurgerRound();
        if (!team && !deathRound)
            return;
        pushHistory();
        const question = currentQuestion();
        if (team) {
            teams[team].addPoints(question ? question.points || 1 : 1);
            io.emit(pointsMessages[team], teams[team].points);
        }
        if (question && question.answer)
            answerRevealed = true;
        if (deathRound) {
            deathCount = Math.min(deathCount + 1, deathBurgerTotal);
            emitDeathBurger();
        }
        buzzerIsLock = true;
        firstBuzzTeam = null;
        lockedOutTeams = [];
        saveState();
        stopBuzzTimer();
        io.emit(messages.messageToClientLockBuzz);
        emitBuzzerState();
        emitQuestionState();
        if (victoryVisible)
            emitVictory();
        emitAdminState();
    }

    /**
     * Mauvaise réponse : « pouet » à l'écran et la main passe à l'autre équipe
     * Au Burger de la mort, le compteur repart à zéro
     */
    const badAnswer = function () {
        const deathRound = isDeathBurgerRound();
        io.emit(messages.messageToClientReceiveBadResponse);
        if (!firstBuzzTeam && !(deathRound && deathCount > 0))
            return;
        pushHistory();
        if (firstBuzzTeam) {
            lockedOutTeams.push(firstBuzzTeam);
            firstBuzzTeam = null;
            // Toutes les équipes se sont trompées : plus personne ne peut buzzer
            buzzerIsLock = validTeamNames.every(function (team) { return lockedOutTeams.indexOf(team) !== -1; });
            stopBuzzTimer();
            emitBuzzerState();
        }
        if (deathRound) {
            deathCount = 0;
            saveState();
            emitDeathBurger();
        }
        emitAdminState();
    }

    /**
     * Nouvelle question ou nouvelle manche : le buzz précédent ne compte plus,
     * les buzzers sont bloqués le temps que l'animateur lise la question
     */
    const resetBuzzer = function () {
        if (buzzerIsLock && !firstBuzzTeam && !lockedOutTeams.length)
            return;
        buzzerIsLock = true;
        firstBuzzTeam = null;
        lockedOutTeams = [];
        io.emit(messages.messageToClientLockBuzz);
        emitBuzzerState();
    }

    /**
     * Joue sur les écrans de jeu le son ou la vidéo de la question en cours
     * @param {*} field 'questionMedia' ou 'answerMedia'
     */
    const playMedia = function (field) {
        if (mediaFields.indexOf(field) === -1)
            return;
        const question = currentRoundQuestions()[questionIndex];
        const media = question && question[field];
        if (!media)
            return;
        io.emit(messages.messageToClientPlayMedia, { url: '/media/' + media.file, type: media.type });
    }

    /**
     * Joue la transition à l'index donné sur tous les écrans
     */
    const playTransition = function (index) {
        const transition = transitionsList[index];
        if (!transition)
            return;
        transitionIndex = index;
        // Nouvelle manche : on repart de la première question
        questionIndex = 0;
        deathCount = 0;
        resetScreenQuestion();
        resetBuzzer();
        resetTimer();
        saveState();
        io.emit(messages.messageToClientNextTransition, transition.filename);
        io.emit(messages.messageToClientReceiveStateTransition, transitionState());
        emitQuestionState();
        emitDeathBurger();
    }

    /**
     * Passe à la question suivante (+1) ou précédente (-1) de la manche
     */
    const moveQuestion = function (direction) {
        const index = questionIndex + direction;
        if (index < 0 || index >= currentRoundQuestions().length)
            return;
        questionIndex = index;
        resetScreenQuestion();
        resetBuzzer();
        stopBuzzTimer();
        saveState();
        emitQuestionState();
    }

    /**
     * Les parties ont été modifiées depuis la page de gestion
     */
    partyStore.onChange(function () {
        if (activePartyId && !partyStore.get(activePartyId)) {
            activePartyId = null;
            questionIndex = 0;
        }
        clampQuestionIndex();
        saveState();
        emitQuestionState();
    });

    /**
     * Se charge d'ajouter ou de retirer des points
     * Pour une équipe
     */
    const receiveOrderModifyPoints = function (messageReceive, messageForClient, team) {
        pushHistory();
        if (messageReceive === messages.messageAdd) {
            team.incrementPoints();
        } else if (messageReceive === messages.messageRemove) {
            team.decrementPoints();
        } else {
            history.pop();
            return;
        }
        saveState();
        io.emit(messageForClient, team.points);
        if (victoryVisible)
            emitVictory();
        emitAdminState();
    }

    io.on(messages.messageConnection, function (socket) {
        if (isAdmin(socket))
            socket.join(adminRoom);
        /**
         *  On répond uniquement au client qui demande l'info des points
         */
        socket.on(messages.messageClientsNeedPointsInformations, function () {
            socket.emit(messages.messageToClientReceivePoints, teamMayo.points, teamKetchup.points);
        });
        socket.on(messages.messageClientNeedStateBuzzer, function () {
            emitBuzzerState(socket);
        });
        socket.on(messages.messageClientNeedStateTransition, function () {
            socket.emit(messages.messageToClientReceiveStateTransition, transitionState());
        });
        /**
         * Etat de l'écran de jeu : chrono, Burger de la mort, victoire, partie lancée
         */
        socket.on(messages.messageClientNeedStateGame, function () {
            emitTimer(socket);
            emitDeathBurger(socket);
            emitVictory(socket);
            if (gameStarted)
                socket.emit(messages.messageToClientStartGame);
        });
        /**
         * Un buzzer s'annonce : la télécommande affiche les buzzers connectés par équipe
         */
        socket.on(messages.messageClientRegisterBuzzer, function (teamName) {
            if (validTeamNames.indexOf(teamName) === -1)
                return;
            socket.data.buzzerTeam = teamName;
            emitAdminState();
        });
        socket.on(messages.messageDisconnected, function () {
            if (socket.data.buzzerTeam)
                emitAdminState();
        });
        /**
         *  Manage les points des équipes
         */
        onAdminMessage(socket, messages.messageMayoTeam, function (message) {
            receiveOrderModifyPoints(message, messages.messageToClientMayo, teamMayo);
        });
        onAdminMessage(socket, messages.messageKetchupTeam, function (message) {
            receiveOrderModifyPoints(message, messages.messageToClientKetchup, teamKetchup);
        });
        /**
         * Se charge de bloquer les buzzers
         */
        onAdminMessage(socket, messages.messageLockBuzz, function () {
            pushHistory();
            buzzerIsLock = true;
            io.emit(messages.messageToClientLockBuzz);
            emitBuzzerState();
            emitAdminState();
        });
        /**
         * Se charge de débloquer les buzzers (pour toutes les équipes)
         */
        onAdminMessage(socket, messages.messageUnLockBuzz, function () {
            pushHistory();
            buzzerIsLock = false;
            firstBuzzTeam = null;
            lockedOutTeams = [];
            stopBuzzTimer();
            io.emit(messages.messageToClientUnLockBuzz);
            emitBuzzerState();
            emitAdminState();
        });
        /**
         * Recharge la partie
         */
        onAdminMessage(socket, messages.messageReloadPart, function () {
            buzzerIsLock = true;
            firstBuzzTeam = null;
            lockedOutTeams = [];
            teamMayo.points = 0;
            teamKetchup.points = 0;
            transitionIndex = -1;
            questionIndex = 0;
            deathCount = 0;
            history = [];
            victoryVisible = false;
            resetScreenQuestion();
            resetTimer();
            saveState();
            io.emit(messages.messageToClientReloadPart);
            emitBuzzerState();
            io.emit(messages.messageToClientReceiveStateTransition, transitionState());
            emitQuestionState();
            emitDeathBurger();
            emitVictory();
            emitAdminState();
        });
        /**
         * Se produit lorsqu'un client buzz
         * Le serveur arbitre : seul le premier buzz est pris en compte,
         * les buzzers sont ensuite bloqués jusqu'au prochain déblocage
         * Le buzz de l'autre équipe juste après est chronométré (écart affiché à l'écran)
         */
        socket.on(messages.messageClientSendBuzz, function (teamName) {
            if (validTeamNames.indexOf(teamName) === -1)
                return;
            if (buzzerIsLock || lockedOutTeams.indexOf(teamName) !== -1) {
                const gap = Date.now() - firstBuzzAt;
                if (firstBuzzTeam && teamName !== firstBuzzTeam && !buzzGapSent && gap <= buzzGapWindow) {
                    buzzGapSent = true;
                    io.emit(messages.messageToClientReceiveBuzzGap, teamName, gap);
                }
                return;
            }
            buzzerIsLock = true;
            firstBuzzTeam = teamName;
            firstBuzzAt = Date.now();
            buzzGapSent = false;
            io.emit(messages.messageToClientLockBuzz);
            io.emit(messages.messageToClientReceiveBuzz, teamName);
            emitBuzzerState();
            if (buzzTimerSeconds > 0)
                startTimer(buzzTimerSeconds, true);
        });
        /**
         * Bonne / mauvaise réponse, annulation
         */
        onAdminMessage(socket, messages.messageGoodAnswer, goodAnswer);
        onAdminMessage(socket, messages.messageBuzzBadResponse, badAnswer);
        onAdminMessage(socket, messages.messageUndo, undo);
        /**
         * Transition suivante / rejouer la précédente
         */
        onAdminMessage(socket, messages.messageNextTransition, function () {
            playTransition(transitionIndex + 1);
        });
        onAdminMessage(socket, messages.messagePreviousTransition, function () {
            playTransition(transitionIndex - 1);
        });
        /**
         * Questions : état (réservé à l'admin), choix de la partie, navigation
         */
        onAdminMessage(socket, messages.messageClientNeedStateQuestion, function () {
            socket.emit(messages.messageToClientReceiveStateQuestion, questionState());
        });
        onAdminMessage(socket, messages.messageClientNeedStateAdmin, function () {
            socket.emit(messages.messageToClientReceiveStateAdmin, adminState());
            emitTimer(socket);
            emitDeathBurger(socket);
        });
        onAdminMessage(socket, messages.messageSelectParty, function (partyId) {
            if (partyId !== null && !partyStore.get(partyId))
                return;
            activePartyId = partyId;
            questionIndex = 0;
            resetScreenQuestion();
            saveState();
            emitQuestionState();
        });
        onAdminMessage(socket, messages.messageNextQuestion, function () {
            moveQuestion(1);
        });
        onAdminMessage(socket, messages.messagePreviousQuestion, function () {
            moveQuestion(-1);
        });
        /**
         * Affiche / masque la question sur l'écran de jeu, révèle la réponse
         */
        onAdminMessage(socket, messages.messageToggleScreenQuestion, function () {
            screenQuestionVisible = !screenQuestionVisible;
            emitQuestionState();
        });
        onAdminMessage(socket, messages.messageToggleRevealAnswer, function () {
            answerRevealed = !answerRevealed;
            emitQuestionState();
        });
        /**
         * Son ou vidéo de la question / de la réponse sur les écrans de jeu
         */
        onAdminMessage(socket, messages.messagePlayMedia, playMedia);
        onAdminMessage(socket, messages.messageStopMedia, function () {
            io.emit(messages.messageToClientStopMedia);
        });
        socket.on(messages.messageClientNeedScreenQuestion, function () {
            socket.emit(messages.messageToClientReceiveScreenQuestion, screenQuestion());
        });
        /**
         * Chrono : lancer / reprendre, mettre en pause, remettre à zéro (et masquer)
         * Chrono de réponse lancé automatiquement après chaque buzz (0 : désactivé)
         */
        onAdminMessage(socket, messages.messageTimerStart, function (seconds) {
            startTimer(seconds, false);
        });
        onAdminMessage(socket, messages.messageTimerPause, pauseTimer);
        onAdminMessage(socket, messages.messageTimerReset, resetTimer);
        onAdminMessage(socket, messages.messageSetBuzzTimer, function (seconds) {
            if (!Number.isInteger(seconds) || seconds < 0 || seconds > buzzTimerMaxSeconds)
                return;
            buzzTimerSeconds = seconds;
            emitAdminState();
        });
        /**
         * Ecran de victoire, lancement de la partie sur l'écran de jeu
         */
        onAdminMessage(socket, messages.messageToggleVictory, function () {
            victoryVisible = !victoryVisible;
            emitVictory();
            emitAdminState();
        });
        onAdminMessage(socket, messages.messageStartGame, function () {
            gameStarted = true;
            io.emit(messages.messageToClientStartGame);
            emitAdminState();
        });
    });

    restoreState();
}

module.exports.validTeamNames = validTeamNames;
module.exports.transitionsList = transitionsList;
module.exports.deathBurgerTotal = deathBurgerTotal;
