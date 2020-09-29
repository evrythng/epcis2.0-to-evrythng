const assert = require('assert');
const evrythng = require('evrythng');
const epcisEvents = require('../EpcisEvent/index');
const epcisquery = require('../epcisquery');
const chai = require('chai');
const chaiHttp = require('chai-http');
const expect = chai.expect;
const fs = require('fs');

chai.use(chaiHttp);

const API_KEY = fs.readFileSync('../publicaccess.secret').toString().trim();

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

const server = 'https://ub1vum6jeg.execute-api.us-east-1.amazonaws.com/dev/';

describe("EPCIS REST interface", function () {

    before(async function () {
        async function main() {

            let app = new evrythng.TrustedApplication(API_KEY);
            for (let id of (await app.thng().read()).map(x => x.id)) {
                await app.thng(id).delete();
            }

            for (let id of (await app.product().read()).map(x => x.id))
                await app.product(id).delete()

            for (let id of (await app.place().read()).map(x => x.id))
                await app.place(id).delete()

            /*let eventTypes = Object.keys(epcisEvents).filter(
                e => e.endsWith('Event')).filter(e => e[0].toUpperCase() === e[0]);
            for (let e of eventTypes.map(e => '_' + e))
                for (let id of (await app.action(e).read()).map(x => x.id))
                    await (new evrythng.Operator(API_KEY)).action(e, id).delete();*/

        }

        await main().catch(console.log)
    });

    describe('GET /debug', function () {

        it('Check if the proxy is live', function (done) { // <= Pass in done callback

            try {

                chai.request(server)
                    .get('/debug')
                    .set('Authorization', API_KEY)
                    .set('Content-Type', 'application/json')
                    .then(async (res) => {

                        expect(res).to.have.status(200);

                    }).catch().then(x => {
                    done();
                });

            } catch (e) {
                console.log(e);
            }

        });

    });

    describe('POST /capture', function () {

        it('Adds new EPCIS events - Adding new thngs in EVT dashboard', function (done) { // <= Pass in done callback

            try {

                chai.request(server)
                    .post('/capture')
                    .send(JSON.parse(fs.readFileSync('example-add.json').toString().trim()))
                    .set('Authorization', API_KEY)
                    .set('Content-Type', 'application/json')
                    .then(async (res) => {

                        expect(res).to.have.status(200);

                        let app = new evrythng.TrustedApplication(API_KEY);

                        let thngs = await app.thng().read();

                        let thngsIds = [];

                        thngs.forEach((thng) => {
                            thngsIds.push(thng.identifiers["gs1:21"]);
                        });

                        expect(thngsIds).to.contain("2017");
                        expect(thngsIds).to.contain("2018");
                        expect(thngsIds).to.contain("1701");

                    }).catch().then(x => {
                    done();
                });

            } catch (e) {
                console.log(e);
            }

        });

        it('OBSERVE EPCIS events - Adding sensors values to EVT thngs', function (done) { // <= Pass in done callback

            try {

                chai.request(server)
                    .post('/capture')
                    .send(JSON.parse(fs.readFileSync('example-observe.json').toString().trim()))
                    .set('Authorization', API_KEY)
                    .set('Content-Type', 'application/json')
                    .then(async (res) => {

                        expect(res).to.have.status(200);

                        let app = new evrythng.TrustedApplication(API_KEY);

                        let thng = await app.thng().read({
                            params: {
                                filter: `identifiers.gs1:21=2017`,
                            },
                        });

                        expect(thng[0].properties["temperature"]).to.equal(17);
                        expect(thng[0].properties["humidity"]).to.equal(50);

                        thng = await app.thng().read({
                            params: {
                                filter: `identifiers.gs1:21=2018`,
                            },
                        });

                        expect(thng[0].properties["humidity"]).to.equal(40);

                    }).catch().then(x => {
                    done();
                });

            } catch (e) {
                console.log(e);
            }

        });

    });

    describe('GET /events', function () {
        let eventTypes = Object.keys(epcisEvents).filter(
            e => e.endsWith('Event')).filter(e => e[0].toUpperCase() === e[0]).filter(e => !(e === "EPCISEvent" || e === "printEvent"));

        it('Returns a list of supported event types', function (done) { // <= Pass in done callback
            chai.request(server)
                .get('/events')
                .set('Authorization', API_KEY)
                .set('Content-Type', 'application/json')
                .then(res => {
                    expect(res.body).to.eql(eventTypes);
                }).catch().then(x => {
                done();
            });
        });
    });

    describe('GET /events/ObjectEvent', function () {
        it('Returns object events that were added as part of the tests (And those that were added before)', function (done) { // <= Pass in done callback
            async function main() {
                try {

                    let res = await chai.request(server)
                        .get('/events/ObjectEvent')
                        .set('Authorization', API_KEY)
                        .set('Content-Type', 'application/json');

                    expect(res).to.have.status(200);
                    expect(res.body).to.have.length.above(0);

                } catch (error) {
                    console.log(error)
                }
            }

            main().catch().then(() => {
                done()
            });
        });
    });

});