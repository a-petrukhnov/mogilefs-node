const querystring = require('querystring')
const net = require('net')

const domain = require('./lib/domain')
const tracker = require('./lib/tracker')
const noop = () => {}

/**
 * Constructor
 *
 * @param {Array} trackers An array of mogile trackers
 * @param {Number} retries Number of times to retry an operation
 */
const Mogile = function(trackers, retries) {
  //default set trackers 127.0.0.1:7001 
  trackers = trackers || ['127.0.0.1:7001']  
  
  // The tracker hosts
  this.trackers = []
  for (let i = 0; i < trackers.length; i++) {
    this.trackers.push(new tracker.factory(trackers[i]))
  }
  
  // The current tracker being used
  this.current_tracker = null
  
  // The number of times to retry an operation
  this.retries = (typeof retries !== 'undefined') ? retries : 1
  
  // The default encoding for connections
  this.encoding = 'ascii'
}

/**
 * Factory class
 *
 * Returns a new instance of Mogile.
 *
 * @param {Array} trackers An array of mogile trackers
 * @param {Number} retries Number of times to retry an operation
 * @return {Mogile}
 */
Mogile.createClient = function(trackers, retries) {
  return new Mogile(trackers, retries)
}

/**
 * Domain factory method
 *
 * Returns a new instance of Domain.
 *
 * @return {Domain}
 */
Mogile.domain = Mogile.prototype.domain = function(name) {
  return domain.factory(this, name)
}

/**
 * Gets a list of all the domains in the file system
 *
 * @param {Function} callback Function to call with an array of all domains
 * @return {Promise}
 */
Mogile.prototype.getDomains = function() {
  return new Promise((resolve, reject) => {
    this.send('default', 'GET_DOMAINS', {}, (err, results) => {
      if (err) {
        reject(err)
      }
      else {
        const domains = []

        for (let i = 1; i <= results['domains']; i++) {
          const dom = 'domain' + i
          const classes = {}

          for (let j = 1; j <= results[dom + 'classes']; j++) {
            classes[results[`${dom}class${j}name`]] = results[`${dom}class${j}mindevcount`] - 0
          }

          domains.push({
            name: results[dom],
            classes: classes
          })
        }
        
        resolve(domains)
      }
    })
  })
}

/**
 * Create domain 
 *
 * @param {String} name domain name
 * @return {Promise}
 */
Mogile.prototype.createDomain = function(name) {
  name = name || null

  return new Promise((resolve, reject) => {
    this.send(name, 'CREATE_DOMAIN', null, (err, response) => {
      if (err) {
        reject(err)
      } else {
        resolve(response)
      }
    })
  })
}

/**
 * delete domain 
 *
 * @param {String} name domain name
 * @return {Promise}
 */
Mogile.prototype.deleteDomain = function(name) {
  name = name || null

  return new Promise((resolve, reject) => {
    this.send(name, 'DELETE_DOMAIN', null, (err, response) => {
      if (err) {
        reject(err)
      } else {
        resolve(response)
      }
    })
  })
}

/**
 * Sends a command to mogile
 *
 * @param {String} domain The storage domain
 * @param {String} cmd The command to send
 * @param {Object} args The command arguments
 * @param {Function} callback Function to call when the operation is complete
 * @return {Function}
 */
Mogile.prototype.send = function(domain, cmd, args, callback) {
  args = args || {}
  callback = callback || noop
  args.domain = domain
  const command = `${cmd} ${querystring.stringify(args)}\n`
  let tries = 0
  
  const sendf = () => {
    this.sendCommand(command, (err, results) => {
      if (err) {
        if (++tries > this.retries) {
          // Mark the tracker dead
          return callback(err)
        } else {
          return sendf()
        }
      } else {
        // All responses should start with OK or ERR, followed by a space, and then some kind
        // of message. The message will be formatted as a URL query string, without any spaces.
        const parts = results.split(' ')
        
        // Having fewer than 2 parts is some kind of communications error, since the tracker
        // will always return 2 string separated by a space.
        if (parts.length !== 2) {
          return callback(new Error(`Got invalid response from tracker: ${results}`))
        }
        
        // Responses starting with ERR are errors returned by the tracker. For instance
        // if the key is unknown.
        if (parts[0] === 'ERR') {
          return callback(parts[1])
        }
        
        return callback(null, querystring.parse(parts[1].replace('\r\n', '')))
      }
    })
  }

  sendf()
}

Mogile.prototype.sendCommand = function(cmd, callback) {
  const trackers = this.getLiveTrackers()
  callback = callback || noop

  if (!trackers.length) {
    callback(new Error('No live trackers found'))
  }
  
  let i = 0

  const sendf = () => {
    this.current_tracker = trackers[i]
    const connection = net.createConnection(this.current_tracker.getPort(), this.current_tracker.getHost())

    connection.setEncoding(this.encoding)

    connection.on('error', (err) => {
      i++
      if (i === this.trackers.length) {
        callback(err)
      } else {
        sendf()
      }
    })

    connection.on('connect', () => {
      connection.write(cmd, this.encoding, () => {
        connection.on('data', (response) => {
          connection.end()
          callback(null, response)
        })
      })
    })

    connection.setTimeout(900000)

    connection.on('timeout', () => {
      connection.end()
      process.exit(0)
    })
  }
  
  sendf()
}

/**
 * Returns all the trackers in the alive state
 *
 * @return {Array}
 */
Mogile.prototype.getLiveTrackers = function() {
  const live_trackers = []

  for (let i = 0; i < this.trackers.length; i++) {
    if (this.trackers[i].isAlive()) {
      live_trackers.push(this.trackers[i])
    }
  }

  return live_trackers
}

// Export the Mogile class
module.exports = Mogile
