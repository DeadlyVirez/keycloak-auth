import dotenv from 'dotenv';
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy } from 'passport-openidconnect';
import helmet from 'helmet';

dotenv.config();

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

const app = express();
const PORT = process.env.PORT || 3000;

// Sicherheits-Headers
app.use(helmet());

// Session-Konfiguration mit besserer Sicherheit
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 Stunden
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// OIDC Konfiguration mit Fehlerbehandlung
async function configureOIDC() {
  try {
    const { Issuer, generators } = await import('openid-client');
    
    console.log('Prüfe Umgebungsvariablen...');
    if (!process.env.KEYCLOAK_BASE_URL || !process.env.KEYCLOAK_REALM) {
      throw new Error('Keycloak Konfiguration fehlt in .env');
    }

    const issuerUrl = `${process.env.KEYCLOAK_BASE_URL}/auth/realms/${process.env.KEYCLOAK_REALM}`;
    console.log('Versuche Keycloak Issuer zu entdecken:', issuerUrl);
    
    const keycloakIssuer = await Issuer.discover(issuerUrl);
    console.log('Keycloak Issuer gefunden:', keycloakIssuer.metadata.issuer);
    
    passport.use('keycloak',
      new Strategy(
        {
          issuer: keycloakIssuer.metadata.issuer,
          authorizationURL: keycloakIssuer.metadata.authorization_endpoint,
          tokenURL: keycloakIssuer.metadata.token_endpoint,
          userInfoURL: keycloakIssuer.metadata.userinfo_endpoint,
          clientID: process.env.KEYCLOAK_CLIENT_ID,
          clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
          callbackURL: process.env.CALLBACK_URL,
          scope: 'openid profile email',
          // Zusätzliche Debug-Optionen
          passReqToCallback: true,
          proxy: true
        },
        (req, issuer, sub, profile, jwtClaims, accessToken, refreshToken, done) => {
          console.log('Auth Callback erreicht mit Profil:', profile);
          profile.accessToken = accessToken;
          profile.refreshToken = refreshToken;
          profile.jwtClaims = jwtClaims;
          return done(null, profile);
        }
      )
    );

    return { client: keycloakIssuer.Client };
  } catch (error) {
    console.error('OIDC Konfigurationsfehler:', error);
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Body:', await error.response.text());
    }
    throw error;
  }
}

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// Public Route
app.get('/', (req, res) => {
  res.send(`
    <h1>Welcome to the Example App</h1>
    <p><a href="/login">Login</a></p>
  `);
});

// Authentication Routes mit Fehlerbehandlung
app.get('/login', (req, res, next) => {
  passport.authenticate('keycloak')(req, res, next);
});

// Debug Route für OAuth Callback
app.get('/auth/callback', 
  (req, res, next) => {
    console.log('Auth Callback erreicht mit Query:', req.query);
    passport.authenticate('keycloak', { 
      failureRedirect: '/',
      failureMessage: true,
      // Debug Optionen
      session: true,
      failWithError: true
    })(req, res, next);
  },
  (req, res) => {
    console.log('Auth erfolgreich, User:', req.user);
    res.redirect('/protected');
  },
  (error, req, res, next) => {
    console.error('Auth Fehler:', error);
    res.redirect('/');
  }
);

// Logout Route mit Fehlerbehandlung
app.get('/logout', (req, res) => {
  try {
    req.logout(() => {
      req.session.destroy((err) => {
        if (err) {
          console.error('Session Zerstörungsfehler:', err);
        }
        res.redirect('/');
      });
    });
  } catch (error) {
    console.error('Logout Fehler:', error);
    res.redirect('/');
  }
});

// Protected Route mit Fehlerbehandlung
app.get('/protected', ensureAuthenticated, async (req, res) => {
  try {
    const user = req.user;
    const roles = await getUserRoles(user.jwtClaims.sub);
    
    res.send(`
      <h1>Protected Resource</h1>
      <p>Welcome, ${user.displayName}</p>
      <p>Your email: ${user.email}</p>
      <p>Your roles: ${JSON.stringify(roles)}</p>
      <p><a href="/logout">Logout</a></p>
    `);
  } catch (error) {
    console.error('Protected Route Fehler:', error);
    res.status(500).send('Internal Server Error');
  }
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
}

// Keycloak Admin Client mit Fehlerbehandlung
async function getUserRoles(userId) {
  try {
    const { default: KeycloakAdminClient } = await import('@keycloak/keycloak-admin-client');
    
    const adminClient = new KeycloakAdminClient({
      baseUrl: process.env.KEYCLOAK_BASE_URL,
      realmName: process.env.KEYCLOAK_REALM
    });

    await adminClient.auth({
      grantType: 'client_credentials',
      clientId: process.env.KEYCLOAK_CLIENT_ID,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET
    });

    const roles = await adminClient.users.listRealmRoleMappings({
      id: userId
    });

    return roles.map(role => role.name);
  } catch (error) {
    console.error('Keycloak Admin API Fehler:', error);
    return [];
  }
}

// Temporäre Debug-Funktion
async function testKeycloakConnection() {
  try {
    const response = await fetch(
      `${process.env.KEYCLOAK_BASE_URL}/auth/realms/${process.env.KEYCLOAK_REALM}/.well-known/openid-configuration`
    );
    
    // Verbesserte Fehlerbehandlung
    if (!response.ok) {
      console.error('HTTP Status:', response.status);
      const text = await response.text();
      console.error('Response Body:', text);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Keycloak OpenID Configuration:', data);
  } catch (error) {
    console.error('Keycloak Verbindungsfehler:', error);
    throw error;  // Weitergabe des Fehlers
  }
}

// Server Start mit Fehlerbehandlung
async function startServer() {
  try {
    console.log('Warte 5 Sekunden auf Keycloak-Start...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    await testKeycloakConnection();
    await configureOIDC();
    
    const server = app.listen(PORT, () => {
      console.log(`Server läuft auf http://localhost:${PORT}`);
    });

    // Graceful Shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM Signal empfangen. Server wird beendet...');
      server.close(() => {
        console.log('Server wurde beendet');
        process.exit(0);
      });
    });
    
  } catch (error) {
    console.error('Server Startfehler:', error);
    process.exit(1);
  }
}

startServer();
