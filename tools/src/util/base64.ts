export function decodeBase64(str: string) {
    let binaryData = Buffer.from(str, "base64");
    return binaryData.toString("utf8");
}

export function encodeBase64(str: string) {
    let binaryData = Buffer.from(str, "utf8");
    return binaryData.toString("base64");
}