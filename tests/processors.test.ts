import { expect, test, describe } from "@jest/globals";
import { extractProcessors, extractSteps, Source } from "@ajuvercr/js-runner";


describe("HTTP Utils tests", () => {
    const pipeline = `
        @prefix js: <https://w3id.org/conn/js#>.
        @prefix ws: <https://w3id.org/conn/ws#>.
        @prefix : <https://w3id.org/conn#>.
        @prefix owl: <http://www.w3.org/2002/07/owl#>.
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#>.
        @prefix sh: <http://www.w3.org/ns/shacl#>.

        <> owl:imports <./node_modules/@ajuvercr/js-runner/ontology.ttl>, <./processors.ttl>.

        [ ] a :Channel;
            :writer <jw>.
            
        <jw> a js:JsWriterChannel.
    `;

    const baseIRI = process.cwd() + "/config.ttl";

    test("js:HttpFetch is properly defined", async () => {
        const proc = `
            [ ] a js:HttpFetch; 
                js:url "http://example.com"; 
                js:method "GET";
                js:headers "content-type: text/plain", "accept: text/plain";
                js:writer <jw>;
                js:closeOnEnd true.
        `;

        const source: Source = {
            value: pipeline + proc,
            baseIRI,
            type: "memory",
        };

        const { processors, quads, shapes: config } = await extractProcessors(source);
        const env = processors.find((x) => x.ty.value.endsWith("HttpFetch"))!;
        expect(env).toBeDefined();

        const argss = extractSteps(env, quads, config);
        expect(argss.length).toBe(1);
        expect(argss[0].length).toBe(7);

        const [[url, method, writer, closeOnEnd, headers, acceptStatusCodes, bodyCanBeEmpty]] = argss;
        expect(url).toEqual("http://example.com");
        expect(method).toEqual("GET");
        expect(headers).toEqual(["content-type: text/plain", "accept: text/plain"]);
        expect(acceptStatusCodes).toBeUndefined();
        expect(bodyCanBeEmpty).toBeUndefined();
        testWriter(writer);
        expect(closeOnEnd).toBeTruthy();

        await checkProc(env.file, env.func);
    });

    test("js:HttpFetch requires a url", async () => {
        const proc = `
            [ ] a js:HttpFetch; 
                js:method "GET";
                js:headers "content-type: text/plain", "accept: text/plain";
                js:writer <jw>;
                js:closeOnEnd true.
        `;

        const source: Source = {
            value: pipeline + proc,
            baseIRI,
            type: "memory",
        }

        const { processors, quads, shapes: config } = await extractProcessors(source);
        const env = processors.find((x) => x.ty.value.endsWith("HttpFetch"))!;
        expect(env).toBeDefined();

        // An error must be thrown, since the url is missing.
        try {
            extractSteps(env, quads, config);
            expect(false).toBeTruthy(); // Since rejects.toThrow doesn't work.
        } catch (e) {
            expect(e).toEqual("nope");
        }
    });
});

function testWriter(arg: any) {
    expect(arg).toBeInstanceOf(Object);
    expect(arg.channel).toBeDefined();
    expect(arg.channel.id).toBeDefined();
    expect(arg.ty).toBeDefined();
}

async function checkProc(location: string, func: string) {
    const mod = await import("file://" + location);
    expect(mod[func]).toBeDefined();
}
