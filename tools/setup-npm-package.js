const fs = require("fs");
const path = require("path");

function assert_env(name) {
    const val = process.env[name];
    if (typeof val === "undefined" || val === "") {
        console.error(`Missing environment variable ${name}`);
        process.exit(1);
    }
    return val;
}

const DIST_DIR = assert_env("DIST_DIR");
const PACKAGE_OBJ = JSON.parse(fs.readFileSync("./package.json").toString('utf-8'));
const VERSION_OBJ = JSON.parse(fs.readFileSync("./version.json").toString('utf-8'));

PACKAGE_OBJ.version = VERSION_OBJ.version;
PACKAGE_OBJ.scripts = {};
PACKAGE_OBJ.devDependencies = {};

fs.writeFileSync(`${DIST_DIR}/package.json`, Buffer.from(JSON.stringify(PACKAGE_OBJ, null, 2), "utf-8") );