// proxy-checker.js

const express = require('express')
const bodyParser = require('body-parser')
const axios = require('axios')
const { HttpsProxyAgent } = require('https-proxy-agent')
const { SocksProxyAgent } = require('socks-proxy-agent')
const https = require('https')

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0' // Disable SSL cert validation globally (optional)

const app = express()
const PORT = process.env.PORT || 3000

// Enable CORS for all origins
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*') // allow any origin
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204) // handle preflight
  }
  next()
})

app.use(bodyParser.json())

// Simple test URL to check proxy
const TEST_URL = 'https://httpbin.org/ip'

app.get('/', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Invalid request method. Please Post with JSON payload'
  })
})

app.post('/', async (req, res) => {
  const { ip, port, type } = req.body

  if (!ip || !port || !type) {
    return res.status(400).json({ success: false, error: 'Missing ip, port, or type' })
  }

  const proxyType = type.toLowerCase()
  let proxyUrl
  let agent

  try {
    switch (proxyType) {
      case 'http':
      case 'https':
        proxyUrl = `${proxyType}://${ip}:${port}`
        agent = new HttpsProxyAgent(proxyUrl)
        break

      case 'socks4':
        proxyUrl = `socks4://${ip}:${port}`
        agent = new SocksProxyAgent(proxyUrl)
        break

      case 'socks5':
        proxyUrl = `socks5://${ip}:${port}`
        agent = new SocksProxyAgent(proxyUrl)
        break

      default:
        return res.status(400).json({ success: false, error: 'Unsupported proxy type' })
    }

    //const httpsAgent = new https.Agent({ rejectUnauthorized: false })

    // Try request via proxy with 10s timeout
    const response = await axios.get(TEST_URL, {
      httpAgent: agent,
      httpsAgent: agent,
      timeout: 10000,
      validateStatus: null,
    })

    // If we got a 200 response and body has origin IP
    if (response.status === 200 && response.data && response.data.origin) {
      return res.json({
        success: true,
        status: response.status,
        origin: response.data.origin,
        proxy: proxyUrl,
      })
    } else {
      return res.json({
        success: false,
        status: response.status,
        message: 'Proxy responded but failed to fetch test URL properly',
        proxy: proxyUrl,
      })
    }
  } catch (error) {
    return res.json({
      success: false,
      error: error.message,
      proxy: proxyUrl,
    })
  }
})

app.listen(PORT, () => {
  console.log(`Proxy checker API running on port ${PORT}`)
})
