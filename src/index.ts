import { Writer } from "@treecg/connector-types";

// Function which converts comma-separated headers to a Headers object.
function parseHeaders(headers: string): Headers {
    const headerList = headers.split(",");
    const result = new Headers();
    headerList.forEach((header) => {
        const [key, value] = header.split(":");
        result.append(key.trim(), value.trim());
    });
    return result;
}

export async function httpFetch(
    url: string,
    method: string = "GET",
    headers: string = "",
    writer: Writer<string | Buffer>,
    closeOnEnd: boolean = true,
) {
    // This is a source processor (i.e, the first processor in a pipeline),
    // therefore we should wait until the rest of the pipeline is set
    // to start pushing down data
    return async () => {
        const res = await fetch(url, {
            method,
            headers: parseHeaders(headers),
        });

        // TODO: figure out how to handle errors.
        if (!res.body) {
            throw new Error("No body in response");
        }

        // TODO: send data in streaming fashion.
        const data = await res.text();
        await writer.push(data);

        // Optionally close the output stream.
        if (closeOnEnd) {
            await writer.end();
        }
    };
}
