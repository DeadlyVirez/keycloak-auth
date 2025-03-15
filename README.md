# Keycloak Identity Brokering Demo

## About the Project
This project demonstrates the implementation of identity brokering in Keycloak with Dex as an external Identity Provider (IdP). It shows:

- Configuration of Keycloak as a Service Provider (SP)
- Setup of Dex as an Identity Provider
- Implementation of a Node.js application with OpenID Connect
- Transmission of user roles and claims from Dex through Keycloak to the application

## To-Do

- [x] Implement working Keycloak + realm configuration
- [x] Implement example app to test login flow
- [x] Implement hashing script for Dex passwords
- [x] Create working Dex instance + config
- [x] Use version-pinning
- [ ] Implement role mapping from Dex JWT token
- [x] Fix wrong callback/auth URL (possibly related to Docker deployment)
- [x] Check user creation and registration process
- [ ] Check if role mapping works correctly
- [ ] Check if users get created as duplicates
- [x] FIX: InternalOAuthError: Failed to obtain access token
- [x] Switch to 'host' networking to avoid docker errors (switch to localhost everywhere instead of container names)

## Architecture

```plaintext
+-------------+     +-----------+     +---------+
|  Demo App   | --> | Keycloak  | --> |   Dex   |
| (Node.js)   |     | (IdP/SP)  |     |  (IdP)  |
+-------------+     +-----------+     +---------+
```

## Prerequisites

- Docker and Docker Compose
- Node.js 18+
- Git

## Installation

1. Clone the repository:
```bash
git clone https://github.com/deadlyvirez/keycloak-auth
cd keycloak-auth
```

2. Start the services:
```bash
docker-compose up --build
```

3. Go to `docker/keycloak/README.md` and follow the steps there

## Testing the Application

1. Open the Demo App: http://localhost:3000
2. Click "Login"
3. Select "Dex" as the Identity Provider
4. Use Dex mock credentials: "test@example.com"
5. Observe role assignment and user info

## Architecture Details

### Authentication Flow

1. User accesses the Demo App
2. Redirect to Keycloak
3. User selects Dex as the Identity Provider
4. Authentication at Dex
5. Dex sends token to Keycloak
6. Keycloak creates session and sends token to the app
7. App validates token and creates user session

## License

MIT

## Contributing

Pull requests are welcome. For major changes, please open an issue first.
