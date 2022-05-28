import path from "path";
import fs from "fs";
import {logLocalError, logRemoteError, logVerbose} from "./logging";
import Mustache from "mustache";
import {Unsigned, UnsignedZero} from "./unsigned";
import {requiresTruthy} from "./requires";
import {WarpIndexProto} from "../protocol/warp-index-proto";
import {DataClassProto} from "../protocol/data-class-proto";
import {MessageClassProto} from "../protocol/message-class-proto";
import {ServiceClassProto} from "../protocol/service-class-proto";
import {ServiceMethodProto} from "../protocol/service-method-proto";
import {MethodArgumentProto} from "../protocol/method-argument-proto";
import {FreeClassProto} from "../protocol/free-class-proto";
import {FreeFunctionProto} from "../protocol/free-function-proto";
import {BUILD_INFO} from "../config";
import {ConstructorProto} from "../protocol/constructor-proto";
import {MethodProto} from "../protocol/method-proto";
import {MethodKindProto} from "../protocol/method-kind-proto";
import exp from "constants";

const {version} = require("../package.json");

const EOL = require('os').EOL;

function readTemplate(templateFileName: string): string {
    let templateFile = path.resolve(__dirname, "..", "templates", templateFileName);
    return fs.readFileSync(templateFile, {flag: "r", encoding: "utf-8"});
}

function getMethodSeparator(): string {
    return EOL + EOL;
}

function getClassSeparator(): string {
    return EOL + EOL;
}

enum CodeGetDefClassKind {
    FreeClass,
    Data,
    Service,
    Message
}

function getClassDef<MT>(logContext: string, kind: CodeGetDefClassKind, source: any, templates: any, mt: new() => MT, methodNameMod: ((name: string, returnType: string) => { name: string, returnType: string }) | null = null) {

    let extendsStr = "";
    let what=""
    switch(kind){
        case CodeGetDefClassKind.FreeClass:
            what = "free class";
            break;
        case CodeGetDefClassKind.Data:
            what = "data class";
            extendsStr = " extends Data "
            break;
        case CodeGetDefClassKind.Service:
            what = "service class";
            extendsStr = " extends Service "
            break;
        case CodeGetDefClassKind.Message:
            what = "message class";
            extendsStr = " extends Message "
            break;
    }

    const className = source.className();
    if (!className)
        throw new Error(logRemoteError(logContext, `Unable to read ${what} from the warp index because the name was empty`));

    let ctorStr = '';
    if (source.ctor) {
        const ctor = source.ctor(new ConstructorProto());
        if (ctor) {
            let args = [];
            for (let j = 0; j < ctor.argumentsLength(); ++j) {
                const argument = ctor.arguments(j, new MethodArgumentProto());
                if (!argument)
                    throw new Error(logRemoteError(logContext, `Unable to read ${what} constructor argument from the warp index because the argument was empty`));
                const name = argument.name();
                if (!name)
                    throw new Error(logRemoteError(logContext, `Unable to read ${what} constructor argument name from the warp index because the argument name was empty`));
                const type = argument.type();
                if (!type)
                    throw new Error(logRemoteError(logContext, `Unable to read ${what} constructor argument type from the warp index because the argument type was empty`));
                args.push(`${name}: ${type}`);
            }
            ctorStr = Mustache.render(templates.defClassCtorTemplate, {
                ARGUMENTS: args.length > 0 ? args.join(', ') : ""
            }) + EOL;
        }
    }

    let methods = [];
    for (let j = 0; j < source.methodsLength(); ++j) {
        const method = source.methods(j, new mt());
        if (!method)
            throw new Error(logRemoteError(logContext, `Unable to read ${what} method from the warp index because it was empty`));
        let name = method.methodName();
        if (!name)
            throw new Error(logRemoteError(logContext, `Unable to read ${what} method name from the warp index because it was empty`));
        let returnType = method.returnType();
        if (!returnType)
            throw new Error(logRemoteError(logContext, `Unable to read ${what} method return type from the warp index because it was empty`));

        if (methodNameMod) {
            const adj = methodNameMod(name, returnType);
            name = adj.name;
            console.assert(name);
            returnType = adj.returnType;
            console.assert(returnType);
        }

        let args = [];
        for (let j = 0; j < method.argumentsLength(); ++j) {
            const argument = method.arguments(j, new MethodArgumentProto());
            if (!argument)
                throw new Error(logRemoteError(logContext, `Unable to read ${what} constructor argument from the warp index because the argument was empty`));
            const name = argument.name();
            if (!name)
                throw new Error(logRemoteError(logContext, `Unable to read ${what} constructor argument name from the warp index because the argument name was empty`));
            const type = argument.type();
            if (!type)
                throw new Error(logRemoteError(logContext, `Unable to read ${what} constructor argument type from the warp index because the argument type was empty`));
            args.push(`${name}: ${type}`);
        }
        const methodKind = method.methodKind ? method.methodKind() : MethodKindProto.Normal;
        switch (methodKind) {
            case MethodKindProto.Getter:
                if (args.length > 0)
                    throw new Error(logRemoteError(logContext, `Invalid ${what} method getter. It has arguments.`));
                methods.push(Mustache.render(templates.defClassGetterTemplate, {
                    METHOD_NAME: name,
                    RETURN_TYPE: returnType
                }));
                break;
            case MethodKindProto.Setter:
                if (returnType != "void")
                    throw new Error(logRemoteError(logContext, `Invalid ${what} method setter. It has a return type that's is not void.`));
                methods.push(Mustache.render(templates.defClassSetterTemplate, {
                    METHOD_NAME: name,
                    ARGUMENTS: args.length > 0 ? args.join(', ') : ""
                }))
                break;
            case MethodKindProto.Normal:
                methods.push(Mustache.render(templates.defClassMethodTemplate, {
                    METHOD_NAME: name,
                    ARGUMENTS: args.length > 0 ? args.join(', ') : "",
                    RETURN_TYPE: returnType
                }))
                break;
            default:
                throw new Error(logRemoteError(logContext, `Unable to read ${what} method kind from the warp index because it was empty`));
        }
    }

    return Mustache.render(templates.defClassTemplate, {
        EXTENDS: extendsStr,
        CLASS_NAME: className,
        CONSTRUCTOR: ctorStr,
        METHODS: methods.length > 0 ? methods.join(EOL) : ""
    });
}

function generateDefs(logContext: string, warpIndex: WarpIndexProto): string {
    requiresTruthy('logContext', logContext);
    requiresTruthy('warpIndex', warpIndex);

    const defIndexTemplate = readTemplate('def-index.mustache');
    const defClassTemplates = {
        defClassTemplate: readTemplate('def-class.mustache'),
        defClassMethodTemplate: readTemplate('def-class-method.mustache'),
        defClassGetterTemplate: readTemplate('def-class-getter.mustache'),
        defClassSetterTemplate: readTemplate('def-class-setter.mustache'),
        defClassCtorTemplate: readTemplate('def-class-ctor.mustache')
    }
    const defFunctionTemplate = readTemplate('def-function.mustache');

    const warpName = warpIndex.warpName();
    if (!warpName)
        throw new Error(logRemoteError(logContext, 'Unable to read warp index because the name was empty'));

    const warpId = Unsigned.fromLong(warpIndex.warpId());
    if (warpId.equals(UnsignedZero))
        throw new Error(logRemoteError(logContext, 'Unable to read warp index because the warp id was invalid'));

    const warpVersion = Unsigned.fromLong(warpIndex.warpVersion());
    if (warpVersion.equals(UnsignedZero))
        throw new Error(logRemoteError(logContext, 'Unable to read warp index because the warp version was invalid'));

    let freeFunctionDefs = [];
    for (let i = 0; i < warpIndex.freeFunctionsLength(); ++i) {
        const freeFunction = warpIndex.freeFunctions(i, new FreeFunctionProto());
        if (!freeFunction)
            throw new Error(logRemoteError(logContext, 'Unable to read free function from the warp index because it contained invalid data'));

        const functionName = freeFunction.functionName();
        if (!functionName)
            throw new Error(logRemoteError(logContext, 'Unable to read free function from the warp index because the function name was empty'));

        const returnType = freeFunction.returnType();
        if (!returnType)
            throw new Error(logRemoteError(logContext, 'Unable to read free function from the warp index because the return type was empty'));

        let args = [];
        for (let j = 0; j < freeFunction.argumentsLength(); ++j) {
            const argument = freeFunction.arguments(j, new MethodArgumentProto());
            if (!argument)
                throw new Error(logRemoteError(logContext, 'Unable to read free function argument from the warp index because the argument was empty'));
            const name = argument.name();
            if (!name)
                throw new Error(logRemoteError(logContext, 'Unable to read free function argument name from the warp index because the argument name was empty'));
            const type = argument.type();
            if (!type)
                throw new Error(logRemoteError(logContext, 'Unable to read free function argument type from the warp index because the argument type was empty'));
            args.push(`${name}: ${type}`);
        }

        freeFunctionDefs.push(Mustache.render(defFunctionTemplate, {
            FUNCTION_NAME: functionName,
            ARGUMENTS: args.length > 0 ? args.join(', ') : "",
            RETURN_TYPE: returnType
        }));
    }

    let classDefs = [];

    for (let i = 0; i < warpIndex.freeClassesLength(); ++i) {
        const freeClass = warpIndex.freeClasses(i, new FreeClassProto());
        if (!freeClass)
            throw new Error(logRemoteError(logContext, 'Unable to read free class from the warp index because it contained invalid data'));
        classDefs.push(getClassDef<MethodProto>(logContext, CodeGetDefClassKind.FreeClass, freeClass, defClassTemplates, MethodProto));
    }

    for (let i = 0; i < warpIndex.dataClassesLength(); ++i) {
        const dataClass = warpIndex.dataClasses(i, new DataClassProto());
        if (!dataClass)
            throw new Error(logRemoteError(logContext, 'Unable to read data class from the warp index because it contained invalid data'));
        classDefs.push(getClassDef<MethodProto>(logContext, CodeGetDefClassKind.Data, dataClass, defClassTemplates, MethodProto));
    }

    for (let i = 0; i < warpIndex.messageClassesLength(); ++i) {
        const messageClass = warpIndex.messageClasses(i, new MessageClassProto());
        if (!messageClass)
            throw new Error(logRemoteError(logContext, 'Unable to read message class from the warp index because it contained invalid data'));
        classDefs.push(getClassDef<MethodProto>(logContext, CodeGetDefClassKind.Message, messageClass, defClassTemplates, MethodProto));
    }

    for (let i = 0; i < warpIndex.serviceClassesLength(); ++i) {
        const serviceClass = warpIndex.serviceClasses(i, new ServiceClassProto());
        if (!serviceClass)
            throw new Error(logRemoteError(logContext, 'Unable to read warp service class from the warp index because it contained invalid data'));
        classDefs.push(getClassDef<ServiceMethodProto>(logContext,
            CodeGetDefClassKind.Service,
            serviceClass,
            defClassTemplates,
            ServiceMethodProto,
            (name: string, returnType: string) => {
                return {name: name + "Async", returnType: `Promise<${returnType}>`}
            }));
    }

    return Mustache.render(defIndexTemplate, {
        FUNCTIONS: freeFunctionDefs.length > 0 ? freeFunctionDefs.join(getClassSeparator()) + getClassSeparator() : "",
        CLASSES: classDefs.length > 0 ? classDefs.join(getClassSeparator()) + getClassSeparator() : ""
    });
}

class GeneratedClient {
    constructor(public package_json: string, public index_js: string) {
        requiresTruthy('package_json', package_json);
        requiresTruthy('index_js', index_js);
    }
}

function generateClient(logContext: string, isEsm: boolean, userKey: string, warpIndex: WarpIndexProto, regenCommand: string): GeneratedClient {
    requiresTruthy('logContext', logContext);
    requiresTruthy('userKey', userKey);
    requiresTruthy('warpIndex', warpIndex);
    requiresTruthy('regenCommand', regenCommand);

    const clientExports = [];

    //read in the templates
    const indexTemplate = readTemplate("index.mustache");
    const messageTemplate = readTemplate("message.mustache");
    const dataTemplate = readTemplate("data.mustache");
    const serviceTemplate = readTemplate("service.mustache");
    const serviceMethodTemplate = readTemplate("service-method.mustache");

    const warpName = warpIndex.warpName();
    if (!warpName)
        throw new Error(logRemoteError(logContext, 'Unable to read warp index because the name was empty'));

    const warpId = Unsigned.fromLong(warpIndex.warpId());
    if (warpId.equals(UnsignedZero))
        throw new Error(logRemoteError(logContext, 'Unable to read warp index because the warp id was invalid'));

    const warpVersion = Unsigned.fromLong(warpIndex.warpVersion());
    if (warpVersion.equals(UnsignedZero))
        throw new Error(logRemoteError(logContext, 'Unable to read warp index because the warp version was invalid'));

    let freeFunctions = [];
    for (let i = 0; i < warpIndex.freeFunctionsLength(); ++i) {
        const freeFunction = warpIndex.freeFunctions(i, new FreeFunctionProto());
        if (!freeFunction)
            throw new Error(logRemoteError(logContext, 'Unable to read free function from the warp index because it contained invalid data'));
        const code = freeFunction.sourceCode();
        if (!code)
            throw new Error(logRemoteError(logContext, 'Unable to read free function from the warp index because the source code was empty'))
        freeFunctions.push(code);
        const functionName = freeFunction.functionName();
        if (!functionName)
            throw new Error(logRemoteError(logContext, 'Unable to read free function from the warp index because the function name was empty'));
        clientExports.push(functionName);
    }

    let freeClasses = [];
    for (let i = 0; i < warpIndex.freeClassesLength(); ++i) {
        const freeClass = warpIndex.freeClasses(i, new FreeClassProto());
        if (!freeClass)
            throw new Error(logRemoteError(logContext, 'Unable to read free class from the warp index because it contained invalid data'));
        const code = freeClass.sourceCode();
        if (!code)
            throw new Error(logRemoteError(logContext, 'Unable to read free class from the warp index because the source code was empty'))

        const className = freeClass.className();
        if (!className)
            throw new Error(logRemoteError(logContext, 'Unable to read free class name from the warp index because it contained invalid data'));

        clientExports.push(className);
        freeClasses.push(code);
    }

    let dataClasses = [];
    for (let i = 0; i < warpIndex.dataClassesLength(); ++i) {
        const dataClass = warpIndex.dataClasses(i, new DataClassProto());
        if (!dataClass)
            throw new Error(logRemoteError(logContext, 'Unable to read data class from the warp index because it contained invalid data'));
        const name = dataClass.className();
        if (!name)
            throw new Error(logRemoteError(logContext, 'Unable to read data class from the warp index because the name was empty'));

        clientExports.push(name);

        const classId = dataClass.classId();
        if (classId <= 0)
            throw new Error(logRemoteError(logContext, 'Unable to read data class from the warp index because the class id was invalid'));
        const code = dataClass.sourceCode();
        if (!code)
            throw new Error(logRemoteError(logContext, 'Unable to read data class from the warp index because the source code was empty'));

        dataClasses.push(Mustache.render(dataTemplate, {
            ESM_EXPORT: isEsm ? "export " : "",
            CODE: code,
            CLASS_NAME: name,
            CLASS_ID: classId
        }));
    }

    let messageClasses = [];
    for (let i = 0; i < warpIndex.messageClassesLength(); ++i) {
        const eventClass = warpIndex.messageClasses(i, new MessageClassProto());
        if (!eventClass)
            throw new Error(logRemoteError(logContext, 'Unable to read message class from the warp index because it contained invalid data'));
        const name = eventClass.className();
        if (!name)
            throw new Error(logRemoteError(logContext, 'Unable to read message class from the warp index because the name was empty'));
        const classId = eventClass.classId();
        if (classId <= 0)
            throw new Error(logRemoteError(logContext, 'Unable to read message class from the warp index because the class id was invalid'));
        const code = eventClass.sourceCode();
        if (!code)
            throw new Error(logRemoteError(logContext, 'Unable to read message class from the warp index because the source code was empty'));

        messageClasses.push(Mustache.render(messageTemplate, {
            ESM_EXPORT: isEsm ? "export " : "",
            CODE: code,
            CLASS_NAME: name,
            CLASS_ID: classId
        }));

        clientExports.push(name);
    }

    let serviceClasses = [];
    for (let i = 0; i < warpIndex.serviceClassesLength(); ++i) {
        const serviceClass = warpIndex.serviceClasses(i, new ServiceClassProto());
        if (!serviceClass)
            throw new Error(logRemoteError(logContext, 'Unable to read service class from the warp index because it contained invalid data'));
        const className = serviceClass.className();
        if (!className)
            throw new Error(logRemoteError(logContext, 'Unable to read service class from the warp index because the name was empty'));

        clientExports.push(className);

        const classId = serviceClass.classId();
        if (classId <= 0)
            throw new Error(logRemoteError(logContext, 'Unable to read service class from the warp index because the class id was invalid'));

        const serviceMethods = [];
        for (let j = 0; j < serviceClass.methodsLength(); ++j) {
            const serviceMethod = serviceClass.methods(j, new ServiceMethodProto());
            if (!serviceMethod)
                throw new Error(logRemoteError(logContext, 'Unable to read service method from the warp index because it contained invalid data'));
            const methodName = serviceMethod.methodName();
            if (!methodName)
                throw new Error(logRemoteError(logContext, 'Unable to read service method from the warp index because the name was empty'));
            const methodId = serviceMethod.methodId();
            if (methodId <= 0)
                throw new Error(logRemoteError(logContext, 'Unable to read service method from the warp index because the method id was invalid'));

            const methodArguments = [];
            for (let k = 0; k < serviceMethod.argumentsLength(); ++k) {
                const methodArgument = serviceMethod.arguments(k, new MethodArgumentProto());
                if (!methodArgument)
                    throw new Error(logRemoteError(logContext, 'Unable to read service method argument from the warp index because it contained invalid data'));
                const methodArgumentName = methodArgument.name();
                if (!methodArgumentName)
                    throw new Error(logRemoteError(logContext, 'Unable to read service method argument from the warp index because the name was empty'));
                methodArguments.push(methodArgumentName)
            }

            let methodArgsPassString = "";
            if (methodArguments.length > 0) {
                methodArgsPassString = ", " + methodArguments.join(', ');
            }

            serviceMethods.push(Mustache.render(serviceMethodTemplate, {
                METHOD_NAME: methodName,
                METHOD_ARGS_SIG: methodArguments.join(', '),
                METHOD_ID: methodId,
                METHOD_ARGS_PASS_STRING: methodArgsPassString
            }));
        }

        let methodsString = "";
        if (serviceMethods.length) {
            methodsString = EOL + serviceMethods.join(getMethodSeparator());
        }

        serviceClasses.push(Mustache.render(serviceTemplate, {
            ESM_EXPORT: isEsm ? "export " : "",
            CLASS_NAME: className,
            METHODS: methodsString,
            CLASS_ID: classId
        }));
    }

    let cjsExports = "";
    if (!isEsm) {
        cjsExports = Mustache.render(readTemplate('index-exports-cjs.mustache'), {
            EXPORTS: clientExports.join(', ')
        });
    }

    const index_js = Mustache.render(indexTemplate, {
        "BUILD_INFO": BUILD_INFO,
        STACKLESS_TOOLS_VERSION: version,
        IMPORT: isEsm ? readTemplate("index-import-esm.js") : readTemplate("index-import-cjs.js"),
        CJS_EXPORT: cjsExports,
        REGEN_COMMAND: regenCommand,
        WARP_NAME: warpName,
        USER_KEY: userKey,
        WARP_ID: warpId.toString(),
        WARP_VERSION: warpVersion.toString(),
        FREE_FUNCTIONS: freeFunctions.length > 0 ? freeFunctions.join(getClassSeparator()) + getClassSeparator() : "",
        FREE_CLASSES: freeClasses.length > 0 ? freeClasses.join(getClassSeparator()) + getClassSeparator() : "",
        DATA: dataClasses.length > 0 ? dataClasses.join(getClassSeparator()) + getClassSeparator() : "",
        MESSAGES: messageClasses.length > 0 ? messageClasses.join(getClassSeparator()) + getClassSeparator() : "",
        SERVICES: serviceClasses.length > 0 ? serviceClasses.join(getClassSeparator()) : ""
    });

    const package_json = isEsm ?
        readTemplate("package-json-esm.json") :
        readTemplate("package-json-cjs.json");

    return new GeneratedClient(package_json, index_js);
}

function generateRootPackage(packageName: string, warpVersion: Unsigned) : string {
    return Mustache.render(readTemplate("root-package-json.mustache"), {
        PACKAGE_NAME: packageName,
        VERSION: `${warpVersion.toString()}.0.0`
    })
}

export function createClient(logContext: string, userKey: string, warpIndex: WarpIndexProto, regenCommand: string, projectDir: string) :
    {packageName: string, relRootPath: string, wasUpdate: boolean} {

    if (!fs.existsSync(projectDir)) {
        throw new Error(logLocalError("Destination project directory does not exist."));
    }

    // Create the package name and the root package
    const warpName = warpIndex.warpName();
    if(!warpName)
        throw new Error(logLocalError("Warp name was empty"));
    let canonicalWarpName = warpName.toLowerCase();
    let packageName = ""
    if(!canonicalWarpName.includes("warp")) {
        packageName = canonicalWarpName
        if(!canonicalWarpName.endsWith('-')) {
            packageName += '-';
        }
        packageName += 'warp';
    } else {
        packageName = canonicalWarpName;
    }

    const warpVersion = Unsigned.fromLong(warpIndex.warpVersion());
    if(warpVersion.equals(UnsignedZero))
        throw new Error(logLocalError(`Invalid warp version`));

    const rootPackage = generateRootPackage(packageName, warpVersion);

    // Generate the type definitions
    const defs = generateDefs(logContext, warpIndex);

    // Generate the CJS client
    const cjsClient = generateClient(logContext, false, userKey, warpIndex, regenCommand);

    // Generate the ESM client
    const esmClient = generateClient(logContext, true, userKey, warpIndex, regenCommand);

    // create necessary directories
    const relRootPath = ".stackless/generated-clients/" + canonicalWarpName;
    const rootDir = path.join(projectDir, relRootPath);
    const cjsDir = path.join(rootDir, "cjs");
    const esmDir = path.join(rootDir, "esm");

    let isUpdate = false;

    // Remove it first so no old code hangs around
    if (fs.existsSync(rootDir)) {
        isUpdate = true;
        fs.rmSync(rootDir, {recursive: true, force: true});
    }

    fs.mkdirSync(rootDir, {recursive: true});
    fs.mkdirSync(cjsDir, {recursive: false});
    fs.mkdirSync(esmDir, {recursive: false});

    //write the files
    fs.writeFileSync(path.join(rootDir, "package.json"), rootPackage, {encoding: "utf8"})
    fs.writeFileSync(path.join(rootDir, "index.d.ts"), defs, { encoding: "utf8"});
    fs.writeFileSync(path.join(cjsDir, "package.json"), cjsClient.package_json, { encoding: "utf8"});
    fs.writeFileSync(path.join(cjsDir, "index.js"), cjsClient.index_js, { encoding: "utf8"});
    fs.writeFileSync(path.join(esmDir, "package.json"), esmClient.package_json, { encoding: "utf8"});
    fs.writeFileSync(path.join(esmDir, "index.js"), esmClient.index_js, { encoding: "utf8"});

    return {packageName, relRootPath, wasUpdate: isUpdate};
}