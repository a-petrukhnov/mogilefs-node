


##=======================================

This project was modified from:

https://github.com/headzoo/node-mogile.git,
https://github.com/Sean2755/MogileFS-ng

The main difference is Promises usage 
===========================================

## Installation

	npm install mogilefs-node

## Usage
	
	const mogile = require('mogilefs-node');
	
	// The createClient method takes an array of trackers
	const trackers = ['mogtracker1.server.net:7001', 'mogtracker2.server.net:7001'];
	
	// Create a new mogile client
	const client = mogile.createClient(trackers);
	
	// Get all the domains
	client.getDomains(function(err, domains) {
		if (err) {
			console.log('ERROR: ' + err);
		}
		console.log(domains);
	});
	
	// All of the commands that work within a domain use a Domain object
	const domain = client.domain('default');
	
	// Get all the paths for a given file
	domain.getPaths('my_file.txt', 0)
		.then(paths => {})
		.catch(error => {});
	
	// Getting the contents of a file, and storing it locally in /tmp/my_file.txt
	domain.getFile('my_file.txt', '/tmp/my_file.txt')
		.then(bytes_written => {})
		.catch(error => {});
	
	// Storing the file /tmp/my_file.txt in mogile using the key 'my_file.txt' in
	// the 'default' storage class.
	domain.storeFile('my_file.txt', 'default', '/tmp/my_file.txt')
		.then(bytes_written => {})
		.catch(error => {});
	
	// Deleting a file
	domain.del('my_file.txt')
		.then(response => {})
		.catch(error => {});
	
	// Renaming a file
	domain.rename('my_file.txt', 'your_file.txt')
		.then(response => {})
		.catch(error => {});

	// Search Key 
	domain.get_keys(prefix_key, null, null)
		.then(response => {})

## Using Transactions

	const mogile = require('mogilefs-node');
	const trackers = ['mogtracker1.server.net:7001', 'mogtracker2.server.net:7001'];
	const client = mogile.createClient(trackers);
	
	client.begin(); // Start the transaction
	
	const domain = client.domain('default');
	domain.storeFile('my_file.txt', 'default', '/tmp/my_file.txt')
		.then(bytes_written => {})
		.catch(error => {});
	
	domain.rename('my_file.txt', 'your_file.txt')
		.then(response => {})
		.catch(error => {
			client.rollback();
			return;
		});
	
	client.commit(); // Commit the changes
	
## TODO

* Check transactions because I am not shure they work properly


## License

(The MIT License)

Copyright (c) 2017 N3xt 

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
