'use strict';
const {TrustedApp} = require('evrythng-extended');
const epcis = require('./epcis');


module.exports.capture = async (events, context) => {
    const app = new TrustedApp(events.headers.Authorization.trim());
    const createdEvents = [];
    for (const event of JSON.parse(events.body).epcisBody.eventList) {
        let e = new epcis[event.isA](event, app);
        e.init();
        e._tags.push('DEBUG');
        createdEvents.push(await app.action('all').create(e.asEVTActionDocument()).then());
    }
    return {
        statusCode: 200,
        body: JSON.stringify(createdEvents.map(e => e.customFields)),
    };
};

module.exports.getEventTypes = async (events, context) => {

    return {
        statusCode: 200,
        body: JSON.stringify(Object.keys(epcis).filter(e => e.endsWith('Event'))),
    };
};


module.exports.getEvents = async (events, context) => {
    const app = new TrustedApp(events.headers.Authorization.trim());
    const epcisEventType = events.pathParameters.eventType;
    let returnEvents;
    if (epcisEventType === 'all') {
        returnEvents = await Promise.all(
            Object.keys(epcis)
                .filter(e => e.endsWith('Event'))
                .map(a => app.action('_' + a).read().then())).then()
    } else {
        returnEvents = await app.action('_' + epcisEventType).read().then();
    }
    return {
        statusCode: 200,
        body: JSON.stringify(returnEvents.filter(x=>x.length>0).map(x=>x).concat((x,y)=>x.concat(y))[0].filter(x=>x.hasOwnProperty('customFields')).map(x=>x.customFields)),
    }
};


module.exports.getEventById = async (events, context) => {
    const app = new TrustedApp(events.headers.Authorization.trim());
    const epcisEventType = events.pathParameters.eventType;
    const eventId = events.pathParameters.eventID.trim();
    let returnedEvent = await app.action('_' + epcisEventType).read({
        params: {
            filter: "identifiers.eventID=" + eventId
        }
    }).then();
    return {
        statusCode: 200,
        body: JSON.stringify(returnedEvent[0].customFields),
    }
};