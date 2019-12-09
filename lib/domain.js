const url = require('url')
const http = require('http')
const fs = require('fs')

/**
 * Constructor
 *
 * @param {Mogile} mogile Instance of the Mogile class
 * @param {String} name The domain name
 */
const Domain = function(mogile, name) {
  this.mogile = mogile
  this.name = name
}

/**
 * Factory method
 *
 * Returns a new instance of the Domain class
 *
 * @param {Mogile} mogile Instance of the Mogile class
 * @param {String} name The domain name
 * @return {Domain}
 */
Domain.factory = function(mogile, name) {
  return new Domain(mogile, name)
}

/**
 * Get available paths
 *
 * @param {String} key The storage key
 * @param {Boolean} noverify Don't have MogileFS check that the file exists
 * @return {Promise}
 */
Domain.prototype.getPaths = function(key, noverify) {
  const args = {
    key,
    noverify: Boolean(noverify)
  }

  return new Promise((resolve, reject) => {
    this.mogile.send(this.name, 'GET_PATHS', args, (err, response) => {
      if (err) {
        reject(err)
      } else {
        const paths = []

        for (let i = 1; i <= response['paths']; i++) {
          paths.push(response['path' + i])
        }

        resolve(paths)
      }
    })
  })
}

/**
 * Get file single path
 *
 * @param {String} key The storage key
 * @param {Boolean} noverify Don't have MogileFS check that the file exists
 * @return {Promise}
 */
Domain.prototype.get = function(key, noverify) {
  return new Promise((resolve, reject) => {
    this.getPaths(key, noverify)
      .then((paths) => {
        resolve(paths[Math.floor(Math.random() * paths.length)])
      })
      .catch(err => reject(err))
  });
}

/**
 * Deletes the file with the given key
 *
 * @param {String} key The storage key
 * @return {Promise}
 */
Domain.prototype.del = function(key) {
  const args = {key}

  return new Promise((resolve, reject) => {
    this.mogile.send(this.name, 'DELETE', args, (err) => {
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  })
}

/**
 * Renames a file from one key to another
 *
 * @param {String} from_key The original key
 * @param {String} to_key The new key
 * @return {Promise}
 */
Domain.prototype.rename = function(from_key, to_key) {
  const args = {
    from_key,
    to_key
  }

  return new Promise((resolve, reject) => {
    this.mogile.send(this.name, 'RENAME', args, (err) => {
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  })
}

/**
 * Gets the file with the given key, and writes it to a local file
 *
 * @param {String} key The storage key
 * @param {String} local The location to write the file to
 * @return {Promise}
 */
Domain.prototype.getFile = function(key, local) {
  let bytes = 0
  let paused = false
  let response = null

  return new Promise((resolve, reject) => {
    this.getPaths(key, 0)
      .catch((err) => reject(err))
      .then((paths) => {
        const write_options = {
          flags: 'w+',
          mode: 0666
        }
        const stream = fs.createWriteStream(local, write_options)

        stream.on('open', (fd) => {
          const url_parts = url.parse(paths[0])
          const get_options = {
            host: url_parts.hostname,
            port: url_parts.port,
            path: url_parts.pathname
          }
          const get = http.get(get_options, (res) => {
            response = res

            res.on('data', (data) => {
              bytes += data.length

              if (!stream.write(data)) {
                res.pause()
                paused = true
              }
            })
            res.on('end', () => {
              (() => {
                if (paused) {
                  process.nextTick(finished)
                } else {
                  stream.end()
                  resolve(bytes)
                }
              })()
            })
          })
          get.on('error', (err) => {
            stream.end()
            reject(err)
          })
        })
        stream.on('error', (err) => {
          reject(err)
        })
        stream.on('drain', () => {
          if (paused) {
            if (!response.complete) response.resume()
            paused = false
          }
        })
      })
  })
}

/**
 * Stores a file with the given key, in the given storage class, from the local file
 *
 * @param {String} key The storage key to save the file as
 * @param {String} storageClass The storage class
 * @param {String} local The local file to read from
 * @return {Promise}
 */
Domain.prototype.save = function(key, storageClass, local) {
  const args = {
    key,
    class: storageClass
  }

  return new Promise((resolve, reject) => {
    this.mogile.send(this.name, 'CREATE_OPEN', args, (err, response) => {
      if (err) {
        reject(err)
      } else {
        // Typical response: { devid: '95', fid: '504917521', path: 'http://127.0.0.1:7500/dev95/0/504/917/0504917521.fid' }
        fs.stat(local, (err, stat) => {
          if (err || !stat) {
            reject(err)
          } else {
            const path = url.parse(response.path)
            const options = {
              host: path.hostname,
              port: parseFloat(path.port),
              path: path.pathname,
              method: 'PUT',
              headers: {
                'Content-Length': stat.size
              }
            }
            const request = http.request(options)

            request.on('error', (err) => {
              reject(err)
            })
            
            const stream = fs.createReadStream(local, {bufferSize: 512 * 1024})
            stream.pipe(request)

            stream.on('end', () => {
              request.end()

              const {devid, fid, path} = response

              const args = {
                key,
                devid,
                fid,
                path,
                class: storageClass
              }

              this.mogile.send(this.name, 'CREATE_CLOSE', args, (err, response) => {
                if (err) {
                  reject(err)
                } else {
                  resolve(stat.size)
                }
              })
            })
          }
        })
      }
    })
  })
}

/**
 * Create class
 *
 * @param {String} key class name
 * @param {String} mindevcount backup folds
 * @return {Promise}
 */
Domain.prototype.createClass = function(key, mindevcount) {
  key = key || ''
  mindevcount = mindevcount || 2

  if (key === 'default') {
    return Error('Can\'t create default class')
  }

  const args = {
    mindevcount,
    domain: this.name,
    class: key
  }

  return new Promise((resolve, reject) => {
    this.mogile.send(this.name, 'CREATE_CLASS', args, (err, response) => {
      if (err) {
        reject(err)
      } else {
        resolve(response)
      }
    })
  })
}

/**
 * Update class
 *
 * @param {String} key class name
 * @param {String} mindevcount backup folds
 * @return {Promise}
 */
Domain.prototype.updateClass = function(key, mindevcount) {
  key = key || ''
  mindevcount = mindevcount || 2

  if (key === 'default') {
    return Error('Can\'t create default class')
  }
  const args = {
    mindevcount,
    domain: this.name,
    class: key,
    update: 1,
  }

  return new Promise((resolve, reject) => {
    this.mogile.send(this.name, 'UPDATE_CLASS', args, (err, response) => {
      if (err) {
        reject(err)
      } else {
        resove(response)
      }
    })
  })
}

/**
 * Delete class
 *
 * @param {String} key class name
 * @return {Promise}
 */
Domain.prototype.deleteClass = function(key) {
  key = key || ''

  if (key === 'default') {
    return Error('Can\'t delete default class')
  }
  const args = {
    domain: this.name,
    class: key
  }

  return new Promise((resolve, reject) => {
    this.mogile.send(this.name, 'DELETE_CLASS', args, (err, response) => {
      if (err) {
        reject(err)
      } else {
        resolve(response)
      }
    })
  })
}

/**
 * FileInfo Class
 *
 * @param key get key information
 * @return {Promise}
 */
Domain.prototype.fileInfo = function(key) {
  key = key || ''
  const args = {
    domain: this.name,
    key: key
  }

  return new Promise((resolve, reject) => {
    this.mogile.send(this.name, 'file_Info', args, (err, response) => {
      if (err) {
        reject(err)
      } else {
        resolve(response)
      }
    })
  })
}

// Export the Domain class
module.exports = Domain
