export function createUuid(dashes: boolean) {
    const str = dashes ? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx' : 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx';
    return str.replace(/[xy]/g, function (c) {
        // eslint-disable-next-line
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}