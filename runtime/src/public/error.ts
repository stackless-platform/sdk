export class PlatformError extends Error {
    constructor(message: string, public code: string) {
        super(message);
        this.code = code;
    }
}

export class ScriptError extends Error {
    constructor(message: string, public warpStack: string) {
        super(message);
        this.warpStack = warpStack;
    }
}