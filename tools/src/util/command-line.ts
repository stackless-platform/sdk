// @ts-ignore
import {box} from "ascii-box";
import {Command, program} from "commander";
import chalk from "chalk";
import figlet from "figlet";

import {createAccountLoginProgramCommand} from "../command/account-login.js";
import {createAccountDeleteProgramCommand} from "../command/account-delete.js";
import {createInitProgramCommand} from "../command/init.js";
import {GlobalOptions} from "./global-options.js";
import {createBootProgramCommand} from "../command/boot.js";
import {createConnectProgramCommand} from "../command/connect.js";
import {createListProgramCommand} from "../command/list.js";
import {createDeleteProgramCommand} from "../command/delete.js";
import {DISCORD_INVITE_URL} from "../config.js";
import {SERVICE_WARNINGS} from "../service-notice.js";
import {getPackageJsonVersion} from "./package-json.js";

function showLogo() {
    //display the header
    console.log(chalk.blueBright(
        figlet.textSync('Stackless', "Cybermedium")
    ));
    console.log(chalk.blueBright("Copyright (c) 2022 Warpdrive Technologies, Inc. All Rights Reserved."));
    console.log();
    console.log(chalk.gray("Stackless Community: ") + DISCORD_INVITE_URL);
    console.log()
}

function showServiceWarning() {
    for(let serviceWarning of SERVICE_WARNINGS) {
        if(serviceWarning.show) {
            console.log(box(
                `${serviceWarning.title} - ${serviceWarning.date.toLocaleString()}

${serviceWarning.details}`,
                {
                    border: 'round',
                    color: serviceWarning.color,
                    maxWidth: serviceWarning.maxWidth
                }
            ));
        }
    }
}

export function processCommandLineOptions() {
    const accountCommand = new Command('account')
        .storeOptionsAsProperties(false)
        .passCommandToAction(false)
        .description("Manage your Stackless account");
    program.option('--version', "Output the version of stackless-tools and exit.")
    program.option('--no-logo', "Don't show the Stackless logo on start");
    program.option('-v, --verbose', "Show verbose messages");
    program.option('--quiet', "Don't show any success/ok messages (implies --no-logo).");
    program.on('option:no-logo', function() {
        GlobalOptions.showLogo = false;
    });
    program.on('option:verbose', function () {
        GlobalOptions.verbose = true;
    });
    program.on('option:quiet', function () {
        GlobalOptions.showLogo = false;
        GlobalOptions.quiet = true;
    });
    program.on('option:version', function () {
        console.log(getPackageJsonVersion());
        process.exit(0);
    });
    let before = () => {
        if(GlobalOptions.showLogo)
            showLogo();
        if(!GlobalOptions.quiet)
            showServiceWarning();
    }
    createInitProgramCommand(before);
    createAccountLoginProgramCommand(before, <Command>accountCommand);
    createAccountDeleteProgramCommand(before, <Command>accountCommand);
    createBootProgramCommand(before);
    createConnectProgramCommand(before);
    createListProgramCommand(before);
    createDeleteProgramCommand(before);
    program.addCommand(accountCommand);
    program.parse(process.argv);
}