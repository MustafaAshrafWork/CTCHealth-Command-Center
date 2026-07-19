export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | {
      ok: false;
      code:
        | "VALIDATION"
        | "CONFLICT"
        | "UNAUTHORIZED"
        | "NOT_FOUND"
        | "ERROR";
      error: string;
    };

export type Session = {
  personId: string;
  name: string;
  isDemo: boolean;
};
