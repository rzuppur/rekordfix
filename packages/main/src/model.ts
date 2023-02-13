export type GenericResultError = { error: string };
export type GenericResultSuccess = { success: true };
export type GenericResult = GenericResultError | GenericResultSuccess;
