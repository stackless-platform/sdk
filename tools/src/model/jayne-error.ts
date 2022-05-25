import {requiresTruthy} from "../util/requires";
import {SERVICE_NOTICES_CHANNEL} from "../config"

export const WARPDRIVE_EMAIL_NOT_VERIFIED_ERROR_CODE = 404;
export const WARPDRIVE_SERVER_ERROR_CODE = 400;

export class ScriptError extends Error {
    constructor(public message: string, public stack: string) {
        super(ScriptError.getMessage(message, stack));
        requiresTruthy('message', message);
        requiresTruthy('stack', stack);
    }

    static fromJson(json_obj: any) {
        if (!json_obj)
            throw new Error("Invalid ScriptError, the error object was empty");
        if (!json_obj.hasOwnProperty('message'))
            throw new Error("Invalid ScriptError, the message was missing");
        if (!json_obj.hasOwnProperty('stack'))
            throw new Error("Invalid ScriptError, the stack was missing");
        return new ScriptError(json_obj.message, json_obj.stack ? json_obj.stack : "<<empty stack trace>>");
    }

    static getMessage(message: string, stack: string) {
        return `${message}\n${stack}`;
    }
}

export class CodeError extends Error {
    constructor(public category: string, public error: string) {
        super(CodeError.getMessage(category, error));
        requiresTruthy('error', error);
        requiresTruthy('category', category);
    }

    static fromJson(json_obj: any) {
        if (!json_obj)
            throw new Error("Invalid CodeError, the error object was empty");
        if (!json_obj.hasOwnProperty('error'))
            throw new Error("Invalid CodeError, the code was missing");
        if (!json_obj.hasOwnProperty('category'))
            throw new Error("Invalid CodeError, the category was missing");
        return new CodeError(json_obj.category, json_obj.error);
    }

    static getMessage(category: string, error: string) {
        switch (category) {
            case "Platform":
                switch (error) {
                    case "MaxWarpLimitReached":
                        return `The total warp limit has been reached. See the ${SERVICE_NOTICES_CHANNEL} channel for when the limit will be increased.`
                    case "UserWarpLimitReached":
                        return "The maximum number of warps already exist on your account. You must delete an existing warp before you can boot a new one."
                    case "AccountCreationTemporarilyDisabled":
                        return `Account creation has been temporarily disabled. See the ${SERVICE_NOTICES_CHANNEL} channel for when new accounts can be created again.`
                    case "FailedToCreateAccountWithGoogleIdentity":
                        return "An underlying error prevented the account from being created.";
                    case "FailedToCreateAccountInDatabase":
                        return "An internal error prevented the account from being created.";
                    default:
                        return "Platform error: " + error;
                }
            case "BusinessLogic":
                switch (error) {
                    case "DuplicateWarpName":
                        return "A warp already exists with that name."
                    case "WarpNotFoundByName":
                        return "A warp by that name was not found."
                    case "UserNotFound":
                        return "The specified user was not found.";
                    case "UserAlreadyExists":
                        return "A user with that email already exists.";
                    case "UserDisabled":
                        return "The user is disabled.";
                    case "EmailUnverified":
                        return "The email is not yet verified.";
                    case "InvalidAccountCreationToken":
                        return "Invalid account creation token. Retry creating an account the re-running the command."
                    default:
                        return "Business logic error: " + error;
                }
            case "External":
                return "Stackless internal error: " + error;
            case "CodeParse":
                return "Warp compilation error: " + error;
        }
    }
}

export function parseError(response_obj: any): Error {
    requiresTruthy('response_obj', response_obj);
    if (!response_obj.hasOwnProperty('type'))
        throw new Error("Unknown error returned from Jayne: type wasn't found");

    switch (response_obj.type) {
        case "code":
            return CodeError.fromJson(response_obj);
        case "script_exception":
            return ScriptError.fromJson(response_obj);
        default:
            throw new Error(`Unknown error type ${response_obj.type} returned from Jayne`);
    }
}