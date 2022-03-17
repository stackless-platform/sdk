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
const ROOT_PACKAGE_OBJ = JSON.parse(fs.readFileSync("./package.json").toString('utf-8'));
const VERSION_OBJ = JSON.parse(fs.readFileSync("./version.json").toString('utf-8'));
const PWD = "./";
//Configure the root package.json
ROOT_PACKAGE_OBJ.version = VERSION_OBJ.version;
ROOT_PACKAGE_OBJ.scripts = {};
ROOT_PACKAGE_OBJ.devDependencies = {};
ROOT_PACKAGE_OBJ.main = PWD + path.relative(DIST_DIR, (ROOT_PACKAGE_OBJ.main).toString());
ROOT_PACKAGE_OBJ.module = PWD + path.relative(DIST_DIR, (ROOT_PACKAGE_OBJ.module).toString());

ROOT_PACKAGE_OBJ.exports = {
    ".": {
        "import": PWD + path.relative(DIST_DIR, ROOT_PACKAGE_OBJ.exports["."]["import"]),
        "require": PWD + path.relative(DIST_DIR, ROOT_PACKAGE_OBJ.exports["."]["require"])
    },
    "./internal": {
        "import": PWD + path.relative(DIST_DIR, ROOT_PACKAGE_OBJ.exports["./internal"]["import"]),
        "require": PWD + path.relative(DIST_DIR, ROOT_PACKAGE_OBJ.exports["./internal"]["require"])
    }
}
fs.writeFileSync(`${DIST_DIR}/package.json`, Buffer.from(JSON.stringify(ROOT_PACKAGE_OBJ, null, 2), "utf-8") );

//Configure the cjs package.json
const CJS_PACKAGE_OBJ = {
    type: "commonjs"
};
fs.writeFileSync(`${DIST_DIR}/cjs/package.json`, Buffer.from(JSON.stringify(CJS_PACKAGE_OBJ, null, 2), "utf-8") );

//Configure the esm package.json
const ESM_PACKAGE_OBJ = {
    type: "module"
};
fs.writeFileSync(`${DIST_DIR}/esm/package.json`, Buffer.from(JSON.stringify(ESM_PACKAGE_OBJ, null, 2), "utf-8") );