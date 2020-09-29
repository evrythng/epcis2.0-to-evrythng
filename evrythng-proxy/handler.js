'use strict';

const evrythng = require('evrythng');
const fs = require('fs');
const epcisEvents = require('./EpcisEvent/index');
const epcisquery = require('./epcisquery');

const print = console.log;

/**
 * @param {JSON} headers - headers of the request
 * @returns {TrustedApplication|Ze} The EVT Trusted App
 */
function loadEVTApp(headers) {
  if (headers.Authorization !== undefined) {
    return new evrythng.TrustedApplication(headers.Authorization.trim());
  }
  if (fs.existsSync('publicaccess.secret')) {
    return new evrythng.TrustedApplication(
      fs.readFileSync('publicaccess.secret').toString().trim(),
    );
  }
  throw Error('Cannot access EPCIS database. No api key available');
}

/**
 * Handle the capture request
 *
 * @param {JSON} epcisBody
 * @param {TrustedApplication} app
 * @returns {Promise<[]>}
 */
const handleCapture = async (epcisBody, app) => {
  const createdEvents = [];

  // I handle each event that are in the EPCIS message
  for (const event of epcisBody.eventList) {
    const e = new (epcisEvents.mapEventTypeToClass(event.isA))(event, app);
    await e.init();
    createdEvents.push(await app.action('all').create(e.asEVTActionDocument()));
  }

  return createdEvents;
};

module.exports.capture = async (events, context) => {
  try {
    const body = JSON.parse(events.body);

    const app = loadEVTApp(events.headers);
    const createdEvents = await handleCapture(body.epcisBody, app);

    return {
      statusCode: 200,
      body: JSON.stringify(createdEvents.map(epcisEvents.printEvent)),
    };
  } catch (error) {
    return {
      statusCode: 400,
      body: error.message || JSON.stringify(error),
    };
  }
};

module.exports.getEventTypes = async (event) => {
  return {
    statusCode: 200,
    body: JSON.stringify(
        Object.keys(epcisEvents).filter(
            e => e.endsWith('Event')).filter(e => e[0].toUpperCase() === e[0]).filter(e => !(e === "EPCISEvent" || e === "printEvent")),
    ),
  };
};

module.exports.getEvents = async (events, context) => {
  try {
    print(JSON.stringify(events));
    const app = loadEVTApp(events.headers);
    const epcisEventType = events.pathParameters.eventType;
    // epcisEventType = epcisEventType.substring(0, epcisEventType.length - 1)

    let evtQuery = epcisquery.simpleEventLookupQuery(epcisEventType);

    if (events.queryStringParameters !== null) {
      evtQuery += `&${epcisquery.filter(
        epcisquery.encodeAsQueryString(events.queryStringParameters),
      )}`;
      epcisquery.eventTypeConstraintConsistency(evtQuery);
      print(evtQuery);
    }

    let returnedEvents = await app.action('all').read({
      params: {
        filter: evtQuery,
      },
    });
    if (returnedEvents.length > 0) returnedEvents = returnedEvents.map(epcisEvents.printEvent);
    return {
      statusCode: 200,
      body: JSON.stringify(returnedEvents),
    };
  } catch (error) {
    return {
      statusCode: 400,
      body: error.message || JSON.stringify(error),
    };
  }
};

module.exports.getEventById = async (events, context) => {
  try {
    const app = loadEVTApp(events.headers);
    const epcisEventType = events.pathParameters.eventType;
    const eventId = events.pathParameters.eventID;
    let returnedEvents = await app.action('all').read({
      params: {
        filter: epcisquery.simpleEventLookupQuery(epcisEventType, eventId),
      },
    });
    if (returnedEvents.length > 0) returnedEvents = returnedEvents.map(epcisEvents.printEvent);
    return {
      statusCode: 200,
      body: JSON.stringify(returnedEvents),
    };
  } catch (error) {
    return {
      statusCode: 400,
      body: error.message || JSON.stringify(error),
    };
  }
};

module.exports.debug = async (events, context) => {
  return {
    statusCode: 200,
    body: JSON.stringify(events),
  };
};
