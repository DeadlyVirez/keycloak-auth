import express from 'express';
import passport from 'passport';

const router = express.Router();

// Authentication Route (login)
router.get('/login', (req, res, next) => {
  passport.authenticate('keycloak')(req, res, next);
});

// OAuth Callback Route with enhanced error handling
router.get(
  '/auth/callback',
  (req, res, next) => {
    console.log('Auth Callback got with Query:', req.query);
    passport.authenticate('keycloak', {
      failureRedirect: '/',
      failureMessage: true,
      session: true,
      failWithError: true
    })(req, res, next);
  },
  (req, res) => {
    console.log('Auth successful, User:', req.user);
    res.redirect('/protected');
  },
  (error, req, res, next) => {
    console.error('Auth error:', error);
    res.redirect('/');
  }
);

// Logout Route with enhanced error handling
router.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) {
      console.error('Logout Error:', err);
      return next(err);
    }
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destroy error:', err);
        return next(err);
      }
      res.clearCookie('connect.sid');
      res.redirect('/');
    });
  });
});

export default router;