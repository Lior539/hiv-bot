'use strict'

const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')
const app = express()

const token = process.env.FB_PAGE_ACCESS_TOKEN

app.set('port', (process.env.PORT || 5000))

// Process application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}))

// Process application/json
app.use(bodyParser.json())

// Index route
app.get('/', function (req, res) {
	res.send('Hello world, I am a chat bot')
})

// for Facebook verification
app.get('/webhook/', function (req, res) {
	if (req.query['hub.verify_token'] === 'hiv-bot-secret-password-@18') {
		res.send(req.query['hub.challenge'])
	}
	res.send('Error, wrong token')
})

// Spin up the server
app.listen(app.get('port'), function() {
	console.log('running on port', app.get('port'))
})

// Process messages
app.post('/webhook/', function (req, res) {
	let messaging_events = req.body.entry[0].messaging
	for (let i = 0; i < messaging_events.length; i++) {
		let event = req.body.entry[0].messaging[i]
		let sender = event.sender.id
		if (event.message && event.message.text) {
			let text = event.message.text
			sendTextMessage(sender, "Text received, echo: " + text.substring(0, 200))
		}

	}
	var data = req.body;

	// Iterate over each entry - there may be multiple if batched
	data.entry.forEach(function(entry) {
		var pageID = entry.id;
		var timeOfEvent = entry.time;

		// Iterate over each messaging event
		entry.messaging.forEach(function(event) {
			if (event.message) {
				receivedMessage(event);
			} else {
				console.log("Webhook received unknown event: ", event);
			}
		});

		res.sendStatus(200)
	})

	function receivedMessage(event) {
		var senderID = event.sender.id;
		var recipientID = event.recipient.id;
		var timeOfMessage = event.timestamp;
		var message = event.message;

		console.log("Received message for user %d and page %d at %d with message:",
		senderID, recipientID, timeOfMessage);
		console.log(JSON.stringify(message));
	}

	function sendTextMessage(sender, text) {
		let messageData = { text:text }
		request({
			url: 'https://graph.facebook.com/v2.6/me/messages',
			qs: {access_token:token},
			method: 'POST',
			json: {
				recipient: {id:sender},
				message: messageData,
			}
		}, function(error, response, body) {
			if (error) {
				console.log('Error sending messages: ', error)
			} else if (response.body.error) {
				console.log('Error: ', response.body.error)
			}
		})
	}
