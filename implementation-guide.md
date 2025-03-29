# Resources API Migration Guide

This guide outlines the steps needed to migrate the Topcoder Resources API from a multi-database architecture to a PostgreSQL-only solution with Prisma ORM.

## 1. Project Structure Update

The following files need to be modified or created:

### New Files to Create

- `prisma/schema.prisma` - Already provided
- `scripts/seed.js` - Already provided
- `.env` - For environment variables

### Files to Update

- `src/models/*.js` - Update models to match Prisma schema
- `src/services/*.js` - Replace database interactions with Prisma
- `src/routes/*.js` - Update route handlers as needed
- `config/default.js` - Remove references to Informix, ElasticSearch, DynamoDB

### Files to Remove

- Database-specific DAL files
- gRPC connector files
- Informix, DynamoDB, ElasticSearch utilities

## 2. Dependency Updates

Update `package.json`:

```json
{
  "scripts": {
    "start": "node app.js",
    "dev": "nodemon app.js",
    "lint": "standard",
    "lint:fix": "standard --fix",
    "test": "mocha test/unit/*.test.js --require test/unit/prepare.js --exit",
    "seed": "node scripts/seed.js"
  },
  "dependencies": {
    "@prisma/client": "^5.4.2",
    "axios": "^1.5.0",
    "body-parser": "^1.20.2",
    "config": "^3.3.9",
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "express-interceptor": "^1.2.0",
    "express-winston": "^4.2.0",
    "get-parameter-names": "^0.3.0",
    "helmet": "^7.0.0",
    "http-status-codes": "^2.3.0",
    "joi": "^17.10.2",
    "js-yaml": "^4.1.0",
    "jsonwebtoken": "^9.0.2",
    "jwks-rsa": "^3.0.1",
    "lodash": "^4.17.21",
    "swagger-ui-express": "^5.0.0",
    "uuid": "^9.0.1",
    "winston": "^3.10.0"
  },
  "devDependencies": {
    "chai": "^4.3.8",
    "chai-as-promised": "^7.1.1",
    "dotenv": "^16.3.1",
    "mocha": "^10.2.0",
    "nodemon": "^3.0.1",
    "nyc": "^15.1.0",
    "prisma": "^5.4.2",
    "standard": "^17.1.0",
    "supertest": "^6.3.3"
  }
}
```

## 3. Service Implementation

Here are examples of how to update the services:

### RoleService.js

```javascript
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const helper = require('../common/helper')
const errors = require('../common/errors')

/**
 * Create role
 * @param {Object} data the data to create role
 * @returns {Object} the created role
 */
async function createRole (data) {
  return prisma.role.create({
    data: {
      id: helper.generateUUID(),
      name: data.name,
      fullAccess: data.fullAccess || false,
      selfObtainable: data.selfObtainable || false,
      createdBy: data.createdBy,
      updatedBy: data.updatedBy
    }
  })
}

/**
 * Get role
 * @param {String} id the role id
 * @returns {Object} the role
 */
async function getRole (id) {
  const role = await prisma.role.findUnique({
    where: { id }
  })
  if (!role) {
    throw new errors.NotFoundError(`Role with id ${id} not found`)
  }
  return role
}

/**
 * Update role
 * @param {String} id the role id
 * @param {Object} data the data to update role
 * @returns {Object} the updated role
 */
async function updateRole (id, data) {
  const role = await getRole(id)
  return prisma.role.update({
    where: { id },
    data: {
      name: data.name !== undefined ? data.name : role.name,
      fullAccess: data.fullAccess !== undefined ? data.fullAccess : role.fullAccess,
      selfObtainable: data.selfObtainable !== undefined ? data.selfObtainable : role.selfObtainable,
      updatedBy: data.updatedBy
    }
  })
}

/**
 * Delete role
 * @param {String} id the role id
 */
async function deleteRole (id) {
  // Check if role exists
  await getRole(id)
  // Check if role is used by any resource
  const resourceCount = await prisma.resource.count({
    where: { roleId: id }
  })
  if (resourceCount > 0) {
    throw new errors.ConflictError(`Role with id ${id} is used by ${resourceCount} resources, cannot delete`)
  }
  await prisma.role.delete({
    where: { id }
  })
}

/**
 * Search roles
 * @param {Object} criteria the search criteria
 * @returns {Array} the search result
 */
async function searchRoles (criteria) {
  const page = criteria.page || 1
  const perPage = criteria.perPage || 20
  const skip = (page - 1) * perPage
  const name = criteria.name

  const where = {}
  if (name) {
    where.name = { contains: name, mode: 'insensitive' }
  }

  const [total, roles] = await Promise.all([
    prisma.role.count({ where }),
    prisma.role.findMany({
      where,
      skip,
      take: perPage,
      orderBy: { name: 'asc' }
    })
  ])

  return {
    total,
    page,
    perPage,
    result: roles
  }
}

module.exports = {
  createRole,
  getRole,
  updateRole,
  deleteRole,
  searchRoles
}
```

### ResourceService.js

```javascript
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const helper = require('../common/helper')
const errors = require('../common/errors')

/**
 * Create resource
 * @param {Object} data the data to create resource
 * @returns {Object} the created resource
 */
async function createResource (data) {
  // Check if role exists
  const role = await prisma.role.findUnique({
    where: { id: data.roleId }
  })
  if (!role) {
    throw new errors.NotFoundError(`Role with id ${data.roleId} not found`)
  }

  // Begin transaction
  return prisma.$transaction(async (tx) => {
    // Create resource
    const resource = await tx.resource.create({
      data: {
        id: helper.generateUUID(),
        challengeId: data.challengeId,
        memberId: data.memberId,
        memberHandle: data.memberHandle,
        roleId: data.roleId,
        createdBy: data.createdBy,
        updatedBy: data.updatedBy
      }
    })

    // Create resource phases if provided
    if (data.phases && data.phases.length > 0) {
      // Check if phases exist
      const phases = await tx.phase.findMany({
        where: { id: { in: data.phases } }
      })
      if (phases.length !== data.phases.length) {
        throw new errors.NotFoundError('One or more phases not found')
      }

      // Create resource phases
      await Promise.all(data.phases.map(phaseId => 
        tx.resourcePhase.create({
          data: {
            id: helper.generateUUID(),
            resourceId: resource.id,
            phaseId,
            createdBy: data.createdBy
          }
        })
      ))
    }

    // Return the created resource with included data
    return getResource(resource.id, true, true)
  })
}

/**
 * Get resource
 * @param {String} id the resource id
 * @param {Boolean} includeRole whether to include role
 * @param {Boolean} includePhases whether to include phases
 * @returns {Object} the resource
 */
async function getResource (id, includeRole = false, includePhases = false) {
  const resource = await prisma.resource.findUnique({
    where: { id },
    include: {
      role: includeRole,
      resourcePhases: includePhases ? {
        include: {
          phase: true
        }
      } : false
    }
  })

  if (!resource) {
    throw new errors.NotFoundError(`Resource with id ${id} not found`)
  }

  // Format response to match API schema
  const result = { ...resource }
  if (includePhases && resource.resourcePhases) {
    result.phases = resource.resourcePhases.map(rp => rp.phase)
    delete result.resourcePhases
  }

  return result
}

/**
 * Update resource
 * @param {String} id the resource id
 * @param {Object} data the data to update resource
 * @returns {Object} the updated resource
 */
async function updateResource (id, data) {
  // Check if resource exists
  await getResource(id)

  // Check if role exists if provided
  if (data.roleId) {
    const role = await prisma.role.findUnique({
      where: { id: data.roleId }
    })
    if (!role) {
      throw new errors.NotFoundError(`Role with id ${data.roleId} not found`)
    }
  }

  // Begin transaction
  return prisma.$transaction(async (tx) => {
    // Update resource
    await tx.resource.update({
      where: { id },
      data: {
        challengeId: data.challengeId,
        memberId: data.memberId,
        memberHandle: data.memberHandle,
        roleId: data.roleId,
        updatedBy: data.updatedBy
      }
    })

    // Update phases if provided
    if (data.phases) {
      // Check if phases exist
      const phases = await tx.phase.findMany({
        where: { id: { in: data.phases } }
      })
      if (phases.length !== data.phases.length) {
        throw new errors.NotFoundError('One or more phases not found')
      }

      // Delete existing resource phases
      await tx.resourcePhase.deleteMany({
        where: { resourceId: id }
      })

      // Create new resource phases
      await Promise.all(data.phases.map(phaseId => 
        tx.resourcePhase.create({
          data: {
            id: helper.generateUUID(),
            resourceId: id,
            phaseId,
            createdBy: data.updatedBy || 'system'
          }
        })
      ))
    }

    // Return the updated resource with included data
    return getResource(id, true, true)
  })
}

/**
 * Delete resource
 * @param {String} id the resource id
 */
async function deleteResource (id) {
  // Check if resource exists
  await getResource(id)

  // Delete resource (cascade will delete resourcePhases)
  await prisma.resource.delete({
    where: { id }
  })
}

/**
 * Search resources
 * @param {Object} criteria the search criteria
 * @returns {Array} the search result
 */
async function searchResources (criteria) {
  const page = criteria.page || 1
  const perPage = criteria.perPage || 20
  const skip = (page - 1) * perPage
  const includeRole = criteria.includeRole === 'true'
  const includePhases = criteria.includePhases === 'true'

  // Build where clause
  const where = {}
  if (criteria.challengeId) {
    where.challengeId = criteria.challengeId
  }
  if (criteria.memberId) {
    where.memberId = criteria.memberId
  }
  if (criteria.roleId) {
    where.roleId = criteria.roleId
  }
  if (criteria.memberHandle) {
    where.memberHandle = { contains: criteria.memberHandle, mode: 'insensitive' }
  }

  // Get total count
  const total = await prisma.resource.count({ where })

  // Get resources
  const resources = await prisma.resource.findMany({
    where,
    skip,
    take: perPage,
    orderBy: { created: 'desc' },
    include: {
      role: includeRole,
      resourcePhases: includePhases ? {
        include: {
          phase: true
        }
      } : false
    }
  })

  // Format response to match API schema
  const result = resources.map(resource => {
    const formattedResource = { ...resource }
    if (includePhases && resource.resourcePhases) {
      formattedResource.phases = resource.resourcePhases.map(rp => rp.phase)
      delete formattedResource.resourcePhases
    }
    return formattedResource
  })

  return {
    total,
    page,
    perPage,
    result
  }
}

/**
 * Add phases to resource
 * @param {String} resourceId the resource id
 * @param {Array} phaseIds the phase ids
 * @param {String} createdBy the creator
 * @returns {Object} the resource with phases
 */
async function addResourcePhases (resourceId, phaseIds, createdBy) {
  // Check if resource exists
  await getResource(resourceId)

  // Check if phases exist
  const phases = await prisma.phase.findMany({
    where: { id: { in: phaseIds } }
  })
  if (phases.length !== phaseIds.length) {
    throw new errors.NotFoundError('One or more phases not found')
  }

  // Check which phases are already associated
  const existingPhases = await prisma.resourcePhase.findMany({
    where: {
      resourceId,
      phaseId: { in: phaseIds }
    }
  })
  const existingPhaseIds = existingPhases.map(rp => rp.phaseId)
  const newPhaseIds = phaseIds.filter(id => !existingPhaseIds.includes(id))

  // Add new phases
  await Promise.all(newPhaseIds.map(phaseId => 
    prisma.resourcePhase.create({
      data: {
        id: helper.generateUUID(),
        resourceId,
        phaseId,
        createdBy
      }
    })
  ))

  // Return updated resource
  return getResource(resourceId, true, true)
}

/**
 * Remove phase from resource
 * @param {String} resourceId the resource id
 * @param {String} phaseId the phase id
 */
async function removeResourcePhase (resourceId, phaseId) {
  // Check if resource exists
  await getResource(resourceId)

  // Check if phase exists
  const phase = await prisma.phase.findUnique({
    where: { id: phaseId }
  })
  if (!phase) {
    throw new errors.NotFoundError(`Phase with id ${phaseId} not found`)
  }

  // Check if resource phase exists
  const resourcePhase = await prisma.resourcePhase.findFirst({
    where: { resourceId, phaseId }
  })
  if (!resourcePhase) {
    throw new errors.NotFoundError(`Resource phase not found for resource ${resourceId} and phase ${phaseId}`)
  }

  // Delete resource phase
  await prisma.resourcePhase.delete({
    where: { id: resourcePhase.id }
  })
}

module.exports = {
  createResource,
  getResource,
  updateResource,
  deleteResource,
  searchResources,
  addResourcePhases,
  removeResourcePhase
}
```

## 4. Postman Collection

Here's the complete Postman collection:

```json
{
  "info": {
    "_postman_id": "a123456-7890-abcd-efgh-123456789012",
    "name": "Topcoder Resources API",
    "description": "Postman collection for testing the Topcoder Resources API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Roles",
      "item": [
        {
          "name": "Get All Roles",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{TOKEN}}",
                "type": "text"
              }
            ],
            "url": {
              "raw": "{{BASE_URL}}/resource-roles",
              "host": ["{{BASE_URL}}"],
              "path": ["resource-roles"]
            }
          },
          "response": []
        },
        {
          "name": "Get Role By ID",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{TOKEN}}",
                "type": "text"
              }
            ],
            "url": {
              "raw": "{{BASE_URL}}/resource-roles/:id",
              "host": ["{{BASE_URL}}"],
              "path": ["resource-roles", ":id"],
              "variable": [
                {
                  "key": "id",
                  "value": "{{ROLE_ID}}"
                }
              ]
            }
          },
          "response": []
        },
        {
          "name": "Create Role",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              },
              {
                "key": "Authorization",
                "value": "Bearer {{TOKEN}}",
                "type": "text"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"name\": \"Test Role\",\n  \"fullAccess\": false,\n  \"selfObtainable\": true,\n  \"createdBy\": \"test\"\n}"
            },
            "url": {
              "raw": "{{BASE_URL}}/resource-roles",
              "host": ["{{BASE_URL}}"],
              "path": ["resource-roles"]
            }
          },
          "response": []
        },
        {
          "name": "Update Role",
          "request": {
            "method": "PATCH",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              },
              {
                "key": "Authorization",
                "value": "Bearer {{TOKEN}}",
                "type": "text"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"name\": \"Updated Test Role\",\n  \"updatedBy\": \"test\"\n}"
            },
            "url": {
              "raw": "{{BASE_URL}}/resource-roles/:id",
              "host": ["{{BASE_URL}}"],
              "path": ["resource-roles", ":id"],
              "variable": [
                {
                  "key": "id",
                  "value": "{{ROLE_ID}}"
                }
              ]
            }
          },
          "response": []
        },
        {
          "name": "Delete Role",
          "request": {
            "method": "DELETE",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{TOKEN}}",
                "type": "text"
              }
            ],
            "url": {
              "raw": "{{BASE_URL}}/resource-roles/:id",
              "host": ["{{BASE_URL}}"],
              "path": ["resource-roles", ":id"],
              "variable": [
                {
                  "key": "id",
                  "value": "{{ROLE_ID}}"
                }
              ]
            }
          },
          "response": []
        }
      ]
    },
    {
      "name": "Phases",
      "item": [
        {
          "name": "Get All Phases",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{TOKEN}}",
                "type": "text"
              }
            ],
            "url": {
              "raw": "{{BASE_URL}}/resource-phases",
              "host": ["{{BASE_URL}}"],
              "path": ["resource-phases"]
            }
          },
          "response": []
        },
        {
          "name": "Get Phase By ID",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{TOKEN}}",
                "type": "text"
              }
            ],
            "url": {
              "raw": "{{BASE_URL}}/resource-phases/:id",
              "host": ["{{BASE_URL}}"],
              "path": ["resource-phases", ":id"],
              "variable": [
                {
                  "key": "id",
                  "value": "{{PHASE_ID}}"
                }
              ]
            }
          },
          "response": []
        },
        {
          "name": "Create Phase",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              },
              {
                "key": "Authorization",
                "value": "Bearer {{TOKEN}}",
                "type": "text"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"name\": \"Test Phase\",\n  \"description\": \"A test phase\",\n  \"createdBy\": \"test\"\n}"
            },
            "url": {
              "raw": "{{BASE_URL}}/resource-phases",
              "host": ["{{BASE_URL}}"],
              "path": ["resource-phases"]
            }
          },
          "response": []
        },
        {
          "name": "Update Phase",
          "request": {
            "method": "PATCH",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              },
              {
                "key": "Authorization",
                "value": "Bearer {{TOKEN}}",
                "type": "text"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"description\": \"Updated test phase description\",\n  \"updatedBy\": \"test\"\n}"
            },
            "url": {
              "raw": "{{BASE_URL}}/resource-phases/:id",
              "host": ["{{BASE_URL}}"],
              "path": ["resource-phases", ":id"],
              "variable": [
                {
                  "key": "id",
                  "value": "{{PHASE_ID}}"
                }
              ]
            }
          },
          "response": []
        },
        {
          "name": "Delete Phase",
          "request": {
            "method": "DELETE",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{TOKEN}}",
                "type": "text"
              }
            ],
            "url": {
              "raw": "{{BASE_URL}}/resource-phases/:id",
              "host": ["{{BASE_URL}}"],
              "path": ["resource-phases", ":id"],
              "variable": [
                {
                  "key": "id",
                  "value": "{{PHASE_ID}}"
                }
              ]
            }
          },
          "response": []
        }
      ]
    },
    {
      "name": "Resources",
      "item": [
        {
          "name": "Get All Resources",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{TOKEN}}",
                "type": "text"
              }
            ],
            "url": {
              "raw": "{{BASE_URL}}/resources?includeRole=true&includePhases=true",
              "host": ["{{BASE_URL}}"],
              "path": ["resources"],
              "query": [
                {
                  "key": "includeRole",
                  "value": "true"
                },
                {
                  "key": "includePhases",
                  "value": "true"
                }
              ]
            }
          },
          "response": []
        },
        {
          "name": "Get Resource By ID",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{TOKEN}}",
                "type": "text"
              }
            ],
            "url": {
              "raw": "{{BASE_URL}}/resources/:id?includeRole=true&includePhases=true",
              "host": ["{{BASE_URL}}"],
              "path": ["resources", ":id"],
              "query": [
                {
                  "key": "includeRole",
                  "value": "true"
                },
                {
                  "key": "includePhases",
                  "value": "true"
                }
              ],
              "variable": [
                {
                  "key": "id",
                  "value": "{{RESOURCE_ID}}"
                }
              ]
            }
          },
          "response": []
        },
        {
          "name": "Create Resource",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              },
              {
                "key": "Authorization",
                "value": "Bearer {{TOKEN}}",
                "type": "text"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"challengeId\": \"123456\",\n  \"memberId\": \"789012\",\n  \"memberHandle\": \"testuser\",\n  \"roleId\":