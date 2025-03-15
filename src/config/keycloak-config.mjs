import { Strategy } from 'passport-openidconnect';
import passport from 'passport';
import jwt from 'jsonwebtoken';

export async function configureOIDC() {
  try {
    const { Issuer } = await import('openid-client');
    
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
          console.log('Auth Callback received with profile:', profile);
          try {
            const decodedClaims = jwt.decode(jwtClaims);
            profile.jwtClaims = decodedClaims;
          } catch (err) {
            console.error('Error decoding JWT claims:', err);
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
    console.error('OIDC Configuration error:', error);
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Body:', await error.response.text());
    }
    throw error;
  }
}