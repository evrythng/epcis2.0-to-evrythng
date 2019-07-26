const assert = require('assert');
const {TrustedApp, Operator} = require('evrythng-extended');
const epcisEvents = require('../epcisEvents');
const epcisquery = require('../epcisquery');
const chai = require('chai');
const chaiHttp = require('chai-http');
const expect = chai.expect;

chai.use(chaiHttp);

function sortedDict(unsortedDict) {
    const d = {};
    for (let k of Object.keys(unsortedDict).sort())
        d[k] = unsortedDict[k];
    return d;
}

describe('EPCIS query epcisquery.js', function () {
    describe('encodeAsQueryString', function () {
        it('should encode a dictionary as a query string', function () {
            let dQs = {'LT_recordTime': '2015-03-15T00:00:00.000-04:00', 'EQ_action': 'ADD'};
            let qs = 'LT_recordTime=2015-03-15T00:00:00.000-04:00&EQ_action=ADD';
            assert.equal(epcisquery.encodeAsQueryString(dQs), qs);
        });
    });
    describe('simpleEventLookupQuery', function () {
        it('should map an EPCIS event path parameter to a query string parameter', function () {
            assert.strictEqual(
                epcisquery.simpleEventLookupQuery('ObjectEvent'),
                'type=_ObjectEvent');
        });
        it('should map an EPCIS event id to query string parametersa query string parameter', function () {
            assert.strictEqual(
                epcisquery.simpleEventLookupQuery('ObjectEvent', 'event1'),
                'type=_ObjectEvent&identifiers.eventID=event1');
        });
    });

});

const server = 'https://epcis.evrythng.io/v2_0';

describe("EPCIS REST interface", function () {
    before(function () {
        async function main() {
            let app = new TrustedApp(process.env['TRUSTED_APP']);
            for (let id of (await app.thng().read()).map(x => x.id))
                await app.thng(id).delete()

            for (let id of (await app.product().read()).map(x => x.id))
                await app.product(id).delete()


            for (let id of (await app.place().read()).map(x => x.id))
                await app.place(id).delete()

            let eventTypes = Object.keys(epcisEvents).filter(
                e => e.endsWith('Event')).filter(e => e[0].toUpperCase() === e[0]);
            for (let e of eventTypes.map(e => '_' + e))
                for (let id of (await app.action(e).read()).map(x => x.id))
                    await (new Operator(process.env['OPERATOR'])).action(e, id).delete();
        }

        main().catch(console.log)
    });
    describe('POST /capture', function () {
        it('Adds new EPCIS events', function (done) { // <= Pass in done callback
            chai.request(server)
                .post('/capture')
                .send(require('./example-1'))
                .set('Authorization', process.env['TRUSTED_APP'])
                .set('Content-Type', 'application/json')
                .then(res => {
                    expect(res).to.have.status(200);
                }).catch().then(x => {
                done()
            })
        });
    });

    describe('GET /events', function () {
        let eventTypes = Object.keys(epcisEvents).filter(
            e => e.endsWith('Event')).filter(e => e[0].toUpperCase() === e[0]);
        it('Returns a list of supported event types', function (done) { // <= Pass in done callback
            chai.request(server)
                .get('/events')
                .set('Authorization', process.env['TRUSTED_APP'])
                .set('Content-Type', 'application/json')
                .then(res => {
                    expect(res.body).to.eql(eventTypes);
                    // expect(res).to.have.status(200);
                }).catch().then(x => {
                done()
            });
        });
    });

    describe('GET /events', function () {

        it('Returns a list of supported event types', function (done) { // <= Pass in done callback
            async function main() {

                try {
                    let eventTypes = Object.keys(epcisEvents).filter(
                        e => e.endsWith('Event')).filter(e => e[0].toUpperCase() === e[0]);
                    let res = await chai.request(server)
                        .get('/events')
                        .set('Authorization', process.env['TRUSTED_APP'])
                        .set('Content-Type', 'application/json');
                    expect(res.body).to.eql(eventTypes);
                } catch (error) {
                    console.log(error)

                }
            }

            main().catch().then(() => {
                done()
            });
        });
    });

    describe('GET /events/ObjectEvent', function () {
        it('Returns two object events that were added as part of the tests', function (done) { // <= Pass in done callback
            async function main() {
                try {
                    let eventTypes = Object.keys(epcisEvents).filter(
                        e => e.endsWith('Event')).filter(e => e[0].toUpperCase() === e[0]);
                    let res = await chai.request(server)
                        .get('/events/ObjectEvent')
                        .set('Authorization', process.env['TRUSTED_APP'])
                        .set('Content-Type', 'application/json');
                    expect(res.body).to.have.lengthOf(2);
                } catch (error) {
                    console.log(error)
                }
            }

            main().catch().then(() => {
                done()
            });
        });
    });

    // after(function () {
    //
    // })
});