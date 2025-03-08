# Info about the Keycloak realm.json

The `realm.json` file is used by Keycloak at startup of the container to automatically import an example realm, that configures our IdP (Dex) and a client

## Additional tasks required after starting Keycloak

1. Log into the Keycloak-Console (http://localhost:8080/auth/admin/master/console/#/example-realm).
2. Go to the example-app client.
3. Go to the tab `Service accounts roles`.
4. Click `Assign role` and select the following roles:
    - realm-management - manage-users
    - realm-management - view-users
    - realm-management - query-users