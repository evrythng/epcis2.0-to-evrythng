'use strict';

const epcisEvent = require('./epcisEvents');

class AggregationEvent extends epcisEvent.EPCISEvent {
  /**
   * @param {Array<string>} epcList
   * @returns {Promise<void>}
   */
  async deleteAction(epcList) {
    await epcisEvent.deleteAction(this.app)(epcList);
  }
}

exports.AggregationEvent = AggregationEvent;
