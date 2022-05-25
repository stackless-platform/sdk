import {GoogleIdentity, GoogleIdentitySingleton} from "./google-identity";
import {requiresTruthy} from "../util/requires";
import {WARPDRIVE_SERVER_ERROR_CODE, parseError, WARPDRIVE_EMAIL_NOT_VERIFIED_ERROR_CODE} from "../model/jayne-error";
import fetch from 'cross-fetch';
import {WarpClassMapping} from "../model/warp-config";
import {JAYNE_SERVICE_URL, JAYNE_TOOLS_PROTOCOL_VERSION} from "../config";

//-- REQUEST

class BeginCreateAccountRequest {
    constructor(public logContext: string, public username: string, public password: string) {
        requiresTruthy('logContext', logContext);
        requiresTruthy('username', username);
        requiresTruthy('password', password);
    }
}

class BootWarpRequest {
    constructor(public logContext: string,
                public warpName: string,
                public language: number,
                public warpFiles: WarpFileContent[],
                public warpIdStr?: string,
                public currentWarpVersionStr?: string,
                public warpClassMappings?: WarpClassMapping[],
                public lastClassId?: number) {
        requiresTruthy('logContext', logContext);
        requiresTruthy('warpName', warpName);
        if (language !== 0)
            throw new Error("invalid warp language");
        requiresTruthy('warpFiles', warpFiles);
    }
}

class DeleteWarpRequest {
    constructor(public logContext: string,
                public warpName: string) {
        requiresTruthy('logContext', logContext);
        requiresTruthy('warpName', warpName);
    }
}

export class WarpFileContent {
    constructor(public code: string, public name: string) {
        requiresTruthy('code', code);
        requiresTruthy('name', name);
    }
}

//-- RESPONSE

class ListWarpsResponse {
    constructor(public ownedWarps: string[]) {
        requiresTruthy('ownedWarps', ownedWarps);
    }
}

class IsEmailVerifiedResponse {
    constructor(public emailVerified: boolean) {
    }
}

class BeginCreateAccountResponse {
    constructor(public emailVerified: boolean,
                public accountCreationToken: string,
                public expiresInSeconds: number) {
        if(this.emailVerified) {
            requiresTruthy('!this.accountCreationToken', !this.accountCreationToken);
            requiresTruthy('!this.expiresInSeconds', !this.expiresInSeconds);
        } else {
            requiresTruthy('this.accountCreationToken', this.accountCreationToken);
            requiresTruthy('this.expiresInSeconds', this.expiresInSeconds);
        }
    }
}

class LoginExistingAccountResponse {
    constructor(public adminKey: string) {
        requiresTruthy('adminKey', adminKey);
    }
}

class BootWarpResponse {
    constructor(public warpIdStr: string, public warpVersionStr: string, public warpClassMappings: WarpClassMapping[]) {
        requiresTruthy('warpIdStr', warpIdStr);
        requiresTruthy('warpVersionStr', warpVersionStr);
        requiresTruthy('warpClassMappings', warpClassMappings)
    }
}

class GetWarpUseInfoResponse {
    constructor(public warpIndexStr: string, public userKey: string) {
        requiresTruthy('warpIndexStr', warpIndexStr);
        requiresTruthy('userKey', userKey);
    }
}

const WARPDRIVE_JAVASCRIPT_LANGUAGE = 0;

export class Jayne {
    constructor(private googleIdentity: GoogleIdentity) {
        requiresTruthy('googleIdentity', googleIdentity);
    }

    public async deleteAccountAsync(logContext: string): Promise<void> {
        try {
            let fetchInit = this.createGoogleIdentityFetchInit("DELETE", "delete your Stackless account and all its data");
            await this.makeServiceCallAsync(fetchInit, `tools-account/delete_account?logContext=${logContext}`, false, true);
        } catch (e: any) {
            if (e.code === "ECONNREFUSED")
                throw new Error("Failed to because the connection was refused");
            throw new Error(e.message);
        }
    }

    public async listWarpsAsync(logContext: string, adminKey: string): Promise<ListWarpsResponse> {
        try {
            let fetchInit = this.createAdminKeyFetchInit("GET", adminKey);
            let json = await this.makeServiceCallAsync(fetchInit, `tools-warp-admin/list_warps?logContext=${logContext}`, true, true);
            return new ListWarpsResponse(json.ownedWarps);
        } catch (e: any) {
            if (e.code === "ECONNREFUSED")
                throw new Error("Failed to because the connection was refused");
            throw new Error(e.message);
        }
    }

    public async deleteWarpAsync(logContext: string, adminKey: string, warpName: string): Promise<void> {
        const req = new DeleteWarpRequest(logContext, warpName);

        try {
            let fetchInit = this.createAdminKeyFetchInit("POST", adminKey);
            await this.makeServiceCallAsync(fetchInit, "tools-warp-admin/delete_warp", false, true, req);
        } catch (e: any) {
            if (e.code === "ECONNREFUSED")
                throw new Error("Failed to because the connection was refused");
            throw new Error(e.message);
        }
    }

    public async bootWarpAsync(logContext: string, adminKey: string, warpName: string, warpFiles: WarpFileContent[],
                               warpClassMappings?: WarpClassMapping[], warpId?: string, currentWarpVersion?: string,
                               lastClassId?: number): Promise<BootWarpResponse> {
        const req = new BootWarpRequest(logContext, warpName, WARPDRIVE_JAVASCRIPT_LANGUAGE,
            warpFiles, warpId, currentWarpVersion, warpClassMappings, lastClassId);

        try {
            let fetchInit = this.createAdminKeyFetchInit("POST", adminKey);
            let jsonObj = await this.makeServiceCallAsync(fetchInit, "tools-warp-admin/boot_warp", true, true, req);
            return new BootWarpResponse(jsonObj.warpIdStr, jsonObj.warpVersionStr, jsonObj.warpClassMappings);
        } catch (e: any) {
            if (e.code === "ECONNREFUSED")
                throw new Error("Failed to because the connection was refused");
            throw new Error(e.message);
        }
    }

    public async isEmailVerifiedAsync(logContext: string, accountCreationToken: string): Promise<boolean> {
        try {
            let fetchInit = this.createUnauthenticatedFetchInit("GET");
            const response = await this.makeServiceCallAsync(fetchInit, `tools-account/is_email_verified?accountCreationToken=${accountCreationToken}`, false, false);
            return response.status === 200;
        } catch (e: any) {
            if (e.code === "ECONNREFUSED")
                throw new Error("Failed because the connection was refused");
            throw new Error(e.message);
        }
    }

    public async beginCreateAccountAsync(logContext: string, username: string, password: string): Promise<BeginCreateAccountResponse> {
        const req = new BeginCreateAccountRequest(logContext, username, password);

        try {
            let fetchInit = this.createUnauthenticatedFetchInit("POST");
            let jsonObj = await this.makeServiceCallAsync(fetchInit, "tools-account/begin_create_account", true, true, req);
            return new BeginCreateAccountResponse(jsonObj.emailVerified, jsonObj.accountCreationToken, jsonObj.expiresInSeconds);
        } catch (e: any) {
            if (e.code === "ECONNREFUSED")
                throw new Error("Failed to because the connection was refused");
            throw new Error(e.message);
        }
    }

    public async loginExistingAccountAsync(logContext: string): Promise<LoginExistingAccountResponse> {
        try {
            let fetchInit = this.createGoogleIdentityFetchInit("GET", "login existing account");
            let jsonObj = await this.makeServiceCallAsync(fetchInit, `tools-account/login_existing_account?logContext=${logContext}`, true, true);
            return new LoginExistingAccountResponse(jsonObj.adminKey);
        } catch (e: any) {
            if (e.code === "ECONNREFUSED")
                throw new Error("Failed to because the connection was refused");
            throw new Error(e.message);
        }
    }

    public async getWarpConnectionInfoAsync(logContext: string, adminKey: string, warpName: string): Promise<GetWarpUseInfoResponse> {

        try {
            let fetchInit = this.createAdminKeyFetchInit("GET", adminKey);
            let jsonObj = await this.makeServiceCallAsync(fetchInit, `tools-warp-admin/get_warp_connection_info/${warpName}?logContext=${logContext}`, true, true);
            return new GetWarpUseInfoResponse(jsonObj.warpIndexStr, jsonObj.userKey);
        } catch (e: any) {
            if (e.code === "ECONNREFUSED")
                throw new Error("Failed to because the connection was refused");
            throw new Error(e.message);
        }
    }

    private assertLoggedIn(what: string) {
        if (!this.googleIdentity.isLoggedIn) {
            throw new Error("Must be logged into Google Identity to " + what);
        }
    }

    private createFetchInit(additional: any) {
        const commonHeaders = {
            "X-Warpdrive-Tools-Protocol-Version": JAYNE_TOOLS_PROTOCOL_VERSION,
            'Content-Type': 'application/json'
        };
        if (additional.headers)
            additional.headers = Object.assign(additional.headers, commonHeaders);
        else
            additional.headers = commonHeaders;
        return additional;
    }

    private createAdminKeyFetchInit(method: string, adminKey: string) {
        return this.createFetchInit({
            method: method,
            headers: {
                'X-WarpAdminKey': adminKey
            }
        });
    }

    private createGoogleIdentityFetchInit(method: string, what: string) {
        this.assertLoggedIn(what);
        return this.createFetchInit({
            method: method,
            credentials: 'include',
            headers: {
                'Authorization': 'Bearer ' + this.googleIdentity.idToken,
            }
        });
    }

    private createUnauthenticatedFetchInit(method: string) {
        return this.createFetchInit({
            method: method
        });
    }

    private async makeServiceCallAsync(fetchInit: any, path: string, expectResult: boolean, parse: boolean, body?: any): Promise<any> {
        const url = `${JAYNE_SERVICE_URL}/${path}`;

        if (body) { // @ts-ignore
            fetchInit.body = JSON.stringify(body);
        }

        // @ts-ignore
        let response = await fetch(url, fetchInit);

        if(parse) {
            if (!response.ok) {
                if (response.status === WARPDRIVE_SERVER_ERROR_CODE) {
                    throw parseError(await response.json());
                }
                throw new Error("Response was not OK: " + response.statusText);
            }
            if (expectResult) {
                let json = await response.json();
                if (!json)
                    throw new Error("Response didn't return anything");

                return json;
            }
        }

        return response;
    }
}

export const JayneSingleton = new Jayne(GoogleIdentitySingleton);