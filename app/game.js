const path = require('path');

module.exports = function (io) {
    const Team = require(path.join(global.__basedir, 'app/models/team'));
    const Transition = require(path.join(global.__basedir, 'app/models/transition'));
    const messages = require(path.join(global.__basedir, 'config/messages-socket'));

    var transitionsList = [];

    const teamMayo = new Team('mayo');
    const teamKetchup = new Team('ketchup');
    /**
     * Noms d'équipes acceptés pour le buzz
     */
    const validTeamNames = ['team-mayo', 'team-ketchup'];
    /**
     * Etat du buzzer
     */
    var buzzerIsLock = true;
    /**
     * Equipe ayant buzzé en premier depuis le dernier déblocage
     */
    var firstBuzzTeam = null;

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

    const initGameSocket = function () {
        /**
         * Init Socket
         */
        io.on(messages.messageConnection, function (socket) {
            /**
             *  Se produit lors d'une déconnexion utilisateur
             */
            socket.on(messages.messageDisconnected, function () { });
            /**
             *  On emet dès que le client se connecte et demande l'info des points
             */
            socket.on(messages.messageClientsNeedPointsInformations, function () {
                socket.emit(messages.messageToClientReceivePoints, teamMayo.points, teamKetchup.points);
            });
            socket.on(messages.messageClientNeedStateBuzzer, function () {
                socket.emit(messages.messageToClientReceiveStateBuzzer, buzzerIsLock, firstBuzzTeam);
            });
            /**
             *  Manage les points de la team mayo
             */
            onAdminMessage(socket, messages.messageMayoTeam, function (message) {
                receiveOrderModifyPoints(message, messages.messageToClientMayo, teamMayo);
            });
            /**
             *  Manage les points de la team ketchup
             */
            onAdminMessage(socket, messages.messageKetchupTeam, function (message) {
                receiveOrderModifyPoints(message, messages.messageToClientKetchup, teamKetchup);
            });
            /**
             * Se charge de bloquer les buzzers 
             */
            onAdminMessage(socket, messages.messageLockBuzz, function () {
                buzzerIsLock = true;
                io.emit(messages.messageToClientLockBuzz)
            });
            /**
             * Se charge de débloquer les buzzers 
             */
            onAdminMessage(socket, messages.messageUnLockBuzz, function () {
                buzzerIsLock = false;
                firstBuzzTeam = null;
                io.emit(messages.messageToClientUnLockBuzz)
            });
            /**
             * Recharge la partie
             */
            onAdminMessage(socket, messages.messageReloadPart, function () {
                buzzerIsLock = true;
                firstBuzzTeam = null;
                teamMayo.points = 0;
                teamKetchup.points = 0;
                initTransitionList();
                io.emit(messages.messageToClientReloadPart);
                io.emit(messages.messageToClientReceiveStateBuzzer, buzzerIsLock, firstBuzzTeam);
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
             * Se charge d'envoyer la prochaine transition
             */
            onAdminMessage(socket, messages.messageNextTransition, function () {
                var nextTransition = transitionsList.shift();
                if (!nextTransition)
                    return;
                io.emit(messages.messageToClientNextTransition, nextTransition.filename);
            });

            /**
             * Se charge d'envoyer un message indiquant que l'équipe
             * A mal répondu à la question
             */
            onAdminMessage(socket, messages.messageBuzzBadResponse, function () {
                io.emit(messages.messageToClientReceiveBadResponse);
            });

            /**
             * Se charge d'ajouter ou de retirer des points
             * Pour une équipe
             */
            const receiveOrderModifyPoints = function (messageReceive, messageForClient, team) {
                if (messageReceive === messages.messageAdd) {
                    team.incrementPoints();
                } else {
                    team.decrementPoints()
                }
                io.emit(messageForClient, team.points);
            }
        });
    }

    /**
     * Se charge d'initialiser les transitions
     */
    const initTransitionList = function () {
        transitionsList = [];
        transitionsList.push(new Transition('nuggets-transition.mp4', 'Nuggets', 1));
        transitionsList.push(new Transition('selt-pepper-transition.mp4', "Sel ou Poivre", 2));
        transitionsList.push(new Transition('menus-transition.mp4', "Les menus", 3));
        transitionsList.push(new Transition('addition-transition.mp4', "L'addition", 4));
        transitionsList.push(new Transition('death-burger-transition.mp4', "Burger de la mort", 5));
        // Tri sur la propriété ordre de manière asc
        transitionsList.sort(function (a, b) {
            return a.order - b.order;
        });
    }

    // Init de la socket
    initGameSocket();

    // On initialise la liste dès le début
    initTransitionList();
}
