import fs, {PathLike} from "fs";
import {logRemoteError, logOk, logSuccess, logWarning, logVerbose, logLocalError} from "../util/logging";
import {AdminKeyFile, getKeyFilePath, isLoggedIn, ADMIN_KEY_FILE_MODE} from "../model/admin-key-file";
import {GoogleIdentitySingleton} from "../service/google-identity";
import {JayneSingleton} from "../service/jayne";
import inquirer from "inquirer";
import {emailValidatorAsync, passwordValidatorAsync} from "../util/validators";
import chalk from "chalk";
import {LoginInfo} from "../model/login-info";
import {Command} from "commander";
import {createLogContext} from "../util/log-context";
import {sleepAsync} from "../util/sleep";

function loginWithKeyFile(keyFile: PathLike, overwrite: boolean): boolean {
    const keyFilePath = getKeyFilePath();

    //if a key file is specified, use that.
    if (fs.existsSync(keyFilePath) && !overwrite) {
        logWarning(`You're already logged in. Specify -o to overwrite.`);
        return false;
    }

    let keyObj = AdminKeyFile.tryFromKeyFile(keyFile);
    if (!keyObj) {
        return false;
    }

    keyObj.write();
    logSuccess("Successfully logged in");
    return true;
}

export async function loginGoogleIdentityAsync(username: string, password: string) {
    if (GoogleIdentitySingleton.isLoggedIn) {
        logVerbose("Already logged into Google Identity, logging out first");
        await GoogleIdentitySingleton.logoutAsync();
    }

    await GoogleIdentitySingleton.loginAsync(username, password);
    logVerbose("Successfully logged into Google Identity");
}

export async function loginExistingDeveloperAsync(logContext: string, username: string, password: string) {
    await loginGoogleIdentityAsync(username, password);
    let response = await JayneSingleton.loginExistingAccountAsync(logContext);
    let keyFile = new AdminKeyFile(response.adminKey);
    keyFile.write();
}

function getNewPasswordAsync(): Promise<string | void> {
    console.log("Please enter a new password at least 8 characters long. This is not your email password.");
    return new Promise<string>((resolve, reject) => {
        inquirer.prompt([
            {
                name: 'password',
                type: 'password',
                message: 'Password:',
                mask: '*',
                validate: passwordValidatorAsync
            }
        ]).then(passwordAnswers => {
            inquirer.prompt([
                {
                    name: 'password',
                    type: 'password',
                    message: 'Password (confirm):',
                    mask: '*',
                    validate: passwordValidatorAsync
                }
            ]).then(password2Answers => {
                if (passwordAnswers.password === password2Answers.password) {
                    resolve(passwordAnswers.password);
                } else {
                    reject();
                }
            });
        });
    }).catch(reason => {
        console.log(chalk.yellow("The passwords don't match, please try again."));
        return getNewPasswordAsync();
    });
}

function promptExistingLoginInfoAsync(): Promise<LoginInfo> {
    return new Promise<LoginInfo>(resolve => {
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

function promptLoginInfoAsync(): Promise<LoginInfo> {
    return new Promise<LoginInfo>(resolve => {
        inquirer.prompt([
            {
                type: 'list',
                name: 'login_type',
                message: 'Do you have a Stackless account?',
                choices: ["Yes", "No, I'd like to create a new account"]
            }
        ]).then(loginTypeAnswers => {
            if (loginTypeAnswers.login_type === "Yes") {
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
            } else { //new
                console.log("Please enter your email address. This will be your Stackless username.");
                console.log(chalk.gray("Warpdrive Technologies, Inc. will never share your data with third parties."));
                inquirer.prompt([
                    {
                        name: 'username',
                        message: 'Email:',
                        validate: emailValidatorAsync
                    }
                ]).then(usernameAnswer => {
                    getNewPasswordAsync().then(password => {
                        resolve(new LoginInfo(true, usernameAnswer.username, <string>password));
                    });
                });
            }
        });
    });
}

export function createAccountLoginProgramCommand(before: any, attachTo: Command) {
    attachTo.command('login [keyFile]')
        .description('Login to Stackless optionally specifying your key file')
        .option("-o, --overwrite", "Overwrite existing login.")
        .action(async (keyFile: string, opts: any) => {
            if (before)
                before();
            if (await executeLoginAsync(keyFile, opts.overwrite)) {
                process.exitCode = 0;
            } else {
                process.exitCode = 1;
            }
        });
}

export async function maybeExecuteLoginAsync(login: boolean): Promise<boolean> {
    if (!isLoggedIn()) {
        if (!login) {
            logLocalError("You must be logged in.");
            return false;
        } else {
            logWarning("You're not logged in. Initiating login.");
            return await executeLoginAsync();
        }
    }
    return true;
}

export async function logoutAsync() {
    if (GoogleIdentitySingleton.isLoggedIn) {
        await GoogleIdentitySingleton.logoutAsync();
    }
}

export async function createNewAccountAsync(logContext: string, username: string, password: string): Promise<boolean> {
    if (GoogleIdentitySingleton.isLoggedIn)
        throw new Error(logLocalError("Must not be logged in."))

    // Begin account creation
    const createResponse = await JayneSingleton.beginCreateAccountAsync(logContext, username, password);

    // Login to Google Identity
    await GoogleIdentitySingleton.loginAsync(username, password);

    if (!createResponse.emailVerified) {
        const token = createResponse.accountCreationToken;
        await GoogleIdentitySingleton.sendVerificationEmailAsync(token);

        console.clear();
        console.log(chalk.yellowBright("To finish creating your account you must verify your email address."));
        console.log();
        console.log(`${chalk.yellow("Next Steps:")}`);
        console.log(`${chalk.blueBright(" 1. Click the link in the email from noreply@stackless.dev.")}`);
        console.log(`${chalk.blueBright(" 2. Click the CONTINUE button on the page the link takes you.")}`);
        console.log();
        console.log(chalk.yellowBright("You'll be logged in here once you've clicked the continue button."));
        console.log();
        console.log(`${chalk.gray("Note: It may take up to 30 minutes for you to receive the email. If this window closes before your email is verified, that's OK. Just re-run the same command you did to get here and choose to login with your email and password.")}`);

        const start = new Date();
        while (true) {
            logVerbose("Checking to see if the email address has been verified...")
            const elapsed = ((new Date()).getTime() - start.getTime()) / 1000;
            if (elapsed > 300) {
                console.log(chalk.yellowBright("Timed out while waiting for email verification. Run 'warp account login' to login after you've verified your email address."));
                return false;
            }
            const emailVerified = await JayneSingleton.isEmailVerifiedAsync(logContext, token);
            if (emailVerified) {
                const response = await JayneSingleton.loginExistingAccountAsync(logContext);
                const adminKeyFile = new AdminKeyFile(response.adminKey);
                adminKeyFile.write();
                return true;
            } else {
                logVerbose("Email not verified. Waiting 3 seconds before checking to see if the email address has been verified.");
            }
            await sleepAsync(3000); //sleep 3 seconds before trying again.
        }
    } else {
        const response = await JayneSingleton.loginExistingAccountAsync(logContext);
        const adminKeyFile = new AdminKeyFile(response.adminKey);
        adminKeyFile.write();
        return true;
    }
}

export async function executeLoginAsync(keyFile: PathLike | null = null, overwrite: boolean = false, existingOnly: boolean = false): Promise<boolean> {
    if (keyFile) {
        return loginWithKeyFile(keyFile, overwrite || false);
    }

    //if the file already exists, we're already logged in
    if (!overwrite && isLoggedIn()) {
        logWarning(`You're already logged in. Specify -o to overwrite.`);
        return false;
    }

    const logContext = createLogContext();

    try {
        let loginInfo;
        if (existingOnly) {
            loginInfo = await promptExistingLoginInfoAsync();
        } else {
            loginInfo = await promptLoginInfoAsync();
        }
        if (loginInfo.isNew) {
            if (await createNewAccountAsync(logContext, loginInfo.username, loginInfo.password)) {
                logSuccess("Stackless account created and logged in successfully!");
            }
        } else {
            await loginExistingDeveloperAsync(logContext, loginInfo.username, loginInfo.password);
            logVerbose("Successfully logged into your Stackless account.");
        }

        return true;
    } catch (e: any) {
        logRemoteError(logContext, e.message);
        return false;
    }
}