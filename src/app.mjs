import dotenv from 'dotenv';
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy } from 'passport-openidconnect';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';

dotenv.config();

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

const app = express();
const PORT = process.env.PORT || 3000;

// Security-Headers
app.use(helmet());

// Session-Configuration with better security
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

// OIDC Configuration with better error handling
async function configureOIDC() {
  try {
    const { Issuer, generators } = await import('openid-client');
    
    console.log('Check environment variables...');
    if (!process.env.KEYCLOAK_BASE_URL || !process.env.KEYCLOAK_REALM) {
      throw new Error('Keycloak Configuration missing in .env');
    }

    const issuerUrl = `${process.env.KEYCLOAK_BASE_URL}/auth/realms/${process.env.KEYCLOAK_REALM}`;
    console.log('Try to discover Keycloak Issuer:', issuerUrl);
    
    const keycloakIssuer = await Issuer.discover(issuerUrl);
    console.log('Keycloak Issuer found:', keycloakIssuer.metadata.issuer);
    
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
          passReqToCallback: true,
          proxy: true,
          skipUserProfile: true,
          scope: ['openid', 'profile', 'email'],
          pkce: false,
          state: true,
          verify: true
        },
        (req, issuer, sub, profile, jwtClaims, accessToken, refreshToken, done) => {
          console.log('Auth Callback got with profile:', profile);
          try {
            const decodedClaims = jwt.decode(jwtClaims);
            profile.jwtClaims = decodedClaims;
          } catch (err) {
            console.error('Fehler beim Decodieren der JWT Claims:', err);
            profile.jwtClaims = {};
          }
          profile.accessToken = accessToken;
          profile.refreshToken = refreshToken;
          return done(null, profile);
        }
      )
    );

    return { client: keycloakIssuer.Client };
  } catch (error) {
    console.error('OIDC Configurationerror:', error);
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

// Authentication Routes with better error handling
app.get('/login', (req, res, next) => {
  passport.authenticate('keycloak')(req, res, next);
});

// Debug Route for OAuth Callback
app.get('/auth/callback', 
  (req, res, next) => {
    console.log('Auth Callback got with Query:', req.query);
    passport.authenticate('keycloak', { 
      failureRedirect: '/',
      failureMessage: true,
      // Debug Options
      session: true,
      failWithError: true
    })(req, res, next);
  },
  (req, res) => {
    console.log('Auth successful, User:', req.user);
    res.redirect('/protected');
  },
  (error, req, res, next) => {
    console.error('Auth Fehler:', error);
    res.redirect('/');
  }
);

// Logout Route with better error handling
app.get('/logout', (req, res, next) => {
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

// Protected Route with better error handling
app.get('/protected', ensureAuthenticated, async (req, res) => {
  try {
    const user = req.user;
    // Hier wird angenommen, dass jwtClaims die Werte "sub" und "preferred_username" enthält.
    const roles = await getUserRoles(user.jwtClaims.sub, user.jwtClaims.preferred_username, user.jwtClaims.email);
    
    res.send(`
      <h1>Protected Resource</h1>
      <p>Welcome, ${user.displayName || user.jwtClaims.name}</p>
      <p>Your email: ${user.email || user.jwtClaims.email}</p>
      <p>Your roles: ${JSON.stringify(roles)}</p>
      <p><a href="/logout">Logout</a></p>
    `);
  } catch (error) {
    console.error('Protected Route Error:', error);
    res.status(500).send('Internal Server Error');
  }
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  const host = req.headers['host'] || 'localhost:3000';
  res.redirect(`http://${host}/login`);
}

// Keycloak Admin Client with better error handling
async function getUserRoles(userId, username, email) {
  try {
    const { default: KeycloakAdminClient } = await import('@keycloak/keycloak-admin-client');

    const adminClient = new KeycloakAdminClient({
      baseUrl: `${process.env.KEYCLOAK_BASE_URL}/auth`, // Verwaltung endpunkt
      realmName: process.env.KEYCLOAK_REALM
    });

    await adminClient.auth({
      grantType: 'client_credentials',
      clientId: process.env.KEYCLOAK_CLIENT_ID,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET
    });

    // Zuerst per ID suchen
    let user = await adminClient.users.findOne({ id: userId });
    if (!user) {
      console.warn(`User nicht gefunden mit ID: ${userId}. Versuch per Username...`);
      if (username) {
        const usersFound = await adminClient.users.find({ username });
        if (usersFound.length > 0) {
          user = usersFound[0];
        }
      }
    }

    // Falls noch immer nicht gefunden, per E-Mail suchen
    if (!user && email) {
      console.warn(`User nicht gefunden per ID und Username, versuche per Email: ${email}`);
      const usersFound = await adminClient.users.find({ email });
      if (usersFound.length > 0) {
        user = usersFound[0];
      }
    }

    if (!user) {
      console.error(`User nicht gefunden weder mit ID: ${userId}, Username: ${username} noch Email: ${email}`);
      return [];
    }

    const roles = await adminClient.users.listRealmRoleMappings({ id: user.id });
    return roles.map(role => role.name);
  } catch (error) {
    console.error('Keycloak Admin API Error:', error);
    return [];
  }
}

// Temporary debugging function
async function testKeycloakConnection() {
  try {
    const response = await fetch(
      `${process.env.KEYCLOAK_BASE_URL}/auth/realms/${process.env.KEYCLOAK_REALM}/.well-known/openid-configuration`
    );
    
    // Improved error handling
    if (!response.ok) {
      console.error('HTTP Status:', response.status);
      const text = await response.text();
      console.error('Response Body:', text);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Keycloak OpenID Configuration:', data);
  } catch (error) {
    console.error('Keycloak Connection error:', error);
    throw error;  // Give back to caller
  }
}

// Server start with better error handling
async function startServer() {
  try {
    console.log('Wait 3 seconds for Keycloak start...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await testKeycloakConnection();
    await configureOIDC();
    
    const server = app.listen(PORT, () => {
      console.log(`Server runs at http://localhost:${PORT}`);
    });

    // Graceful Shutdown
    process.on('SIGTERM', () => {
      console.log('Got SIGTERM signal. Server will be shut down...');
      server.close(() => {
        console.log('Server was shut down. Good bye!');
        process.exit(0);
      });
    });
    
  } catch (error) {
    console.error('Server Startfehler:', error);
    process.exit(1);
  }
}

startServer();
