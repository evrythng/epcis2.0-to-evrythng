'use strict';


const print = console.log

const epcToTuple = epc => [epc.slice(0, epc.lastIndexOf(':')), epc.slice(epc.lastIndexOf(':') + 1,)]


const lookupGS1Thng = app => async epc => {

    let sgtinGtin = epc.split('.');
    let sgtin = sgtinGtin.pop();
    let gtin = sgtinGtin.join('');

    let product = await app.product().read({
        params: {
            filter: "identifiers.gs1:01=" + gtin
        }
    }).then();

    product = product.pop();
    if (Object.keys(product).length === 0) {
        throw Error(`gtin ${gtin} not found`);
    }
    let thng = await app.thng().read({
        params: {
            filter: "identifiers.gs1:21=" + sgtin + "&product=" + product.id
        }
    }).then();

    return thng;
};

const lookupPlace = app => async epc => {
    const identifier = epcToTuple(epc)[0];
    const _epc = epcToTuple(epc)[1];
    let place = await app.place().read({
        params: {
            filter: `${identifier}=${_epc}`
        }
    }).then();
    if (place.length > 1) {
        throw Error('More than one entry found for ' + epc);
    } else {
        return place;
    }
};


// see https://github.com/evrythng/gs1-digital-link-tools/blob/master/src/data/alpha-map.json
const alphaMap = {
    "01": "gtin",
    "8006": "itip",
    "8013": "gmn",
    "8010": "cpid",
    "410": "shipTo",
    "411": "billTo",
    "412": "purchasedFrom",
    "413": "shipFor",
    "414": "gln",
    "415": "payTo",
    "416": "glnProd",
    "8017": "gsrnp",
    "8018": "gsrn",
    "255": "gcn",
    "00": "sscc",
    "253": "gdti",
    "401": "ginc",
    "402": "gsin",
    "8003": "grai",
    "8004": "giai",
    "22": "cpv",
    "10": "lot",
    "21": "ser",
    "8011": "cpsn",
    "254": "glnx",
    "8020": "refno",
    "8019": "srin"
};

const createOrLookupPlace = app => async (identifierEpc) => {

    print('createOrLookupPlace')
    const identifier = identifierEpc[0];
    const epc = identifierEpc[1];
    const invIdx = {};
    for (let a in alphaMap)
        invIdx[alphaMap[a]] = a


    let place = await app.place().read({
        params: {
            filter: `identifiers.${identifier}=${epc}`
        }
    });

    if (place.length === 0) {
        let placeIdentifiers = {}
        print('createOrLookupPlace place len == 0')
        placeIdentifiers[identifier] = epc;
        place = await app.place().create({
            name: `Demo epcis place ${epc}. Please update me`,
            identifiers:  placeIdentifiers,
            "position": {
                "type": "Point",
                "coordinates": [
                    5.625,
                    21.94304553343818
                ]
            }
        });
    }
    return [place]
};

const createOrLookupGS1Place = app => async epc => {
    print('debug createOrLookupGS1Place ')
    let place = await lookupPlace(app)(epc);
    print(place)
    if (place.length === 0) {
        print('debug createOrLookupGS1Place place len == 0')
        const identifier = epcToTuple(epc)[0];
        const epc = epcToTuple(epc)[1];
        place = await app.place().create({
            name: `Demo epcis place ${epc}. Please update me`,
            identifiers: {identifier: epc},
            "position": {
                "type": "Point",
                "coordinates": [
                    5.625,
                    21.94304553343818
                ]
            }
        })
    }
    return place;
};

const createOrLookupGS1Product = app => async epc => {
    print(epc)
    let sgtinGtin = epc.split('.');
    let sgtin = sgtinGtin.pop();
    let gtin = sgtinGtin.join('');

    let product = await app.product().read({
        params: {
            filter: "identifiers.gs1:01=" + gtin
        }
    }).then();

    if (product.length === 0) {
        print('debug')
        product = await app.product().create({
            name: `epcis product gtin ${gtin}`,
            identifiers: {"gs1:01": gtin}
        }).then()
        return [product]
    } else {
        return product
    }
};


const createOrLookupGS1Thng = app => async epc => {
    print('debug createOrLookupGS1Thng '+ epc)
    let sgtinGtin = epc.split('.');
    let sgtin = sgtinGtin.pop();
    let thng = null;
    try {
        thng = await lookupGS1Thng(app)(epc);
        if (thng.length !== 0) {
            return thng
        }
    } catch (e) {

    }
    let product = (await createOrLookupGS1Product(app)(epc)).pop();

    return await app.thng().create({
        name: `epcis thng sgtin ${sgtin}`,
        identifiers: {"gs1:21": sgtin},
        product: product.id,
    }).then();
};


const addAction = app => async (epcList, allowExisting, bizLocation) => {
    if (allowExisting === undefined) {
        allowExisting = false;
    }
    print('epcisAddAction debug ')
    print(epcList)
    let withoutPrefix = epcList.map(epc => epc.slice(epc.lastIndexOf(':') + 1,));
    let productsGtins = withoutPrefix.map(epc => epc.split('.').slice(0, 2)).map(s => s.join(''));
    productsGtins = new Set(productsGtins);
    let existingProducts = {};
    for (const gtin of productsGtins) {
        let product = await app.product().read({
            params: {
                filter: `identifiers.gs1:01=${gtin}`
            }
        }).then();

        if (Object.keys(product).length === 0)
            await app.product().create({
                name: `epcis product gtin ${gtin}`,
                identifiers: {"gs1:01": gtin}
            }).then()
        existingProducts[gtin] = product.pop()
    }
    print('epcisAction 2')
    // print(epcList)
    // print(epcList.map(epcToTuple).map(a=>a))

    print('epcisAction 3')
    if (!allowExisting &&
        (await Promise.all(epcList.map(epcToTuple).map(e => e[1]).map(lookupGS1Thng(app)))).join("").length !== 0) {
        throw Error('Some thngs already exist. They cannot be added twice')
    }

    print('epcisAction 4')
    let thngs = await Promise.all(epcList.map(epcToTuple).map(e => e[1]).map(createOrLookupGS1Thng(app)))
    if (bizLocation !== undefined) {
        for (let thng of thngs) {
            print(bizLocation.id);
            await app.thng(thng.id).location().update([{place: bizLocation.id}]);
        }

    }
    print('epcisAction 5')
    let collection = await app.collection().create({
        name: `epcis add event collection`,
    });
    await app.collection(collection.id).thng().update(thngs.map(t => t.id))
    print('epcisAction 6')
    print('collection '+ JSON.stringify(collection))
    return collection;
};


const deleteAction = app => async (epcList) => {
    print('deleteAction debug ')
    let withoutPrefix = epcList.map(epc => epc.slice(epc.lastIndexOf(':') + 1,));
    let productsGtins = withoutPrefix.map(epc => epc.split('.').slice(0, 2)).map(s => s.join(''));
    productsGtins = new Set(productsGtins);
    let existingProducts = {};
    for (const gtin of productsGtins) {
        let product = await app.product().read({
            params: {
                filter: `identifiers.gs1:01=${gtin}`
            }
        });

        if (Object.keys(product).length === 0)
            throw `Invalid EPC  because product ${gtin} does not exist.`
        existingProducts[gtin] = product.pop()
    }
    print('deleteAction 2')
    // print(epcList)
    // print(epcList.map(epcToTuple).map(a=>a))

    let thngs = await Promise.all(epcList.map(epcToTuple).map(e => e[1]).map(createOrLookupGS1Thng(app)))
    thngs = thngs.reduce((x, y) => x.concat(y)).map(t => t.id);
    print('deleteAction 3')
    if (thngs.length !== epcList.length) {
        throw Error('Could not find all the EPCs specified in the event')
    }
    await Promise.all(thngs.map(t => t.delete()))
};

const observeAction = app => async (epcList) => {
    print('observeAction debug ');
    // print(bizLocation)
    let withoutPrefix = epcList.map(epc => epc.slice(epc.lastIndexOf(':') + 1,));
    let productsGtins = withoutPrefix.map(epc => epc.split('.').slice(0, 2)).map(s => s.join(''));
    print('observeAction debug 1');
    productsGtins = new Set(productsGtins);
    print(productsGtins)
    let existingProducts = {};
    for (const gtin of productsGtins) {
        let product = await app.product().read({
            params: {
                filter: `identifiers.gs1:01=${gtin}`
            }
        });
        print(product)

        if (Object.keys(product).length === 0)
            throw `Invalid EPC  because product ${gtin} does not exist.`
        existingProducts[gtin] = product.pop()
    }
    print('observeAction 2')
    print(epcList)

    let thngs = await Promise.all(epcList.map(epcToTuple).map(e => e[1]).map(createOrLookupGS1Thng(app)));
    // thngs = thngs.reduce((x, y) => x.concat(y));
    print('observeAction 3')
    if (thngs.length !== epcList.length) {
        throw Error('Could not find all the EPCs specified in the event')
    }

    if (bizLocation !== undefined) {
        await Promise.all(thngs.map(t => app.thng(t.id).location().update([{place: bizLocation.id}])))
    }
    let collection = await app.collection().create({
        name: `epcis observe event collection`,
    });
    await app.collection(collection.id).thng().update(thngs.map(t => t.id))
    return collection;
};

class EPCISEvent {
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
        print('event top class start')
        this.collection = (await addAction(this.app)(epcList, true, this.bizLocation)).id;
        print('event top class stop')
    }

    async observeAction(epcList) {
        print('obsreve action start')
        this.collection = (await observeAction(this.app)(epcList, this.bizLocation)).id;
        print('obsreve action stop')
    }

    async deleteAction(epcList) {
        throw "deleteAction not implemented";
    }

    constructor(event, app) {
        this._timestamp = new Date();
        this._identifiers = {};
        this._tags = [];
        this._customFields = {};
        this._type = null;
        this._location = null;

        this._locationSource = null;
        this._collection = null;


        this.app = app;
        this._customFields = event;
        this._type = `_${event.isA}`;
        if (event.hasOwnProperty('eventID') || event.hasOwnProperty('eventId')) {
            this._identifiers['eventID'] = event.eventID;
        }
        if (event.hasOwnProperty('eventTime')) {
            this.timestamp = (new Date(event.eventTime)).getTime();
        }
        if (event.hasOwnProperty('bizStep')) {
            this.tags.push(`bizStep:${event.bizStep}`);
        }

        this.tags.push(`readPoint:${event.readPoint}`);
        this.tags.push(`epcisAction:${event.action}`);
        if (event.hasOwnProperty('bizLocation')) {
            this.tags.push(`bizLocation:${event.bizLocation}`);
        }
    }

    async init() {
        let event = this._customFields;

        let readPoint = (await createOrLookupPlace(this.app)(epcToTuple(event.readPoint))).pop();
        this.locationSource = 'place';
        this.location = {
            place: readPoint.id
        };

        if (event.hasOwnProperty('bizLocation')) {
            this.bizLocation = (await createOrLookupPlace(this.app)(epcToTuple(event.bizLocation))).pop();
        }
        print('debug init EPCISEvent start ' + JSON.stringify(event))
        let temp = await this[`${event.action.toLowerCase()}Action`](event.epcList);
        print('debug init EPCISEvent stop ' + JSON.stringify(this));

    }

    asEVTActionDocument() {
        let out = {};
        for (const k of Object.getOwnPropertyNames(this)) {
            if (k !== 'app') {
                out[k.slice(1,)] = this[k];
            }
        }
        print('asEVTActionDocument ' + JSON.stringify(out))
        return out;
    }
}

class ObjectEvent extends EPCISEvent {

    async addAction(epcList) {
        print('object event start')
        this.collection = (await addAction(this.app)(epcList, false, this.bizLocation)).id;
        print('object event stop')
    }

    async deleteAction(epcList) {
        await deleteAction(this.app)(epcList)
    }

}

class AggregationEvent extends EPCISEvent {



    async deleteAction(epcList) {
        await deleteAction(this.app)(epcList)
    }

}

exports.createOrLookupGS1Product = createOrLookupGS1Product;
exports.createOrLookupGS1Thng = createOrLookupGS1Thng;
exports.createOrLookupGS1Place = createOrLookupGS1Place;
exports.ObjectEvent = ObjectEvent;
exports.AggregationEvent = AggregationEvent;
exports.printEvent = eventAction => {
    const customFields = eventAction.customFields||{};
    // recordTime is required by EPCIS. Since this timestamp is created by the backend, it will not be in a custom field.
    customFields.recordTime = (new Date(eventAction.createdAt)).toISOString();
    return customFields;
};
