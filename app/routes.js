const urlResolverService = require('./services/url-resolver');

/**
 * Noms d'équipes acceptés
 */
const validTeamNames = ['team-mayo', 'team-ketchup'];

module.exports = function (app, passport) {
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
  app.get("/game", function (req, res) {
    const urlToGenerate = urlResolverService.retrieveUrlForQrCodeGeneration(req);
    res.render(basePathViews + "game", {
      urlToGenerate
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
   * Déconnexion de l'admin
   */
  app.get("/logout", function (req, res) {
    req.logout();
    res.redirect('/login');
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
}