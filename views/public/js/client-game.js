const $pointKetchupDecade = $('#point-ketchup-decade');
const $pointKetchupUnit = $('#point-ketchup-unit');
const $pointMayoDecade = $('#point-mayo-decade');
const $pointMayoUnit = $('#point-mayo-unit');

const $modalBuzz = $('#modal-buzz');
const $mainBackground = $('#game-background');

const $modalTransition = $('#modal-transition');
const $sourceTransition = $('#source-transition');
const $videoTransitionContainer = $('#video-transition-container');

const $screenQuestion = $('#screen-question');
const $screenQuestionRound = $('#screen-question-round');
const $screenQuestionPoints = $('#screen-question-points');
const $screenQuestionText = $('#screen-question-text');
const $screenQuestionChoices = $('#screen-question-choices');
const $screenQuestionAnswer = $('#screen-question-answer');
const $screenQuestionMenus = $('#screen-question-menus');

const $modalMedia = $('#modal-media');
const videoMedia = document.getElementById('video-media');

const $buzzFirst = $('#buzz-first');
const $buzzFirstLogo = $('#buzz-first-logo');
const $buzzFirstGap = $('#buzz-first-gap');

const $screenTimer = $('#screen-timer');
const $deathBurger = $('#death-burger');
const $deathBurgerSteps = $('#death-burger-steps');
const $deathBurgerTitle = $deathBurger.find('.death-burger-title');

const $victory = $('#victory');
const $victoryTitle = $('#victory-title');
const $victoryLogo = $('#victory-logo');
const $victoryScoreKetchup = $('#victory-score-ketchup');
const $victoryScoreMayo = $('#victory-score-mayo');
const $confetti = $('#confetti');

let socket = null;
/**
 * Variable permettant de savoir quel équipe
 * Aura buzz en première
 */
let buzzFirstTimeout = null;

/**
 * Points affichés par équipe (le burger se remplit étage par étage)
 */
const displayedPoints = { 'team-mayo': 0, 'team-ketchup': 0 };
const pointsAnimations = {};
const durationPointStep = 300;

/**
 * Chrono : décompte local à partir du temps restant envoyé par le serveur
 */
let timer = { visible: false, running: false, remaining: 0, endsAt: 0 };
const timerHurryMs = 5000;

/**
 * Dernier compteur du Burger de la mort affiché
 */
let lastDeathCount = 0;

/**
 * Indique si la transition est en cours
 */
let isTransitionRunning = false;

/**
 * Son de la question / réponse en cours de lecture
 */
let mediaAudio = null;

const mayo = 'team-mayo'
const ketchup = 'team-ketchup';
const componentsMayo = [];
const componentsKetchup = [];

/**
 * Couleur
 */
const mayoColor = '#E0C800';
const ketchupColor = '#C71000';

/**
 * Sons
 */
const buzzSound = './sounds/buzz.mp3';
const buzzSoundAie = './sounds/burger-sound-buzz-1.mp3';
const buzzSoundOutch = './sounds/burger-sound-buzz-2.mp3';

/**
 * Prop css convention
 */
const baseEmpty = 'empty-';

/**
 * Base répertoire
 */
const baseDirVideos = './videos/';

/**
 * Les Durées
 */
const durationHiddenModalBuzzFirst = 4000;
const durationHideCursor = 3000;
const confettiCount = 150;

const teamLogos = {
    'team-mayo': './images/teams/mayo.svg',
    'team-ketchup': './images/teams/ketchup.svg'
};
const teamLabels = {
    'team-mayo': 'Mayo',
    'team-ketchup': 'Ketchup'
};

// Noms des messages partagés avec le serveur (/js/messages-socket.js)
const messages = BQ_MESSAGES;

/**
 * Se charge d'attribuer des points à une equipe
 * @param {*} team L'equipe à qui on va attribuer les points
 * @param {*} points Les points que l'on va attribuer
 */
var attributePointsAtTeam = function (team, points) {
    var digitis = null;
    if (points > 9) {
        digitis = convertPointsAsIndividualDigits(points);
    }
    if (team === ketchup) {
        if (digitis) {
            $pointKetchupDecade.text(digitis[0]);
            $pointKetchupUnit.text(digitis[1]);
        } else {
            $pointKetchupDecade.text(0);
            $pointKetchupUnit.text(points);
        }
    } else if (team === mayo) {
        if (digitis) {
            $pointMayoDecade.text(digitis[0]);
            $pointMayoUnit.text(digitis[1]);
        } else {
            $pointMayoDecade.text(0);
            $pointMayoUnit.text(points);
        }
    } else {
        alert("Impossible d'assigner un point car aucune équipe n'est déterminé");
    }
    // Récupère la collection de composant pour une équipe
    var collection = team === mayo ? componentsMayo : componentsKetchup;
    // Changement de l'aspect visuel
    changeStateBackground(collection, points);
}

/**
 * Se charge de changer l'affichage pour
 * Une équipe par rapport à son nombre de points
 * @param {*} team 
 * @param {*} points Les points que l'on va attribuer
 */
var changeStateBackground = function (collection, points) {
    for (let index = 0; index < collection.length; index++) {
        const element = collection[index];
        if (!element)
            continue;
        // Récupération des points
        const value = element.getAttribute('data-points');
        if (value > points) {
            // Si jamais le composant est coloré
            // On le remet normal        
            if (!element.className.includes(baseEmpty)) {
                element.className = baseEmpty + element.className;
            }
        } else {
            if (!element.className.includes(baseEmpty))
                continue;
            element.className = element.className.substring(baseEmpty.length);
        }
    }
}

/**
 * Se charge de transformer un nombre 
 * Dans un tableau de nombre individuel
 * @param {*} points Les points a transformer
 */
var convertPointsAsIndividualDigits = function (points) {
    if (!points)
        return null;
    var output = [];
    var pointsToString = points.toString();
    for (let index = 0; index < pointsToString.length; index++) {
        const element = pointsToString.charAt(index);
        output.push(element);
    }
    return output;
}

/**
 * Se charge d'alimenter les difféntes collections
 */
const registerComponents = function () {
    // Enregistrement des composants mayo
    populateCollectionComponents(componentsMayo, mayo);
    // Enregistement des composants ketchup
    populateCollectionComponents(componentsKetchup, ketchup);
}

/**
 * Se charge d'enregistrer dans une collection les composants
 * Pour chaque équipe
 * @param {*} collection La collection à hydrater
 * @param {*} containerId L'id du container parent de l'equipe
 */
const populateCollectionComponents = function (collection, containerId) {
    let container = document.getElementById(containerId);
    let childs = container.querySelectorAll('[data-points]');
    for (let index = 0; index < childs.length; index++) {
        const element = childs[index];
        collection.push(element);
    }
}

/** 
 * Se charge d'interargir avec la vue
 * Affiche un background de buzz différent 
 * Sur l'écran suivant le nom de l'équipe 
 * @param {*} teamName Le nom de l'équipe
 */
const receiveBuzzAndInteractOnView = function (teamName) {
    if (isTransitionRunning)
        return;
    let color = null;
    let sound = null;
    if (teamName === ketchup) {
        color = ketchupColor;
        sound = buzzSoundAie;
    } else if (teamName === mayo) {
        color = mayoColor;
        sound = buzzSoundOutch;
    } else {
        console.log('Impossible de faire le buzz car valeur indéterminée : ' + teamName)
    }
    if (!color)
        return;
    // Comme dans l'émission, le buzz coupe le son ou la vidéo en cours
    stopMedia();
    $mainBackground.hide();
    playSound(sound);
    $modalBuzz.show();
    $modalBuzz.fadeIn(0, function () {
        $(this).css('background', color).fadeOut(500, function () {
            $modalBuzz.hide();
            $mainBackground.show();
            pinupTeamBuzzFirstOnView(teamName);
        });
    });
}

/**
 * Affiche en grand le logo de l'équipe qui a buzzé en premier
 * @param {*} teamName Le nom de l'équipe
 */
const pinupTeamBuzzFirstOnView = function (teamName) {
    clearTimeout(buzzFirstTimeout);
    $buzzFirstLogo.attr('src', teamLogos[teamName]).attr('alt', teamLabels[teamName]);
    // Relance l'animation d'apparition
    $buzzFirst.prop('hidden', true);
    void $buzzFirst.get(0).offsetWidth;
    $buzzFirst.prop('hidden', false);
    buzzFirstTimeout = setTimeout(function () {
        $buzzFirst.prop('hidden', true);
    }, durationHiddenModalBuzzFirst);
}

/**
 * Ecart entre le buzz de l'équipe gagnante et celui de l'autre équipe
 * @param {*} teamName L'équipe ayant buzzé trop tard
 * @param {*} gap L'écart en ms
 */
const displayBuzzGap = function (teamName, gap) {
    const seconds = (gap / 1000).toFixed(2).replace('.', ',');
    $buzzFirstGap.text(teamLabels[teamName] + ' : ' + seconds + ' s trop tard !');
}

/**
 * Anime l'élément du burger correspondant au point gagné
 */
const popBurgerElement = function (team, points) {
    const collection = team === mayo ? componentsMayo : componentsKetchup;
    collection.forEach(function (element) {
        if (Number(element.getAttribute('data-points')) === points && element.animate)
            element.animate([
                { transform: 'scale(1)' },
                { transform: 'scale(1.25)' },
                { transform: 'scale(1)' }
            ], { duration: 350, easing: 'ease-out' });
    });
}

/**
 * Affiche directement les points d'une équipe
 */
const showPoints = function (team, points) {
    clearInterval(pointsAnimations[team]);
    displayedPoints[team] = points;
    attributePointsAtTeam(team, points);
}

/**
 * Le burger se remplit étage par étage jusqu'aux nouveaux points
 */
const animatePoints = function (team, points) {
    clearInterval(pointsAnimations[team]);
    if (points <= displayedPoints[team]) {
        showPoints(team, points);
        return;
    }
    const step = function () {
        const next = displayedPoints[team] + 1;
        displayedPoints[team] = next;
        attributePointsAtTeam(team, next);
        popBurgerElement(team, next);
        if (next >= points)
            clearInterval(pointsAnimations[team]);
    }
    step();
    if (displayedPoints[team] < points)
        pointsAnimations[team] = setInterval(step, durationPointStep);
}

/**
 * Se charge d'afficher la fenêtre de jeu principal
 * Et de cacher la fenêtre de transition
 */
const showMainBackgroundAndHideTransition = function () {
    $mainBackground.show();
    $modalTransition.hide();
    isTransitionRunning = false;
    $('body').removeClass('transition-running');
}

/**
 * Se charge d'afficher une transition à l'écran
 * @param {*} transitionName Le nom de la ressource à afficher
 */
const receiveOrderForTransition = function (transitionName) {
    $mainBackground.hide();
    $modalTransition.show();
    isTransitionRunning = true;
    $('body').addClass('transition-running');
    $sourceTransition.attr('src', baseDirVideos + transitionName);
    const video = $videoTransitionContainer.get(0);
    video.load();
    const promise = video.play();
    if (promise)
        promise.catch(function (error) {
            console.log('Lecture de la transition impossible : ' + error);
        });
    // .one : évite d'empiler un handler à chaque transition
    $videoTransitionContainer.one('ended', function () {
        showMainBackgroundAndHideTransition();
    });
}

/**
 * Se charge d'arrête une transition
 */
const stopTransitionNow = function () {
    showMainBackgroundAndHideTransition();
    $videoTransitionContainer.off('ended');
    $videoTransitionContainer.get(0).pause();
    $sourceTransition.attr('src', '');
}

/**
 * Se charge d'envoyer un son
 * Lorsqu'une équipe à mal répondu
 */
const launchBuzzSound = function () {
    playSound(buzzSound);
}

/**
 * Joue un son
 * @param {*} sound le lien du son à jouer
 */
const playSound = function (sound) {
    var audio = new Audio(sound);
    playElement(audio);
    return audio;
}

/**
 * Lance la lecture d'un élément audio / vidéo
 * play() renvoie une promesse rejetée si le navigateur bloque la lecture
 */
const playElement = function (element) {
    const promise = element.play();
    if (promise)
        promise.catch(function (error) {
            console.log('Lecture impossible : ' + error);
        });
}

/**
 * Arrête le son ou la vidéo de la question / réponse
 */
const stopMedia = function () {
    if (mediaAudio) {
        mediaAudio.pause();
        mediaAudio = null;
    }
    videoMedia.onended = null;
    videoMedia.pause();
    videoMedia.removeAttribute('src');
    videoMedia.load();
    $modalMedia.prop('hidden', true);
}

/**
 * Joue le son ou la vidéo d'une question / réponse
 * @param {*} media { url, type } type : 'audio' ou 'video'
 */
const playMedia = function (media) {
    stopMedia();
    if (media.type === 'video') {
        $modalMedia.prop('hidden', false);
        videoMedia.src = media.url;
        // La vidéo disparait une fois terminée
        videoMedia.onended = stopMedia;
        playElement(videoMedia);
    } else {
        mediaAudio = playSound(media.url);
    }
}

/**
 * Les menus : noms des menus à choisir, ceux verrouillés sont barrés
 * @param {*} menus [{ name, played }]
 */
const displayScreenMenus = function (menus) {
    $screenQuestionMenus.empty();
    menus.forEach(function (menu, index) {
        $screenQuestionMenus.append($('<div class="screen-question-menu"></div>')
            .toggleClass('played', menu.played)
            .text(menu.name || 'Menu ' + (index + 1)));
    });
}

/**
 * Affiche la question en cours (Nuggets, menus, propositions de Sel ou Poivre) ou la masque
 * @param {*} question { round, theme, question, choices, answer } (answer seulement une fois révélée),
 *  { round, menus } pour choisir un menu, null pour masquer
 */
const displayScreenQuestion = function (question) {
    $screenQuestion.prop('hidden', !question);
    if (!question)
        return;
    const isMenus = Array.isArray(question.menus);
    $screenQuestionMenus.prop('hidden', !isMenus);
    if (isMenus) {
        $screenQuestionRound.text(question.round);
        $screenQuestionText.text('');
        $screenQuestionPoints.prop('hidden', true);
        $screenQuestionChoices.empty().removeClass('revealed');
        $screenQuestionAnswer.prop('hidden', true).text('');
        displayScreenMenus(question.menus);
        return;
    }
    $screenQuestionMenus.empty();
    $screenQuestionRound.text(question.theme ? question.round + ' — ' + question.theme : question.round);
    $screenQuestionText.text(question.question);
    $screenQuestionPoints.prop('hidden', !(question.points > 1)).text(question.points + ' miams');

    const revealed = question.answer !== null && question.answer !== '';
    const normalize = function (text) { return text.trim().toLowerCase(); };
    let answerInChoices = false;
    $screenQuestionChoices.empty().toggleClass('revealed', revealed);
    question.choices.forEach(function (choice, index) {
        const isGood = revealed && normalize(choice) === normalize(question.answer);
        answerInChoices = answerInChoices || isGood;
        $screenQuestionChoices.append($('<div class="screen-question-choice"></div>')
            .toggleClass('good', isGood)
            .append($('<span class="screen-question-choice-letter"></span>').text(String.fromCharCode(65 + index)))
            .append($('<span></span>').text(choice)));
    });
    // Réponse libre (menus) ou absente des propositions : affichée en dessous
    $screenQuestionAnswer.prop('hidden', !revealed || answerInChoices)
        .text(revealed ? question.answer : '');
}

/**
 * Chrono à l'écran
 * @param {*} state { visible, running, duration, remaining }
 */
const displayTimer = function (state) {
    timer = {
        visible: state.visible,
        running: state.running,
        remaining: state.remaining,
        endsAt: Date.now() + state.remaining
    };
    renderTimer();
}

const renderTimer = function () {
    $screenTimer.prop('hidden', !timer.visible);
    if (!timer.visible)
        return;
    const remaining = timer.running ? Math.max(timer.endsAt - Date.now(), 0) : timer.remaining;
    $screenTimer.text(Math.ceil(remaining / 1000))
        .toggleClass('paused', !timer.running && remaining > 0)
        .toggleClass('hurry', timer.running && remaining <= timerHurryMs)
        .toggleClass('ended', remaining <= 0);
}

/**
 * Compteur du Burger de la mort
 * @param {*} state { active, count, total }
 */
const displayDeathBurger = function (state) {
    $deathBurger.prop('hidden', !state.active);
    if ($deathBurgerSteps.children().length !== state.total) {
        $deathBurgerSteps.empty();
        for (let index = 1; index <= state.total; index++)
            $deathBurgerSteps.append($('<div class="death-burger-step"></div>').text(index));
    }
    $deathBurgerSteps.children().each(function (index) {
        $(this).toggleClass('done', index < state.count);
    });
    const won = state.count >= state.total;
    $deathBurger.toggleClass('won', won);
    $deathBurgerTitle.text(won ? 'Burger de la mort gagné !' : 'Burger de la mort');
    // Erreur : le compteur repart à zéro en tremblant
    if (state.active && state.count === 0 && lastDeathCount > 0) {
        $deathBurger.removeClass('reset');
        void $deathBurger.get(0).offsetWidth;
        $deathBurger.addClass('reset');
    }
    lastDeathCount = state.count;
}

/**
 * Pluie de confettis aux couleurs du jeu
 */
const launchConfetti = function () {
    const colors = [ketchupColor, mayoColor, '#ffffff', '#1E8F3A', '#B2733F'];
    $confetti.empty();
    for (let index = 0; index < confettiCount; index++) {
        $confetti.append($('<div class="confetti-piece"></div>').css({
            left: (Math.random() * 100) + 'vw',
            background: colors[index % colors.length],
            animationDuration: (2.5 + Math.random() * 3) + 's',
            animationDelay: (-Math.random() * 5) + 's'
        }));
    }
}

/**
 * Ecran de victoire
 * @param {*} state { visible, winner, mayo, ketchup }
 */
const displayVictory = function (state) {
    const wasVisible = !$victory.prop('hidden');
    $victory.prop('hidden', !state.visible);
    if (!state.visible) {
        $confetti.empty();
        return;
    }
    $victoryTitle.text(state.winner ? "Victoire de l'équipe " + teamLabels[state.winner] + ' !' : 'Égalité !');
    $victoryLogo.prop('hidden', !state.winner);
    if (state.winner)
        $victoryLogo.attr('src', teamLogos[state.winner]).attr('alt', teamLabels[state.winner]);
    $victoryScoreKetchup.text(state.ketchup);
    $victoryScoreMayo.text(state.mayo);
    if (!wasVisible)
        launchConfetti();
}

/**
 * Plein écran (nécessite une action sur la page : clic, touche)
 */
const toggleFullscreen = function () {
    const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
    const el = document.documentElement;
    const method = isFullscreen
        ? document.exitFullscreen || document.webkitExitFullscreen
        : el.requestFullscreen || el.webkitRequestFullScreen || el.mozRequestFullScreen || el.msRequestFullscreen;
    // Non supporté sur certains navigateurs (ex : Safari iOS)
    if (!method)
        return;
    const promise = method.call(isFullscreen ? document : el);
    if (promise)
        promise.catch(function (error) {
            console.log('Plein écran impossible : ' + error);
        });
}

/**
 * Mode TV : curseur masqué quand la souris ne bouge plus,
 * plein écran avec la touche F ou un double-clic
 */
const initTvMode = function () {
    let cursorTimeout = null;
    const $body = $('body');
    const showCursor = function () {
        $body.removeClass('hide-cursor');
        clearTimeout(cursorTimeout);
        cursorTimeout = setTimeout(function () { $body.addClass('hide-cursor'); }, durationHideCursor);
    }
    $(document).on('mousemove', showCursor);
    showCursor();
    $(document).on('dblclick', toggleFullscreen);
    $(document).on('keydown', function (event) {
        if (event.key.toLowerCase() === 'f' && !event.ctrlKey && !event.metaKey && !event.altKey)
            toggleFullscreen();
    });
    setInterval(renderTimer, 200);
}

/**
 * Se charge d'initialiser la modal de préparation (QR code d'accès au choix des équipes)
 */
const initPrepareGame = function () {
    const btnEveryBodyReady = $('#button-everybody-ready');
    // Le QR code est généré côté serveur, il n'y a plus qu'à fermer la modal
    btnEveryBodyReady.on('click', function () {
        closePrepareGame(true);
    });
}

/**
 * Ferme la modal de préparation (bouton « Tout le monde est prêt ! » ou télécommande)
 * @param {*} fullscreen Passe en plein écran (seulement possible après un clic sur l'écran)
 */
const closePrepareGame = function (fullscreen) {
    const modalPrepareGame = $('#modal-prepare-game');
    if (!modalPrepareGame.length)
        return;
    modalPrepareGame.fadeOut('slow', function () {
        modalPrepareGame.remove();
        if (fullscreen && !document.fullscreenElement)
            toggleFullscreen();
    });
}

/**
 * Initialise la socket et ecoute les eventuelles messages
 */
const initSocketAndListenEvents = function () {
    socket = io();
    /**
     * Points pour l'équipe mayo
     */
    socket.on(messages.messageToClientMayo, function (points) {
        animatePoints(mayo, points);
    });
    /**
     * Points pour l'équipe ketchup
     */
    socket.on(messages.messageToClientKetchup, function (points) {
        animatePoints(ketchup, points);
    });
    /**
     * Rechargement de la partie
     */
    socket.on(messages.messageToClientReloadPart, function () {
        showPoints(mayo, 0);
        showPoints(ketchup, 0);
        stopTransitionNow();
        stopMedia();
    });
    /**
     * Reception des points des différents équipes
     */
    socket.on(messages.messageToClientReceivePoints, function (pointsMayo, pointsKetchup) {
        showPoints(mayo, pointsMayo);
        showPoints(ketchup, pointsKetchup);
    });
    /**
     * Réception de l'évènement du buzzer
     */
    socket.on(messages.messageToClientReceiveBuzz, function (teamName) {
        $buzzFirstGap.text('');
        receiveBuzzAndInteractOnView(teamName);
    });
    socket.on(messages.messageToClientReceiveBuzzGap, displayBuzzGap);
    /**
     * Chrono, Burger de la mort, écran de victoire, lancement depuis la télécommande
     */
    socket.on(messages.messageToClientReceiveTimer, displayTimer);
    socket.on(messages.messageToClientTimerEnded, launchBuzzSound);
    socket.on(messages.messageToClientReceiveDeathBurger, displayDeathBurger);
    socket.on(messages.messageToClientReceiveVictory, displayVictory);
    socket.on(messages.messageToClientStartGame, function () {
        closePrepareGame(false);
    });
    /**
     * Affiche la prochaine transition
     */
    socket.on(messages.messageToClientNextTransition, function (transitionName) {
        receiveOrderForTransition(transitionName);
    });
    socket.on(messages.messageToClientReceiveBadResponse, function () {
        launchBuzzSound();
    });
    /**
     * Question à afficher à l'écran (Nuggets, menus)
     */
    socket.on(messages.messageToClientReceiveScreenQuestion, displayScreenQuestion);
    /**
     * Son ou vidéo d'une question / réponse lancé depuis la télécommande
     */
    socket.on(messages.messageToClientPlayMedia, playMedia);
    socket.on(messages.messageToClientStopMedia, stopMedia);
    /**
     * On souhaite connaitre le nombre de points
     * Dès que l'on se connecte (ou se reconnecte) sur la page
     */
    socket.on('connect', function () {
        socket.emit(messages.messageClientsNeedPointsInformations);
        socket.emit(messages.messageClientNeedScreenQuestion);
        socket.emit(messages.messageClientNeedStateGame);
    });
}

registerComponents();

initSocketAndListenEvents();

initPrepareGame();

initTvMode();