'use strict';

const {TrustedApp} = require('evrythng-extended');
const epcisEvents = require('./epcisEvents');
const epcisquery = require('./epcisquery');


module.exports.capture = async (events, context) => {
    const app = new TrustedApp(events.headers.Authorization.trim());
    const createdEvents = [];
    for (const event of JSON.parse(events.body).epcisBody.eventList) {
        let e = new epcisEvents[event.isA](event, app);
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
        body: JSON.stringify(Object.keys(epcisEvents).filter(e => e.endsWith('Event'))),
    };
};


module.exports.getEvents = async (events, context) => {
    console.log(JSON.stringify(events));
    const app = new TrustedApp(events.headers.Authorization.trim());
    const epcisEventType = events.pathParameters.eventType;

    let evtQuery = epcisquery.simpleEventLookupQuery(epcisEventType);
    if (events.queryStringParameters!==null && events.queryStringParameters.hasOwnProperty('$filter')) {
        evtQuery+=`&${epcisquery.filter(events.queryStringParameters['$filter'])}`;
        epcisquery.eventTypeConstraintConsistency(evtQuery);
    }
    let returnedEvents = [];
    returnedEvents = await app.action('all').read({
        params: {
            filter: evtQuery
        }
    }).then();
    if (returnedEvents.length>0)
        returnedEvents = returnedEvents.map(x => x.customFields);
    return {
        statusCode: 200,
        body: JSON.stringify(returnedEvents)
    };
};


module.exports.getEventById = async (events, context) => {
    console.log(JSON.stringify(events))
    const app = new TrustedApp(events.headers.Authorization.trim());
    const epcisEventType = events.pathParameters.eventType;
    let eventId = events.pathParameters.eventID;

    let returnedEvents = await app.action('all').read({
        params: {
            filter: epcisquery.simpleEventLookupQuery(epcisEventType, eventId)
        }
    }).then();
    if (returnedEvents.length>0)
        returnedEvents = returnedEvents.map(x => x.customFields);
    return {
        statusCode: 200,
        body: JSON.stringify(returnedEvents),
    }
};


module.exports.debug = async (events, context) => {
    console.log(JSON.stringify(events));

    return {
        statusCode: 200,
        body: JSON.stringify(events),
    }
};

