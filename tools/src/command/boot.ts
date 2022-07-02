import { program } from "commander";
import { logRemoteError, logOk, logLocalError, logSuccess } from "../util/logging.js";
import {
    IdentityClassMapping,
    WarpClassMapping,
    WarpSrcClassTagMapping,
    WarpConfig,
    WarpIdentity
} from "../model/warp-config.js";
import fs from "fs";
import path from "path";
import crc32 from "crc-32";
import { JayneSingleton, WarpFileContent } from "../service/jayne.js";
import { uuidv4 } from "../util/util.js";
import { createLogContext } from "../util/log-context.js";
import { WARP_RUNTIME_PACKAGE_NAME } from "../constants.js";
import { compile } from "../util/compiler.js";

export function createBootProgramCommand(before: any) {
    program.command('boot [warpDir]')
        .description('Upload the code changes in [warpDir] to the warp it points to and boot it up, creating a new warp version. Clients must run warp connect to get the new version. The current directory is used if not specified.')
        .action(async (warpDir: string) => {
            if (before)
                before();
            warpDir = warpDir || process.cwd();
            if (await executeBootAsync(warpDir)) {
                process.exitCode = 0;
            } else {
                process.exitCode = 1;
            }
        });
}

function compare(l: WarpFileContent, r: WarpFileContent) {
    let comparison = 0;
    if (l.name > r.name) {
        comparison = 1;
    } else if (l.name < r.name) {
        comparison = -1;
    }
    return comparison;
}


function readWarpContent(baseDir: string, dir: string, ext?: string[]): WarpFileContent[] {
    let results: WarpFileContent[] = [];
    let list = fs.readdirSync(dir);
    const baseFileNames = new Set();
    list.forEach(function (fileName) {
        const pathName = path.join(dir, fileName);
        let stat = fs.statSync(pathName);
        if (stat && stat.isDirectory()) {
            if (fileName !== WARP_RUNTIME_PACKAGE_NAME)
                results = results.concat(readWarpContent(baseDir, pathName, ext));
        } else {
            let include = false;
            if (ext) {
                if (ext.includes(path.extname(pathName)))
                    include = true;
            } else {
                include = true;
            }
            if (include) {
                const name = path.relative(baseDir, pathName);
                const baseFileName = path.join(path.parse(name).dir, path.parse(name).name);
                if (baseFileNames.has(baseFileName)) {
                    throw new Error(logLocalError(`Duplicate file name: ${pathName}. All warp code must have unique file base names (I.e. cannot have a file named foo.js and a file named foo.mjs in the save directory.)`));
                }
                baseFileNames.add(baseFileName);
                const code = fs.readFileSync(pathName, { encoding: "utf8", flag: "r" });
                if (!code || code.trim().length == 0) {
                    throw new Error(logLocalError(`Unable to push empty code file: ${pathName}`));
                }
                results.push({
                    name: name,
                    code: code
                });
            }
        }
    });
    return results.sort(compare);
}

function getChecksum(warpName: string, warpDir: string, warpFiles: WarpFileContent[]): number {
    //note: don't need to know which one changed, just that any of them changed.
    let value = 0;

    value = crc32.bstr(warpName, value);

    warpFiles.forEach(warpFile => {
        //include the filename in the crc to detect filename changes
        value = crc32.bstr(warpFile.name, value); //note: file is already relative to warpDir
        //add the file's contents to the crc to detect file content changes
        value = crc32.bstr(warpFile.code, value);
    });

    return value;
}


export async function executeBootAsync(warpDir: string): Promise<boolean> {
    
    //this is stubbed
    const output = await compile(warpDir);
    return true;
    
    
    
    //note: does not require login because the admin key is already in warp.json



    //if there's any typescript files, compile them to alternative directory and use that instead
    // if (containsFilesWithExt(warpDir, warpDir, '.ts')) {

    // }

    // TODO: 
    // <compile>
    // <upload>
    // 5. pass the list of files to Jayne and get back a list of signed URLs to upload to
    // 6. upload the files, warp_index, and a manifest that lists all the files and necessary warp metadata to the bucket
    // 7. call boot warp with the manifest and warp_idex which updates the database and calls SetupWarp
    // 8. write the new identity to the warp.json file returned by boot warp

    // let warpFiles;
    // try
    // {
    //     warpFiles = readWarpContent(warpDir, warpDir,[".js", ".mjs"]);
    //     if (!warpFiles || warpFiles.length == 0) {
    //         logLocalError("No JavaScript files found in warp directory.");
    //         return false;
    //     }
    // }
    // catch(e) {
    //     // @ts-ignore
    //     logLocalError(e.message);
    //     return false;
    // }

    // let checksum = getChecksum(warpConfig.warp, warpDir, warpFiles);

    // const classMappings = [];

    // if (warpConfig.classes.length > 0) {
    //     for (const classTag of warpConfig.classes) {
    //         let found = false;
    //         // @ts-ignore
    //         for (const identityClass of warpConfig.identity.identityClassMappings) {
    //             if (identityClass.tag === classTag.tag) {
    //                 classMappings.push(new WarpClassMapping(classTag.name, identityClass.classId));
    //                 found = true;
    //                 break;
    //             }
    //         }
    //         if (!found) {
    //             logLocalError(`Invalid class mapping in warp.json. The class ${classTag.name} has a tag that wasn't found in identity's class mapping: ${JSON.stringify(warpConfig.identity.identityClassMappings)}.`)
    //             return false;
    //         }
    //     }
    // }

    // if (warpConfig.identity.checksum) {
    //     if (warpConfig.identity.checksum === checksum) {
    //         const prevClassNames = new Set<string>();
    //         // @ts-ignore
    //         for (const identityClassMapping of warpConfig.identity.identityClassMappings) {
    //             prevClassNames.add(identityClassMapping.className);
    //         }

    //         let hasDiff = classMappings.length !== warpConfig.identity.identityClassMappings?.length;
    //         if (!hasDiff) {
    //             for (const classMapping of classMappings) {
    //                 if (!prevClassNames.has(classMapping.className)) {
    //                     hasDiff = true;
    //                     break;
    //                 }
    //             }
    //         }

    //         if (!hasDiff) {
    //             logOk("No changes found");
    //             return true;
    //         }
    //     }
    // }

    // const adminKey = warpConfig.identity.adminKey;
    // const logContext = createLogContext();

    // try {
    //     const response = await JayneSingleton.bootWarpAsync(logContext,
    //         adminKey, warpConfig.warp, warpFiles, classMappings,
    //         warpConfig.identity.warpId,
    //         warpConfig.identity.warpVersion,
    //         warpConfig.identity.lastClassId);

    //     const classes = [];
    //     const identityClasses = [];
    //     let lastClassId = warpConfig.identity.lastClassId ?? 0;
    //     for (const warpClassMapping of response.warpClassMappings) {
    //         let tag = null;
    //         if (warpConfig.identity.identityClassMappings) {
    //             for (const prev of warpConfig.identity.identityClassMappings) {
    //                 if (prev.classId === warpClassMapping.classId) {
    //                     tag = prev.tag;
    //                     break;
    //                 }
    //             }
    //         }
    //         if (!tag) {
    //             tag = uuidv4(false);
    //         }
    //         classes.push(new WarpSrcClassTagMapping(warpClassMapping.className, tag));
    //         identityClasses.push(new IdentityClassMapping(warpClassMapping.className, warpClassMapping.classId, tag));
    //         if (warpClassMapping.classId > lastClassId)
    //             lastClassId = warpClassMapping.classId;
    //     }

    //     warpConfig.classes = classes;
    //     warpConfig.identity = new WarpIdentity(adminKey, checksum, response.warpIdStr, response.warpVersionStr, identityClasses, lastClassId);
    //     warpConfig.writeToDir(warpDir);

    //     logSuccess("Warp booted successfully!");
    //     return true;
    // } catch (e) {
    //     // @ts-ignore
    //     logRemoteError(logContext, e.message);
    //     return false;
    // }
}