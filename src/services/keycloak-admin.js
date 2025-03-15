export async function getUserRoles(userId, username, email) {
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