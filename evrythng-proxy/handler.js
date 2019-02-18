'use strict';
const {TrustedApp} = require('evrythng-extended');
const epcis = require('./epcis');


module.exports.capture = async (events, context) => {
    const app = new TrustedApp(events.headers.Authorization.trimEnd());
    const createdEvents = [];
    for (const event of JSON.parse(events.body).epcisBody.eventList) {
        let e = new epcis[event.isA](event, app);
        e.init();
        e._tags.push('DEBUG');
        createdEvents.push(await app.action('all').create(e.asEVTActionDocument()).then());
    }
    return {
        statusCode: 200,
        body: JSON.stringify(createdEvents),
    };
};
