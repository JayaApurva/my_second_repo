/**
 * Script to fetch test data from the existing API.
 */
const axios = require('axios')
const fs = require('fs')
const path = require('path')
const logger = require('../src/common/logger')

const API_BASE_URL = 'https://api.topcoder-dev.com/v5'
const DATA_DIR = path.join(__dirname, '../data')

// Create data directory if it doesn't exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

/**
 * Fetch data from a specific endpoint
 * @param {String} endpoint the API endpoint
 * @param {String} filename the filename to save the data
 */
async function fetchData(endpoint, filename) {
  try {
    logger.info(`Fetching data from ${endpoint}...`)
    const response = await axios.get(`${API_BASE_URL}/${endpoint}`)
    
    const data = response.data
    logger.info(`Fetched ${Array.isArray(data) ? data.length : 1} records from ${endpoint}`)
    
    // Save to file
    fs.writeFileSync(
      path.join(DATA_DIR, filename),
      JSON.stringify(data, null, 2)
    )
    
    logger.info(`Data saved to ${filename}`)
    return data
  } catch (error) {
    logger.error(`Error fetching data from ${endpoint}: ${error.message}`)
    throw error
  }
}

/**
 * Main function
 */
async function main() {
  try {
    logger.info('Starting data fetching...')

    // Fetch resources
    await fetchData('resources', 'resources.json')

    // Fetch resource roles
    await fetchData('resource-roles', 'resource-roles.json')

    // Fetch resource role phase dependencies
    await fetchData('resource-roles/phase-dependencies', 'resource-role-phase-dependencies.json')

    logger.info('Data fetching completed successfully')
  } catch (error) {
    logger.error(`Error fetching data: ${error.message}`)
    process.exit(1)
  }
}

// Run the main function
main()
