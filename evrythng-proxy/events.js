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

lookupGS1Resource.register("urn:epc:id:sgtin", app => async epc => {

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
});

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

const createOrLookupGS1Place = singledispatch(app => async epc => {
    throw Error(`EPC type not found ${epc}`);
});


createOrLookupGS1Place.register("urn:epc:id:sgln", app => async epc => {
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
});

const createOrLookupGS1Product = singledispatch(app => async epc => {
    throw Error(`EPC type not found ${epc}`);
});

createOrLookupGS1Product.register("urn:epc:id:sgtin", app => async epc => {
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
});

const createOrLookupGS1Thng = singledispatch(app => async epc => {
    throw Error(`EPC type not found ${epc}`);
});

createOrLookupGS1Thng.register("urn:epc:id:sgtin", app => async epc => {
    lookupGS1Resource.setGlobals(app);
    let sgtinGtin = epc.split('.');
    let sgtin = sgtinGtin.pop();
    let thng = null;
    try {
        thng = await lookupGS1Resource(["urn:epc:id:sgtin", epc]);
        if (thng.length !== 0) {
            return thng
        }
    } catch (e) {

    }
    let product = (await createOrLookupGS1Product(["urn:epc:id:sgtin", epc])).pop();

    return await app.thng().create({
        name: `epcis thng sgtin ${sgtin}`,
        identifiers: {"gs1:21": sgtin},
        product: product.id,
    }).then();
});



const epcisAddAction = singledispatch(app => async (epcList) => {
    print('debug')
    createOrLookupGS1Thng.setGlobals(app)
    let thngs = await Promise.all(epcList.map(epcToTuple).map(createOrLookupGS1Thng)).then();
    let collection = await app.collection().create({
        name: `epcis event collection`
    }).then();
    print('debug 2')
    await collection.thng().update(thngs.map(t=>t.id)).then();
    return collection;
});



epcisAddAction.register('ObjectEvent', app => async (epcList) => {
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
    lookupGS1Resource.setGlobals(app)
    let existingThngs = await Promise.all(epcList.map(epcToTuple).map(lookupGS1Resource)).then()
    print('epcisAction 3')
    if (existingThngs.join("").length !== 0) {
        throw Error('Some thngs already exist. They cannot be added twice')
    }
    let sgtinGtins = withoutPrefix.map(epc => epc.split('.')).map(a => [a.pop(), a.join('')]);
    print('epcisAction 4')
    const gtinLookup = {};
    for (const sgtinGtin of sgtinGtins) {
        let sgtin = sgtinGtin[0];
        let gtin = sgtinGtin[1];
        gtinLookup[sgtin] = gtin;
    }

    let collection = await app.collection().create({
        name: `epcis event collection`
    }).then();
    print('epcisAction 5')
    let thngs = [];
    for (const sgtin in gtinLookup) {
        let thng = await app.thng().create({
            name: `epcis thng sgtin ${sgtin}`,
            identifiers: {"gs1:21": sgtin},
            product: existingProducts[gtinLookup[sgtin]].id,
        }).then()
        thngs.push(thng.id)
    }
    print('epcisAction 6')
    await collection.thng().update(thngs).then();
    print('epcisAction 7')
    return collection;
});


const EventToActionMapper = app => async (event) => {
    epcisAddAction.setGlobals(app)

    createOrLookupGS1Place.setGlobals(app);
    const doFinally = {};
    let action = {identifiers: {}, customFields: {}, tags: []};
    for (const keyVal of Object.entries(event)) {
        let key = keyVal[0];
        let val = keyVal[1];
        switch (key) {
            case 'isA':
                action['type'] = `_${val}`;
                break;
            case 'eventID':
                action.identifiers[key] = val;
                break;
            case 'eventTime':
                let tz = '';
                if (event.hasOwnProperty('eventTimeZoneOffset'))
                    // tz = event.eventTimeZoneOffset;
                action['timestamp'] = new Date(val + tz).getTime();
                break;
            case 'readPoint':
                let readPoint = (await createOrLookupGS1Place(epcToTuple(val))).pop();
                action.locationSource = 'place';
                action.location = {
                    place: readPoint.id
                };
                action.tags.push(`${key}:${val}`);
                break;
            case 'bizLocation':
                doFinally[key] = val;
                action.tags.push(`${key}:${val}`);
                break;

            case 'epcList':
                action.tags.push(`epcisAction:${event.action}`);
                action.collection = (await epcisAddAction([event.isA, val])).pop().id
                break;
        }
        /*
            We keep a copy of the event. When the event is fetched through the EPCIS interface we
            can simply return the entire document.
         */
        action.customFields[key] = val;

    }
    for (const entry of Object.entries(doFinally)) {
        let key = entry[0];
        let val = entry[1];
        switch (key) {
            case 'bizLocation':
                let bizLocation = (await createOrLookupGS1Place(epcToTuple(val))).pop();

                if (bizLocation.location !== undefined) {

                    for (const thng of await app.collection(action.collection).thng().read().then()) {

                        await thng.update({location: bizLocation.location}).then();
                    }
                }
                break;
        }

    }
    return action
}


exports.capture = app => async (epcisEvents) => {

    for (const event of epcisEvents){


        let actionDocument = await EventToActionMapper(app)(event);

        let action = await app.action(actionDocument.type).create(actionDocument).then().catch(print);

    }


};