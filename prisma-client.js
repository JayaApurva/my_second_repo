/**
 * Prisma client configuration.
 * This sets up a singleton instance of the Prisma client.
 */
const { PrismaClient } = require('@prisma/client')

// Check if we have an existing Prisma instance in global
const globalForPrisma = global

// Create and export Prisma client singleton
const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

module.exports = prisma
