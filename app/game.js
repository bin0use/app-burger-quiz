const Team = require('./models/team');
const Transition = require('./models/transition');
const messages = require('../config/messages-socket');
const { createStateStore } = require('./services/state-store');

/**
 * Noms d'équipes acceptés pour le buzz
 */
const validTeamNames = ['team-mayo', 'team-ketchup'];

/**
 * Liste des transitions dans l'ordre de la partie
 */
const transitionsList = [
    new Transition('nuggets-transition.mp4', 'Nuggets', 1),
    new Transition('selt-pepper-transition.mp4', 'Sel ou Poivre', 2),
    new Transition('menus-transition.mp4', 'Les menus', 3),
    new Transition('addition-transition.mp4', "L'addition", 4),
    new Transition('death-burger-transition.mp4', 'Burger de la mort', 5),
].sort(function (a, b) {
    return a.order - b.order;
});

/**
 * @param {*} io Le serveur socket.io
 * @param {*} options.stateFile Fichier de sauvegarde de la partie (optionnel)
 */
module.exports = function (io, options) {
    options = options || {};
    const store = createStateStore(options.stateFile);

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
    }

    const saveState = function () {
        store.save({
            mayo: teamMayo.points,
            ketchup: teamKetchup.points,
            transitionIndex: transitionIndex
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
     * Joue la transition à l'index donné sur tous les écrans
     */
    const playTransition = function (index) {
        const transition = transitionsList[index];
        if (!transition)
            return;
        transitionIndex = index;
        saveState();
        io.emit(messages.messageToClientNextTransition, transition.filename);
        io.emit(messages.messageToClientReceiveStateTransition, transitionState());
    }

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
            saveState();
            io.emit(messages.messageToClientReloadPart);
            io.emit(messages.messageToClientReceiveStateBuzzer, buzzerIsLock, firstBuzzTeam);
            io.emit(messages.messageToClientReceiveStateTransition, transitionState());
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
