const crypto = require("crypto");

const STACKLESS_LOG_CONTEXT_LENGTH = 10;

export function createLogContext() {
    return crypto.randomBytes(STACKLESS_LOG_CONTEXT_LENGTH / 2).toString('hex');
}