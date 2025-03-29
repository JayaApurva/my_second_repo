# Topcoder Resources API

## Dependencies

- NodeJS (v12+)
- PostgreSQL (v16.3)

## Configuration

Configuration for the application is at `config/default.js`.
The following parameters can be set in config files or in env variables:

- LOG_LEVEL: the log level; default: 'debug'
- PORT: the server port; default: 3000
- API_VERSION: the API version; default: v5
- AUTH_SECRET: Auth0 secret; default: 'mysecret'
- DATABASE_URL: PostgreSQL connection string in format: `postgresql://username:password@host:port/database`
- AUTH_DOMAIN: Auth0 domain; default: 'topcoder-dev.auth0.com'
- AUTH0_CLIENT_ID: Auth0 client id
- AUTH0_CLIENT_SECRET: Auth0 client secret
- AUTH0_AUDIENCE: Auth0 audience
- TOKEN_CACHE_TIME: Auth0 token cache time

## Local Postgres Setup

Install PostgreSQL v16.3:

```bash
# On Ubuntu
sudo apt update
sudo apt install postgresql-16

# On macOS with Homebrew
brew install postgresql@16
```

Create a database and user:

```bash
sudo -u postgres psql

postgres=# CREATE USER topcoder WITH PASSWORD 'password';
postgres=# CREATE DATABASE resources WITH OWNER topcoder;
postgres=# \q
```

Update your `.env` file with the PostgreSQL connection string:

```
DATABASE_URL=postgresql://topcoder:password@localhost:5432/resources
```

## Local Deployment

1. Install dependencies:

```bash
npm install
```

2. Run database migrations with Prisma:

```bash
npx prisma migrate deploy
```

3. Seed the database with test data:

```bash
npm run seed
```

4. Start the application:

```bash
npm start
```

## API Documentation

Swagger API documentation is available at http://localhost:3000/api-docs

## Running Tests

To run the tests:

```bash
npm run test
```

## Verification

You can verify the API functionality using the provided Postman collection in the `docs` folder.

To verify:

1. Import the Postman collection from `docs/postman_collection.json`
2. Update the environment variables in Postman:
   - `BASE_URL`: The base URL of the API (e.g., `http://localhost:3000/v5`)
   - `TOKEN`: A valid JWT token (if authentication is enabled)
3. Run the requests to verify functionality

## Data Migration

The application includes a data migration script that fetches data from the existing Topcoder Dev API and seeds it into the local database:

```bash
npm run seed
```

This will:
1. Fetch resource roles from the Topcoder Dev API
2. Fetch resource phases from the Topcoder Dev API
3. Fetch resources from the Topcoder Dev API
4. Seed all this data into your local database

## Architecture Overview

The Resources API has been updated to use PostgreSQL with Prisma ORM as the sole persistence layer, removing dependencies on Informix, DynamoDB, and ElasticSearch.

### Components:

- **Prisma ORM**: Provides type