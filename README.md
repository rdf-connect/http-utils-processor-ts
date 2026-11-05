# http-utils-processor-ts

[![Build and test](https://github.com/jenspots/http-utils-processor-ts/actions/workflows/build-test.yml/badge.svg)](https://github.com/jenspots/http-utils-processor-ts/actions/workflows/build-test.yml) [![Coverage Status](https://coveralls.io/repos/github/jenspots/http-utils-processor-ts/badge.svg?branch=main)](https://coveralls.io/github/jenspots/http-utils-processor-ts?branch=main) [![npm](https://img.shields.io/npm/v/@rdfc/http-utils-processor-ts.svg?style=popout)](https://npmjs.com/package/@rdfc/http-utils-processor-ts)

RDF-Connect Typescript processors for handling HTTP operations. The main processor fetches a URL and writes the response to an output channel. It supports configurable HTTP methods, headers, authentication, and scheduling via cron expressions.

---

## Usage

### Installation

```bash
npm install
npm run build
```

Or install from NPM:

```bash
npm install @rdfc/http-utils-processor-ts
```

---

### Pipeline Configuration Example

```turtle
@prefix rdfc: <https://w3id.org/rdf-connect#>.
@prefix rdfcp: <https://w3id.org/rdf-connect/processors#>.
@prefix owl: <http://www.w3.org/2002/07/owl#>.

### Import the processor definitions
<> owl:imports <./node_modules/@rdfc/http-utils-processor-ts/processors.ttl>.

### Define the channels your processor needs
<out> a rdfc:Writer.

### Define and configure the processor
<fetcher> a rdfcp:HttpFetch;
    rdfcp:url "https://example.org/api/data";
    rdfcp:output <out>;
    rdfcp:options [
        rdfcp:method "GET";
        rdfcp:headers "Authorization: Bearer TOKEN";
        rdfcp:acceptStatusCodes "200-300";
        rdfcp:timeOutMilliseconds 5000;
        rdfcp:cron "*/5 * * * *";
        rdfcp:runOnInit true;
        rdfcp:errorsAreFatal true;
        rdfcp:outputAsBuffer false;
        rdfcp:auth [
            rdfcp:type "basic";
            rdfcp:username "user";
            rdfcp:password "pass"
        ]
    ].
```

---

## Configuration

### Parameters of `rdfcp:HttpFetch`:

- `rdfcp:url` (**string** or IRI, required): URL(s) to fetch. Can be given more than once to fetch several URLs.
- `rdfcp:output` (**rdfc:Writer**, required): Output channel to write the fetched response.
- `rdfcp:options` (**rdfcp:HttpFetchOptionsShape**, optional): Optional settings including method, headers, timeout, authentication, cron, and more.

---

### Parameters of `rdfcp:HttpFetchOptionsShape`:

- `rdfcp:method` (**string**, optional): HTTP method (default: `GET`).
- `rdfcp:headers` (**string[]**, optional): Array of header strings (default: `[]`).
- `rdfcp:acceptStatusCodes` (**string[]**, optional): List of accepted status codes or ranges, e.g., `["200", "201-300"]` (default: `["200-300"]`).
- `rdfcp:timeOutMilliseconds` (**integer**, optional): Maximum wait time for a response before throwing a timeout error.
- `rdfcp:auth` (**rdfcp:HttpFetchAuthShape**, optional): Authentication configuration (see below).
- `rdfcp:cron` (**string**, optional): Cron expression to schedule repeated executions. Without it, the URLs are fetched once and the writer is closed, so the pipeline can end; with it, the writer stays open for the next run.
- `rdfcp:runOnInit` (**boolean**, optional): Run immediately upon initialization if cron is set (default: `false`).
- `rdfcp:errorsAreFatal` (**boolean**, optional): Exit on fetch errors (default: `true`).
- `rdfcp:outputAsBuffer` (**boolean**, optional): Whether the response is returned as a buffer (default: `false`).
- `rdfcp:outputAsStream` (**boolean**, optional): Whether the response is returned as a stream instead of a single string or buffer (default: `false`).

---

### Authentication (`rdfcp:HttpFetchAuthShape`)

Supported types:

#### HTTP Basic Authentication

- `rdfcp:type`: `"basic"`
- `rdfcp:username`: Username string
- `rdfcp:password`: Plaintext password

#### OAuth 2.0 Password Grant

- `rdfcp:type`: `"oauth2"`
- `rdfcp:endpoint`: URL of the OAuth 2.0 server
- `rdfcp:username`: Username string
- `rdfcp:password`: Plaintext password

> Credentials are only sent to the authentication endpoint, not to the target URL.

---

## HTTP Server (`rdfcp:HttpServer`)

The package also provides the inverse of `rdfcp:HttpFetch`: instead of pulling data
from a URL, `rdfcp:HttpServer` starts an HTTP server and writes the body of every
incoming request to its output channel. This turns a pipeline into an ingestion
endpoint that other services can push data to.

Importing `processors.ttl` (as shown below) transitively imports `server.ttl`, so a
single `owl:imports` makes both processors available.

### Pipeline Configuration Example

```turtle
@prefix rdfc: <https://w3id.org/rdf-connect#>.
@prefix rdfcp: <https://w3id.org/rdf-connect/processors#>.
@prefix owl: <http://www.w3.org/2002/07/owl#>.

### Import the processor definitions
<> owl:imports <./node_modules/@rdfc/http-utils-processor-ts/processors.ttl>.

### Define the channel the server writes incoming bodies to
<in> a rdfc:Writer.

### Define and configure the server
<server> a rdfcp:HttpServer;
    rdfcp:port 8080;
    rdfcp:output <in>;
    rdfcp:options [
        rdfcp:host "0.0.0.0";
        rdfcp:method "POST";
        rdfcp:path "/ingest";
        rdfcp:successStatusCode 202;
        rdfcp:streamThresholdBytes 5242880
    ].
```

### Parameters of `rdfcp:HttpServer`:

- `rdfcp:port` (**integer**, required): Port to listen on. Use `0` to let the OS assign a free port.
- `rdfcp:output` (**rdfc:Writer**, required): Output channel that receives each request body. Requests are handled one at a time.
- `rdfcp:options` (**rdfcp:HttpServerOptionsShape**, optional): Additional settings (see below).

### Parameters of `rdfcp:HttpServerOptionsShape`:

- `rdfcp:host` (**string**, optional): Bind address (default: `0.0.0.0`). The default makes the server reachable from outside a Docker container; use `127.0.0.1` to only accept local connections.
- `rdfcp:method` (**string**, optional): Accepted HTTP method (default: `POST`). Requests using any other method receive `405 Method Not Allowed`.
- `rdfcp:path` (**string**, optional): Accepted request path (default: `/`). Requests to any other path receive `404 Not Found`.
- `rdfcp:successStatusCode` (**integer**, optional): Status code returned to clients after the body is successfully written (default: `200`).
- `rdfcp:streamThresholdBytes` (**integer**, optional): Body size, in bytes, above which the request is streamed to the writer instead of buffered in memory (default: `5242880`, i.e. 5MB). Applies whether the size is known up front via `Content-Length` or only discovered while reading a body with no declared length (e.g. chunked transfer encoding).

---

## Errors

All errors thrown are of type `HttpFetchError` and include a `HttpUtilsErrorType` enum describing the error nature.

---

## Tests

Use Node.js to run tests:

```bash
npm run build
npm test
```

Some tests interact with real servers and may require credentials via a `.env` file:

```shell
# OAuth 2.0 Password Grant
RINF_USERNAME=
RINF_PASSWORD=

# HTTP Basic Auth
WoRMS_USERNAME=
WoRMS_PASSWORD=

# Set to true to enable real requests
BLUE_BIKE=true
```

Additional test information can be found [here](./tests/README.md).  
