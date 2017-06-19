'use strict'

const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')

const FB_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN
const WIT_TOKEN = process.env.WIT_AI_SERVER_TOKEN
const FB_HUB_VERIFY_TOKEN = process.env.FB_HUB_VERIFY_TOKEN

let Wit = null
let log = null
try {
	// if running from repo
	Wit = require('../').Wit
	log = require('../').log
} catch (e) {
	Wit = require('node-wit').Wit
	log = require('node-wit').log
}

// ----------------------------------------------------------------------------
// Messenger API specific code

// See the Send API reference
// https://developers.facebook.com/docs/messenger-platform/send-api-reference

const fbMessage = (id, text) => {
	const body = JSON.stringify({
		recipient: { id },
		message: { text },
	})
	const qs = 'access_token=' + encodeURIComponent(FB_TOKEN)
	return fetch('https://graph.facebook.com/v2.6/me/messages?' + qs, {
		method: 'POST',
		headers: {'Content-Type': 'application/json'},
		body,
	})
	.then(rsp => rsp.json())
	.then(json => {
		if (json.error && json.error.message) {
			throw new Error(json.error.message)
		}
		return json
	})
}

// ----------------------------------------------------------------------------
// Wit.ai bot specific code

// This will contain all user sessions.
// Each session has an entry:
// sessionId -> {fbid: facebookUserId, context: sessionState}

const sessions = {}

const findOrCreateSession = (fbid) => {
	let sessionId
	// Let's see if we already have a session for the user fbid
	Object.keys(sessions).forEach(k => {
		if (sessions[k].fbid === fbid) {
			// Yep, got it!
			sessionId = k
		}
	})
	if (!sessionId) {
		// No session found for user fbid, let's create a new one
		sessionId = new Date().toISOString()
		sessions[sessionId] = {fbid: fbid, context: {}}
	}
	return sessionId
}

// Our bot actions
const actions = {
	send({sessionId}, {text}) {
		// Our bot has something to say!
		// Let's retrieve the Facebook user whose session belongs to
		const recipientId = sessions[sessionId].fbid
		if (recipientId) {
			// Yay, we found our recipient!
			// Let's forward our bot response to her.
			// We return a promise to let our bot know when we're done sending
			return fbMessage(recipientId, text)
			.then(() => null)
			.catch((err) => {
				console.error(
					'Oops! An error occurred while forwarding the response to',
					recipientId,
					':',
					err.stack || err
				)
			})
		} else {
			console.error('Oops! Couldn\'t find user for session:', sessionId)
			// Giving the wheel back to our bot
			return Promise.resolve()
		}
	},
	// You should implement your custom actions here
	// See https://wit.ai/docs/quickstart
}

// Setting up our bot
const wit = new Wit({
	accessToken: WIT_TOKEN,
	actions,
	logger: new log.Logger(log.INFO)
})

// ----------------------------------------------------------------------------
const app = express()
app.set('port', (process.env.PORT || 5000))

app.use(({method, url}, rsp, next) => {
	rsp.on('finish', () => {
		console.log(`${rsp.statusCode} ${method} ${url}`)
	})
	next()
})

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
	if (req.query['hub.verify_token'] === FB_HUB_VERIFY_TOKEN_) {
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
	console.log("Received messaging events at webhook: ", messaging_events)
	for (let i = 0;  i < messaging_events.length;  i++) {
		let event = req.body.entry[0].messaging[i]
		forwardMessengerEventToWit(event)
	}
	res.sendStatus(200)
})

function forwardMessengerEventToWit(event) {
	if (!event.message || !event.message.text) {
		console.log("There was no event message! Did not forward to Wit")
		return
	}
	let messageText = event.message.text

	let senderId = event.sender.id
	let sessionId = findOrCreateSession(senderId)

	wit.message(
		messageText
	).then((context) => {
		handleWitSuccessResponse(context, senderId, sessionId, messageText)
	})
	.catch((err) => {
		console.error('Oops! Got an error from Wit: ', err.stack || err)
	})
}

function handleWitSuccessResponse(context, fbSenderId, sessionId, originalMessage) {
	let entities = context.entities
	var messageToSend = ''
	if (Object.keys(entities).length != 1) {
		console.log('Context entities for message \"', originalMessage, '\" does not equal 1 for context: ', context)
		messageToSend = 'I \'m not sure I understand what you\'re asking. You can try calling the Toll-Free HIV and AIDS Helpline and speak to a human - 0800-012-322'
	} else {
		let entityName =  Object.keys(entities)[0]
		console.log('Will send message for entity with name: ', entityName)
		messageToSend = messageForWitEntityName(entityName)

		// Based on the session state, you might want to reset the session.
		// This depends heavily on the business logic of your bot.
		// Example:
		// if (context['done']) {
		//   delete sessions[sessionId]
		// }

		// Updating the user's current session state
		sessions[sessionId].context = context
	}

	sendMessengerTextMessageToUserWithId(fbSenderId, messageToSend)
}

function messageForWitEntityName(entityName) {
	switch (entityName) {
		case 'what_causes_aids':
			return 'HIV causes AIDS'

		case 'what_causes_hiv':
			return 'There are only three ways that people can get HIV:' +
			'\n 1. By having unprotected sex with someone who has HIV' +
			'\n 2. By allowing blood from an infected person to get into their own bloodstream.' +
			'For instance, if a person with HIV uses a needle to inject drugs, and then shares the need with someone else, the virus can be passed on' +
			'\n 3. A mother with HIV can pass it on to her bahby during pregnancy, in childbirth, or by breast-feeding.'
			'\n\n You *cannot* get HIV from someone sneezing or coughing near you. You also can\'t get HIV by touching, hugging or holding hands with someone who has HIV or AIDS' 

		case 'what_is_aids':
			return "AIDS stands for Acquired Immune Deficiency Syndrome. " +
			'\n"Acquired" means something that you get. Most people get AIDS from having unprotected sex or by sharing needles to inject drugs ' +
			'\n\n"Immune Deficiency" means that the body\'s immune system becomes damaged. ' +
			'When the immune system is weak, the body cannot fight off illnesses the way it usually does.' +
			'\n\n"Syndrome" means that a person gets several illnesses all at once.'

		case 'what_is_an_immune_system':
			return 'Can you remember the last time you had a cold? ' +
			'For a while, your head ached, you coughed and you sniffed. ' +
			'Then the cold went away. This is because your body has an *immune system*. ' +
			'The immune system defends the body, and fights the germs and viruses that make you ill. ' +
			'But HIV attacks the immune system, and the body can no longer fight germs and infections'

		case 'what_is_hiv':
			return 'HIV stands for Human Immunodeficiency Virus. Let\' start with the short words: ' +
			'\n"Human" means that only people can get it. ' +
			'\nA "virus" is a type of germ that gets into a person\'s body. ' +
			'\n"Immunodeficiency" means that the body\'s immune system becomes weak' +
			'\n\n' + messageForWitEntityName('what_is_an_immune_system')

		case 'what_is_unprotected_sex'
		// TODO
			return ''
		default:
		//Should not get here
			return ''
	}
}

// ----------------------------------------------------------------------------

function sendMessengerTextMessageToUserWithId(id, text) {
	let messageData = { text:text }
	request({
		url: 'https://graph.facebook.com/v2.6/me/messages',
		qs: {access_token:FB_TOKEN},
		method: 'POST',
		json: {
			recipient: {id:id},
			message: messageData,
		}
	}, function(error, response, body) {
		if (error) {
			console.log('Error sending messages: ', error)
		} else if (response.body.error) {
			console.log('Error: ', response.body.error)
		} else {
			console.log("Sent text message to user ", id)
			console.log("Message", messageData)
		}
	})
}
