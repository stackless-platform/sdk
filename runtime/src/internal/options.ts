import {WarpOptions} from "../public/warp-options.js";

class Options {
    private _warpOptions: WarpOptions | null = null;

    setWarpOptions(warpOptions: WarpOptions) {
        this._warpOptions = warpOptions;
    }

    getWarpOptions(): WarpOptions {
        if (!this._warpOptions)
            this._warpOptions = new WarpOptions();
        return this._warpOptions;
    }
}

export const options = new Options();
