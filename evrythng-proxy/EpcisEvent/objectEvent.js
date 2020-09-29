'use strict';

const { EPCISEvent, addAction, observeAction, deleteAction } = require('./epcisEvents');

class ObjectEvent extends EPCISEvent {
  /**
   * @param {Array<string>} epcList - the list of things that have to be added
   */
  async addAction(epcList) {
    // console.log('object event start');
    this.collection = (await addAction(this.app)(epcList, false, this.bizLocation)).id;
    // console.log('object event stop');
  }

  /**
   *
   * @param {Array<string>} epcList - the list of things that have to be updated
   */
  async observeAction(epcList) {
    // console.log('observe action start');
    await observeAction(this.app)(epcList, this.bizLocation, this.sensorsValue);
    // console.log('observe action stop');
  }

  /**
   * @param {Array<string>} epcList - the list of things that have to be deleted
   */
  async deleteAction(epcList) {
    await deleteAction(this.app)(epcList);
  }
}

exports.ObjectEvent = ObjectEvent;
