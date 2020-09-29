'use strict';

const {
  EPCISEvent,
  deleteAction,
  observeAction,
  addAction,
  createOrLookupGS1Place,
  createOrLookupGS1Product,
  createOrLookupGS1Thng,
  printEvent,
} = require('./epcisEvents');
const { ObjectEvent } = require('./objectEvent');
const { AggregationEvent } = require('./aggregationEvent');

/**
 * @param {string} eventType - The field 'isA' of a EPCIS Document
 * @returns {Class} the EPCISEvent subclass that corresponds to the eventType field
 */
function mapEventTypeToClass(eventType) {
  switch (eventType) {
    case 'ObjectEvent':
      return ObjectEvent;
    case 'AggregationEvent':
      return AggregationEvent;
    default:
      throw new Error('The eventType is not handled by the proxy!');
  }
}

module.exports = {
  mapEventTypeToClass,
  EPCISEvent,
  ObjectEvent,
  AggregationEvent,
  deleteAction,
  observeAction,
  addAction,
  createOrLookupGS1Place,
  createOrLookupGS1Product,
  createOrLookupGS1Thng,
  printEvent,
};
