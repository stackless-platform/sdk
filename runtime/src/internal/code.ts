// THIS FILE WAS CODE GENERATED

export enum Code {
    Ok = 1,
    InvalidRequest = 2,
    InvalidLogContext = 3,
    ScriptEngine_ClassNotFound = 4,
    ScriptEngine_MethodNotFound = 5,
    ScriptEngine_NoCode = 6,
    ScriptEngine_BadFileId = 7,
    ScriptEngine_FailedToCompileModuleUnknownReason = 8,
    ScriptEngine_FailedToInstanciateModuleUnknownReason = 9,
    ScriptEngine_FailedToEvaluateModuleUnknownReason = 10,
    ScriptEngine_UnableToGetMethod = 11,
    ScriptEngine_UnableToGetMethodBecauseItWasNotAFunction = 12,
    ScriptEngine_UnableToCallMethod = 13,
    ScriptEngine_UnknownFunctionCallFailure = 14,
    ScriptEngine_DuplicateModuleName = 15,
    ScriptEngine_UnsupportedValueType = 16,
    ScriptEngine_UnableToSetArrayValue = 17,
    ScriptEngine_UnableToSetObjectValue = 18,
    Datastore_UnsavedChanges = 19,
    Datastore_TypeMismatch = 20,
    Datastore_ObjectDeleted = 21,
    Datastore_WriteConflictTryAgain = 22,
    Datastore_ObjectNotFound = 23,
    Datastore_Unknown = 24,
    Datastore_MustGetLatestObject = 25,
    Datastore_DuplicateObject = 26,
    Datastore_ClientHasVersionInvalid = 29,
    Datastore_MustGetLatestWarp = 31,
    Datastore_EngineSourceCorrupted = 32,
    Datastore_WarpIndexNotFound = 33,
    Datastore_EngineSourceNotFound = 34,
    Datastore_UnableToOpen = 35,
    Datastore_UnableToCreateDirectory = 36,
    Datastore_UnknownSystemError = 37,
    Datastore_DeletedFlagExists = 38,
    Datastore_DeletedFileExists = 39,
    Datastore_WarpVersionCorrupted = 40,
    Datastore_FailedToSetInitialWarpVersion = 41,
    Validator_ClientMustUpgrade = 44,
    Validator_InvalidFlatbuffer = 45,
    Validator_Forbidden = 46,
    Validator_PrimaryKeyTooLarge = 47,
    Validator_PrimaryKeyTooSmall = 48,
    Validator_InvalidRequest = 49,
    Innerspace_ConnectionFault = 52,
    Innerspace_RequestTooLarge = 53,
    Innerspace_Shutdown = 54,
    Innerspace_UnableToResolveHostPort = 55,
    Innerspace_NoEndpoints = 56,
    Launcher_TimedOutWhileGettingWarpSpace = 58,
    Launcher_FailedToSpawnWarpSpace = 59,
    WarpSpace_WarpDeleted = 61
}

export function getCodeName(code: Code) {
    switch (code) {
        case Code.Ok:
            return 'Ok';
        case Code.InvalidRequest:
            return 'InvalidRequest';
        case Code.InvalidLogContext:
            return 'InvalidLogContext';
        case Code.ScriptEngine_ClassNotFound:
            return 'ScriptEngine_ClassNotFound';
        case Code.ScriptEngine_MethodNotFound:
            return 'ScriptEngine_MethodNotFound';
        case Code.ScriptEngine_NoCode:
            return 'ScriptEngine_NoCode';
        case Code.ScriptEngine_BadFileId:
            return 'ScriptEngine_BadFileId';
        case Code.ScriptEngine_FailedToCompileModuleUnknownReason:
            return 'ScriptEngine_FailedToCompileModuleUnknownReason';
        case Code.ScriptEngine_FailedToInstanciateModuleUnknownReason:
            return 'ScriptEngine_FailedToInstanciateModuleUnknownReason';
        case Code.ScriptEngine_FailedToEvaluateModuleUnknownReason:
            return 'ScriptEngine_FailedToEvaluateModuleUnknownReason';
        case Code.ScriptEngine_UnableToGetMethod:
            return 'ScriptEngine_UnableToGetMethod';
        case Code.ScriptEngine_UnableToGetMethodBecauseItWasNotAFunction:
            return 'ScriptEngine_UnableToGetMethodBecauseItWasNotAFunction';
        case Code.ScriptEngine_UnableToCallMethod:
            return 'ScriptEngine_UnableToCallMethod';
        case Code.ScriptEngine_UnknownFunctionCallFailure:
            return 'ScriptEngine_UnknownFunctionCallFailure';
        case Code.ScriptEngine_DuplicateModuleName:
            return 'ScriptEngine_DuplicateModuleName';
        case Code.ScriptEngine_UnsupportedValueType:
            return 'ScriptEngine_UnsupportedValueType';
        case Code.ScriptEngine_UnableToSetArrayValue:
            return 'ScriptEngine_UnableToSetArrayValue';
        case Code.ScriptEngine_UnableToSetObjectValue:
            return 'ScriptEngine_UnableToSetObjectValue';
        case Code.Datastore_UnsavedChanges:
            return 'Datastore_UnsavedChanges';
        case Code.Datastore_TypeMismatch:
            return 'Datastore_TypeMismatch';
        case Code.Datastore_ObjectDeleted:
            return 'Datastore_ObjectDeleted';
        case Code.Datastore_WriteConflictTryAgain:
            return 'Datastore_WriteConflictTryAgain';
        case Code.Datastore_ObjectNotFound:
            return 'Datastore_ObjectNotFound';
        case Code.Datastore_Unknown:
            return 'Datastore_Unknown';
        case Code.Datastore_MustGetLatestObject:
            return 'Datastore_MustGetLatestObject';
        case Code.Datastore_DuplicateObject:
            return 'Datastore_DuplicateObject';
        case Code.Datastore_ClientHasVersionInvalid:
            return 'Datastore_ClientHasVersionInvalid';
        case Code.Datastore_MustGetLatestWarp:
            return 'Datastore_MustGetLatestWarp';
        case Code.Datastore_EngineSourceCorrupted:
            return 'Datastore_EngineSourceCorrupted';
        case Code.Datastore_WarpIndexNotFound:
            return 'Datastore_WarpIndexNotFound';
        case Code.Datastore_EngineSourceNotFound:
            return 'Datastore_EngineSourceNotFound';
        case Code.Datastore_UnableToOpen:
            return 'Datastore_UnableToOpen';
        case Code.Datastore_UnableToCreateDirectory:
            return 'Datastore_UnableToCreateDirectory';
        case Code.Datastore_UnknownSystemError:
            return 'Datastore_UnknownSystemError';
        case Code.Datastore_DeletedFlagExists:
            return 'Datastore_DeletedFlagExists';
        case Code.Datastore_DeletedFileExists:
            return 'Datastore_DeletedFileExists';
        case Code.Datastore_WarpVersionCorrupted:
            return 'Datastore_WarpVersionCorrupted';
        case Code.Datastore_FailedToSetInitialWarpVersion:
            return 'Datastore_FailedToSetInitialWarpVersion';
        case Code.Validator_ClientMustUpgrade:
            return 'Validator_ClientMustUpgrade';
        case Code.Validator_InvalidFlatbuffer:
            return 'Validator_InvalidFlatbuffer';
        case Code.Validator_Forbidden:
            return 'Validator_Forbidden';
        case Code.Validator_PrimaryKeyTooLarge:
            return 'Validator_PrimaryKeyTooLarge';
        case Code.Validator_PrimaryKeyTooSmall:
            return 'Validator_PrimaryKeyTooSmall';
        case Code.Validator_InvalidRequest:
            return 'Validator_InvalidRequest';
        case Code.Innerspace_ConnectionFault:
            return 'Innerspace_ConnectionFault';
        case Code.Innerspace_RequestTooLarge:
            return 'Innerspace_RequestTooLarge';
        case Code.Innerspace_Shutdown:
            return 'Innerspace_Shutdown';
        case Code.Innerspace_UnableToResolveHostPort:
            return 'Innerspace_UnableToResolveHostPort';
        case Code.Innerspace_NoEndpoints:
            return 'Innerspace_NoEndpoints';
        case Code.Launcher_TimedOutWhileGettingWarpSpace:
            return 'Launcher_TimedOutWhileGettingWarpSpace';
        case Code.Launcher_FailedToSpawnWarpSpace:
            return 'Launcher_FailedToSpawnWarpSpace';
        case Code.WarpSpace_WarpDeleted:
            return 'WarpSpace_WarpDeleted';
        default:
            return `InternalError(${code})`;
    }
}