/**
 * Noms des messages socket.io échangés entre le serveur et les clients
 * Fichier partagé : chargé par node (module.exports)
 * Et servi tel quel aux navigateurs (variable globale BQ_MESSAGES)
 */
(function (root) {
    const messages = Object.freeze({
        /**
         * Messages de base de socket.io
         */
        messageConnection: 'connection',
        messageDisconnected: 'disconnect',
        /**
         * Message de la télécommand admin
         * Pour intérargir avec le jeu
         */
        messageAdd: 'add',
        messageRemove: 'remove',
        messageReloadPart: 'event-reload-part',
        messageMayoTeam: 'event-point-mayo',
        messageKetchupTeam: 'event-point-ketchup',
        messageLockBuzz: 'event-lock-buzz',
        messageUnLockBuzz: 'event-unlock-buzz',
        messageNextTransition: 'event-next-transition',
        messagePreviousTransition: 'event-previous-transition',
        messageBuzzBadResponse: 'event-bad-response',
        messageSelectParty: 'event-select-party',
        messageNextQuestion: 'event-next-question',
        messagePreviousQuestion: 'event-previous-question',
        messageToggleScreenQuestion: 'event-toggle-screen-question',
        messageToggleRevealAnswer: 'event-toggle-reveal-answer',
        messagePlayMedia: 'event-play-media',
        messageStopMedia: 'event-stop-media',
        /**
         * Les messages que les clients envoies
         */
        messageClientSendBuzz: 'on-buzz',
        messageClientsNeedPointsInformations: 'need-information-points',
        messageClientNeedStateBuzzer: 'need-state-buzzer',
        messageClientNeedStateTransition: 'need-state-transition',
        messageClientNeedStateQuestion: 'need-state-question',
        messageClientNeedScreenQuestion: 'need-screen-question',
        /**
         * Les messages à envoyer aux clients
         */
        messageToClientReloadPart: 'reload-part',
        messageToClientMayo: 'point-mayo',
        messageToClientKetchup: 'point-ketchup',
        messageToClientReceivePoints: 'receive-points-teams',
        messageToClientReceiveBuzz: 'receive-buzz',
        messageToClientLockBuzz: 'receive-lock-buzz',
        messageToClientUnLockBuzz: 'receive-unlock-buzz',
        messageToClientReceiveStateBuzzer: 'receive-state-buzzer',
        messageToClientNextTransition: 'receive-next-transition',
        messageToClientReceiveStateTransition: 'receive-state-transition',
        messageToClientReceiveBadResponse: 'receive-buzz-bad-response',
        messageToClientReceiveStateQuestion: 'receive-state-question',
        messageToClientReceiveScreenQuestion: 'receive-screen-question',
        messageToClientPlayMedia: 'receive-play-media',
        messageToClientStopMedia: 'receive-stop-media',
    });

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = messages;
    } else {
        root.BQ_MESSAGES = messages;
    }
})(this);
