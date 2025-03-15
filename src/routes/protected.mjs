import express from 'express';
import { getUserRoles } from '../services/keycloak-admin.js';
import { ensureAuthenticated } from '../middleware/auth.js';

const router = express.Router();

router.get('/protected', ensureAuthenticated, async (req, res) => {
  try {
    const user = req.user;
    // Assumes jwtClaims includes "sub", "preferred_username", and "email"
    const roles = await getUserRoles(
      user.jwtClaims.sub,
      user.jwtClaims.preferred_username,
      user.jwtClaims.email
    );
    
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

export default router;