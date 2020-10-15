'use strict';

const querystring = require('querystring');
const epcisEvents = require('./EpcisEvent/index');

function parseArgsList(args) {
  return args
    .replace(/[()]/g, '')
    .trim()
    .split(',')
    .map((s) => s.trim());
}

function tokenizeExp(exp) {
  const idx = {};
  for (let i = exp.length; i >= 0; i -= 1) idx[exp[i]] = i;
  if ('_' in idx)
    return [exp.slice(0, idx._), exp.slice(idx._ + 1, idx['=']), exp.slice(idx['='] + 1)];
  return [exp.slice(0, idx['=']), undefined, exp.slice(idx['='] + 1)];
}

function expandList(leftArg, op, rightArgs, prefix) {
  if (prefix === undefined) prefix = '';
  const rightArg = `${prefix}${rightArgs.pop()}`;
  if (rightArgs.length === 0) {
    return `${leftArg}${op}${rightArg}`;
  }
  return `${expandList(leftArg, op, rightArgs, prefix)},${rightArg}`;
}

const operatorMapping = {
  eq: (x, y, r) => `${x}=${r || ''}${y}`,
  exists: (x, y, r) => {
    return expandList(x, '=', parseArgsList(y), r);
  },
  gt: (x, y, r) => `${x}>${r || ''}${y}`,
  ge: (x, y, r) => `${x}>=${r || ''}${y}`,
  lt: (x, y, r) => `${x}<${r || ''}${y}`,
  le: (x, y, r) => `${x}<${r || ''}${y}`,
};

exports.filter = (query) => {
  query = querystring.unescape(query);
  query = query.replace(/['"]/g, '');

  const queryTokens = [];

  query.split('&').forEach((exp) => {
    const tokens = tokenizeExp(exp);
    let op;
    let left;
    let right;
    let prefix = '';
    if (tokens !== null) {
      op = tokens[0].toLowerCase();
      left = tokens[1];
      right = tokens[2];

      switch (left) {
        case 'eventType':
          left = 'type';
          prefix = '_';
          break;
        case 'eventTime':
          left = 'timestamp';
          right = new Date(right).getTime();
          break;
        case 'recordTime':
          left = 'timestamp';
          right = new Date(right).getTime();
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
          prefix = 'readPoint:';
          break;
        case 'bizLocation':
          left = 'tags';
          prefix = 'bizLocation:';
          break;
        case 'bizStep':
          left = 'tags';
          prefix = 'bizStep:';
      }

      queryTokens.push(operatorMapping[op](left, right, prefix));
    }
  });

  return queryTokens.join('&');
};

function isSubset(array, set) {
  if (array.length > set.size) return false;
  for (const e of array) {
    if (!set.has(e)) return false;
  }
  return true;
}

exports.eventTypeConstraintConsistency = (query) => {
  let attr;
  let eventTypesSet = null;

  for (const exp of query.split('&')) {
    const tokens = exp.split('=');

    [attr] = tokens;

    if (attr === 'type') {
      if (eventTypesSet === null) {
        eventTypesSet = new Set(tokens[1]);
      } else if (!isSubset(tokens[1], eventTypesSet)) {
        return false;
      }
    }
  }

  return true;
};


exports.simpleEventLookupQuery = (epcisEventType, eventID) => {
  if (epcisEventType === undefined) {
    throw new Error('EPCIS event type cannot be empty');
  }
  let eventTypes = [];

  if (epcisEventType === 'all') {
    eventTypes = Object.keys(epcisEvents).filter(
        e => e.endsWith('Event')).filter(e => e[0].toUpperCase() === e[0]).filter(e => !(e === "EPCISEvent" || e === "printEvent"));
  } else {
    eventTypes = epcisEventType.split(',');
  }
  eventTypes = eventTypes.map((a) => a.trim()).map((a) => `_${a}`);
  let query = 'type=';
  for (let i = 0; i < eventTypes.length; i += 1)
    query += `${eventTypes[i]}${(i < eventTypes.length - 1 && ',') || ''}`;
  if (eventID !== undefined) query += `&identifiers.eventID=${eventID}`;
  return query;
};

exports.encodeAsQueryString = (d) => {
  return Object.keys(d)
    .map((k) => `${k}=${d[k]}`)
    .join('&');
};
