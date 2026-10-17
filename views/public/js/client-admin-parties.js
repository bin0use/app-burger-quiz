// Gestion des parties et des questions (API /admin/api/parties)
const apiUrl = '/admin/api/parties';
const mediaApiUrl = '/admin/api/media';
const mediaMaxSize = Number(document.body.getAttribute('data-media-max-size'));

const $alertContainer = $('#alert-container');
const $partyList = $('#party-list');
const $partyListEmpty = $('#party-list-empty');
const $partyDetail = $('#party-detail');
const $partyPlaceholder = $('#party-placeholder');
const $inputPartyName = $('#input-party-name');
const $linkExportParty = $('#link-export-party');
const $roundTabs = $('#round-tabs');
const $questionList = $('#question-list');
const $questionListEmpty = $('#question-list-empty');

const $modalQuestion = $('#modal-question');
const $modalQuestionTitle = $('#modal-question-title');
const $inputQuestionRound = $('#input-question-round');
const $inputQuestionTheme = $('#input-question-theme');
const $inputQuestionText = $('#input-question-text');
const $inputQuestionAnswer = $('#input-question-answer');
const $questionChoices = $('#question-choices');
const $inputsChoice = $questionChoices.find('[data-choice]');
const $radiosGoodChoice = $questionChoices.find('[name=question-good-choice]');
const $mediaFields = $('[data-media]');
const $buttonSaveQuestion = $('#button-save-question');

/**
 * Etat de la page
 */
let parties = [];
let currentParty = null;
let currentRound = $roundTabs.find('[data-round]').first().data('round');
let editedQuestionId = null;
/**
 * Sons / vidéos de la question en cours d'édition : { questionMedia, answerMedia }
 */
let editedMedia = {};
let uploadsInProgress = 0;

/**
 * Appelle l'API, renvoie le JSON de la réponse (null si vide)
 * @param {*} method La méthode HTTP
 * @param {*} url L'url relative à l'API
 * @param {*} body Le corps (envoyé en JSON)
 */
const callApi = async function (method, url, body) {
    const options = { method: method, headers: {} };
    if (method !== 'GET' && method !== 'DELETE') {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body || {});
    }
    const response = await fetch(apiUrl + url, options);
    if (response.status === 401) {
        window.location.href = '/login';
        throw new Error('Session expirée');
    }
    const data = response.status === 204 ? null : await response.json().catch(function () { return null; });
    if (!response.ok)
        throw new Error(data && data.error ? data.error : 'Erreur ' + response.status);
    return data;
}

/**
 * Envoie un son / une vidéo, renvoie { file, type, name }
 */
const uploadMedia = async function (file) {
    if (file.size > mediaMaxSize)
        throw new Error('Fichier trop volumineux (' + Math.round(mediaMaxSize / 1024 / 1024) + ' Mo maximum)');
    const response = await fetch(mediaApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) },
        body: file
    });
    if (response.status === 401) {
        window.location.href = '/login';
        throw new Error('Session expirée');
    }
    if (response.status === 413)
        throw new Error('Fichier trop volumineux');
    const data = await response.json().catch(function () { return null; });
    if (!response.ok)
        throw new Error(data && data.error ? data.error : 'Erreur ' + response.status);
    return data;
}

/**
 * Libellé d'un média pour la liste des questions
 */
const mediaLabel = function (media) {
    return (media.type === 'video' ? 'Vidéo' : 'Son') + (media.name ? ' : ' + media.name : '');
}

/**
 * Affiche un message en haut de la page
 */
const showAlert = function (message, style) {
    const $alert = $('<div class="alert alert-dismissible fade show" role="alert"></div>')
        .addClass('alert-' + (style || 'danger'))
        .text(message)
        .append('<button type="button" class="close" data-dismiss="alert" aria-label="Fermer"><span aria-hidden="true">&times;</span></button>');
    $alertContainer.empty().append($alert);
    if (style === 'success')
        setTimeout(function () { $alert.alert('close'); }, 2500);
}

/**
 * Exécute une action et affiche l'erreur éventuelle
 */
const run = function (action) {
    return async function () {
        try {
            await action.apply(this, arguments);
        } catch (error) {
            showAlert(error.message);
        }
    };
}

/**
 * Affiche la liste des parties
 */
const renderPartyList = function () {
    $partyList.empty();
    $partyListEmpty.prop('hidden', parties.length > 0);
    parties.forEach(function (party) {
        const $item = $('<a href="#" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center"></a>')
            .attr('data-id', party.id)
            .toggleClass('active', !!currentParty && currentParty.id === party.id)
            .append($('<span></span>').text(party.name))
            .append($('<span class="badge badge-pill badge-light"></span>').text(party.questionsCount + ' question(s)'));
        $partyList.append($item);
    });
}

/**
 * Affiche le détail de la partie sélectionnée
 */
const renderPartyDetail = function () {
    $partyDetail.prop('hidden', !currentParty);
    $partyPlaceholder.prop('hidden', !!currentParty);
    if (!currentParty)
        return;
    $inputPartyName.val(currentParty.name);
    $linkExportParty.attr('href', apiUrl + '/' + currentParty.id + '/export');
    $roundTabs.find('[data-round]').each(function () {
        const round = $(this).data('round');
        $(this).toggleClass('active', round === currentRound);
        $(this).find('[data-count]').text(questionsOfRound(round).length);
    });
    renderQuestionList();
}

const questionsOfRound = function (round) {
    return currentParty.questions.filter(function (question) { return question.round === round; });
}

/**
 * Affiche les questions de la manche sélectionnée
 */
const renderQuestionList = function () {
    const questions = questionsOfRound(currentRound);
    $questionList.empty();
    $questionListEmpty.prop('hidden', questions.length > 0);
    questions.forEach(function (question, index) {
        const $content = $('<div class="flex-grow-1 mr-3"></div>');
        if (question.theme)
            $content.append($('<small class="text-muted d-block"></small>').text(question.theme));
        $content.append($('<div class="font-weight-bold"></div>').text((index + 1) + '. ' + question.question));
        if (question.choices && question.choices.length) {
            const $choices = $('<ol type="A" class="mb-0 pl-4 small"></ol>');
            question.choices.forEach(function (choice) {
                $choices.append($('<li></li>').text(choice));
            });
            $content.append($choices);
        }
        if (question.questionMedia)
            $content.append($('<div class="small text-info"></div>').text('Question — ' + mediaLabel(question.questionMedia)));
        $content.append($('<div class="text-success"></div>').text(question.answer ? 'Réponse : ' + question.answer : ''));
        if (question.answerMedia)
            $content.append($('<div class="small text-info"></div>').text('Réponse — ' + mediaLabel(question.answerMedia)));

        const $actions = $('<div class="btn-group btn-group-sm align-self-start"></div>')
            .append($('<button type="button" class="btn btn-outline-secondary" data-action="up" title="Monter">&uarr;</button>').prop('disabled', index === 0))
            .append($('<button type="button" class="btn btn-outline-secondary" data-action="down" title="Descendre">&darr;</button>').prop('disabled', index === questions.length - 1))
            .append('<button type="button" class="btn btn-outline-primary" data-action="edit">Modifier</button>')
            .append('<button type="button" class="btn btn-outline-danger" data-action="delete">Supprimer</button>');

        $questionList.append($('<li class="list-group-item d-flex"></li>')
            .attr('data-id', question.id)
            .append($content, $actions));
    });
}

/**
 * Recharge la liste des parties (et la partie sélectionnée)
 */
const refresh = async function () {
    parties = await callApi('GET', '');
    if (currentParty)
        currentParty = parties.some(function (party) { return party.id === currentParty.id; })
            ? await callApi('GET', '/' + currentParty.id)
            : null;
    renderPartyList();
    renderPartyDetail();
}

const selectParty = async function (id) {
    currentParty = await callApi('GET', '/' + id);
    renderPartyList();
    renderPartyDetail();
}

/**
 * Affiche le son / la vidéo d'un champ média de la modal (lecteur d'aperçu)
 * @param {*} $field Le champ ([data-media])
 */
const renderMediaField = function ($field) {
    const media = editedMedia[$field.data('media')];
    const $preview = $field.find('[data-media-preview]').empty();
    if (media) {
        $preview.append($(media.type === 'video' ? '<video controls preload="metadata" class="mw-100" style="max-height: 200px"></video>' : '<audio controls preload="metadata" class="w-100"></audio>')
            .attr('src', '/media/' + media.file));
        $preview.append($('<small class="text-muted d-block"></small>').text(media.name));
    }
    $field.find('[data-media-choose]').text(media ? 'Remplacer' : 'Choisir un fichier');
    $field.find('[data-media-remove]').prop('hidden', !media);
}

/**
 * Ouvre la modal de question (ajout si question absente)
 */
const openQuestionModal = function (question) {
    editedQuestionId = question ? question.id : null;
    $modalQuestionTitle.text(question ? 'Modifier la question' : 'Ajouter une question');
    $inputQuestionRound.val(question ? question.round : currentRound);
    $inputQuestionTheme.val(question ? question.theme : '');
    $inputQuestionText.val(question ? question.question : '');
    $inputQuestionAnswer.val(question ? question.answer : '');
    const choices = question && question.choices ? question.choices : [];
    $inputsChoice.each(function (index) {
        $(this).val(choices[index] || '');
    });
    $radiosGoodChoice.each(function (index) {
        $(this).prop('checked', !!choices[index] && choices[index] === $inputQuestionAnswer.val());
    });
    editedMedia = {
        questionMedia: question ? question.questionMedia || null : null,
        answerMedia: question ? question.answerMedia || null : null
    };
    $mediaFields.each(function () {
        $(this).find('[data-media-status]').text('');
        renderMediaField($(this));
    });
    $modalQuestion.modal('show');
}

const initEvents = function () {
    $('#button-new-party').on('click', run(async function () {
        const name = window.prompt('Nom de la nouvelle partie :');
        if (!name || !name.trim())
            return;
        const party = await callApi('POST', '', { name: name });
        currentParty = party;
        await refresh();
    }));

    $('#input-import-party').on('change', run(async function () {
        const file = this.files[0];
        this.value = '';
        if (!file)
            return;
        let data;
        try {
            data = JSON.parse(await file.text());
        } catch {
            throw new Error("Le fichier n'est pas un JSON valide");
        }
        currentParty = await callApi('POST', '/import', data);
        await refresh();
        showAlert('Partie « ' + currentParty.name + ' » importée', 'success');
    }));

    $partyList.on('click', '[data-id]', run(async function (event) {
        event.preventDefault();
        await selectParty($(this).attr('data-id'));
    }));

    $('#form-rename-party').on('submit', run(async function (event) {
        event.preventDefault();
        await callApi('PUT', '/' + currentParty.id, { name: $inputPartyName.val() });
        await refresh();
        showAlert('Partie renommée', 'success');
    }));

    $('#button-duplicate-party').on('click', run(async function () {
        currentParty = await callApi('POST', '/' + currentParty.id + '/duplicate');
        await refresh();
        showAlert('Partie dupliquée', 'success');
    }));

    $('#button-delete-party').on('click', run(async function () {
        if (!window.confirm('Supprimer la partie « ' + currentParty.name + ' » et toutes ses questions ?'))
            return;
        await callApi('DELETE', '/' + currentParty.id);
        currentParty = null;
        await refresh();
    }));

    $roundTabs.on('click', '[data-round]', function (event) {
        event.preventDefault();
        currentRound = $(this).data('round');
        renderPartyDetail();
    });

    $('#button-new-question').on('click', function () {
        openQuestionModal(null);
    });

    $questionList.on('click', '[data-action]', run(async function () {
        const id = $(this).closest('[data-id]').attr('data-id');
        const url = '/' + currentParty.id + '/questions/' + id;
        const action = $(this).data('action');
        if (action === 'edit') {
            openQuestionModal(currentParty.questions.find(function (question) { return question.id === id; }));
            return;
        }
        if (action === 'delete') {
            if (!window.confirm('Supprimer cette question ?'))
                return;
            await callApi('DELETE', url);
        } else {
            await callApi('POST', url + '/move', { direction: action === 'up' ? -1 : 1 });
        }
        await refresh();
    }));

    $('#form-question').on('submit', run(async function (event) {
        event.preventDefault();
        const question = {
            round: $inputQuestionRound.val(),
            theme: $inputQuestionTheme.val(),
            question: $inputQuestionText.val(),
            choices: $inputsChoice.map(function () { return $(this).val(); }).get(),
            answer: $inputQuestionAnswer.val(),
            questionMedia: editedMedia.questionMedia,
            answerMedia: editedMedia.answerMedia
        };
        const url = '/' + currentParty.id + '/questions';
        if (editedQuestionId)
            await callApi('PUT', url + '/' + editedQuestionId, question);
        else
            await callApi('POST', url, question);
        // On affiche la manche dans laquelle la question a été enregistrée
        currentRound = question.round;
        $modalQuestion.modal('hide');
        await refresh();
    }));

    /**
     * La bonne proposition cochée devient la réponse
     */
    const copyGoodChoiceToAnswer = function () {
        const index = $radiosGoodChoice.filter(':checked').val();
        if (index !== undefined)
            $inputQuestionAnswer.val($inputsChoice.eq(index).val());
    }
    $radiosGoodChoice.on('change', copyGoodChoiceToAnswer);
    $inputsChoice.on('input', copyGoodChoiceToAnswer);

    $modalQuestion.on('shown.bs.modal', function () {
        $inputQuestionText.trigger('focus');
    });
    // Coupe l'aperçu en cours de lecture à la fermeture
    $modalQuestion.on('hidden.bs.modal', function () {
        $mediaFields.find('audio, video').each(function () { this.pause(); });
    });

    /**
     * Sons / vidéos : envoyés dès qu'ils sont choisis, enregistrés avec la question
     */
    $mediaFields.find('[data-media-input]').on('change', async function () {
        const file = this.files[0];
        this.value = '';
        if (!file)
            return;
        const $field = $(this).closest('[data-media]');
        const $status = $field.find('[data-media-status]').text('Envoi en cours…');
        uploadsInProgress++;
        $buttonSaveQuestion.prop('disabled', true);
        // La modal a pu être rouverte sur une autre question pendant l'envoi
        const target = editedMedia;
        try {
            target[$field.data('media')] = await uploadMedia(file);
            if (target !== editedMedia)
                return;
            $status.text('');
            renderMediaField($field);
        } catch (error) {
            $status.text(error.message);
        } finally {
            uploadsInProgress--;
            $buttonSaveQuestion.prop('disabled', uploadsInProgress > 0);
        }
    });
    $mediaFields.find('[data-media-remove]').on('click', function () {
        const $field = $(this).closest('[data-media]');
        editedMedia[$field.data('media')] = null;
        renderMediaField($field);
    });
}

initEvents();

run(refresh)();
