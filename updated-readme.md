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

# Start PostgreSQL
sudo service postgresql start    # Ubuntu
brew services start postgresql@16 # macOS
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

1. Clone the repository:

```bash
git clone https://github.com/topcoder-platform/resources-api.git
cd resources-api
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root directory with your database configuration:

```
DATABASE_URL=postgresql://topcoder:password@localhost:5432/resources
```

4. Run database migrations with Prisma:

```bash
npx prisma migrate deploy
```

5. Seed the database with test data:

```bash
npm run seed
```

6. Start the application:

```bash
npm start
```

## Architecture

The Resources API uses PostgreSQL with Prisma ORM as the sole persistence layer, replacing the previous multi-database architecture that included Informix, DynamoDB, and ElasticSearch.

### Components:

- **Prisma ORM**: Provides type-safe database access
- **PostgreSQL**: Primary data store
- **Express.js**: Web framework
- **Joi**: Schema validation

### Data Models:

- **Resource**: Represents a resource associated with a challenge or member
- **Role**: Defines the roles that can be assigned to resources
- **Phase**: Represents phases that resources can be associated with
- **ResourcePhase**: Join table to manage resource-phase relationships

## API Documentation

Swagger API documentation is available at http://localhost:3000/api-docs

## Data Seeding

The application includes a data migration script that fetches data from the existing Topcoder Dev API and seeds it into the local database:

```bash
npm run seed
```

This script will:
1. Fetch resource roles from the Topcoder Dev API
2. Fetch resource phases from the Topcoder Dev API
3. Fetch a sample of resources from the Topcoder Dev API
4. Seed all this data into your local database

You can modify the script at `scripts/seed.js` to fetch more data or customize the seeding process.

## Running Tests

To run the tests:

```bash
npm run test
```

Note: Tests that require S3 setup have been disabled as part of this migration.

## Verification

You can verify the API functionality using the provided Postman collection in the `docs` folder.

To verify:

1. Import the Postman collection from `docs/postman_collection.json`
2. Update the environment variables in Postman:
   - `BASE_URL`: The base URL of the API (e.g., `http://localhost:3000/v5`)
   - `TOKEN`: A valid JWT token (if authentication is enabled)
3. Run the requests to verify functionality

You can also manually test the API endpoints:

- List all resources: GET http://localhost:3000/v5/resources
- Get a specific resource: GET http://localhost:3000/v5/resources/{id}
- Create a resource: POST http://localhost:3000/v5/resources
- Update a resource: PATCH http://localhost:3000/v5/resources/{id}
- Delete a resource: DELETE http://localhost:3000/v5/resources/{id}

Similar endpoints are available for roles and phases.

## Migration Notes

This version of the Resources API has been migrated from a multi-database architecture (Informix, DynamoDB, ElasticSearch) to a single PostgreSQL database with Prisma ORM. Key changes include:

1. Removed all dependencies on Informix, DynamoDB, and ElasticSearch
2. Simplified data access using Prisma ORM
3. Maintained API compatibility with previous versions
4. Improved local development experience

## License

Copyright (c) 2023 Topcoder, Inc. All rights reserved.
