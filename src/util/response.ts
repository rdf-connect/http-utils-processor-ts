/**
 * Reads a response body in as a stream.
 */
export async function* readResponseAsStream(response: Response) {
    const reader = response.body?.getReader();

    if (!reader) {
        throw new Error("Response body is null");
    }

    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }
        yield value;
    }
}
