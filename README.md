# EPCIS 2.0 Proxy Implementation for EVRYTHNG

A proxy to use the upcoming EPCIS 2.0 standard with the EVRYTHNG API. EPCIS 2.0 is the latest update of the GS1 EPCIS standard and is currently being developed by the EPCIS and CBV 2.0 MSWG. The standard has not been ratified yet, hence consider everything you see here tentative.

## Related projects

- REST API:
    - [EPCIS 2.0 bindings](https://github.com/evrythng/gs1-epcis-2.0)
- Payload specifications: 
    - [EPCIS 2.0 JSON Schema](https://github.com/dannyhaak/epcis2-json-schema)
    - [EPCIS 2.0 JSON-LD]()
 
## Setup

### Requirements:

- Node version > 8.0
- Serverless version >= 1.36.3
- evrythng-extended version >= 4.7.2
- [EVRYTHNG](https://dashboard.evrythng.com) account
- [Trusted App API](https://developers.evrythng.com/docs/api-key-scopes-and-permissions#section-trusted-application-api-key)
- [Custom Action types](https://developers.evrythng.com/reference/action-types) `_ObjectEvent`, `_AggregationEvent` 

### Installation:

- Make sure serverless is installed globally `npm install serverless -g`
- If you're deploying the gateway for the first time, [follow these instructions](https://serverless.com).
- Install evrythng-exgtended `npm i -s evrythng-extended`
- Deploy the new gateway `serverless deploy`
- Debugging information can be obtained by inspecting log files. For example, to read the latest log files for the capture interface, type `serverless logs -f capture`

### Project structure:

- [evrythng-proxy](evrythng-proxy) contains the EPCIS 2.0 proxy, that will be deployed on AWS
- [example-event.json](example-event.json) contains a sample paylaod to test the proxy

## Using the proxy

You'll need an [EVRYTHNG](https://dashboard.evrythng.com) account and a [Trusted App API](https://developers.evrythng.com/docs/api-key-scopes-and-permissions#section-trusted-application-api-key) key to use this service. 

**If you don't provide an API key, you'll use the default public EPCIS 2.0 account on EVRYTHNG**. 

### Capturing EPCIS Events

To create your first ObjectEvents, try:

Request

```
curl -X POST "https://9kr88qvs8c.execute-api.us-east-1.amazonaws.com/labs/capture" -H "Content-Type: application/json"  -H "Authorization:TRUSTED APP API KEY" -d @example-event.json
```

Response

```
[{"id":"U6D4GbF3Kn5snAawan9q4gge","createdAt":1550487945956,"customFields":{"action":"ADD","bizLocation":"urn:epc:id:sgln:0614141.00888.0","bizStep":"urn:fosstrak:demo:bizstep:fmcg:production","bizTransactionList":[{"bizTransaction":"http://transaction.acme.com/po/12345678","type":"urn:epcglobal:cbv:btt:po"},{"bizTransaction":"urn:epcglobal:cbv:bt:0614141073467:1152","type":"urn:epcglobal:cbv:btt:desadv"}],"destinationList":[{"destination":"urn:epc:id:sgln:0614141.00001.0","type":"urn:epcglobal:cbv:sdt:owning_party"}],"disposition":"urn:fosstrak:demo:disp:fmcg:pendingQA","epcList":["urn:epc:id:sgtin:0614141.107346.2017","urn:epc:id:sgtin:0614141.107346.2018"],"eventID":"_:event2","eventTime":"2008-11-09T13:30:17Z","eventTimeZoneOffset":"+00:00","isA":"ObjectEvent","readPoint":"urn:epc:id:sgln:0614141.00777.0","sourceList":[{"source":"urn:epc:id:sgln:4012345.00001.0","type":"urn:epcglobal:cbv:sdt:possessing_party"}]},"tags":["readPoint:urn:epc:id:sgln:0614141.00777.0","epcisAction:ADD","bizLocation:urn:epc:id:sgln:0614141.00888.0","DEBUG"],"timestamp":1226237417000,"type":"_ObjectEvent","location":{"latitude":39.0481,"longitude":-77.4728,"position":{"type":"Point","coordinates":[-77.4728,39.0481]}},"locationSource":"geoIp","context":{"ipAddress":"35.174.185.11","city":"Ashburn","region":"Virginia","countryCode":"US","timeZone":"America/New_York"},"createdByProject":"UMf2DkcMbXAhy8waRmN2Dmxf","createdByApp":"U6C3NyfNDwQhshawRqXWAwss","identifiers":{}}]
```

### Querying EPCIS Events

Use this `https://9kr88qvs8c.execute-api.us-east-1.amazonaws.com/labs` service to experiment with the gateway

- List all object event: `/events/ObjectEvent`
- Retrieve all object and aggregation events that occured at the business location `urn:epc:id:sgln:0614141.00888.0`: 

```
'/events/all?$filter=eventType in (ObjectEvent, AggregationEvent)&bizLocation eq urn:epc:id:sgln:0614141.00888.0'
```

