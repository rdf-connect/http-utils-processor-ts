# http-utils-processor-ts

[![Build and test with Bun](https://github.com/jenspots/http-utils-processor-ts/actions/workflows/build-test.yml/badge.svg)](https://github.com/jenspots/http-utils-processor-ts/actions/workflows/build-test.yml) [![Coverage Status](https://coveralls.io/repos/github/jenspots/http-utils-processor-ts/badge.svg?branch=main)](https://coveralls.io/github/jenspots/http-utils-processor-ts?branch=main) [![npm](https://img.shields.io/npm/v/@rdfc/http-utils-processor-ts.svg?style=popout)](https://npmjs.com/package/@rdfc/http-utils-processor-ts)

Connector Architecture Typescript processors for handling HTTP operations.

## Functions

### [`httpFetch`](./src/index.ts)

Build and execute an HTTP request. Writes the body of the response into a user specified channel.

-   `url`: endpoints against which requests are made. Can be a single string or an array of strings. At the time of writing, the order is not respected and results are pushed down the stream randomly.
-   `writer`: channel into which the resulting data is written.
-   `options`: an optional parameter which may include:
    -   `method` the HTTP method to use. (default: `GET`)
    -   `headers`: an array of strings to be used as headers in the outgoing request. (default: `[]`)
    -   `acceptStatusCodes`: an array of strings which lists all the status codes deemed "successful". These strings contain either integer literals such as `"200"`, or ranges such as `"200-300"`. Note that range "`a-b`" is inclusive `a`, exclusive `b`. (default: `["200-300"]`)
    -   `closeOnEnd`: whether to close the writer stream on end. (default: `true`)
    -   `timeOutMilliseconds`: maximum time spend waiting for a response before throwing a `HttpFetchError.timeOutError` error. (default: `null`)
    -   `auth`: object describing which authentication flow to use, as well as its parameters. See below for more info. (default: `null`)
    -   `cron`: specify the interval at which the function should run as a crontab expression. If `null`, the function only executes once before returning. (default: `null`)
    -   `errorsAreFatal`: whether to exit when an error occurs in the fetch phase. Note that when an invalid configuration is provided, an error is still thrown since the function cannot execute at all. (default: `true`)

#### Authentication

This package supports some forms of authentication such as HTTP Basic Authentication and the OAuth 2.0 Password Grant. Additional methods may be implemented by extending the abstract [`Auth`](./src/auth/index.ts) class, after which you must define an additional [`AuthConfig`](./src/auth/index.ts) type and extend the [`Auth.from`](./src/auth/index.ts) static method.

##### HTTP Basic Authentication

A simple flow which includes the base64 encoded username and password in each request.

-   `type`: must be set to`basic`.
-   `username`: your username as string.
-   `password`: your plaintext password.

##### OAuth 2.0 Password Grant

Before executing your request, a POST request is sent to the OAuth server in order to obtain a token. The result of which is embedded as a header inside the original request.

-   `type`: must be set to `oauth2`
-   `endpoint`: the URL of the OAuth 2.0 server.
-   `username`: your username as string.
-   `password`: your plaintext password.

Note that your credentials are not send to the server you specified in the `url` option of `httpFetch`, but only to the `endpoint` you specified above.

## Errors

All errors thrown in `httpFetch` are of the `HttpFetchError` type, as defined in [`./src/error.ts`](./src/error.ts). This class contains a `HttpUtilsErrorType` enum value which reflects the nature of the error.

## Tests

At the time of writing, tests should be executed using the Node.js runtime.

```sh
$ npm run build
$ npm test
```

Some tests interact with real online servers, and may therefore require credentials. These can be supplied inside a `.env` file at the root of the repository.

```shell
# Requires OAuth 2.0 Password Grant
RINF_USERNAME=
RINF_PASSWORD=

# Requires HTTP Basic Auth
WoRMS_USERNAME=
WoRMS_PASSWORD=

# Needs to be `true` in order to execute
BLUE_BIKE=true
```

Additional information can be found [here](./tests/README.md).
