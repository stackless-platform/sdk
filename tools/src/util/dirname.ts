import path from "path";
import {fileURLToPath} from "url";
import {PathLike} from "fs";

// call like: getDirname(import.meta.url)
export function getDirname(url: PathLike) {
    return path.dirname(fileURLToPath(import.meta.url));
}

