import chalk from "chalk";
import * as figlet from "figlet";
import {createAccountLoginProgramCommand} from "../command/account-login";
import {createAccountDeleteProgramCommand} from "../command/account-delete";
import {createInitProgramCommand} from "../command/init";
const { program, Command } = require('commander');
import {GlobalOptions} from "./global-options";
import {createBootProgramCommand} from "../command/boot";
import {createConnectProgramCommand} from "../command/connect";
import {createListProgramCommand} from "../command/list";
import {createDeleteProgramCommand} from "../command/delete";
import {DISCORD_INVITE_URL} from "../config";
import {SERVICE_WARNINGS} from "../service-notice";

const {version} = require("../package.json");
// @ts-ignore
import {box} from "ascii-box";

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
        console.log(version);
        process.exit(0);
    });
    let before = () => {
        if(GlobalOptions.showLogo)
            showLogo();
        if(!GlobalOptions.quiet)
            showServiceWarning();
    }
    createInitProgramCommand(before);
    createAccountLoginProgramCommand(before, accountCommand);
    createAccountDeleteProgramCommand(before, accountCommand);
    createBootProgramCommand(before);
    createConnectProgramCommand(before);
    createListProgramCommand(before);
    createDeleteProgramCommand(before);
    program.addCommand(accountCommand);
    program.parse(process.argv);
}