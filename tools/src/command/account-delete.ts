import {logRemoteError, logOk} from "../util/logging";
import {AdminKeyFile, isLoggedIn} from "../model/admin-key-file";
import {JayneSingleton} from "../service/jayne";
import {Command} from "commander";
import inquirer from "inquirer";
import {emailValidatorAsync} from "../util/validators";
import {LoginInfo} from "../model/login-info";
import {loginGoogleIdentityAsync, logoutAsync} from "./account-login";
import {createLogContext} from "../util/log-context";
import {GoogleIdentitySingleton} from "../service/google-identity";

export function createAccountDeleteProgramCommand(before: any, attachTo: Command) {
    attachTo.command('delete')
        .description('Delete your Stackless account including all its code and objects.')
        .requiredOption("--yes-im-sure-i-want-to-delete-my-account", "Required because this operation is destructive and cannot be undone (even by Stackless support).")
        .action(async () => {
            if (before)
                before();
            const loginInfo = await getLoginInfo();
            if (await executeAccountDeleteAsync(loginInfo)) {
                process.exitCode = 0;
            } else {
                process.exitCode = 1;
            }
        });
}

function getLoginInfo(): Promise<LoginInfo> {
    return new Promise<LoginInfo>(resolve => {
        console.log("You must login with your username and password to be able to delete you Stackless account.")
        inquirer.prompt([{
            name: 'username',
            message: 'Username (email):',
            validate: emailValidatorAsync
        }]).then(usernameAnswer => {
            inquirer.prompt([
                {
                    name: 'password',
                    type: 'password',
                    message: 'Password:',
                    mask: '*'
                }
            ]).then(passwordAnswer => {
                resolve(new LoginInfo(false, usernameAnswer.username, passwordAnswer.password));
            });
        });
    });
}

export async function executeAccountDeleteAsync(loginInfo: LoginInfo): Promise<boolean> {
    const logContext = createLogContext();
    try {
        await loginGoogleIdentityAsync(loginInfo.username, loginInfo.password);

        await JayneSingleton.deleteAccountAsync(logContext);

        await logoutAsync();

        if (AdminKeyFile.exists())
            AdminKeyFile.delete();

        logOk("Stackless account deleted");
        return true;
    } catch (e: any) {
        logRemoteError(logContext, e.message);
        return false;
    }
}