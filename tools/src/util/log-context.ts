const crypto = require("crypto");

const WARPDRIVE_LOG_CONTEXT_LENGTH = 10;

export function createLogContext() {
    return crypto.randomBytes(WARPDRIVE_LOG_CONTEXT_LENGTH / 2).toString('hex');
}