import {requiresTruthy} from "./requires.js";
import {WarpIndexProto} from "../protocol/warp-index-proto.js";
import {ByteBuffer} from "flatbuffers";

export function deserializeWarpIndex(warpIndexStr: string): WarpIndexProto {
    requiresTruthy('warpIndexStr', warpIndexStr);

    let b = Buffer.from(warpIndexStr, 'base64');
    let c = new ByteBuffer(b);

    return WarpIndexProto.getRootAsWarpIndexProto(c);
}