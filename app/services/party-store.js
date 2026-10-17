const crypto = require('crypto');
const { createStateStore } = require('./state-store');
const { rounds, isValidRound } = require('../models/rounds');

/**
 * Limites de saisie
 */
const limits = {
    name: 100,
    theme: 100,
    question: 500,
    answer: 500,
    choice: 200,
    choices: 4
};

/**
 * Erreur de saisie (renvoyée en 400 par l'API)
 */
class ValidationError extends Error { }

/**
 * Nettoie un champ texte et vérifie sa longueur
 * @param {*} value La valeur saisie
 * @param {*} label Le nom du champ (pour le message d'erreur)
 * @param {*} max La longueur maximum
 * @param {*} required Indique si le champ est obligatoire
 */
const cleanText = function (value, label, max, required) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (required && !text)
        throw new ValidationError(`Le champ « ${label} » est obligatoire`);
    if (text.length > max)
        throw new ValidationError(`Le champ « ${label} » ne doit pas dépasser ${max} caractères`);
    return text;
}

const cleanName = function (name) {
    return cleanText(name, 'Nom', limits.name, true);
}

/**
 * Propositions de réponse (Nuggets) : les propositions vides sont ignorées
 */
const cleanChoices = function (choices) {
    if (choices === undefined || choices === null)
        return [];
    if (!Array.isArray(choices))
        throw new ValidationError('Propositions invalides');
    const cleaned = choices
        .map(function (choice) { return cleanText(choice, 'Proposition', limits.choice, false); })
        .filter(Boolean);
    if (cleaned.length > limits.choices)
        throw new ValidationError(`${limits.choices} propositions maximum`);
    return cleaned;
}

/**
 * Valide les champs d'une question (sans l'identifiant)
 */
const cleanQuestion = function (data) {
    data = data || {};
    if (!isValidRound(data.round))
        throw new ValidationError('Manche inconnue');
    return {
        round: data.round,
        theme: cleanText(data.theme, 'Thème', limits.theme, false),
        question: cleanText(data.question, 'Question', limits.question, true),
        choices: cleanChoices(data.choices),
        answer: cleanText(data.answer, 'Réponse', limits.answer, false)
    };
}

/**
 * Se charge de stocker les parties (et leurs questions) dans un fichier JSON
 * @param {*} filePath Le chemin du fichier (si absent, les parties restent en mémoire)
 */
const createPartyStore = function (filePath) {
    const file = createStateStore(filePath);
    const saved = file.load();
    const parties = saved && Array.isArray(saved.parties) ? saved.parties : [];
    const listeners = [];

    const now = function () {
        return new Date().toISOString();
    }

    /**
     * Sauvegarde puis prévient les abonnés
     */
    const commit = function (party) {
        if (party)
            party.updatedAt = now();
        file.save({ parties: parties });
        listeners.forEach(function (listener) { listener(); });
    }

    const find = function (id) {
        return parties.find(function (party) { return party.id === id; }) || null;
    }

    const findQuestion = function (party, questionId) {
        return party
            ? party.questions.find(function (question) { return question.id === questionId; }) || null
            : null;
    }

    /**
     * Résumé d'une partie (nombre de questions par manche)
     */
    const summary = function (party) {
        const counts = {};
        rounds.forEach(function (round) { counts[round.key] = 0; });
        party.questions.forEach(function (question) { counts[question.round]++; });
        return {
            id: party.id,
            name: party.name,
            createdAt: party.createdAt,
            updatedAt: party.updatedAt,
            questionsCount: party.questions.length,
            counts: counts
        };
    }

    /**
     * Copie profonde (on ne laisse jamais sortir les objets internes)
     */
    const copy = function (value) {
        return value ? structuredClone(value) : null;
    }

    const newParty = function (name, questions) {
        const date = now();
        const party = {
            id: crypto.randomUUID(),
            name: cleanName(name),
            createdAt: date,
            updatedAt: date,
            questions: (questions || []).map(function (question) {
                return Object.assign({ id: crypto.randomUUID() }, cleanQuestion(question));
            })
        };
        parties.push(party);
        commit();
        return copy(party);
    }

    return {
        list: function () {
            return parties.map(summary);
        },
        get: function (id) {
            return copy(find(id));
        },
        /**
         * Questions d'une manche, dans l'ordre
         */
        questionsOfRound: function (id, roundKey) {
            const party = find(id);
            if (!party)
                return [];
            return copy(party.questions.filter(function (question) {
                return question.round === roundKey;
            }));
        },
        create: function (name) {
            return newParty(name, []);
        },
        /**
         * Importe une partie exportée ({ name, questions })
         */
        importParty: function (data) {
            if (!data || typeof data !== 'object' || !Array.isArray(data.questions))
                throw new ValidationError('Fichier de partie invalide');
            return newParty(data.name, data.questions);
        },
        rename: function (id, name) {
            const party = find(id);
            if (!party)
                return null;
            party.name = cleanName(name);
            commit(party);
            return copy(party);
        },
        duplicate: function (id) {
            const party = find(id);
            if (!party)
                return null;
            const name = (party.name + ' (copie)').slice(0, limits.name);
            return newParty(name, party.questions);
        },
        remove: function (id) {
            const index = parties.findIndex(function (party) { return party.id === id; });
            if (index === -1)
                return false;
            parties.splice(index, 1);
            commit();
            return true;
        },
        addQuestion: function (id, data) {
            const party = find(id);
            if (!party)
                return null;
            const question = Object.assign({ id: crypto.randomUUID() }, cleanQuestion(data));
            party.questions.push(question);
            commit(party);
            return copy(question);
        },
        updateQuestion: function (id, questionId, data) {
            const party = find(id);
            const question = findQuestion(party, questionId);
            if (!question)
                return null;
            const cleaned = cleanQuestion(data);
            // Changement de manche : la question passe à la fin de sa nouvelle manche
            if (cleaned.round !== question.round) {
                party.questions.splice(party.questions.indexOf(question), 1);
                party.questions.push(question);
            }
            Object.assign(question, cleaned);
            commit(party);
            return copy(question);
        },
        removeQuestion: function (id, questionId) {
            const party = find(id);
            const question = findQuestion(party, questionId);
            if (!question)
                return false;
            party.questions.splice(party.questions.indexOf(question), 1);
            commit(party);
            return true;
        },
        /**
         * Monte (-1) ou descend (+1) une question au sein de sa manche
         */
        moveQuestion: function (id, questionId, direction) {
            const party = find(id);
            const question = findQuestion(party, questionId);
            if (!question)
                return null;
            if (direction !== -1 && direction !== 1)
                throw new ValidationError('Direction invalide');
            const sameRound = party.questions.filter(function (other) {
                return other.round === question.round;
            });
            const neighbour = sameRound[sameRound.indexOf(question) + direction];
            if (neighbour) {
                const from = party.questions.indexOf(question);
                const to = party.questions.indexOf(neighbour);
                party.questions[from] = neighbour;
                party.questions[to] = question;
                commit(party);
            }
            return copy(party);
        },
        /**
         * Abonnement aux modifications des parties
         */
        onChange: function (listener) {
            listeners.push(listener);
        }
    };
}

module.exports = { createPartyStore, ValidationError, limits };
