import dotenv from 'dotenv';
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import helmet from 'helmet';
import { configureOIDC } from './config/keycloak-config.mjs';
import authRoutes from './routes/auth.mjs';
import protectedRoutes from './routes/protected.mjs';

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

// Register extracted routes
app.use(authRoutes);
app.use(protectedRoutes);

// Keycloak Admin Client with better error handling
async function getUserRoles(userId, username, email) {
  try {
    const { default: KeycloakAdminClient } = await import('@keycloak/keycloak-admin-client');

    const adminClient = new KeycloakAdminClient({
      baseUrl: `${process.env.KEYCLOAK_BASE_URL}/auth`,
      realmName: process.env.KEYCLOAK_REALM
    });

    await adminClient.auth({
      grantType: 'client_credentials',
      clientId: process.env.KEYCLOAK_CLIENT_ID,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET
    });

    // Try to find user by ID first
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

    // If still not found, try by email
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

// Debugging function
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
