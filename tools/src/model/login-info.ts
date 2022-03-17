import {requiresTruthy} from "../util/requires";

export class LoginInfo {
    constructor(public isNew: boolean, public username: string, public password: string) {
        requiresTruthy('username', username);
        requiresTruthy('password', password);
    }
}