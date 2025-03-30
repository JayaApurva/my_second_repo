/**
 * This module contains the helper methods.
 */
const _ = require('lodash')
const config = require('config')
const logger = require('./logger')

/**
 * Convert the first character of the string to uppercase and the remaining to lowercase
 * @param {String} str the string to convert
 * @returns {String} the converted string
 */
function toProperCase (str) {
  return str ? str.charAt(0).toUpperCase() + str.substr(1).toLowerCase() : ''
}

/**
 * Convert string to camel case
 * @param {String} str the string to convert
 * @returns {String} the converted string
 */
function toCamelCase (str) {
  if (!str) {
    return ''
  }

  if (str.indexOf('_') >= 0) {
    str = str.toLowerCase().replace(/_([a-z])/g, g => g[1].toUpperCase())
  }
  return str
}

/**
 * Get link for a given page
 * @param {Object} req the HTTP request
 * @param {Number} page the page number
 * @returns {String} link for the page
 */
function getPageLink (req, page) {
  const q = _.assignIn({}, req.query)
  q.page = page
  return `${req.protocol}://${req.get('Host')}${req.baseUrl}${req.path}?${querystring.stringify(q)}`
}

/**
 * Set HTTP response headers from result metadata
 * @param {Object} req the HTTP request
 * @param {Object} res the HTTP response
 * @param {Object} result the operation result
 */
function setResHeaders (req, res, result) {
  const totalPages = Math.ceil(result.total / result.perPage)
  if (result.page < totalPages) {
    res.set('X-Next-Page', result.page + 1)
  }
  res.set('X-Page', result.page)
  res.set('X-Per-Page', result.perPage)
  res.set('X-Total', result.total)
  res.set('X-Total-Pages', totalPages)
  // set Link header
  if (totalPages > 0) {
    let link = `<${getPageLink(req, 1)}>; rel="first", <${getPageLink(req, totalPages)}>; rel="last"`
    if (result.page > 1) {
      link += `, <${getPageLink(req, result.page - 1)}>; rel="prev"`
    }
    if (result.page < totalPages) {
      link += `, <${getPageLink(req, result.page + 1)}>; rel="next"`
    }
    res.set('Link', link)
  }
}

/**
 * Generate paged result from Prisma model
 * @param {Object} model the Prisma model
 * @param {Object} whereClause the where clause
 * @param {Number} page the page number
 * @param {Number} perPage the page size
 * @param {Number} total the total number of records
 * @param {Array} fields the fields to include in the result
 * @returns {Object} paged result
 */
async function pagedResult (model, whereClause, page, perPage, total, fields) {
  // Normalize page and perPage
  page = parseInt(page) || 1
  perPage = parseInt(perPage) || config.DEFAULT_PAGE_SIZE

  // Construct select clause
  let select = undefined
  if (fields) {
    select = {}
    fields.forEach(field => {
      select[field] = true
    })
  }

  // Get data with pagination
  const items = await model.findMany({
    where: whereClause,
    select,
    skip: (page - 1) * perPage,
    take: perPage
  })

  return {
    items,
    page,
    perPage,
    total,
    totalPages: Math.ceil(total / perPage)
  }
}

module.exports = {
  toProperCase,
  toCamelCase,
  getPageLink,
  setResHeaders,
  pagedResult
}
