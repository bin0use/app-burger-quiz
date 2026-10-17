// Socket node
var socket = io();

const messageAdd = 'add'
const messageRemove = 'remove';
const messageMayoTeam = 'event-point-mayo';
const messageKetchupTeam = 'event-point-ketchup';
const messageReloadPart = 'event-reload-part';
const messageLockBuzz= 'event-lock-buzz';
const messageUnLockBuzz= 'event-unlock-buzz';
const messageNextTransition= 'event-next-transition';
const messageBuzzBadResponse = 'event-bad-response';
const messageClientNeedStateBuzzer = 'need-state-buzzer';

/**
 * Les messages que reçoit le client
 */
const messageToClientLockBuzz = 'receive-lock-buzz';
const messageToClientUnLockBuzz = 'receive-unlock-buzz';
const messageToClientReceiveStateBuzzer = 'receive-state-buzzer';
const messageToClientReceiveBuzz = 'receive-buzz';

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

const $modalReloadPartWarn = $('#modal-reload-part');
const $buzzerStatus = $('#buzzer-status');

var initEvents = function () {
    $buttonAddPointMayo.click(function () {
        socket.emit(messageMayoTeam, messageAdd);
    });
    $buttonRemovePointMayo.click(function () {
        socket.emit(messageMayoTeam, messageRemove);
    });
    $buttonAddPointKetchup.click(function () {
        socket.emit(messageKetchupTeam, messageAdd);
    });
    $buttonRemovePointKetchup.click(function () {
        socket.emit(messageKetchupTeam, messageRemove);
    });
    $buttonReloadPart.click(function () {
        socket.emit(messageReloadPart);
        $modalReloadPartWarn.modal('hide');
    });
    $buttonLockBuzzer.click(function () {
        socket.emit(messageLockBuzz);
    });
    $buttonUnLockBuzzer.click(function () {
        socket.emit(messageUnLockBuzz);
    });
    $buttonNextTransition.click(function(){
        socket.emit(messageNextTransition);
    });
    $buttonBuzzBadResponse.click(function() {
        socket.emit(messageBuzzBadResponse);
    })
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
 * Ecoute les changements d'état du buzzer
 */
const listenBuzzerState = function () {
    let lastBuzzTeam = null;
    socket.on(messageToClientReceiveStateBuzzer, function (isLocked, teamName) {
        lastBuzzTeam = teamName;
        displayBuzzerState(isLocked, teamName);
    });
    socket.on(messageToClientLockBuzz, function () {
        displayBuzzerState(true, lastBuzzTeam);
    });
    socket.on(messageToClientUnLockBuzz, function () {
        lastBuzzTeam = null;
        displayBuzzerState(false, null);
    });
    socket.on(messageToClientReceiveBuzz, function (teamName) {
        lastBuzzTeam = teamName;
        displayBuzzerState(true, teamName);
    });
    // Récupère l'état courant dès la connexion
    socket.emit(messageClientNeedStateBuzzer);
}

initEvents();

listenBuzzerState();