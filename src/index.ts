import { Writer } from "@treecg/connector-types";

export async function httpFetch(
    message: string,
    writer: Writer<string | Buffer>,
    closeOnEnd: boolean = true,
) {
    // This is a source processor (i.e, the first processor in a pipeline),
    // therefore we should wait until the rest of the pipeline is set
    // to start pushing down data
    return async () => {
        await writer.push(message);

        if (closeOnEnd) {
            await writer.end();
        }
    };
}
