# Keycloak Identity Brokering Demo

## About the Project
This project demonstrates the implementation of identity brokering in Keycloak with Dex as an external Identity Provider (IdP). It shows:

- Configuration of Keycloak as a Service Provider (SP)
- Setup of Dex as an Identity Provider
- Implementation of a Node.js application with OpenID Connect
- Transmission of user roles and claims from Dex through Keycloak to the application

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
git clone https://github.com/yourusername/keycloak-auth
cd keycloak-auth
```

2. Start the services:
```bash
docker-compose up -d
```

3. Wait until all services are started:
```bash
docker-compose logs -f keycloak-health
```

## Keycloak Configuration

1. Open Keycloak Admin Console: http://localhost:8080
2. Log in with admin/admin
3. Navigate to "Identity Providers"
4. Add a new provider "Dex"
5. Configure:
    - Client ID: keycloak
    - Client Secret: dex-secret
    - Authorization URL: http://dex:5556/dex/auth
    - Token URL: http://dex:5556/dex/token

## Testing the Application

1. Open the Demo App: http://localhost:3000
2. Click "Login"
3. Select "Dex" as the Identity Provider
4. Use Dex mock credentials
5. Observe role assignment and user info

## Development

```bash
# Install dependencies
npm ci

# Start in development mode
npm run dev

# Run tests
npm test
```

## Project Structure

```plaintext
.
├── app.mjs                 # Main application file
├── docker-compose.yml      # Docker services configuration
├── realm.json              # Keycloak realm configuration
├── dex-config.yaml         # Dex IdP configuration
├── .env                    # Environment variables
└── package.json            # Node.js dependencies
```

## Troubleshooting

Check container logs:
```bash
docker-compose logs keycloak
docker-compose logs dex
docker-compose logs app
```

Check network connection:
```bash
docker-compose exec app curl -v http://keycloak:8080/auth/realms/example-realm
```

Check container status:
```bash
docker-compose ps
```

## Architecture Details

### Authentication Flow

1. User accesses the Demo App
2. Redirect to Keycloak
3. User selects Dex as the Identity Provider
4. Authentication at Dex
5. Dex sends token to Keycloak
6. Keycloak creates session and sends token to the app
7. App validates token and creates user session

### Security Aspects

- All communication runs over HTTPS (in production)
- Token-based authentication
- Secure session management
- CSRF protection
- XSS prevention through Helmet

## License

MIT

## Contributing

Pull requests are welcome. For major changes, please open an issue first.