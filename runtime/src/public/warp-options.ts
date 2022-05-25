export class WarpOptions {
    constructor(public enableVerboseLogging: boolean = true,
                public enableMessageTracing: boolean = true,
                public debugLogHeader: string = "[stackless]") {
    }
}