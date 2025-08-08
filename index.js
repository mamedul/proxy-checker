const express = require('express')
const bodyParser = require('body-parser')
const axios = require('axios')
const { HttpsProxyAgent } = require('https-proxy-agent')
const { SocksProxyAgent } = require('socks-proxy-agent')

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0' // Disable SSL cert validation

const app = express()
const PORT = process.env.PORT || 3000

// Enable CORS for all origins
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

app.use(bodyParser.json())

const TEST_URL = 'https://httpbin.org/ip'

app.get('/', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Invalid request method. Please POST with JSON payload'
  })
})

// Function to check a single proxy
async function checkProxy({ ip, port, type }) {
  if (!ip || !port || !type) {
    return { success: false, error: 'Missing ip, port, or type' }
  }

  const proxyType = type.toLowerCase()
  let proxyUrl, agent

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
        return { success: false, error: 'Unsupported proxy type', proxy: `${type}://${ip}:${port}` }
    }

    const response = await axios.get(TEST_URL, {
      httpAgent: agent,
      httpsAgent: agent,
      timeout: 10000,
      validateStatus: null
    })

    if (response.status === 200 && response.data?.origin) {
      return {
        success: true,
        status: response.status,
        origin: response.data.origin,
        proxy: proxyUrl
      }
    } else {
      return {
        success: false,
        status: response.status,
        message: 'Proxy responded but failed to fetch test URL properly',
        proxy: proxyUrl
      }
    }
  } catch (err) {
    return {
      success: false,
      error: err.message,
      proxy: `${proxyType}://${ip}:${port}`
    }
  }
}

app.post('/', async (req, res) => {
  let proxies = req.body

  // If it's a single object, wrap in array
  if (!Array.isArray(proxies)) {
    proxies = [proxies]
  }

  // Process all proxies in parallel
  const results = await Promise.all(proxies.map(proxy => checkProxy(proxy)))
  res.json(results)
})

app.listen(PORT, () => {
  console.log(`Proxy checker API running on port ${PORT}`)
})
