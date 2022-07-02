import {requiresTruthy} from "../util/requires.js";

export class LoginInfo {
    constructor(public isNew: boolean, public username: string, public password: string) {
        requiresTruthy('username', username);
        requiresTruthy('password', password);
    }
}