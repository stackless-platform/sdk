import ts, {ScriptTarget} from "typescript";
import {EOL} from 'os';
import chalk from "chalk";
import {ByteBuffer} from "flatbuffers";
import fs, {PathLike} from "fs";
import path from "path";

import {WARP_RUNTIME_PACKAGE_NAME} from "../constants.js";
import {WarpConfig} from "../model/warp-config.js";
import {getColor, logLocalError, logVerbose} from "./logging.js";
import {getDirname} from "./dirname.js";
import {createDir, recreateDir} from "./loud-fs.js";
import CompilerOptions = ts.CompilerOptions;

interface CompilerOutput {
    warpIndexBytes: ByteBuffer;
    files: [];
}

function _findFilesByExtension(baseDir: string,
                               dir: string,
                               extensions: Set<string>,
                               files: string[],
                               badExtensions: Set<string> | null,
                               skipDirs: Set<string> | null,
                               uniqueBaseNames: Set<string> | null): string[] {

    let list = fs.readdirSync(dir);
    list.forEach(function (fileName) {
        const pathName = path.join(dir, fileName);
        let stat = fs.statSync(pathName);
        if (stat && stat.isDirectory()) {
            if (!skipDirs?.has(fileName)) {
                _findFilesByExtension(baseDir, pathName, extensions, files, badExtensions, skipDirs, uniqueBaseNames);
            }
        }
        if (extensions.has(path.extname(pathName))) {
            if (uniqueBaseNames) {
                const p = path.parse(pathName);
                const baseName = path.join(p.dir, p.name);
                if (uniqueBaseNames.has(baseName)) {
                    throw new Error(logLocalError(`Duplicate file found. Cannot have multiple modules with the same base name (name without a file extension). File: ${pathName}`));
                }
                uniqueBaseNames.add(baseName);
            }
            files!.push(pathName);
        }
    });
    return files;
}

function findFilesByExtension(dir: string,
                              extensions: string[],
                              uniqueBaseName: boolean = true,
                              badExtensions?: string[],
                              skipDirs?: string[]) {
    return _findFilesByExtension(
        dir,
        dir,
        new Set<string>(extensions),
        [],
        new Set<string>(badExtensions) ?? null,
        new Set<string>(skipDirs) ?? null,
        uniqueBaseName ? new Set<string>() : null);
}

const LocalImportTransformer = <T extends ts.Node>(context: ts.TransformationContext) => (rootNode: T) => {
    function visit(node: ts.Node): ts.Node {
        // replace import
        if (node.parent &&
            node.parent.kind === ts.SyntaxKind.ImportDeclaration &&
            node.kind === ts.SyntaxKind.StringLiteral) {
            const literal = node as ts.StringLiteral;
            const text = literal.text;
            if (text && text.startsWith('.') && !path.extname(text)) {
                return context.factory.createStringLiteral(text + '.js');
            }
        }
        return ts.visitEachChild(node, visit, context);
    }
    return ts.visitNode(rootNode, visit);
};

function compileTypeScript(fileNames: string[], options: CompilerOptions) {
    let program = ts.createProgram(fileNames, options);

    let emitResult = program.emit();

    let allDiagnostics = ts
        .getPreEmitDiagnostics(program)
        .concat(emitResult.diagnostics);

    let errors: string[] = [];
    let warnings: string[] = [];

    allDiagnostics.forEach(diagnostic => {
        let target;
        if (diagnostic.category === ts.DiagnosticCategory.Error)
            target = errors;
        else if (diagnostic.category === ts.DiagnosticCategory.Warning)
            target = warnings;
        else
            return;

        if (diagnostic.file) {
            let {line, character} = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start!);
            let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, EOL);
            target.push(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
        } else {
            target.push(ts.flattenDiagnosticMessageText(diagnostic.messageText, EOL));
        }
    });

    if (warnings.length > 0) {
        console.log(`${warnings.length} Warning${warnings.length > 1 ? "s" : ""}:`);
        warnings.forEach(warning => {
            console.log(getColor(chalk.yellowBright, warning));
        });
    }
    if (errors.length > 0) {
        if (warnings.length > 0)
            console.log("");
        console.log(`${errors.length} Error${errors.length > 1 ? "s" : ""}:`);
        errors.forEach(error => {
            console.log(getColor(chalk.redBright, error));
        });
        throw new Error("TypeScript compilation failed");
    }
}

function copyBuildFile(src: PathLike, target: PathLike) {
    fs.copyFileSync(src, target);
    logVerbose(`${src} -> ${target}`);
}

function writePackageJson(target: PathLike, obj: any) {
    fs.writeFileSync(target, JSON.stringify(obj), {encoding: "utf8"});
    logVerbose(`Wrote ${target}`);
}

class Init {
    data: any[] = [];
    services: any[] = [];
    messages: any[] = [];

    registerData(dataType: any): void {
        this.data.push(dataType);
    }

    registerService(serviceType: any): void {
        this.services.push(serviceType);
    }

    registerMessage(messageType: any): void {
        this.messages.push(messageType);
    }
}

function writeRuntimeStub(dir: string, decl: boolean) {
    // make a node_modules directory to make TSC happy
    const modulesDirName = 'node_modules';
    const modulesDir = path.join(dir, modulesDirName);
    fs.mkdirSync(modulesDir);

    const dirname = getDirname(import.meta.url);

    const targetDir = path.join(modulesDir, WARP_RUNTIME_PACKAGE_NAME);
    fs.mkdirSync(targetDir);
    copyBuildFile(path.resolve(dirname, '..', 'templates', 'runtime-stub.js'),
        path.join(targetDir, 'index.mjs'));
    if (decl) {
        copyBuildFile(path.resolve(dirname, '..', 'templates', 'runtime-index.d.ts'),
            path.join(targetDir, 'index.d.ts'));
    }
    writePackageJson(path.join(targetDir, 'package.json'), {
        "name": WARP_RUNTIME_PACKAGE_NAME,
        "main": 'index.mjs',
        "type": "module",
        "private": true
    });
}

function writeWarpPackageJson(dir: string) {
    writePackageJson(path.join(dir, 'package.json'), {
        "name": "warp-package",
        "type": "module",
        "private": true
    });
}

function writeMessage(dirMessage: string, file: PathLike) {
    fs.writeFileSync(file, dirMessage, {encoding: "utf8"});
}

interface CompileForIndexCreationResult {
    schemaOutDir: string;
    declOutDir: string;
}

function parseAndStage(inDir: PathLike, outDir: PathLike, options: ts.CompilerOptions) : string[] {
    const id = inDir.toString();
    let sourceFiles = findFilesByExtension(
        id,
        ['.ts', '.js', '.mjs'],
        true, // Because that's how the warp runtime works; it doesn't care about extensions.
        ['.d.ts']);
    let program = ts.createProgram(sourceFiles, options);
    const fileNames = [];
    for (const fileName of sourceFiles) {
        fileNames.push(program.getSourceFile(fileName)!);
    }
    const printer = ts.createPrinter();
    const result = ts.transform<ts.SourceFile>(fileNames, [LocalImportTransformer], options);
    createDir(outDir);
    const od = outDir.toString();
    const stagedFiles = [];
    for (const sfo of result.transformed) {
        const f = sfo.fileName;
        const target = path.join(od, f.substring(id.length));
        fs.writeFileSync(target, printer.printFile(sfo), {encoding:"utf8"});
        logVerbose(`Staged ${f}`);
        stagedFiles.push(target);
    }
    return stagedFiles;
}

function compileForIndexCreation(warpName: string,
                                 srcDir: string,
                                 buildDir: string): CompileForIndexCreationResult {
    if (!(fs.existsSync(srcDir) && fs.statSync(srcDir).isDirectory()))
        throw new Error(logLocalError(`Missing or invalid source directory ${srcDir}`));

    logVerbose(`Compiling ${srcDir} for schema creation...`);

    recreateDir(buildDir);

    const objDir = path.join(buildDir, 'obj');

    const compilerOptions = <ts.CompilerOptions> {
        noImplicitAny: true,
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        noEmit: true,
        allowJs: true,
        strict: true
    };

    const stagedFiles = parseAndStage(srcDir, objDir, compilerOptions);

    writeRuntimeStub(objDir, true);
    writeWarpPackageJson(objDir);

    const outDir = path.join(buildDir, 'out');
    createDir(outDir);

    const schemaOutDir = path.resolve(outDir, 'schema');
    const declOutDir = path.resolve(outDir, 'decl');

    compilerOptions.noEmit = false;
    compilerOptions.declaration = true;
    compilerOptions.noEmitOnError = true;
    compilerOptions.declarationDir = declOutDir;
    compilerOptions.outDir = schemaOutDir;

    compileTypeScript(stagedFiles, compilerOptions);

    writeRuntimeStub(schemaOutDir, false);
    writeWarpPackageJson(schemaOutDir);

    const dirMessage =
        "Note for the curious:\n" +
        "This directory is used to load the warp's code into the local node process, so I can reflect upon its types\n" +
        "and build the warp index (the FlatBuffers binary file that describes the warp to the engine). The presence\n" +
        "of the node_modules folder and the package.json file may make you think that Stackless uses Node.js/Deno on\n" +
        "the backend. It doesn't, it's a custom C++ system built from the ground up for the cloud (aka Cloud Native).\n" +
        "- Scott Jones - June 16th 2022";
    writeMessage(dirMessage, path.join(schemaOutDir, 'README.txt'));

    return {schemaOutDir, declOutDir};
}

export async function compile(warpDir: string): Promise<CompilerOutput> {
    if (!WarpConfig.fileExists(warpDir)) {
        throw new Error(logLocalError(`${warpDir} is not a warp. You may need to run 'warp init' in that directory.`));
    }

    let warpConfig = await WarpConfig.open(warpDir);

    const buildDir = path.join(warpDir, '.build');

    // compile the warp for index creation
    const {schemaOutDir, declOutDir} = compileForIndexCreation(warpConfig.warp, warpDir, buildDir);

    // load the module that the warp.json has specified in the onBoot field
    const onBootModulePath = path.join(schemaOutDir, warpConfig.onBootModule + '.js');
    if (!fs.existsSync(onBootModulePath)) {
        throw new Error(logLocalError(`The onBootModule ${onBootModulePath} was not found`));
    }
    let onBootModule = null;
    try {
        onBootModule = await import(onBootModulePath);
    } catch (reason) {
        throw new Error(logLocalError(`Failed while loading onBootModule: ${reason}`));
    }

    // run onBoot to get registered functions
    const init = new Init();
    try {
        onBootModule.onBoot(init);
    } catch (reason) {
        throw new Error(logLocalError(`Failed while calling onBoot locally to build the warp index: ${reason}`));
    }

    // - load the onBootModule dynamically and call its onBoot exported function
    // 3. parse types out and match them to the registered functions
    // 4. create the warp_index from both the registered functions and the types

    return { // stubbed
        warpIndexBytes: new ByteBuffer(new Uint8Array()),
        files: []
    };
}

