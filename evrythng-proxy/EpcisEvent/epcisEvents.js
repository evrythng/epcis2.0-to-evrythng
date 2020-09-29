'use strict';

/* eslint-disable no-console */
const print = console.log;
/* eslint-enable no-console */

/**
 * Split the epc in two parts
 *
 * @param {string} epc - (ex : 'urn:epc:id:sgtin:0614141.107346.2017')
 * @returns {Array} (ex : [ 'urn:epc:id:sgtin', '0614141.107346.2017' ])
 */
const epcToTuple = (epc) => [
  epc.slice(0, epc.lastIndexOf(':')),
  epc.slice(epc.lastIndexOf(':') + 1),
];

/**
 *
 * @param {Evrythng Trusted App} app
 * @returns {Thng}
 */
const lookupGS1Thng = (app) => async (epc) => {
  const sgtinGtin = epc.split('.');
  const sgtin = sgtinGtin.pop();
  const gtin = sgtinGtin.join('');

  print(`sgtinGtin : ${sgtinGtin}`);
  print(`sgtin : ${sgtin}`);
  print(`gtin : ${gtin}`);

  let product = await app.product().read({
    params: {
      filter: `identifiers.gs1:01=${gtin}`,
    },
  });

  product = product.pop();
  if (Object.keys(product).length === 0) {
    throw Error(`gtin ${gtin} not found`);
  }
  return app.thng().read({
    params: {
      filter: `identifiers.gs1:21=${sgtin}&product=${product.id}`,
    },
  });
};

/**
 *
 * @param {Evrythng Trusted App} app
 * @returns {Place}
 */
const lookupPlace = (app) => async (epc) => {
  const identifier = epcToTuple(epc)[0];
  const _epc = epcToTuple(epc)[1];
  const place = await app.place().read({
    params: {
      filter: `${identifier}=${_epc}`,
    },
  });
  if (place.length > 1) {
    throw Error(`More than one entry found for ${epc}`);
  } else {
    return place;
  }
};

// see https://github.com/evrythng/gs1-digital-link-tools/blob/master/src/data/alpha-map.json
/* const alphaMap = {
  '01': 'gtin',
  8006: 'itip',
  8013: 'gmn',
  8010: 'cpid',
  410: 'shipTo',
  411: 'billTo',
  412: 'purchasedFrom',
  413: 'shipFor',
  414: 'gln',
  415: 'payTo',
  416: 'glnProd',
  8017: 'gsrnp',
  8018: 'gsrn',
  255: 'gcn',
  '00': 'sscc',
  253: 'gdti',
  401: 'ginc',
  402: 'gsin',
  8003: 'grai',
  8004: 'giai',
  22: 'cpv',
  10: 'lot',
  21: 'ser',
  8011: 'cpsn',
  254: 'glnx',
  8020: 'refno',
  8019: 'srin',
}; */

/**
 *
 * @param {Evrythng Trusted App} app
 * @returns {Place}
 */
const createOrLookupPlace = (app) => async (identifierEpc) => {
  // print('createOrLookupPlace');
  const identifier = identifierEpc[0];
  const epc = identifierEpc[1];

  let place = await app.place().read({
    params: {
      filter: `identifiers.${identifier}=${epc}`,
    },
  });

  if (place.length === 0) {
    const placeIdentifiers = {};
    print('createOrLookupPlace place len == 0');
    placeIdentifiers[identifier] = epc;
    place = await app.place().create({
      name: `Demo epcis place ${epc}. Please update me`,
      identifiers: placeIdentifiers,
      position: {
        type: 'Point',
        coordinates: [5.625, 21.94304553343818],
      },
    });
  }
  return [place];
};

/**
 *
 * @param {Evrythng Trusted App} app
 * @returns {Place}
 */
const createOrLookupGS1Place = (app) => async (epc) => {
  print('debug createOrLookupGS1Place ');
  let place = await lookupPlace(app)(epc);

  if (place.length === 0) {
    print('debug createOrLookupGS1Place place len == 0');
    const epcIdentifier = epcToTuple(epc)[1];
    place = await app.place().create({
      name: `Demo epcis place ${epcIdentifier}. Please update me`,
      identifiers: { identifier: epcIdentifier },
      position: {
        type: 'Point',
        coordinates: [5.625, 21.94304553343818],
      },
    });
  }
  return place;
};

/**
 * This function takes a gtin as parameter
 *
 * @param {Evrythng Trusted App} app
 * @returns {Product}
 */
const createOrLookupGS1ProductGtin = (app) => async (gtin) => {
  let product = await app.product().read({
    params: {
      filter: `identifiers.gs1:01=${gtin}`,
    },
  });

  if (product.length === 0) {
    product = await app.product().create({
      name: `epcis product gtin ${gtin}`,
      identifiers: { 'gs1:01': gtin },
    });

    return [product];
  }
  return product;
};

/**
 * This function takes an epc as parameter
 *
 * @param {Evrythng Trusted App} app
 * @returns {Product}
 */
const createOrLookupGS1Product = (app) => async (epc) => {
  const sgtinGtin = epc.split('.');
  sgtinGtin.pop(); // I pop the sgtin
  const gtin = sgtinGtin.join('');

  return createOrLookupGS1ProductGtin(app)(gtin);
};

/**
 *
 * @param {Evrythng Trusted App} app
 * @returns {Thng}
 */
const createOrLookupGS1Thng = (app) => async (epc) => {
  print(`debug createOrLookupGS1Thng ${epc}`);
  const sgtinGtin = epc.split('.');
  const sgtin = sgtinGtin.pop();
  let thng = null;
  try {
    thng = await lookupGS1Thng(app)(epc);
    if (thng.length !== 0) return thng;
  } catch (e) {
    // empty
  }
  const product = (await createOrLookupGS1Product(app)(epc)).pop();

  return app.thng().create({
    name: `epcis thng sgtin ${sgtin}`,
    identifiers: { 'gs1:21': sgtin },
    product: product.id,
  });
};

/**
 * Handle the EPCIS event that has ADD Action
 *
 * @param {Evrythng Trusted App} app
 * @returns {The created collection}
 */
const addAction = (app) => async (epcList, allowExisting, bizLocation) => {
  if (allowExisting === undefined) {
    allowExisting = false;
  }
  // print('epcisAddAction debug ');
  print(epcList);
  const withoutPrefix = epcList.map((epc) => epc.slice(epc.lastIndexOf(':') + 1));
  let productsGtins = withoutPrefix.map((epc) => epc.split('.').slice(0, 2)).map((s) => s.join(''));
  productsGtins = new Set(productsGtins);

  let promises = [];

  productsGtins.forEach((gtin) => {
    promises.push(createOrLookupGS1ProductGtin(app)(gtin));
  });

  await Promise.all(promises);

  if (
    !allowExisting &&
    (
      await Promise.all(
        epcList
          .map(epcToTuple)
          .map((e) => e[1])
          .map(lookupGS1Thng(app)),
      )
    ).join('').length !== 0
  ) {
    throw Error('Some thngs already exist. They cannot be added twice');
  }

  print('epcisAction 4');
  const thngs = await Promise.all(
    epcList
      .map(epcToTuple)
      .map((e) => e[1])
      .map(createOrLookupGS1Thng(app)),
  );
  if (bizLocation !== undefined) {
    promises = [];

    thngs.forEach((thng) => {
      promises.push(
        app
          .thng(thng.id)
          .locations()
          .update([{ place: bizLocation.id }]),
      );
    });

    await Promise.all(promises);
  }

  print('epcisAction 5');
  const collection = await app.collection().create({
    name: `epcis add event collection`,
  });
  await app
    .collection(collection.id)
    .thng()
    .update(thngs.map((t) => t.id));
  print('epcisAction 6');
  return collection;
};

/**
 * Handle the EPCIS event that has DELETE Action
 *
 * @param {Evrythng Trusted App} app
 */
const deleteAction = (app) => async (epcList) => {
  const withoutPrefix = epcList.map((epc) => epc.slice(epc.lastIndexOf(':') + 1));
  let productsGtins = withoutPrefix.map((epc) => epc.split('.').slice(0, 2)).map((s) => s.join(''));
  productsGtins = new Set(productsGtins);

  const promises = [];

  productsGtins.forEach(async (gtin) => {
    promises.push(async () => {
      const product = await app.product().read({
        params: {
          filter: `identifiers.gs1:01=${gtin}`,
        },
      });

      if (Object.keys(product).length === 0)
        throw Error(`Invalid EPC  because product ${gtin} does not exist.`);
    });
  });

  await Promise.all(promises);

  let thngs = await Promise.all(
    epcList
      .map(epcToTuple)
      .map((e) => e[1])
      .map(createOrLookupGS1Thng(app)),
  );
  thngs = thngs.reduce((x, y) => x.concat(y)).map((t) => t.id);
  print('deleteAction 3');
  if (thngs.length !== epcList.length) {
    throw Error('Could not find all the EPCs specified in the event');
  }
  await Promise.all(thngs.map((t) => t.delete()));
};

/**
 * Handle the EPCIS event that has OBSERVE action
 *
 * @param {Evrythng Trusted App} app
 */
const observeAction = (app) => async (epcList, bizLocation, sensorsValues) => {
  print('observeAction debug ');
  print(`sensors values : ${sensorsValues}`);
  const withoutPrefix = epcList.map((epc) => epc.slice(epc.lastIndexOf(':') + 1));
  let productsGtins = withoutPrefix.map((epc) => epc.split('.').slice(0, 2)).map((s) => s.join(''));
  print('observeAction debug 1');
  productsGtins = new Set(productsGtins);

  let promises = [];

  productsGtins.forEach(async (gtin) => {
    promises.push(async () => {
      const product = await app.product().read({
        params: {
          filter: `identifiers.gs1:01=${gtin}`,
        },
      });

      if (Object.keys(product).length === 0)
        throw Error(`Invalid EPC  because product ${gtin} does not exist.`);
    });
  });

  await Promise.all(promises);

  let thngs = await Promise.all(
    epcList
      .map(epcToTuple)
      .map((e) => e[1])
      .map(createOrLookupGS1Thng(app)),
  );

  if (thngs.length !== epcList.length) {
    throw Error('Could not find all the EPCs specified in the event');
  }

  // print('observe action 4');

  const { sensorReport } = sensorsValues[0];

  const propertiesPayload = [];
  const locationPayload = [
    {
      position: {
        type: 'Point',
        coordinates: [],
      },
    },
  ];

  sensorReport.forEach((report) => {
    const _key = report.type.slice(4);

    if (_key === 'Latitude') {
      locationPayload[0].position.coordinates.push(report.stringValue);
    } else if (_key === 'Longitude') {
      locationPayload[0].position.coordinates.unshift(report.stringValue); // I insert it at the beginning of the array because I need to have the longitude first and then the latitude
    } else {//It's not linked with the location, it's the
      let _value;

      if (report.value !== undefined) _value = report.value;
      else if (report.meanValue !== undefined) _value = report.meanValue;
      else if (report.stringValue !== undefined) _value = report.stringValue;
      else if (report.maxValue !== undefined && report.minValue !== undefined)
        _value = (report.maxValue + report.minValue) / 2;
      else _value = 'Unhandled case in sensor report';

      propertiesPayload.push({
        key: _key,
        value: _value,
      });
    }
  });

  if (bizLocation !== undefined) {
    await Promise.all(
      thngs.map((t) =>
        app
          .thng(t.id)
          .locations()
          .update([{ place: bizLocation.id }]),
      ),
    );
  }

  promises = [];

  // for each thngs in the EPC list, I update the properties
  thngs.forEach((thng) => {
    promises.push(app.thng(thng[0].id).property().update(propertiesPayload));
  });

  await Promise.all(promises);

  if (locationPayload[0].position.coordinates.length === 2) {
    // If I have an element in the coordinates field, that means I have to update the location in EVRYTHNG cloud
    // print(`update location with ${locationPayload}`);

    promises = [];

    thngs.forEach((thng) => promises.push(app.thng(thng[0].id).locations().update(locationPayload)));

    await Promise.all(promises);
  }

};

/**
 * A class that represents an EPCIS event
 */
class EPCISEvent {
  /* eslint-disable require-jsdoc */

  get collection() {
    return this._collection;
  }

  set collection(value) {
    this._collection = value;
  }

  get event() {
    return this._customFields;
  }

  set event(value) {
    this._customFields = value;
  }

  get timestamp() {
    return this._timestamp;
  }

  set timestamp(value) {
    this._timestamp = value;
  }

  get identifiers() {
    return this._identifiers;
  }

  set identifiers(value) {
    this._identifiers = value;
  }

  get tags() {
    return this._tags;
  }

  set tags(value) {
    this._tags = value;
  }

  get customFields() {
    return this._customFields;
  }

  set customFields(value) {
    this._customFields = value;
  }

  get type() {
    return this._type;
  }

  set type(value) {
    this._type = value;
  }

  get location() {
    return this._location;
  }

  set location(value) {
    this._location = value;
  }

  set locationSource(value) {
    this._locationSource = value;
  }

  get locationSource() {
    return this._locationSource;
  }

  async addAction(epcList) {
    print('event top class start');
    this.collection = (await addAction(this.app)(epcList, true, this.bizLocation)).id;
    print('event top class stop');
  }

  async observeAction(epcList) {
    print('obsreve action start');
    this.collection = (await observeAction(this.app)(epcList, this.bizLocation)).id;
    print('obsreve action stop');
  }

  /* eslint-disable class-methods-use-this */
  /* eslint-disable no-unused-vars */
  async deleteAction(epcList) {
    throw Error('deleteAction not implemented');
  }
  /* eslint-disable class-methods-use-this */
  /* eslint-disable no-unused-vars */

  /* eslint-enable require-jsdoc */

  /**
   *
   * @param {JSON} event - The EPCIS event
   * @param {EVRYTHNG Trusted App} app
   */
  constructor(event, app) {
    this._timestamp = new Date();
    this._identifiers = {};
    this._tags = [];
    this._customFields = {};
    this._type = null;
    this._location = null;
    this.number = 8;

    this._locationSource = null;
    this._collection = null;

    this.sensorsValue = [];

    this.app = app;
    this._customFields = event;
    this._type = `_${event.isA}`;
    if (
      Object.prototype.hasOwnProperty.call(event, 'eventID') ||
      Object.prototype.hasOwnProperty.call(event, 'eventId')
    ) {
      this._identifiers.eventID = event.eventID;
    }
    if (Object.prototype.hasOwnProperty.call(event, 'eventTime')) {
      this.timestamp = new Date(event.eventTime).getTime();
    }
    if (Object.prototype.hasOwnProperty.call(event, 'bizStep')) {
      this.tags.push(`bizStep:${event.bizStep}`);
    }

    this.tags.push(`readPoint:${event.readPoint}`);
    this.tags.push(`epcisAction:${event.action}`);
    if (Object.prototype.hasOwnProperty.call(event, 'bizLocation')) {
      this.tags.push(`bizLocation:${event.bizLocation}`);
    }

    if (Object.prototype.hasOwnProperty.call(event, 'sensorElementList')) {
      this.sensorsValue = event.sensorElementList;
    }
  }

  /**
   * It does all the stuff that need to be done in reaction to the EPCIS object that we get
   */
  async init() {
    const event = this._customFields;

    let readPoint;
    if (Object.prototype.hasOwnProperty.call(event, 'readPoint'))
      readPoint = (await createOrLookupPlace(this.app)(epcToTuple(event.readPoint))).pop();

    this.locationSource = 'place';

    if (readPoint) {
      this.location = {
        place: readPoint.id,
      };
    }

    if (Object.prototype.hasOwnProperty.call(event, 'bizLocation'))
      this.bizLocation = (await createOrLookupPlace(this.app)(epcToTuple(event.bizLocation))).pop();

    print(`debug init EPCISEvent start ${JSON.stringify(event)}`);
    print(`${event.action.toLowerCase()}Action`);
    await this[`${event.action.toLowerCase()}Action`](event.epcList); // call the right action
    print(`debug init EPCISEvent stop ${JSON.stringify(this)}`);
  }

  /**
   * @returns {JSON} The object as EVT document
   */
  asEVTActionDocument() {
    const out = {};
    Object.getOwnPropertyNames(this).forEach((k) => {
      if (k !== 'app') {
        out[k.slice(1)] = this[k];
      }
    });
    print(`asEVTActionDocument ${JSON.stringify(out)}`);
    return out;
  }
}

module.exports = {
  createOrLookupGS1Thng,
  createOrLookupGS1Product,
  createOrLookupGS1Place,
  EPCISEvent,
  addAction,
  observeAction,
  deleteAction,
  printEvent: (eventAction) => {
    const customFields = eventAction.customFields || {};
    // recordTime is required by EPCIS. Since this timestamp is created by the backend, it will not be in a custom field.
    customFields.recordTime = new Date(eventAction.createdAt).toISOString();
    return customFields;
  },
};
