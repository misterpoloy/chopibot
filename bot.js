const { ActivityTypes, MessageFactory } = require('botbuilder');
const { LuisRecognizer, QnAMaker } = require('botbuilder-ai');
// Turn counter property
const TURN_COUNTER_PROPERTY = 'turnCounterProperty';
const WELCOMED_USER = 'DidBotWelcomeUser';

class ArlyBot {
    /**
     *
     * @param {ConversationState} conversation state object
     */
    constructor(conversationState, luisPredictionOptions, includeApiResults, endpoint, qnaOptions = {}) {
        // Creates a new state accessor property.
        this.luisRecognizer = new LuisRecognizer(luisPredictionOptions, includeApiResults, true);
        this.qnaMaker = new QnAMaker(endpoint, qnaOptions);
        // Custom properties
        this.countProperty = conversationState.createProperty(TURN_COUNTER_PROPERTY);
        this.welcomedUserPropery = conversationState.createProperty(WELCOMED_USER);
        this.conversationState = conversationState;
    }
    /**
     *
     * Use onTurn to handle an incoming activity, received from a user, process it, and reply as needed
     *
     * @param {TurnContext} on turn context object.
     */
    async onTurn(turnContext) {
        // Message activities may contain text, speech, interactive cards, and binary or unknown attachments.
        // see https://aka.ms/about-bot-activity-message to learn more about the message and other activity types
        if (turnContext.activity.type === ActivityTypes.Message) {
            let didBotWelcomeUser = await this.welcomedUserPropery.get(turnContext, false);

            if (didBotWelcomeUser === false) {
                // First message ever.
                let userName = turnContext.activity.from.name;
                const string = `${ userName }, te recuerdo que siempre ` +
                `puedes estar pendiente de nuestras últimas ofertas y ` +
                `promociones desde nuestra página en Facebook.`;

                await turnContext.sendActivity(string);
                await this.welcomedUserPropery.set(turnContext, true);
            }
            /** QNA **/
            const qnaResults = await this.qnaMaker.generateAnswer(turnContext.activity.text);

            // If an answer was received from QnA Maker, send the answer back to the user.
            if (qnaResults[0]) {
                await turnContext.sendActivity(qnaResults[0].answer);

            // If no answers were returned from QnA Maker, reply with help.
            } else {
                /** LUIS Start **/
                // Perform a call to LUIS to retrieve results for the user's message.
                const results = await this.luisRecognizer.recognize(turnContext);

                // Since the LuisRecognizer was configured to include the raw results, get the `topScoringIntent` as specified by LUIS.
                const topIntent = results.luisResult.topScoringIntent;

                if (topIntent.intent !== 'None') {
                    await turnContext.sendActivity(`LUIS Top Scoring Intent: ${ topIntent.intent }, Score: ${ topIntent.score }`);
                } else {
                    // If the top scoring intent was "None" tell the user no valid intents were found and provide help.
                    await turnContext.sendActivity('Esto es nuevo para mi, no he entendido lo que quieres decir 🤔');
                }
            /** LUIS END */
            }
            /** QNA END **/
        } else if (turnContext.activity.type === ActivityTypes.ConversationUpdate) {
            await this.sendWelcomeMessage(turnContext);
        } else {
            await turnContext.sendActivity(`[${ turnContext.activity.type } event detected.]`);
        }
        // Save state changes
        await this.conversationState.saveChanges(turnContext);
    }

    async sendWelcomeMessage(turnContext) {
        const activity = turnContext.activity;
        if (activity.membersAdded) {
        // Iterate over all new members added to the conversation.
            for (const idx in activity.membersAdded) {
                if (activity.membersAdded[idx].id !== activity.recipient.id) {
                    const welcomeMessage = `Hola ${ activity.membersAdded[idx].name } 😀! ` +
                      ` Mi nombre es ChopiBot, estoy para contestar preguntas ` +
                      `que tengas acerca de nuestra tienda o nuestros productos.`;
                    await turnContext.sendActivity(welcomeMessage);
                    await this.sendSuggestedActions(turnContext);
                }
            }
        }
    }

    async sendSuggestedActions(turnContext) {
        var reply = MessageFactory.suggestedActions(['¿Que es un bot?', '¿Cuál es su telefono?'], 'Estos son algunos ejemplos de lo que puedes decir');
        await turnContext.sendActivity(reply);
    }
}

exports.ArlyBot = ArlyBot;
