'use strict';

const {TrustedApp} = require('evrythng-extended');
const epcisEvents = require('./epcisEvents');
const epcisquery = require('./epcisquery');
const fs = require('fs');

function loadEVTApp(headers) {
    if (headers.hasOwnProperty('Authorization') && headers.Authorization !== null) {
        return new TrustedApp(headers.Authorization.trim());
    }
    if (fs.existsSync('publicaccess.secret')) {
        return new TrustedApp(fs.readFileSync('publicaccess.secret').toString().trim());
    }
    throw "Cannot access EPCIS database. No api key available";
}

module.exports.capture = async (events, context) => {
    try {
        const app = loadEVTApp(events.headers);
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
    } catch (error) {
        return {
            statusCode: 400,
            body: JSON.stringify(error),
        }
    }
};

module.exports.getEventTypes = async (events, context) => {
    return {
        statusCode: 200,
        body: JSON.stringify(Object.keys(epcisEvents).filter(e => e.endsWith('Event'))),
    };
};

module.exports.getEvents = async (events, context) => {

    try {
        const app = loadEVTApp(events.headers);
        const epcisEventType = events.pathParameters.eventType;
        let evtQuery = epcisquery.simpleEventLookupQuery(epcisEventType);
        if (events.queryStringParameters !== null && events.queryStringParameters.hasOwnProperty('$filter')) {
            evtQuery += `&${epcisquery.filter(events.queryStringParameters['$filter'])}`;
            epcisquery.eventTypeConstraintConsistency(evtQuery);
        }
        let returnedEvents = [];
        returnedEvents = await app.action('all').read({
            params: {
                filter: evtQuery
            }
        }).then();
        if (returnedEvents.length > 0)
            returnedEvents = returnedEvents.map(x => x.customFields);
        return {
            statusCode: 200,
            body: JSON.stringify(returnedEvents)
        };
    } catch (error) {
        return {
            statusCode: 400,
            body: JSON.stringify(error),
        }

    }
};

module.exports.getEventById = async (events, context) => {
    try {
        const app = loadEVTApp(events.headers);
        const epcisEventType = events.pathParameters.eventType;
        let eventId = events.pathParameters.eventID;
        let returnedEvents = await app.action('all').read({
            params: {
                filter: epcisquery.simpleEventLookupQuery(epcisEventType, eventId)
            }
        }).then();
        if (returnedEvents.length > 0)
            returnedEvents = returnedEvents.map(x => x.customFields);
        return {
            statusCode: 200,
            body: JSON.stringify(returnedEvents),
        }
    } catch (error) {
        return {
            statusCode: 400,
            body: JSON.stringify(error),
        }

    }
};


module.exports.debug = async (events, context) => {


    return {
        statusCode: 200,
        body: JSON.stringify(events),
    }
};

