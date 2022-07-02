import {Unsigned} from "../src/util/unsigned";

const ULONG_MAX_STR = "18446744073709551615";

describe("should convert", () => {
    it("minimum 64bit unsigned interger", () => {
        const unsigned = new Unsigned(BigInt(0));
        expect(unsigned.toString()).toBe("0");
        const comp = Unsigned.fromLong(unsigned.toLong());
        expect(comp.toString()).toEqual("0");
    });
    it('maximum 64bit unsigned integer', () => {
        const unsigned = new Unsigned(BigInt(ULONG_MAX_STR));
        expect(unsigned.toString()).toBe(ULONG_MAX_STR);
        const comp = Unsigned.fromLong(unsigned.toLong());
        expect(comp.toString()).toEqual(ULONG_MAX_STR);
    });
});