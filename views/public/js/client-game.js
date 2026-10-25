/**
 * Ecran de jeu (TV / vidéoprojecteur) : sans jQuery ni Bootstrap
 */

// Noms des messages partagés avec le serveur (/js/messages-socket.js)
const messages = BQ_MESSAGES;

const byId = function (id) { return document.getElementById(id); };

/**
 * Dimensions de la scène (16:9), mise à l'échelle de l'écran
 */
const stageWidth = 1920;
const stageHeight = 1080;

const stage = byId('stage');
const scoreElements = { 'team-ketchup': byId('score-ketchup'), 'team-mayo': byId('score-mayo') };
const scoreboardRound = byId('scoreboard-round');

const questionPanel = byId('question-panel');
const questionRound = byId('question-round');
const questionPoints = byId('question-points');
const questionText = byId('question-text');
const questionChoices = byId('question-choices');
const questionAnswer = byId('question-answer');
const questionMenus = byId('question-menus');

const timerElement = byId('timer');
const timerRing = byId('timer-ring');
const timerValue = byId('timer-value');

const deathBurger = byId('death-burger');
const deathBurgerTitle = byId('death-burger-title');
const deathBurgerTower = byId('death-burger-tower');
const deathBurgerCount = byId('death-burger-count');

const roundCard = byId('round-card');
const badAnswer = byId('bad-answer');

const buzzFirst = byId('buzz-first');
const buzzFirstLogo = byId('buzz-first-logo');
const buzzFirstName = byId('buzz-first-name');
const buzzFirstGap = byId('buzz-first-gap');

const victory = byId('victory');
const confetti = byId('confetti');

const media = byId('media');
const videoMedia = byId('video-media');
const transition = byId('transition');
const videoTransition = byId('video-transition');
const prepare = byId('prepare');

const teams = ['team-ketchup', 'team-mayo'];
const teamLabels = { 'team-mayo': 'Mayo', 'team-ketchup': 'Ketchup' };
const teamLogos = { 'team-mayo': '/images/teams/mayo.svg', 'team-ketchup': '/images/teams/ketchup.svg' };
const teamColors = { 'team-mayo': '#E0C800', 'team-ketchup': '#C71000' };

/**
 * Sons
 */
const buzzSound = '/sounds/buzz.mp3';
const buzzSounds = { 'team-ketchup': '/sounds/burger-sound-buzz-1.mp3', 'team-mayo': '/sounds/burger-sound-buzz-2.mp3' };

/**
 * Durées (ms)
 */
const durationBuzzFirst = 4000;
const durationHideCursor = 3000;
const durationPointStep = 300;
const durationBadAnswer = 900;
const durationCollapse = 900;
const durationPrepareFade = 600;
const timerWarningRatio = 0.5;
const timerHurryMs = 5000;
const confettiCount = 150;
/**
 * Roulement avant la réponse : intervalles (ms) entre deux propositions, de plus en plus lents
 */
const spotlightSteps = [70, 70, 80, 90, 100, 120, 140, 170, 210, 260, 320];

/**
 * Taille de police de la question : la plus grande qui tient dans le panneau
 */
const questionFontMax = 44;
const questionFontMin = 22;

const imageDir = '/images/burger/';

/**
 * Eléments du plateau d'une équipe : un par point (le burger se remplit élément par élément)
 * [points, image remplie, image vide] ; une liste de listes forme une rangée (frites)
 */
const trayLayout = {
    burger: [
        [10, 'top-bread', 'empty-top-bread'],
        [9, 'top-tomato', 'empty-top-tomato'],
        [8, 'top-meat', 'empty-top-meat'],
        [7, 'cheese', 'empty-cheese'],
        [6, 'salad', 'empty-salad'],
        [5, 'middle-burger', 'empty-middle-burger'],
        [4, 'base-tomato', 'empty-base-tomato'],
        [3, 'base-meat', 'empty-base-meat'],
        [2, 'salad', 'empty-salad'],
        [1, 'base-burger', 'empty-base-burger']
    ],
    drink: [
        [13, 'straw', 'empty-straw'],
        [12, 'top-cup', 'empty-top-cup'],
        [11, 'cup', 'empty-cup']
    ],
    sauces: [
        [16, 'tube-ketchup', 'empty-mayo-ketchup'],
        [15, 'tube-mayo', 'empty-mayo-ketchup'],
        [14, 'salt-pepper', 'empty-salt-pepper']
    ],
    fries: [
        [[22, 'frie-1', 'empty-frie-1'], [23, 'frie-2', 'empty-frie-2'], [24, 'frie-3', 'empty-frie-3'], [25, 'frie-4', 'empty-frie-4']],
        [[18, 'frie-1', 'empty-frie-1'], [19, 'frie-2', 'empty-frie-2'], [20, 'frie-3', 'empty-frie-3'], [21, 'frie-4', 'empty-frie-4']],
        [17, 'bucket', 'empty-bucket']
    ]
};

/**
 * Burger de la mort : étages de la tour, du bas vers le haut
 */
const deathBurgerLayers = trayLayout.burger.slice().reverse();

/**
 * Etat de l'écran
 */
const trayItems = { 'team-ketchup': [], 'team-mayo': [] };
const displayedPoints = { 'team-ketchup': 0, 'team-mayo': 0 };
const pointsAnimations = {};
let timer = { visible: false, running: false, duration: 0, remaining: 0, endsAt: 0 };
let lastDeathCount = 0;
let isTransitionRunning = false;
let mediaAudio = null;
let buzzFirstTimeout = null;
let badAnswerTimeout = null;
let collapseTimeout = null;
let spotlightTimeout = null;
let screenQuestion = null;

const el = function (tag, className, text) {
    const element = document.createElement(tag);
    if (className)
        element.className = className;
    if (text !== undefined)
        element.textContent = text;
    return element;
}

/**
 * Relance une animation CSS (retire puis remet la classe)
 */
const restartAnimation = function (element, className) {
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
}

/**
 * Met la scène 16:9 à l'échelle de l'écran
 */
const fitStage = function () {
    const scale = Math.min(window.innerWidth / stageWidth, window.innerHeight / stageHeight);
    stage.style.transform = 'translate(-50%, -50%) scale(' + scale + ')';
}

/**************************/
/*   PLATEAUX ET POINTS   */
/**************************/

const createTrayItem = function (team, definition) {
    const image = el('img', 'tray-item');
    image.alt = '';
    image.dataset.points = definition[0];
    image.dataset.full = imageDir + definition[1] + '.png';
    image.dataset.empty = imageDir + definition[2] + '.png';
    image.src = image.dataset.empty;
    trayItems[team].push(image);
    return image;
}

/**
 * Construit le plateau d'une équipe : burger, boisson, sauces, frites
 */
const buildTray = function (team) {
    const content = el('div', 'tray-content');
    const column = function (name, definitions) {
        const element = el('div', 'tray-column tray-' + name);
        definitions.forEach(function (definition) {
            if (Array.isArray(definition[0])) {
                const row = el('div', 'tray-fries-row');
                definition.forEach(function (item) { row.appendChild(createTrayItem(team, item)); });
                element.appendChild(row);
            } else {
                element.appendChild(createTrayItem(team, definition));
            }
        });
        return element;
    }
    content.appendChild(column('burger', trayLayout.burger));
    content.appendChild(column('drink', trayLayout.drink));
    content.appendChild(column('sauces', trayLayout.sauces));
    content.appendChild(column('fries', trayLayout.fries));
    document.querySelector('.tray[data-team="' + team + '"]').appendChild(content);
}

/**
 * Remplit le plateau jusqu'aux points donnés
 * @param {*} gained Point qui vient d'être gagné (élément animé)
 */
const renderPoints = function (team, points, gained) {
    trayItems[team].forEach(function (image) {
        const value = Number(image.dataset.points);
        const src = value <= points ? image.dataset.full : image.dataset.empty;
        if (image.getAttribute('src') !== src)
            image.src = src;
        if (value === gained)
            restartAnimation(image, 'gained');
    });
    const score = scoreElements[team];
    if (score.textContent !== String(points)) {
        score.textContent = points;
        restartAnimation(score, 'bump');
    }
}

/**
 * Affiche directement les points d'une équipe
 */
const showPoints = function (team, points) {
    clearInterval(pointsAnimations[team]);
    displayedPoints[team] = points;
    renderPoints(team, points, null);
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
        renderPoints(team, next, next);
        if (next >= points)
            clearInterval(pointsAnimations[team]);
    }
    step();
    if (displayedPoints[team] < points)
        pointsAnimations[team] = setInterval(step, durationPointStep);
}

/**************************/
/*   SONS ET VIDEOS       */
/**************************/

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

const playSound = function (sound) {
    const audio = new Audio(sound);
    playElement(audio);
    return audio;
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
    media.hidden = true;
}

/**
 * Joue le son ou la vidéo d'une question / réponse
 * @param {*} item { url, type } type : 'audio' ou 'video'
 */
const playMedia = function (item) {
    stopMedia();
    if (item.type === 'video') {
        media.hidden = false;
        videoMedia.src = item.url;
        // La vidéo disparait une fois terminée
        videoMedia.onended = stopMedia;
        playElement(videoMedia);
    } else {
        mediaAudio = playSound(item.url);
    }
}

/**
 * Transition entre les manches (vidéo plein écran)
 */
const hideTransition = function () {
    transition.hidden = true;
    isTransitionRunning = false;
    videoTransition.onended = null;
}

const playTransition = function (filename) {
    isTransitionRunning = true;
    transition.hidden = false;
    videoTransition.src = '/videos/' + filename;
    videoTransition.onended = hideTransition;
    playElement(videoTransition);
}

const stopTransition = function () {
    videoTransition.pause();
    videoTransition.removeAttribute('src');
    videoTransition.load();
    hideTransition();
}

/**************************/
/*   BUZZ                 */
/**************************/

/**
 * Une équipe a buzzé : écran à ses couleurs, son logo arrive en grand
 */
const displayBuzz = function (team) {
    if (isTransitionRunning || !teamLabels[team])
        return;
    // Comme dans l'émission, le buzz coupe le son ou la vidéo en cours
    stopMedia();
    playSound(buzzSounds[team]);
    clearTimeout(buzzFirstTimeout);
    buzzFirst.className = team;
    buzzFirstLogo.src = teamLogos[team];
    buzzFirstLogo.alt = teamLabels[team];
    buzzFirstName.textContent = teamLabels[team] + ' !';
    buzzFirstGap.textContent = '';
    // Relance les animations d'apparition
    buzzFirst.hidden = true;
    void buzzFirst.offsetWidth;
    buzzFirst.hidden = false;
    buzzFirstTimeout = setTimeout(function () {
        buzzFirst.hidden = true;
    }, durationBuzzFirst);
}

/**
 * Ecart entre le buzz de l'équipe gagnante et celui de l'autre équipe
 */
const displayBuzzGap = function (team, gap) {
    const seconds = (gap / 1000).toFixed(2).replace('.', ',');
    buzzFirstGap.textContent = teamLabels[team] + ' : ' + seconds + ' s trop tard !';
}

/**
 * L'équipe qui a la main : bordure de l'écran à ses couleurs
 * @param {*} isLocked Buzzer bloqué
 * @param {*} firstTeam Equipe ayant buzzé (ou null)
 */
const displayBuzzerState = function (isLocked, firstTeam) {
    teams.forEach(function (team) {
        stage.classList.toggle('hand-' + team, team === firstTeam);
    });
}

/**
 * Mauvaise réponse : « pouet » et grande croix
 */
const displayBadAnswer = function () {
    playSound(buzzSound);
    if (isTransitionRunning)
        return;
    clearTimeout(badAnswerTimeout);
    badAnswer.hidden = true;
    void badAnswer.offsetWidth;
    badAnswer.hidden = false;
    badAnswerTimeout = setTimeout(function () { badAnswer.hidden = true; }, durationBadAnswer);
}

/**************************/
/*   QUESTION             */
/**************************/

/**
 * Identifiant d'une question à l'écran : une nouvelle question est animée à son arrivée
 */
const questionKey = function (question) {
    if (!question)
        return null;
    if (question.menus)
        return 'menus:' + question.round;
    return [question.round, question.theme, question.question].concat(question.choices).join('\n');
}

/**
 * Plus grande taille de police pour que la question tienne dans le panneau
 */
const fitQuestion = function () {
    if (questionPanel.hidden)
        return;
    const style = getComputedStyle(questionPanel);
    const available = parseFloat(style.maxHeight) - parseFloat(style.borderTopWidth) - parseFloat(style.borderBottomWidth)
        - parseFloat(style.paddingBottom);
    // Hauteur du contenu mise en page (offsetTop / offsetHeight ignorent les animations en cours)
    const contentHeight = function () {
        let bottom = 0;
        Array.prototype.forEach.call(questionPanel.children, function (child) {
            if (child.offsetParent)
                bottom = Math.max(bottom, child.offsetTop + child.offsetHeight);
        });
        return bottom;
    }
    let size = questionFontMax;
    questionPanel.style.fontSize = size + 'px';
    while (size > questionFontMin && contentHeight() > available) {
        size -= 2;
        questionPanel.style.fontSize = size + 'px';
    }
}

const normalize = function (text) { return String(text).trim().toLowerCase(); };

/**
 * Les menus : cartes de restaurant (nombre de questions, tampon de l'équipe qui l'a choisi)
 * @param {*} menus [{ name, played, team, count }]
 */
const renderMenus = function (menus, animate) {
    questionMenus.textContent = '';
    menus.forEach(function (menu, index) {
        const card = el('div', 'question-menu' + (menu.played ? ' played' : ''));
        card.appendChild(el('div', 'question-menu-name', menu.name || 'Menu ' + (index + 1)));
        if (menu.count)
            card.appendChild(el('div', 'question-menu-count', menu.count + (menu.count > 1 ? ' questions' : ' question')));
        if (menu.team)
            card.appendChild(el('div', 'question-menu-stamp ' + menu.team, 'Choisi par ' + teamLabels[menu.team]));
        if (animate)
            card.style.animationDelay = (250 + index * 150) + 'ms';
        questionMenus.appendChild(card);
    });
}

/**
 * Propositions de la question (la bonne est marquée, mise en avant une fois révélée)
 */
const renderChoices = function (question, animate) {
    questionChoices.textContent = '';
    (question.choices || []).forEach(function (choice, index) {
        const item = el('div', 'question-choice');
        item.appendChild(el('span', 'question-choice-letter', String.fromCharCode(65 + index)));
        item.appendChild(el('span', '', choice));
        if (animate)
            item.style.animationDelay = (300 + index * 150) + 'ms';
        if (question.answer && normalize(choice) === normalize(question.answer))
            item.classList.add('good');
        questionChoices.appendChild(item);
    });
}

/**
 * Révèle la réponse : roulement sur les propositions, puis la bonne s'allume
 * @param {*} animate Roulement (seulement quand l'animateur vient de révéler la réponse)
 */
const revealAnswer = function (question, animate) {
    const choices = Array.prototype.slice.call(questionChoices.children);
    const good = questionChoices.querySelector('.good');
    const showAnswer = function () {
        choices.forEach(function (choice) { choice.classList.remove('spotlight'); });
        questionChoices.classList.add('revealed');
        // Réponse libre (menus) ou absente des propositions : affichée en dessous
        questionAnswer.hidden = !!good;
        questionAnswer.textContent = good ? '' : question.answer;
        fitQuestion();
    }
    if (!animate || !good || choices.length < 2) {
        showAnswer();
        return;
    }
    // Le roulement s'arrête sur la bonne réponse
    const goodIndex = choices.indexOf(good);
    let position = ((goodIndex - spotlightSteps.length) % choices.length + choices.length) % choices.length;
    let step = 0;
    const tick = function () {
        choices.forEach(function (choice, index) { choice.classList.toggle('spotlight', index === position); });
        if (step >= spotlightSteps.length) {
            spotlightTimeout = setTimeout(showAnswer, 250);
            return;
        }
        spotlightTimeout = setTimeout(tick, spotlightSteps[step]);
        step++;
        position = (position + 1) % choices.length;
    }
    tick();
}

/**
 * Affiche la question en cours (ou les menus à choisir) en bas de l'écran
 * @param {*} question { round, theme, question, choices, points, answer } (answer seulement une fois révélée),
 *  { round, menus } pour choisir un menu, null pour masquer
 */
const displayScreenQuestion = function (question) {
    const previous = screenQuestion;
    screenQuestion = question;
    clearTimeout(spotlightTimeout);
    stage.classList.toggle('with-question', !!question);
    questionPanel.hidden = !question;
    if (!question)
        return;
    const isNew = questionKey(previous) !== questionKey(question);
    if (isNew)
        restartAnimation(questionPanel, 'enter');

    const isMenus = Array.isArray(question.menus);
    questionMenus.hidden = !isMenus;
    questionRound.textContent = !isMenus && question.theme ? question.round + ' — ' + question.theme : question.round;
    questionPoints.hidden = isMenus || !(question.points > 1);
    questionPoints.textContent = question.points + ' miams';
    questionChoices.classList.remove('revealed');
    questionAnswer.hidden = true;
    if (isMenus) {
        questionText.textContent = '';
        questionChoices.textContent = '';
        renderMenus(question.menus, isNew);
        fitQuestion();
        return;
    }
    questionMenus.textContent = '';
    questionText.textContent = question.question;
    renderChoices(question, isNew);
    fitQuestion();
    if (question.answer)
        revealAnswer(question, !isNew && !!previous && !previous.answer);
}

/**************************/
/*   MANCHE               */
/**************************/

/**
 * Manche en cours dans le bandeau
 * @param {*} state { current, next, hasPrevious }
 */
const displayTransitionState = function (state) {
    scoreboardRound.textContent = state.current || 'Burger Quiz';
}

/**
 * Carton de manche : numéro, nom et règles
 * @param {*} state { visible, number, label, rules }
 */
const displayRoundCard = function (state) {
    const wasVisible = !roundCard.hidden;
    roundCard.hidden = !state.visible;
    if (!state.visible)
        return;
    byId('round-card-number').textContent = 'Manche ' + state.number;
    byId('round-card-label').textContent = state.label;
    byId('round-card-rules').textContent = state.rules || '';
    if (!wasVisible)
        restartAnimation(roundCard.firstElementChild, 'round-card-content');
}

/**************************/
/*   CHRONO               */
/**************************/

const timerCircumference = 2 * Math.PI * Number(timerRing.getAttribute('r'));
timerRing.style.strokeDasharray = timerCircumference;

/**
 * Chrono : décompte local à partir du temps restant envoyé par le serveur
 * @param {*} state { visible, running, duration, remaining }
 */
const displayTimer = function (state) {
    timer = {
        visible: state.visible,
        running: state.running,
        duration: state.duration,
        remaining: state.remaining,
        endsAt: Date.now() + state.remaining
    };
    renderTimer();
}

/**
 * Anneau qui se vide : orange à mi-temps, rouge et pulsation sur les dernières secondes
 */
const renderTimer = function () {
    timerElement.hidden = !timer.visible;
    if (!timer.visible)
        return;
    const remaining = timer.running ? Math.max(timer.endsAt - Date.now(), 0) : timer.remaining;
    const ratio = timer.duration ? remaining / (timer.duration * 1000) : 0;
    timerValue.textContent = Math.ceil(remaining / 1000);
    timerRing.style.strokeDashoffset = timerCircumference * (1 - ratio);
    timerElement.classList.toggle('paused', !timer.running && remaining > 0);
    timerElement.classList.toggle('warning', ratio <= timerWarningRatio);
    timerElement.classList.toggle('hurry', timer.running && remaining > 0 && remaining <= timerHurryMs);
    timerElement.classList.toggle('ended', remaining <= 0);
}

/**************************/
/*   BURGER DE LA MORT    */
/**************************/

const buildDeathBurger = function () {
    deathBurgerLayers.forEach(function (layer) {
        const image = el('img', 'death-burger-layer empty');
        image.alt = '';
        image.dataset.full = imageDir + layer[1] + '.png';
        image.dataset.empty = imageDir + layer[2] + '.png';
        image.src = image.dataset.empty;
        deathBurgerTower.appendChild(image);
    });
}

/**
 * Tour du Burger de la mort : un étage par bonne réponse, elle s'effondre à la moindre erreur
 * @param {*} state { active, count, total }
 */
const displayDeathBurger = function (state) {
    deathBurger.hidden = !state.active;
    stage.classList.toggle('death-round', state.active);
    const layers = Array.prototype.slice.call(deathBurgerTower.children);
    const won = state.count >= state.total;
    deathBurger.classList.toggle('won', won);
    deathBurgerTitle.textContent = won ? 'Burger de la mort gagné !' : 'Burger de la mort';
    deathBurgerCount.textContent = state.count + ' / ' + state.total;
    const render = function () {
        layers.forEach(function (layer, index) {
            const done = index < state.count;
            if (done && layer.classList.contains('empty') && state.active)
                restartAnimation(layer, 'drop');
            layer.classList.toggle('empty', !done);
            layer.src = done ? layer.dataset.full : layer.dataset.empty;
        });
    }
    // Erreur : la tour s'effondre avant de repartir de zéro
    if (state.active && state.count === 0 && lastDeathCount > 0) {
        clearTimeout(collapseTimeout);
        layers.forEach(function (layer) {
            layer.classList.remove('drop');
            layer.style.setProperty('--fall-x', (Math.random() * 400 - 200) + 'px');
            layer.style.setProperty('--fall-r', (Math.random() * 120 - 60) + 'deg');
        });
        restartAnimation(deathBurger, 'collapse');
        collapseTimeout = setTimeout(function () {
            deathBurger.classList.remove('collapse');
            render();
        }, durationCollapse);
    } else {
        render();
    }
    lastDeathCount = state.count;
}

/**************************/
/*   VICTOIRE             */
/**************************/

const launchConfetti = function () {
    const colors = [teamColors['team-ketchup'], teamColors['team-mayo'], '#ffffff', '#1E8F3A', '#A0612F'];
    confetti.textContent = '';
    for (let index = 0; index < confettiCount; index++) {
        const piece = el('div', 'confetti-piece');
        piece.style.left = (Math.random() * 100) + '%';
        piece.style.background = colors[index % colors.length];
        piece.style.animationDuration = (2.5 + Math.random() * 3) + 's';
        piece.style.animationDelay = (-Math.random() * 5) + 's';
        confetti.appendChild(piece);
    }
}

/**
 * Ecran de victoire et récapitulatif de la partie
 * @param {*} state { visible, winner, mayo, ketchup, rounds: [{ label, mayo, ketchup }], buzzes: { mayo, ketchup } }
 */
const displayVictory = function (state) {
    const wasVisible = !victory.hidden;
    victory.hidden = !state.visible;
    if (!state.visible) {
        confetti.textContent = '';
        return;
    }
    const logo = byId('victory-logo');
    byId('victory-title').textContent = state.winner ? "Victoire de l'équipe " + teamLabels[state.winner] + ' !' : 'Égalité !';
    logo.hidden = !state.winner;
    if (state.winner) {
        logo.src = teamLogos[state.winner];
        logo.alt = teamLabels[state.winner];
    }
    byId('victory-score-ketchup').textContent = state.ketchup;
    byId('victory-score-mayo').textContent = state.mayo;

    const rounds = state.rounds || [];
    const body = byId('victory-recap-rounds');
    body.textContent = '';
    rounds.forEach(function (round) {
        const row = el('tr');
        row.appendChild(el('td', '', round.label));
        row.appendChild(el('td', 'victory-recap-ketchup', round.ketchup));
        row.appendChild(el('td', 'victory-recap-mayo', round.mayo));
        body.appendChild(row);
    });
    byId('victory-recap').hidden = !rounds.length;
    const buzzes = state.buzzes || { mayo: 0, ketchup: 0 };
    const buzzesElement = byId('victory-buzzes');
    buzzesElement.hidden = !(buzzes.mayo || buzzes.ketchup);
    buzzesElement.textContent = 'Premiers au buzzer : Ketchup ' + buzzes.ketchup + ' · Mayo ' + buzzes.mayo;
    if (!wasVisible)
        launchConfetti();
}

/**************************/
/*   MODE TV              */
/**************************/

/**
 * Plein écran (nécessite une action sur la page : clic, touche)
 */
const toggleFullscreen = function () {
    const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
    const root = document.documentElement;
    const method = isFullscreen
        ? document.exitFullscreen || document.webkitExitFullscreen
        : root.requestFullscreen || root.webkitRequestFullScreen;
    // Non supporté sur certains navigateurs (ex : Safari iOS)
    if (!method)
        return;
    const promise = method.call(isFullscreen ? document : root);
    if (promise)
        promise.catch(function (error) {
            console.log('Plein écran impossible : ' + error);
        });
}

/**
 * Curseur masqué quand la souris ne bouge plus, plein écran avec la touche F ou un double-clic
 */
const initTvMode = function () {
    let cursorTimeout = null;
    const showCursor = function () {
        document.body.classList.remove('hide-cursor');
        clearTimeout(cursorTimeout);
        cursorTimeout = setTimeout(function () { document.body.classList.add('hide-cursor'); }, durationHideCursor);
    }
    document.addEventListener('mousemove', showCursor);
    showCursor();
    document.addEventListener('dblclick', toggleFullscreen);
    document.addEventListener('keydown', function (event) {
        if (event.key.toLowerCase() === 'f' && !event.ctrlKey && !event.metaKey && !event.altKey)
            toggleFullscreen();
    });
    window.addEventListener('resize', fitStage);
    fitStage();
    setInterval(renderTimer, 100);
}

/**
 * Ecran de préparation (QR code) : fermé par le bouton « Tout le monde est prêt ! » ou la télécommande
 * @param {*} fullscreen Passe en plein écran (seulement possible après un clic sur l'écran)
 */
const closePrepare = function (fullscreen) {
    if (!prepare.isConnected || prepare.classList.contains('closing'))
        return;
    prepare.classList.add('closing');
    setTimeout(function () { prepare.remove(); }, durationPrepareFade);
    if (fullscreen && !document.fullscreenElement)
        toggleFullscreen();
}

/**************************/
/*   SOCKET               */
/**************************/

const initSocket = function () {
    const socket = io();
    socket.on(messages.messageToClientMayo, function (points) { animatePoints('team-mayo', points); });
    socket.on(messages.messageToClientKetchup, function (points) { animatePoints('team-ketchup', points); });
    socket.on(messages.messageToClientReceivePoints, function (pointsMayo, pointsKetchup) {
        showPoints('team-mayo', pointsMayo);
        showPoints('team-ketchup', pointsKetchup);
    });
    socket.on(messages.messageToClientReloadPart, function () {
        showPoints('team-mayo', 0);
        showPoints('team-ketchup', 0);
        stopTransition();
        stopMedia();
    });
    socket.on(messages.messageToClientReceiveBuzz, displayBuzz);
    socket.on(messages.messageToClientReceiveBuzzGap, displayBuzzGap);
    socket.on(messages.messageToClientReceiveStateBuzzer, displayBuzzerState);
    socket.on(messages.messageToClientReceiveBadResponse, displayBadAnswer);
    socket.on(messages.messageToClientReceiveTimer, displayTimer);
    socket.on(messages.messageToClientTimerEnded, function () { playSound(buzzSound); });
    socket.on(messages.messageToClientReceiveDeathBurger, displayDeathBurger);
    socket.on(messages.messageToClientReceiveVictory, displayVictory);
    socket.on(messages.messageToClientReceiveRoundCard, displayRoundCard);
    socket.on(messages.messageToClientStartGame, function () { closePrepare(false); });
    socket.on(messages.messageToClientNextTransition, playTransition);
    socket.on(messages.messageToClientReceiveStateTransition, displayTransitionState);
    socket.on(messages.messageToClientReceiveScreenQuestion, displayScreenQuestion);
    socket.on(messages.messageToClientPlayMedia, playMedia);
    socket.on(messages.messageToClientStopMedia, stopMedia);
    // Etat complet à la connexion (et à chaque reconnexion)
    socket.on('connect', function () {
        socket.emit(messages.messageClientsNeedPointsInformations);
        socket.emit(messages.messageClientNeedScreenQuestion);
        socket.emit(messages.messageClientNeedStateGame);
        socket.emit(messages.messageClientNeedStateTransition);
        socket.emit(messages.messageClientNeedStateBuzzer);
    });
}

// La police chargée change la taille du texte : la question est réajustée
document.fonts.ready.then(fitQuestion);
document.fonts.addEventListener('loadingdone', fitQuestion);

teams.forEach(buildTray);
buildDeathBurger();
byId('button-everybody-ready').addEventListener('click', function () { closePrepare(true); });
initTvMode();
initSocket();
