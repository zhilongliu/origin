const Busboy = require('busboy')
const imageType = require('image-type')
const isJSON = require('is-json')
const http = require('http')
const httpProxy = require('http-proxy')
const request = require('superagent')
const zlib = require('zlib')

const config = require('./config')
const logger = require('./logger')

const validImageTypes = ['image/jpeg', 'image/gif', 'image/png']

function isValidFile(buffer) {
  return isValidImage(buffer) || isJSON(buffer.toString())
}

function isValidImage(buffer) {
  const image = imageType(buffer)
  return image && validImageTypes.includes(image.mime)
}

function handleFileUpload (req, res) {
  const busboy = new Busboy({
    headers: req.headers,
    limits: {
      fileSize: 2 * 1024 * 1024
    }
  })

  busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
    file.fileRead = []

    file.on('data', function(chunk) {
      file.fileRead.push(chunk)
    })

    file.on('limit', function() {
      logger.warn(`File upload too large`)
      res.writeHead(413, { 'Connection': 'close' });
      res.end()
      req.unpipe(req.busboy)
    })

    file.on('end', function() {
      let buffer = Buffer.concat(file.fileRead);

      if (!isValidFile(buffer)) {
        logger.warn(`Upload of invalid file type attempted`)
        res.writeHead(415, { 'Connection': 'close' })
        res.end()
        req.unpipe(req.busboy)
      } else {
        const url = config.IPFS_API_URL + req.url + '?stream-channels=false'
        request.post(url)
          .set(req.headers)
          .attach('file', buffer)
          .then((response) => {
            let responseData = response.text
            if (response.headers['content-encoding'] === 'gzip') {
              // Compress the response so the header is correct if necessary
              responseData = zlib.gzipSync(response.text)
            } else if (response.headers['content-encoding'] === 'deflate') {
              responseData = zlib.deflateSync(response.text)
            }
            res.writeHead(response.status, response.headers)
            res.end(responseData)
          }, (error) => {
            logger.error(`An error occurred proxying request to IPFS`)
            logger.error(error)
            res.writeHead(500, { 'Connection': 'close' })
            res.end()
          })
      }
    })
  })

  req.pipe(busboy)
}

function handleFileDownload(req, res) {
  // Proxy download requests to gateway
  proxy.web(req, res, {
    target: config.IPFS_GATEWAY_URL,
    selfHandleResponse: true
  })
}

const proxy = httpProxy.createProxyServer({})

// Validate downloads. It is necessary to inspect the file type for downloads
// because it is possible to add IPFS content to a peer and request it using an
// Origin IPFS server which would cause it to be available.
proxy.on('proxyRes', (proxyResponse, req, res) => {
  let buffer = []

  proxyResponse.on('data', (data) => {
    buffer.push(data)
  })

  proxyResponse.on('end', () => {
    buffer = Buffer.concat(buffer)

    if (isValidFile(buffer)) {
      res.writeHead(proxyResponse.statusCode, proxyResponse.headers)
      res.end(buffer)
    } else {
      res.writeHead(415, { 'Connection': 'close' })
      res.end()
    }
  })
})

proxy.on('error', (err) => {
  logger.error(err)
})

const server = http.createServer((req, res) => {
  if (req.url == '/api/v0/add') {
    handleFileUpload(req, res)
  } else if (req.url.startsWith('/ipfs')) {
    handleFileDownload(req, res)
  } else {
    req.writeHead(404, { 'Connection': 'close' })
    res.end()
  }
}).listen(config.IPFS_PROXY_PORT, config.IPFS_PROXY_ADDRESS)

logger.debug(`Listening on ${config.IPFS_PROXY_PORT}`)
logger.debug(`Proxying to IPFS gateway ${config.IPFS_GATEWAY_URL}`)
logger.debug(`Proxying to IPFS API ${config.IPFS_API_URL}`)

module.exports = server
