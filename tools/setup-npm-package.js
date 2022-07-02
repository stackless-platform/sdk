import fs from "fs";

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
const PACKAGE_CONFIG = JSON.parse(fs.readFileSync("./package-config.json").toString('utf-8'));

PACKAGE_OBJ.name = PACKAGE_CONFIG.name;

if(PACKAGE_CONFIG.private) {
    PACKAGE_OBJ.private = true;
} else {
    delete PACKAGE_OBJ.private;
}

PACKAGE_OBJ.version = VERSION_OBJ.version;
PACKAGE_OBJ.scripts = {};
PACKAGE_OBJ.devDependencies = {};

fs.writeFileSync(`${DIST_DIR}/package.json`, Buffer.from(JSON.stringify(PACKAGE_OBJ, null, 2), "utf-8") );