'use strict';

const print = console.log

const epcToTuple = epc => [epc.slice(0, epc.lastIndexOf(':')), epc.slice(epc.lastIndexOf(':') + 1,)]

function singledispatch(fn) {
    let registry = {};
    let global = null;
    let mainFn = async (keyValue) => {
        if (global === null) {
            throw Error('No global variables set');
        }
        let key = keyValue[0];
        let value = keyValue[1];
        let result = null;
        if (key in registry) {
            result = await registry[key](global)(value);
        } else {
            result = await fn(global)(value);
        }

        if (result.length === undefined) { // let's try to be a bit consistent and always return an array.
            return [result];
        } else {
            return result;
        }
    };
    mainFn.register = (key, fn) => {
        registry[key] = fn;
    };
    mainFn.setGlobals = (arg) => {
        global = arg;
    };
    return mainFn
}

const lookupGS1Resource = singledispatch(app => async epc => {
    throw Error(`Resource not found ${epc}`);
});

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
    }).then()

    return thng;
};

lookupGS1Resource.register("urn:epc:id:sgln", app => async epc => {

    let place = await app.place().read({
        params: {
            filter: `identifiers.urn:epc:id:sgln=${epc}`
        }
    }).then();
    if (place.length > 1) {
        throw Error('More than one entry found for ' + epc);
    } else {
        return place;
    }
});


const createOrLookupGS1Place = app => async epc => {
    lookupGS1Resource.setGlobals(app);
    let place = await lookupGS1Resource(["urn:epc:id:sgln", epc]);
    if (place.length === 0) {
        place = await app.place().create({
            name: `Demo epcis place ${epc}. Please update me`,
            identifiers: {"urn:epc:id:sgln": epc},
            "position": {
                "type": "Point",
                "coordinates": [
                    5.625,
                    21.94304553343818
                ]
            }
        }).then()
    }
    return place;
};


const createOrLookupGS1Product = app => async epc => {
    let sgtinGtin = epc.split('.');
    let sgtin = sgtinGtin.pop();
    let gtin = sgtinGtin.join('');

    let product = await app.product().read({
        params: {
            filter: "identifiers.gs1:01=" + gtin
        }
    }).then();
    if (product.length === 0) {
        return await app.product().create({
            name: `epcis product gtin ${gtin}`,
            identifiers: {"gs1:01": gtin}
        }).then()
    } else {
        return product
    }
};


const createOrLookupGS1Thng = app => async epc => {

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


const addAction = app => async (epcList, allowExisting) => {
    if (allowExisting === undefined) {
        allowExisting = false;
    }
    print('epcisAddAction debug ')
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
        (await Promise.all(epcList.map(epcToTuple).map(e => e[1]).map(lookupGS1Thng(app))).then()).join("").length !== 0) {
        throw Error('Some thngs already exist. They cannot be added twice')
    }


    let thngs = await Promise.all(epcList.map(epcToTuple).map(e => e[1]).map(createOrLookupGS1Thng(app))).then()
    thngs = thngs.reduce((x, y) => x.concat(y)).map(t => t.id);
    let collection = await app.collection().create({
        name: `epcis event collection`,
        thngs: thngs
    }).then().catch(print);
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

    get createdAt() {
        return this._createdAt;
    }

    set createdAt(value) {
        this._createdAt = value;
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
        this.collection = (await addAction(this.app)(epcList, true)).id;
    }

    async observeAction(epcList) {
    }

    async deleteAction(epcList) {
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
        if (event.hasOwnProperty('eventId')) {
            this.identifiers.eventID = event.eventID;
        }
        if (event.hasOwnProperty('eventTime')) {
            this.timestamp = (new Date(event.eventTime)).getTime();
        }
        this.tags.push(`readPoint:${event.readPoint}`);
        this.tags.push(`epcisAction:${event.action}`);
        if (event.hasOwnProperty('bizLocation')) {
            this.tags.push(`bizLocation:${event.bizLocation}`);
        }
    }

    async init() {
        let event = this.customFields;

        let readPoint = (await createOrLookupGS1Place(this.app)(epcToTuple(event.readPoint))).pop();
        this.locationSource = 'place';
        this.location = {
            place: readPoint.id
        };


        await this[`${event.action.toLowerCase()}Action`](event.epcList);

        if (event.hasOwnProperty('bizLocation')) {
            let bizLocation = (await createOrLookupGS1Place(this.app)(epcToTuple(event.bizLocation))).pop();
            this.tags.push(`bizLocation:${event.bizLocation}`);
        }
        return this;

    }

    asEVTActionDocument() {
        let out = {};
        for (const k of Object.getOwnPropertyNames(this)) {
            if (k !== 'app') {
                out[k.slice(1,)] = this[k];
            }
        }
        return out;
    }
}

class ObjectEvent extends EPCISEvent {

    async addAction(epcList) {
        this.collection = (await addAction(this.app)(epcList, true)).id;
    }

}
class AggregationEvent extends EPCISEvent {

}

exports.ObjectEvent = ObjectEvent;
exports.AggregationEvent = AggregationEvent;
