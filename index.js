'use strict'

const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')
const app = express()

const fbToken = process.env.FB_PAGE_ACCESS_TOKEN
const witToken = process.env.WIT_AI_SERVER_TOKEN

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
		receivedMessengerEvent(event)
	}
	res.sendStatus(200)
})

function receivedMessengerEvent(event) {
	console.log("Received message: ", event.message)

	let senderId = event.sender.id
	if (event.message && event.message.text) {
		let text = event.message.text
		sendTextMessage(senderId, "Text received, echo: " + text.substring(0, 200))
	}
}

function sendTextMessage(senderId, text) {
	let messageData = { text:text }
	request({
		url: 'https://graph.facebook.com/v2.6/me/messages',
		qs: {access_token:fbToken},
		method: 'POST',
		json: {
			recipient: {id:senderId},
			message: messageData,
		}
	}, function(error, response, body) {
		if (error) {
			console.log('Error sending messages: ', error)
		} else if (response.body.error) {
			console.log('Error: ', response.body.error)
		} else {
			console.log("Sent text message to user ", senderId);
			console.log("Message", messageData);
		}
	})
}
