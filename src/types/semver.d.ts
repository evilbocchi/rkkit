declare module "semver" {
    export type Range = string;

    export function satisfies(
        version: string,
        range: string,
        optionsOrLoose?: unknown,
    ): boolean;

    export function rcompare(
        a: string,
        b: string,
        optionsOrLoose?: unknown,
    ): number;
}
