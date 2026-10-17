const Team = require('./models/team');
const { transitionsList } = require('./models/rounds');
const messages = require('../config/messages-socket');
const { createStateStore } = require('./services/state-store');
const { createPartyStore } = require('./services/party-store');

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
    /**
     * Etat du buzzer
     */
    let buzzerIsLock = true;
    /**
     * Equipe ayant buzzé en premier depuis le dernier déblocage
     */
    let firstBuzzTeam = null;
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
        clampQuestionIndex();
    }

    const saveState = function () {
        store.save({
            mayo: teamMayo.points,
            ketchup: teamKetchup.points,
            transitionIndex: transitionIndex,
            activePartyId: activePartyId,
            questionIndex: questionIndex
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
        return {
            parties: partyStore.list().map(function (summary) {
                return { id: summary.id, name: summary.name, questionsCount: summary.questionsCount };
            }),
            activePartyId: party ? party.id : null,
            round: transition ? transition.label : null,
            index: questionIndex,
            total: questions.length,
            question: questions[questionIndex] || null
        };
    }

    /**
     * Envoie l'état des questions à toutes les télécommandes
     */
    const emitQuestionState = function () {
        io.to(adminRoom).emit(messages.messageToClientReceiveStateQuestion, questionState());
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
        saveState();
        io.emit(messages.messageToClientNextTransition, transition.filename);
        io.emit(messages.messageToClientReceiveStateTransition, transitionState());
        emitQuestionState();
    }

    /**
     * Passe à la question suivante (+1) ou précédente (-1) de la manche
     */
    const moveQuestion = function (direction) {
        const index = questionIndex + direction;
        if (index < 0 || index >= currentRoundQuestions().length)
            return;
        questionIndex = index;
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
        if (messageReceive === messages.messageAdd) {
            team.incrementPoints();
        } else if (messageReceive === messages.messageRemove) {
            team.decrementPoints();
        } else {
            return;
        }
        saveState();
        io.emit(messageForClient, team.points);
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
            socket.emit(messages.messageToClientReceiveStateBuzzer, buzzerIsLock, firstBuzzTeam);
        });
        socket.on(messages.messageClientNeedStateTransition, function () {
            socket.emit(messages.messageToClientReceiveStateTransition, transitionState());
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
            buzzerIsLock = true;
            io.emit(messages.messageToClientLockBuzz);
        });
        /**
         * Se charge de débloquer les buzzers
         */
        onAdminMessage(socket, messages.messageUnLockBuzz, function () {
            buzzerIsLock = false;
            firstBuzzTeam = null;
            io.emit(messages.messageToClientUnLockBuzz);
        });
        /**
         * Recharge la partie
         */
        onAdminMessage(socket, messages.messageReloadPart, function () {
            buzzerIsLock = true;
            firstBuzzTeam = null;
            teamMayo.points = 0;
            teamKetchup.points = 0;
            transitionIndex = -1;
            questionIndex = 0;
            saveState();
            io.emit(messages.messageToClientReloadPart);
            io.emit(messages.messageToClientReceiveStateBuzzer, buzzerIsLock, firstBuzzTeam);
            io.emit(messages.messageToClientReceiveStateTransition, transitionState());
            emitQuestionState();
        });
        /**
         * Se produit lorsqu'un client buzz
         * Le serveur arbitre : seul le premier buzz est pris en compte,
         * les buzzers sont ensuite bloqués jusqu'au prochain déblocage
         */
        socket.on(messages.messageClientSendBuzz, function (teamName) {
            if (buzzerIsLock || validTeamNames.indexOf(teamName) === -1)
                return;
            buzzerIsLock = true;
            firstBuzzTeam = teamName;
            io.emit(messages.messageToClientLockBuzz);
            io.emit(messages.messageToClientReceiveBuzz, teamName);
        });
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
        onAdminMessage(socket, messages.messageSelectParty, function (partyId) {
            if (partyId !== null && !partyStore.get(partyId))
                return;
            activePartyId = partyId;
            questionIndex = 0;
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
         * Se charge d'envoyer un message indiquant que l'équipe
         * A mal répondu à la question
         */
        onAdminMessage(socket, messages.messageBuzzBadResponse, function () {
            io.emit(messages.messageToClientReceiveBadResponse);
        });
    });

    restoreState();
}

module.exports.validTeamNames = validTeamNames;
module.exports.transitionsList = transitionsList;
