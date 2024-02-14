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
            :reader <jr>;
            :writer <jw>.
            
        <jr> a js:JsReaderChannel.
        <jw> a js:JsWriterChannel.
    `;

    const baseIRI = process.cwd() + "/config.ttl";

    test("js:HttpFetch is properly defined", async () => {
        const proc = `
            [ ] a js:HttpFetch; 
                js:url "http://example.com"; 
                js:method "GET";
                js:headers "content-type: text/plain";
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
        expect(argss[0].length).toBe(5);

        const [[url, method, headers, writer, closeOnEnd]] = argss;
        expect(url).toEqual("http://example.com");
        expect(method).toEqual("GET");
        expect(headers).toEqual("content-type: text/plain");
        testWriter(writer);
        expect(closeOnEnd).toBeTruthy();

        await checkProc(env.file, env.func);
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
