const QRCode = require('qrcode');
const urlResolverService = require('./services/url-resolver');
const { validTeamNames } = require('./game');
const { rounds } = require('./models/rounds');
const express = require('express');
const { ValidationError, limits, mediaFields } = require('./services/party-store');
const { isAcceptedType } = require('./services/media-store');

module.exports = function (app, passport, partyStore, mediaStore) {
  /**
   * Le chemin de base où se trouve les views
   */
  const basePathViews = app.get('views');

  /**
   * Route par défaut choix des équipes
   */
  app.get("/", function (req, res) {
    res.render(basePathViews + "team-choice");
  });

  /**
   * Choix des équipes
   */
  app.get("/buzzer", function (req, res) {
    let team = req.query.team;
    // Si aucune team valide n'a été déterminée on renvoie sur la page
    if (validTeamNames.indexOf(team) === -1) {
      res.redirect("/");
      return;
    }
    res.render(basePathViews + "buzzer", {
      team: team
    });
  });

  /**
   * Ecran de jeu
   */
  app.get("/game", async function (req, res) {
    const urlToGenerate = urlResolverService.retrieveUrlForQrCodeGeneration(req);
    // Le QR code est généré côté serveur sous forme d'image
    const qrCodeDataUrl = urlToGenerate
      ? await QRCode.toDataURL(urlToGenerate, { width: 250, margin: 2 })
      : '';
    res.render(basePathViews + "game", {
      urlToGenerate,
      qrCodeDataUrl
    });
  });

  /** Securité */

  /**
   * Formulaire de login
   */
  app.get("/login", function (req, res) {
    res.render(basePathViews + "login", {
      errors: req.flash('error')
    });
  });

  // Permet d'authentifier l'admin
  app.post('/login',
    passport.authenticate('local', {
      successRedirect: '/admin',
      failureRedirect: '/login',
      failureFlash: true
    })
  );

  /**
   * Télécommande admin pour animer le jeu
   */
  app.get("/admin", isLoggedIn, function (req, res) {
    res.render(basePathViews + "admin");
  });

  /**
   * Gestion des parties et des questions
   */
  app.get("/admin/parties", isLoggedIn, function (req, res) {
    res.render(basePathViews + "admin-parties", {
      rounds: rounds,
      limits: limits
    });
  });

  /** API de gestion des parties (JSON, réservée à l'admin) */

  const api = '/admin/api/parties';

  app.get(api, isApiLoggedIn, function (req, res) {
    res.json(partyStore.list());
  });

  app.post(api, isApiLoggedIn, requireJson, handle(function (req) {
    return [201, partyStore.create(req.body.name)];
  }));

  app.post(api + '/import', isApiLoggedIn, requireJson, handle(function (req) {
    return [201, partyStore.importParty(req.body)];
  }));

  app.get(api + '/:id', isApiLoggedIn, handle(function (req) {
    return [200, partyStore.get(req.params.id)];
  }));

  /**
   * Export d'une partie (sans identifiants) pour la réimporter plus tard
   */
  app.get(api + '/:id/export', isApiLoggedIn, function (req, res) {
    const party = partyStore.get(req.params.id);
    if (!party)
      return res.status(404).json({ error: 'Partie introuvable' });
    const filename = party.name.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'partie';
    res.attachment('burger-quiz-' + filename + '.json');
    res.send(JSON.stringify({
      name: party.name,
      questions: party.questions.map(function (question) {
        const exported = {
          round: question.round,
          theme: question.theme,
          question: question.question,
          choices: question.choices,
          answer: question.answer,
          points: question.points || 1,
          note: question.note || ''
        };
        // Seule la référence est exportée : le fichier reste sur ce serveur
        mediaFields.forEach(function (field) {
          if (question[field])
            exported[field] = question[field];
        });
        return exported;
      })
    }, null, 2));
  });

  app.put(api + '/:id', isApiLoggedIn, requireJson, handle(function (req) {
    return [200, partyStore.rename(req.params.id, req.body.name)];
  }));

  app.delete(api + '/:id', isApiLoggedIn, handle(function (req) {
    return [204, partyStore.remove(req.params.id)];
  }));

  app.post(api + '/:id/duplicate', isApiLoggedIn, requireJson, handle(function (req) {
    return [201, partyStore.duplicate(req.params.id)];
  }));

  app.post(api + '/:id/questions', isApiLoggedIn, requireJson, handle(function (req) {
    return [201, partyStore.addQuestion(req.params.id, req.body)];
  }));

  /**
   * Copie ou déplace des questions vers une autre partie : { questionIds, targetId, mode: 'copy' | 'move' }
   */
  app.post(api + '/:id/questions/transfer', isApiLoggedIn, requireJson, handle(function (req) {
    return [200, partyStore.transferQuestions(req.params.id, req.body.questionIds, req.body.targetId, req.body.mode)];
  }));

  app.put(api + '/:id/questions/:questionId',isApiLoggedIn, requireJson, handle(function (req) {
    return [200, partyStore.updateQuestion(req.params.id, req.params.questionId, req.body)];
  }));

  app.delete(api + '/:id/questions/:questionId', isApiLoggedIn, handle(function (req) {
    return [204, partyStore.removeQuestion(req.params.id, req.params.questionId)];
  }));

  app.post(api + '/:id/questions/:questionId/move', isApiLoggedIn, requireJson, handle(function (req) {
    return [200, partyStore.moveQuestion(req.params.id, req.params.questionId, req.body.direction)];
  }));

  /**
   * Envoi d'un son ou d'une vidéo (contenu brut du fichier)
   * Le type audio / vidéo ne peut pas être envoyé par un formulaire d'un autre site
   */
  app.post('/admin/api/media', isApiLoggedIn,
    express.raw({ type: function (req) { return isAcceptedType(req.get('Content-Type')); }, limit: limits.mediaSize }),
    function (req, res) {
      const media = Buffer.isBuffer(req.body) ? mediaStore.save(req.body, req.get('Content-Type')) : null;
      if (!media)
        return res.status(415).json({ error: 'Format non pris en charge (mp3, wav, ogg, m4a, mp4, webm…)' });
      let name = '';
      try {
        name = decodeURIComponent(req.get('X-File-Name') || '');
      } catch {
        // Nom illisible : le média reste utilisable sans nom
      }
      media.name = name.slice(0, limits.mediaName);
      res.status(201).json(media);
    });

  /**
   * Déconnexion de l'admin
   */
  app.get("/logout", function (req, res, next) {
    req.logout(function (error) {
      if (error)
        return next(error);
      res.redirect('/login');
    });
  });

  /**
   * Permet de rediriger sur la home
   * Si route introuvable
   * Attention a bien placer cette route en tout dernier !
   */
  app.use(function (req, res) {
    res.redirect('/');
  });

  /**
   * Middleware permettant de savoir si l'utilisateur est loggué
   * Uniquement pour la partie admin
   * @param {*} req 
   * @param {*} res 
   * @param {*} next 
   */
  function isLoggedIn(req, res, next) {
    // Si l'utilisateur est authentifié on passe à la requête suivante
    if (req.isAuthenticated())
      return next();
    // Si c'est pas le cas on le redirige vers la page d'authentification
    res.redirect('/login');
  }

  /**
   * Même chose pour l'API : on répond en 401 au lieu de rediriger
   */
  function isApiLoggedIn(req, res, next) {
    if (req.isAuthenticated())
      return next();
    res.status(401).json({ error: 'Authentification requise' });
  }

  /**
   * Les requêtes de modification de l'API doivent être en JSON
   * (un formulaire d'un autre site ne peut pas en envoyer)
   */
  function requireJson(req, res, next) {
    if (req.is('application/json') && req.body && typeof req.body === 'object')
      return next();
    res.status(415).json({ error: 'Le corps de la requête doit être en JSON' });
  }

  /**
   * Exécute une action de l'API : [statut, résultat]
   * Un résultat vide (null / false) signifie que l'élément est introuvable
   */
  function handle(action) {
    return function (req, res) {
      try {
        const [status, result] = action(req);
        if (!result)
          return res.status(404).json({ error: 'Partie ou question introuvable' });
        if (status === 204)
          return res.status(204).end();
        res.status(status).json(result);
      } catch (error) {
        if (!(error instanceof ValidationError))
          throw error;
        res.status(400).json({ error: error.message });
      }
    };
  }
}