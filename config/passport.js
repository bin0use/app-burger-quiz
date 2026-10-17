const LocalStrategy = require('passport-local').Strategy;
const User = require('../app/models/user');
const credentials = require('./credentials');

// expose this function to our app using module.exports
module.exports = function (passport) {

    // =========================================================================
    // passport session setup
    // =========================================================================
    // required for persistent login sessions
    // passport needs ability to serialize and unserialize users out of session

    // used to serialize the user for the session
    // On ne stocke que le nom d'utilisateur (jamais le mot de passe) en session
    passport.serializeUser(function (user, done) {
        done(null, user.username);
    });

    // used to deserialize the user
    passport.deserializeUser(function (username, done) {
        let user = new User();
        user.username = username;
        user.title = 'admin';
        done(null, user);
    });

    // =========================================================================
    // LOCAL SIGNUP ============================================================
    // =========================================================================
    // we are using named strategies since we have one for login and one for signup
    // by default, if there was no name, it would just be called 'local'

    passport.use(new LocalStrategy({
            passReqToCallback: true
        },
        function (req, username, password, done) {
            if (credentials.check(username, password)) {
                let user = new User();
                user.username = username;
                user.title = 'admin';
                done(null, user);
            } else {
                done(null, false, { message: 'Identifiant ou mot de passe incorrect' });
            }
        }
    ));
};
