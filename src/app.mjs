import dotenv from 'dotenv';
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import helmet from 'helmet';
import { configureOIDC } from './config/keycloak-config.mjs';

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
      console.warn(`User not found with ID: ${userId}. Trying by username...`);
      if (username) {
        const usersFound = await adminClient.users.find({ username });
        if (usersFound.length > 0) {
          user = usersFound[0];
        }
      }
    }

    // Falls noch immer nicht gefunden, per E-Mail suchen
    if (!user && email) {
      console.warn(`User not found by ID or username, trying by email: ${email}`);
      const usersFound = await adminClient.users.find({ email });
      if (usersFound.length > 0) {
        user = usersFound[0];
      }
    }

    if (!user) {
      console.error(`User not found with ID: ${userId}, username: ${username} or email: ${email}`);
      return [];
    }

    const roles = await adminClient.users.listRealmRoleMappings({ id: user.id });
    return roles.map(role => role.name);
  } catch (error) {
    console.error('Keycloak Admin API error:', error);
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

// Server start with graceful error handling
async function startServer() {
  try {
    console.log('Waiting 3 seconds for Keycloak to start...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const maxRetries = 3;
    let attempt = 0;
    let keycloakConnected = false;

    while (attempt < maxRetries && !keycloakConnected) {
      try {
        await testKeycloakConnection();
        keycloakConnected = true;
      } catch (error) {
        attempt++;
        console.error(`Keycloak connection attempt ${attempt} of ${maxRetries} failed:`, error);
        if (attempt < maxRetries) {
          console.log('Retrying in 3000ms ...');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }

    if (!keycloakConnected) {
      console.warn('Proceeding without a successful Keycloak connection. Some functionalities may be limited.');
    }

    await configureOIDC();

    const server = app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });

    // Graceful Shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received. Server shutting down...');
      server.close(() => {
        console.log('Server has shut down. Goodbye!');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('Server start error:', error);
  }
}

startServer();
