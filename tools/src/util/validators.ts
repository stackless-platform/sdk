import {logLocalError} from "./logging.js";

export const emailValidatorAsync = async (input: any) => {
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(input).toLowerCase());
};

export const warpNameValidatorAsync = async (input: any) => {
    const re = /^[A-Za-z0-9\-_]{3,50}$/;
    return re.test(String(input));
}

export async function validateWarpNameOrErrorAsync(warpName: string) : Promise<boolean> {
    if (!await warpNameValidatorAsync(warpName)) {
        logLocalError(`The warp name ${warpName} is invalid. It must be between 3 and 50 characters and contain only letters, numbers, and the characters - and _.`);
        return false;
    }
    return true;
}

export const passwordValidatorAsync = async (input: any) => {
    if (!input)
        return false;

    if (typeof input !== 'string')
        return false;

    return input.length >= 8;
};