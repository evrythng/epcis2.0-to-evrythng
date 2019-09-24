'use strict';

const {TrustedApp} = require('evrythng-extended');
const epcisEvents = require('./epcisEvents');
const epcisquery = require('./epcisquery');
const fs = require('fs');

const print = console.log;

function loadEVTApp(headers) {
    if (headers.Authorization !== undefined) {
        return new TrustedApp(headers.Authorization.trim());
    }
    if (fs.existsSync('publicaccess.secret')) {
        return new TrustedApp(fs.readFileSync('publicaccess.secret').toString().trim());
    }
    throw "Cannot access EPCIS database. No api key  available";
}

module.exports.capture = async (events, context) => {
    // return  {
    //         statusCode: 200,
    //         body: JSON.stringify(events)
    //     };




    try {
        const app = loadEVTApp(events.headers);

        const createdEvents = [];
        let body = JSON.parse(events.body);
        print('debug')
        // return {statusCode:200, body: JSON.stringify(body.epcisBody.eventList)}
        let i = 0;
        for (const event of body.epcisBody.eventList) {
            print('round start' + i);
            let e = new epcisEvents[event.isA](event, app);
            await e.init();
            createdEvents.push(await app.action('all').create(e.asEVTActionDocument()));
            print('round ' + ++i);
        }
        return {
            statusCode: 200,
            body: JSON.stringify(createdEvents.map(epcisEvents.printEvent)),
        };
    } catch (error) {
        return {
            statusCode: 400,
            body: error.message || JSON.stringify(error),
        }
    }
};

module.exports.getEventTypes = async (events, context) => {
    return {
        statusCode: 200,
        body: JSON.stringify(Object.keys(epcisEvents).filter(e => e.endsWith('Event')).filter(e=>e[0].toUpperCase() === e[0]))
    };
};



module.exports.getEvents = async (events, context) => {

    try {
        // print(JSON.stringify(events))
        const app = loadEVTApp(events.headers);
        let epcisEventType = events.pathParameters.eventType;
        // epcisEventType = epcisEventType.substring(0, epcisEventType.length - 1)

        let evtQuery = epcisquery.simpleEventLookupQuery(epcisEventType);

        if (events.queryStringParameters !== null) {

            evtQuery += `&${epcisquery.filter(epcisquery.encodeAsQueryString(events.queryStringParameters))}`;
            epcisquery.eventTypeConstraintConsistency(evtQuery);
            print(evtQuery)
        }

        let returnedEvents = await app.action('all').read({
            params: {
                filter: evtQuery
            }
        });
        if (returnedEvents.length > 0)
            returnedEvents = returnedEvents.map(epcisEvents.printEvent);
        return {
            statusCode: 200,
            body: JSON.stringify(returnedEvents)
        };
    } catch (error) {
        return {
            statusCode: 400,
            body: error.message || JSON.stringify(error),
        }

    }
};

module.exports.getEventById = async (events, context) => {
    try {
        const app = loadEVTApp(events.headers);
        let epcisEventType = events.pathParameters.eventType;
        // epcisEventType = epcisEventType.substring(0, epcisEventType.length - 1);
        let eventId = events.pathParameters.eventID;
        let returnedEvents = await app.action('all').read({
            params: {
                filter: epcisquery.simpleEventLookupQuery(epcisEventType, eventId)
            }
        });
        if (returnedEvents.length > 0)
            returnedEvents = returnedEvents.map(epcisEvents.printEvent);
        return {
            statusCode: 200,
            body: JSON.stringify(returnedEvents),
        }
    } catch (error) {
        return {
            statusCode: 400,
            body: error.message || JSON.stringify(error),
        }

    }
};


module.exports.debug = async (events, context) => {
    return {
        statusCode: 200,
        body: JSON.stringify(events),
    }
};

