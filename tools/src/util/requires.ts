export function requiresTruthy(name: string, value: any) {
    if(!value) {
        throw new Error(`${name} was falsy when it needed to be truthy`);
    }
}