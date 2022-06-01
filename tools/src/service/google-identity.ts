/// <reference lib="dom" />
import { getApp, initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, signOut, onAuthStateChanged, Auth, signInWithEmailAndPassword, UserCredential, sendEmailVerification } from 'firebase/auth';
import { logLocalError, logVerbose } from "../util/logging";
import { FIREBASE_CONFIG, SITE_VERIFY_EMAIL_URL } from "../config";
import { requiresTruthy } from "../util/requires";

class GoogleIdentityLoginInfo {
    constructor(public credential: UserCredential, public idToken: string) {
        requiresTruthy("credential", credential);
        requiresTruthy("idToken", idToken);
    }
}

export class GoogleIdentity {
    private _loginInfo: GoogleIdentityLoginInfo | null;
    private _app: FirebaseApp;
    private _auth: Auth;

    constructor() {
        initializeApp(FIREBASE_CONFIG);
        this._app = getApp();
        this._auth = getAuth(this._app);
        this._loginInfo = null;
    }

    public get idToken(): string {
        const idToken = this._loginInfo?.idToken;
        if (!idToken)
            throw new Error(logLocalError("Attempted to get id token when not logged in"));
        return idToken;
    }

    public get isLoggedIn(): boolean {
        return !!this._loginInfo;
    }

    public async logoutAsync(): Promise<void> {
        if (!this.isLoggedIn) {
            throw new Error(logLocalError("Already logged out of Google Identity, cannot logout again."));
        }

        try {
            await signOut(this._auth);
            this._loginInfo = null;
            logVerbose("Logged out of Google Identity successfully");
        } catch (e) {
            throw new Error(logLocalError("Failed to logout of Google Identity: " + e));
        }
    }

    public async loginAsync(username: string, password: string) {
        if (this.isLoggedIn) {
            throw new Error(logLocalError("Already logged in to Google Identity, cannot login in again"));
        }

        let userCredential: UserCredential;
        try {
            userCredential = await signInWithEmailAndPassword(this._auth, username, password);
        }
        catch (e: any) {
            if (e.code === "auth/user-not-found")
                throw new Error("Invalid username or password");
            throw e;
        }

        if (!userCredential)
            throw new Error(logLocalError("Empty user credentials returned from Google Identity login"));
        if (!userCredential.user)
            throw new Error(logLocalError("User credential's User field was empty after login to Google Identity"));

        const idToken = await userCredential.user.getIdToken(true);
        if (!idToken)
            throw new Error(logLocalError("ID token returned after Google Identity login was empty"));

        this._loginInfo = new GoogleIdentityLoginInfo(userCredential, idToken);
    }

    public async sendVerificationEmailAsync(token: string) {
        if (!this.isLoggedIn)
            throw new Error("Must be signed in");
        try {
            const actionCodeSettings = {
                url: `${SITE_VERIFY_EMAIL_URL}?token=` + token,
                handleCodeInApp: false
            };
            const currentUser = this._auth.currentUser;
            if(!currentUser)
                throw new Error(logLocalError("The current user wasn't set"));
            await sendEmailVerification(currentUser, actionCodeSettings)
        }
        catch (e: any) {
            throw new Error(logLocalError("Failed to send verification email: " + e));
        }
    }
}
export const GoogleIdentitySingleton = new GoogleIdentity();
