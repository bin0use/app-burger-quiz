const $buttonMayo = $('#buzz-button-mayo');
const $buttonKetchup = $('#buzz-button-ketchup');

// La base de l'url de redirection
const baseRedirectUrl = '/buzzer';

const initEvents = function () {
    $buttonMayo.on('click', function () {
        location.href = baseRedirectUrl + '?team=team-mayo';
    });
    $buttonKetchup.on('click', function () {
        location.href = baseRedirectUrl + '?team=team-ketchup';
    });
}

initEvents();