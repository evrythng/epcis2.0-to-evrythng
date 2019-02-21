'use strict';

const querystring = require('querystring');
const epcisEvents = require('./epcisEvents');

const operatorMapping = {
    'eq': (x, y) => `${x}=${y}`,
    'in': (x, y, r) => {
        return expandList(x, '=', parseArgsList(y), r)
    },
    'gt': (x, y) => `${x}>${y}`,
    'ge': (x, y) => `${x}>=${y}`,
    'lt': (x, y) => `${x}<${y}`,
    'le': (x, y) => `${x}<${y}`,
};

function binaryExp(exp) {
    const operators = new Set(Object.keys(operatorMapping).map(x=>` ${x} `));
    let op = null;
    let j = null;
    for (let i = exp.length; i >= 0; i--) {
        j = i - 4;
        if (j >= 0 && operators.has(exp.slice(j, i))) {
            op = exp.slice(j, i);
            return [op.trim(), exp.slice(0, j).trim(), exp.slice(i,)];
        }
    }
    return null;
}

function expandList(leftArg, op, rightArgs, rightPrefix) {
    if (rightPrefix === undefined)
        rightPrefix = '';
    let rightArg = `${rightPrefix}${rightArgs.pop()}`;
    if (rightArgs.length === 0) {
        return `${leftArg}${op}${rightArg}`
    } else {
        return `${expandList(leftArg, op, rightArgs, rightPrefix)},${rightArg}`
    }
}

function parseArgsList(args) {
    return args.replace(/[()]/g, "").trim().split(',')
}



exports.filter = query => {
    query = querystring.unescape(query);
    query = query.replace(/['"]/g, "");
    let queryTokens = [];
    let op;
    let left;
    let right;
    let rightPrefix = '';
    for (const exp of query.split('&')) {
        let tokens = binaryExp(exp);

        if (tokens !== null) {
            op = tokens[0];
            left = tokens[1];
            right = tokens[2];

            switch (left) {
                case 'eventType':
                    left = 'type';
                    rightPrefix = "_";
                    break;
                case 'time':
                    left = 'timestamp';
                    break;
                case 'recordTime':
                    left = 'timestamp';
                    break;
                case 'eventID':
                    left = 'identifiers.eventID';
                    break;
                case 'action':
                    left = 'tags';
                    right = `epcisAction:${right}`;
                    break;
                case 'readPoint':
                    left = 'tags';
                    rightPrefix = 'readPoint:';
                    break;
            }
            queryTokens.push(operatorMapping[op](left, right, rightPrefix));
        }
    }
    return queryTokens.join('&')
};

function isSubset(array, set) {
    if (array.length > set.size)
        return false;
    for (let e of array) {
        if (!set.has(e))
            return false;
    }
    return true;
}

exports.eventTypeConstraintConsistency = query => {

    let attr;
    let eventTypesSet = null;

    for (const exp of query.split('&')) {
        let tokens = exp.split('=');

        attr = tokens[0];

        if (attr!=='type') {
            continue;
        }

        if (eventTypesSet===null) {
            eventTypesSet = new Set(tokens[1]);
            continue;
        }
        if (!isSubset(tokens[1], eventTypesSet)) {
            return false;
        }
    }
    return true;
};

exports.simpleEventLookupQuery = (epcisEventType, eventID) => {
    if (epcisEventType === undefined) {
        throw "EPCIS event type cannot be empty";
    }
    let eventTypes = [];
    if (epcisEventType === 'all') {
        eventTypes = Object.keys(epcisEvents).filter(e => e.endsWith('Event'));
    } else {
        eventTypes = epcisEventType.split(',');
    }
    eventTypes = eventTypes.map(a => a.trim()).map(a => '_' + a);
    let query = 'type=';
    for (let i = 0; i < eventTypes.length; i++)
        query += `${eventTypes[i]}${(i < eventTypes.length - 1) && ',' || ''}`;
    if (eventID !== undefined)
        query += `&identifiers.eventID=${eventID}`;
    return query;
};
