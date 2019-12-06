const url = require('url');
const http = require('http');
const fs = require('fs');
const noop = () => {};

/**
 * Constructor
 *
 * @param {Mogile} mogile Instance of the Mogile class
 * @param {String} name The domain name
 */
const Domain = function(mogile, name) {
	this.mogile = mogile;
	this.name = name;
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
	return new Domain(mogile, name);
}

/**
 * Get available paths
 * Returns promise
 *
 * @param {String} key The storage key
 * @param {Boolean} noverify Don't have MogileFS check that the file exists
 * @return {Boolean}
 */
Domain.prototype.getPaths = function(key, noverify) {
	const args = {
		key,
		noverify: Boolean(noverify)
	};

	return new Promise((resolve, reject) => {
		this.mogile.send(this.name, 'GET_PATHS', args, (err, response) => {
			if (err) {
				reject(err);
			} else {
				const paths = [];

				for (let i = 1; i <= response['paths']; i++) {
					paths.push(response['path' + i]);
				}

				resolve(paths);
			}
		});
	});
}

/**
 * Deletes the file with the given key
 * Returns promise
 *
 * @param {String} key The storage key
 * @param {String} storage_class Optional. The storage class. Only required when using transactions
 * @return {Boolean}
 */
Domain.prototype.del = function(key, storage_class) {
	const args = {
		key,
		class: storage_class
	};

	return new Promise((resolve, reject) => {
		this.mogile.send(this.name, 'DELETE', args, (err) => {
			if (err) {
				reject(err);
			} else {
				resolve();
			}
		});
	});
}

/**
 * Renames a file from one key to another
 * Returns promise
 *
 * @param {String} from_key The original key
 * @param {String} to_key The new key
 * @return {Boolean}
 */
Domain.prototype.rename = function(from_key, to_key) {
	const args = {
		from_key,
		to_key
	};

	return new Promise((resolve, reject) => {
		this.mogile.send(this.name, 'RENAME', args, (err) => {
			if (err) {
				reject(err);
			} else {
				resolve();
			}
		});
	});
}

/**
 * Gets the file with the given key, and writes it to a local file
 * Returns promise
 *
 * @param {String} key The storage key
 * @param {String} local The location to write the file to
 * @return {Boolean}
 */
Domain.prototype.getFile = function(key, local) {
	let bytes_written = 0;
	let paused = false;
	let response = null;

	return new Promise((resolve, reject) => {
		this.getPaths(key, 0, (err, paths) => {
			if (err) {
				reject(err);
			} else {
				const write_options = {
					flags: 'w+',
					mode: 0666
				};
				const stream = fs.createWriteStream(local, write_options);

				stream.on('open', (fd) => {
					const url_parts = url.parse(paths[0]);
					const get_options = {
						host: url_parts.hostname,
						port: url_parts.port,
						path: url_parts.pathname
					};
					const get = http.get(get_options, (res) => {
						response = res;

						res.on('data', (data) => {
							bytes_written += data.length;

							if (!stream.write(data)) {
								res.pause();
								paused = true;
							}
						});
						res.on('end', () => {
							(() => {
								if (paused) {
									process.nextTick(finished);
								} else {
									stream.end();
									resolve(bytes_written);
								}
							})();
						});
					});
					get.on('error', (err) => {
						stream.end();
						reject(err);
					});
				});
				stream.on('error', (err) => {
					reject(err);
				});
				stream.on('drain', () => {
					if (paused) {
						if (!response.complete) response.resume();
						paused = false;
					}
				});
			}
		});
	});
}

/**
 * Stores a file with the given key, in the given storage class, from the local file
 * Returns promise
 *
 * @param {String} key The storage key to save the file as
 * @param {String} storage_class The storage class
 * @param {String} local The local file to read from
 * @return {Boolean}
 */
Domain.prototype.storeFile = function(key, storage_class, local) {
	const args = {
		key,
		class: storage_class
	};

	return new Promise((resolve, reject) => {
		this.mogile.send(this.name, 'CREATE_OPEN', args, (err, response) => {
			if (err) {
				reject(err);
			} else {
				// Typical response: { devid: '95', fid: '504917521', path: 'http://127.0.0.1:7500/dev95/0/504/917/0504917521.fid' }
				fs.stat(local, (err, stat) => {
					if (err || !stat) {
						reject(err);
					} else {
						const path = url.parse(response.path);
						const options = {
							host: path.hostname,
							port: parseFloat(path.port),
							path: path.pathname,
							method: 'PUT',
							headers: {
								'Content-Length': stat.size
							}
						};
						const request = http.request(options);

						request.on('error', (err) => {
							reject(err);
						});
						
						const stream = fs.createReadStream(local, { bufferSize: 512 * 1024 });
						stream.pipe(request);

						stream.on('end', () => {
							request.end();

							const {devid, fid, path} = response;

							var args = {
								key,
								devid,
								fid,
								path,
								class: storage_class
							};

							this.mogile.send(this.name, 'CREATE_CLOSE', args, (err, response) => {
								if (err) {
									reject(err);
								}
								resolve(stat.size);
							});
						});
					}
				});
			}
		});
	});
}

/**
 * listkey is search keys option
 * Returns promise
 *
 * @param {String} prefix  Key prefix
 * @param {String} lastKey Optional. Last key
 * @param {String} limit Optional. Maximum number of keys to return
 * @return {Boolean}
 */

Domain.prototype.get_keys = function(prefix, lastKey, limit) {
	lastKey = lastKey || 0 ;
	limit   = limit || 9999999;
	
	const key_list = [];
	const args = {
		prefix,
		limit,
		after: lastKey
	};

	return new Promise((resolve, reject) => {
		this.mogile.send(this.name, 'list_keys', args, (err, response) => {
			if (err) {
				reject(err);
			} else {
				for (let i = 1; i < parseInt(response['key_count']) + 1; i++) {
					key_list.push(response[`key_${i}`]);		 
		  		}

				resolve(key_list);
			}
		});
	});
}

/**
 * Create class
 * Returns promise
 *
 * @param {String} key  class name
 * @param {String} mindevcount backup folds
 * @return {Boolean}
 */
Domain.prototype.createClass = function(key, mindevcount) {
    key = key || noop;
    mindevcount = mindevcount || 2;

    if (key === 'default') {
        return Error('Can\'t create default class');
    }

    const args = {
    	mindevcount,
        domain: this.name,
        class: key
    };

    return new Promise((resolve, reject) => {
    	this.mogile.send(this.name, 'CREATE_CLASS', args, (err, response) => {
	        if (err) {
	            reject(err);
	        } else {
	        	resolve(response);
	        }
	    });
    });
}

/**
 * Update class
 * Returns promise
 *
 * @param {String} key  class name
 * @param {String} mindevcount backup folds
 * @return {Boolean}
 */
Domain.prototype.updateClass = function(key, mindevcount) {
    key = key || noop;
    mindevcount = mindevcount || 2;

    if (key === 'default') {
        return Error('Can\'t create default class');
    }
    const args = {
    	mindevcount,
        domain: this.name,
        class: key,
        update: 1,
    };

    return new Promise((resolve, reject) => {
    	this.mogile.send(this.name, 'UPDATE_CLASS', args, (err, response) => {
	        if (err) {
	            reject(err);
	        } else {
        		resove(response);
	        }
	    });
    });
}

/**
 * Delete class
 * Returns promise
 *
 * @param {String} key  class name
 * @return {Boolean}
 */
Domain.prototype.deleteClass = function(key) {
    key = key || noop;

    if (key === 'default') {
        return Error('Can\'t delete default class');
    }
    const args = {
        domain: this.name,
        class: key
    };

    return new Promise((resolve, reject) => {
    	this.mogile.send(this.name, 'DELETE_CLASS', args, (err, response) => {
	        if (err) {
	            reject(err);
			} else {
				resolve(response);
			}
	    });
    });
}

/**
 * FileInfo Class
 * Returns promise
 *
 * @param key   get key information
 * @return {Boolean}
 */
Domain.prototype.fileInfo = function(key) {
    key = key || noop;
    const args = {
		domain: this.name,
        key: key
    };

    return new Promise((resolve, reject) => {
    	this.mogile.send(this.name, 'file_Info', args, (err, response) => {
	        if (err) {
	            reject(err);
		    } else {
		    	resolve(response);
		    }
	    });
    });
}

// Export the Domain class
module.exports = Domain;
