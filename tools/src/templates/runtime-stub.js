export class Init {
    registerData(dataType)
    {}
    registerService(serviceType)
    {}
    registerMessage(messageType)
    {}
}

export class Service {
    constructor(primaryKey){}
    get primaryKey(){}
}

export class Data {
    constructor(primaryKey){}
    get primaryKey() {}
}

export class Message {
}

export function createUuid(dashes){}

export class system {
    static saveData(...data) {}
    static saveDataGraphs(...dataRoots) {}
    static revert(serviceOrData){}
    static getService(serviceType, primaryKey) {}
    static getData(dataType, primaryKey){}
    static delete(serviceOrData, purge){}
    static sendMessage(source, message){}
}
