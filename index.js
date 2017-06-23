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
// Wit.ai bot specific code

const wit = new Wit({
	accessToken: WIT_TOKEN,
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

	wit.message(
		messageText
	).then((context) => {
		handleWitSuccessResponse(context, senderId, messageText)
	})
	.catch((err) => {
		console.error('Oops! Got an error from Wit: ', err.stack || err)
	})
}

function handleWitSuccessResponse(context, fbSenderId, originalMessage) {
	let entities = context.entities
	var messageToSend = ''
	if (Object.keys(entities).length != 1) {
		console.log('Context entities for message \"', originalMessage, '\" does not equal 1 for context: ', context)
		messageToSend = 'I\'m not sure I understand what you\'re asking. You can try calling the Toll-Free HIV and AIDS Helpline and speak to a human - 0800-012-322'
		logAnalytics_WitHadNoEntityForQuestion(originalMessage)
	} else {
		let entityName =  Object.keys(entities)[0]
		console.log('Will send message for entity with name: ', entityName)
		messageToSend = messageForWitEntityName(entityName)
		logAnalytics_UserAskedQuestionEvent(entityName)
	}

	sendMessengerTextMessageToUserWithId(fbSenderId, messageToSend)
}

function messageForWitEntityName(entityName) {
	switch (entityName) {

		case 'can_you_get_hiv_from_oral_sex':
		return 'It\'s possible to get HIV from oral sex -- whether you are giving or getting oral sex'

		case 'can_you_get_hiv_from_anal_sex':
		return 'Yes. Anal sex without a condom is very risky behavior. Either sex partner can become infected with HIV. ' +
		'\n\nWhen you have anal sex, use a latex condom. ' +
		'They\'re more likely to break during anal than vaginal sex, so also use a lot of water-based lubricant to lower the chance of that happening.'

		case 'can_you_have_hiv_without_aids':
		return 'A person can have HIV for a long time without having AIDS. Most people don\'t look or feel sick when they first get HIV. ' +
		'They may not get sick for a long time. The virus can stay in their blood for years. At this stage, the person does not have AIDS. ' +
		'Usually people with HIV get sick only after five to ten years.'

		case 'can_you_still_have_sex':
		return 'You can still have sex if you have HIV. However, it is important to remember to use a condom.'

		case 'does_having_sex_with_a_virgin_cure_hiv':
		return 'No, having sex with a virgin does not cure HIV or AIDS. ' +
		'\n\nThere is no cure for HIV or AIDS yet, but it is still possible to live a long and healthy life.'

		case 'how_long_does_it_take_for_hiv_to_cause_aids':
		return 'How long it takes for AIDS symptoms to appear is different for each person. ' +
		'It depends on things like your health in general and how well you are taking care of yourself.' +
		'\n\n Usually people with HIV get sick only after five to ten years.' +
		'\n\n Remember, it is still possible to live a long and healthy life if you have HIV'

		case 'how_to_avoid_getting_hiv':
		return 'Always remember the following rules to keep safe from HIV:' +
		'\n\n1. Use a new condom every time you have sex. Unprotected sex spreads HIV!' +
		'\n2. Avoid touching blood with your bare hands.' +
		'\n3. Never touch a used injection needle, or a knife or a razor blade that has blood on it' +
		'\n4. Cover a fresh open cut or bleeding wound with a plaster or bandage.'

		case 'how_to_stay_healthy_with_hiv':
		return 'A person with HIV can stay healthy by:' +
		'\n1. Taking the required medicines regularly.' +
		'\n2. Eating fresh fruit and vegetables.' +
		'\n3. Exercising and playing sport, but also making sure to get plenty of rest.'

		case 'how_to_tell_if_you_have_hiv':
		return 'The only way to know for sure if a person has HIV is to have a blood test at a clinic or hospital. ' +
		'\n\nYou cannot tell if someone has HIV by looking at them. ' +
		'Many people who have HIV don\'t have any symptoms at all for many years.'

		case 'is_it_safe_to_get_an_injection':
		return 'It is safe to have an injection at a clinic or a hospital. ' +
		'Doctors and nurses use only sterile injection needles. ' +
		'Sterile means that it is so clean that it has no germs on it.'

		case 'is_there_a_cure_for_hiv_or_aids':
		return 'There is no cure for HIV or AIDS yet, but it is still possible to live a long and healthy life.' +
		'\n\n' + messageForWitEntityName('how_to_stay_healthy_with_hiv')

		case 'thank_you':
		return textMessageReplyForThankYou()

		case 'what_causes_aids':
		return 'HIV causes AIDS'

		case 'what_causes_hiv':
		return 'There are only three ways that people can get HIV:' +
		'\n 1. By having unprotected sex with someone who has HIV' +
		'\n 2. By allowing blood from an infected person to get into their own bloodstream. ' +
		'For instance, if a person with HIV uses a needle to inject drugs, and then shares the need with someone else, the virus can be passed on' +
		'\n 3. A mother with HIV can pass it on to her bahby during pregnancy, in childbirth, or by breast-feeding.' +
		'\n\n You *cannot* get HIV from someone sneezing or coughing near you. You also cannot get HIV by touching, hugging or kissing someone who has HIV or AIDS'

		case 'what_happens_when_you_have_hiv':
		return 'HIV slowly weakens the body\'s immune system. ' +
		'Five to ten years after getting the virus, the immune system becomes so weak that it can\'t defend the body against infections. ' +
		'The person with HIV then gets sick, usually with more than one illness. '

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

		case 'what_is_the_difference_between_hiv_and_aids':
		return 'There is a difference between HIV and AIDS. People who have HIV can stay healthy for a long time. ' +
		'They only start getting sick when their immune system is damaged and weak. We then say that they have AIDS.'

		case 'what_is_unprotected_sex':
		return 'Unprotected sex is any sex without a condom. Sometimes the condom might break or slip off during sex. This still counts as unprotected sex.' +
		'\n\nHaving unprotected sex puts you at risk of getting HIV. It is important to use a condom when having sex.'

		case 'what_should_i_eat':
		return 'People with HIV or AIDS should eat plenty of fresh fruit, vegetables, chicken and fish to stay healthy for as long as possible.' +
		'\n\nFresh vegetables and fruit are full of vitamins. Vitamins make the immune system strong, which helps your body to fight against illnesses.'

		case 'where_did_aids_come_from':
		return 'Nobody knows where HIV came from. Scientists think that it is a new germ that appeared only some years ago. ' +
		'HIV and AIDS were first identified in the early 1980s.'

		case 'where_to_get_tested':
		return 'You can get tested for HIV at your local clinic or hospital.'

		default:
		//Should not get here
		console.log('No message defined for entityName:', entityName);
		return ''
	}
}

function textMessageReplyForThankYou() {
	let randomNumber = Math.floor(Math.random() * 4)
	switch (randomNumber) {
		case 0:
		return 'You\'re welcome!'
		case 1:
		return 'I\'m happy to help 😊'
		case 2:
		return 'It\'s a pleasure 🤗'
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

// ----------------------------------------------------------------------------
// Analytics

function logAnalytics_UserAskedQuestionEvent(witEntityName) {
	request.post({
		url : "https://graph.facebook.com/823503547798776/activities",
		form: {
			event: 'CUSTOM_APP_EVENTS',
			custom_events: JSON.stringify([{
				_eventName: "user_asked_question",
				fb_description: witEntityName
			}]),
			advertiser_tracking_enabled: 0,
			application_tracking_enabled: 0,
		}
	}, function(err,httpResponse,body){
		console.log(httpResponse)
		console.log(body)
			if (err !==) {
				console.log('Error sending analytics event "user_asked_question". \n Error:', err)
			}
	});
}

function logAnalytics_WitHadNoEntityForQuestion(questionText) {
	request.post({
		url : "https://graph.facebook.com/823503547798776/activities",
		form: {
			event: 'CUSTOM_APP_EVENTS',
			custom_events: JSON.stringify([{
				_eventName: "wit_had_no_entity_for_question",
				fb_description: questionText
			}]),
			advertiser_tracking_enabled: 0,
			application_tracking_enabled: 0,
		}
	}, function(err,httpResponse,body){
		console.log(httpResponse)
		console.log(body)
			if (err !==) {
				console.log('Error sending analytics event "wit_had_no_entity_for_question". \n Error:', err)
			}
	});
}
