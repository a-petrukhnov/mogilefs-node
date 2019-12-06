
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
	client.getDomains()
		.then(response => {})
		.catch(error => {});
	
	// All of the commands that work within a domain use a Domain object
	const domain = client.domain('default');
	
	// Get all the paths for a given file
	domain.getPaths('my_file.txt', 0)
		.then(paths => {})
		.catch(error => {});
	
	// Getting the contents of a file, and storing it locally in /tmp/my_file.txt
	domain.get('my_file.txt', '/tmp/my_file.txt')
		.then(bytes => {})
		.catch(error => {});
	
	// Storing the file /tmp/my_file.txt in mogile using the key 'my_file.txt' in
	// the 'default' storage class.
	domain.save('my_file.txt', 'default', '/tmp/my_file.txt')
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
