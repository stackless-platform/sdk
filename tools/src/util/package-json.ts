import fs from "fs";
import path from "path";
import {getDirname} from "./dirname.js";
export function getPackageJsonVersion() : string {
    const dirname = getDirname(import.meta.url);
    const {version} = JSON.parse(fs.readFileSync(path.join(dirname, "..", "package.json"), {flag: "r", encoding: "utf-8"}));
    return version;
}