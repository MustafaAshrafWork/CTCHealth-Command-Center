export function assertProjectSeedAllowed(
  existingProjectCount: number,
  destructiveFlag: string | undefined = process.env.SEED_DESTRUCTIVE,
): void {
  if (existingProjectCount === 0 || destructiveFlag === "1") {
    return;
  }

  throw new Error(
    `Seed aborted: found ${existingProjectCount} existing project${existingProjectCount === 1 ? "" : "s"}. ` +
      "The six staff personas were provisioned, but project data was left unchanged. " +
      "Re-run with SEED_DESTRUCTIVE=1 only if deleting and replacing all project data is intentional.",
  );
}
