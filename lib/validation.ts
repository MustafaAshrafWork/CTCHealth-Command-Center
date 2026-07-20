import { z } from "zod";

const requiredText = (maximumLength: number) =>
  z.string().trim().min(1).max(maximumLength);
const nonEmptyText = z.string().trim().min(1);

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parses a `YYYY-MM-DD` string as a real calendar date at UTC midnight.
 * `Date` silently normalizes impossible dates (e.g. `2026-02-31` becomes
 * March 3rd), so this rejects any input whose parsed date does not
 * serialize back to the exact input string — that is the only reliable
 * way to catch invalid days, months, and non-leap Feb 29ths.
 */
export function parseStrictISODate(value: string): Date | null {
  if (!ISO_DATE_PATTERN.test(value)) {
    return null;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return null;
  }
  return date;
}

const INVALID_CALENDAR_DATE_MESSAGE =
  "Enter a valid calendar date in YYYY-MM-DD format.";

// Accepts a `Date` (already normalized by the browser form) or a strict
// `YYYY-MM-DD` string (as sent by the chat confirmation flow) and rejects
// impossible calendar dates instead of silently rolling them over.
export const strictCalendarDateSchema = z
  .union([z.date(), z.string()])
  .refine(
    (value) =>
      value instanceof Date
        ? !Number.isNaN(value.getTime())
        : parseStrictISODate(value) !== null,
    { message: INVALID_CALENDAR_DATE_MESSAGE },
  )
  .transform((value) =>
    value instanceof Date ? value : (parseStrictISODate(value as string) as Date),
  );

export const idSchema = z.string().trim().min(1);

export const projectCategorySchema = z.enum([
  "tech",
  "consultancy",
  "agency",
  "agents",
]);
export const projectStatusSchema = z.enum([
  "planning",
  "active",
  "on_hold",
  "completed",
]);
export const projectPrioritySchema = z.enum(["high", "medium", "low"]);
export const flagStatusSchema = z.enum(["open", "resolved"]);

const optionalSharePointLink = z
  .string()
  .trim()
  .optional()
  .superRefine((value, context) => {
    if (!value) {
      return;
    }

    let url: URL;
    try {
      url = new URL(value);
    } catch {
      context.addIssue({
        code: "custom",
        message: "Enter a valid SharePoint HTTPS URL.",
      });
      return;
    }

    if (url.protocol !== "https:") {
      context.addIssue({
        code: "custom",
        message: "SharePoint link must use HTTPS.",
      });
      return;
    }

    // This schema also runs in the client form for immediate format feedback.
    // The private tenant allowlist is enforced when the server action parses
    // the same payload; it must never be exposed in the browser bundle.
    if (typeof window !== "undefined") {
      return;
    }

    const allowedHosts = (process.env.SHAREPOINT_ALLOWED_HOSTS ?? "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean);

    if (allowedHosts.length === 0) {
      context.addIssue({
        code: "custom",
        message:
          "SharePoint links are disabled until SHAREPOINT_ALLOWED_HOSTS is configured.",
      });
      return;
    }

    if (!allowedHosts.includes(url.hostname.toLowerCase())) {
      context.addIssue({
        code: "custom",
        message: `SharePoint hostname "${url.hostname}" is not allowed. Use an approved SharePoint host.`,
      });
    }
  });

const projectBaseFields = {
  name: requiredText(200),
  client: nonEmptyText,
  category: projectCategorySchema,
  status: projectStatusSchema,
  priority: projectPrioritySchema,
  ownerId: nonEmptyText,
  memberIds: z.array(nonEmptyText),
  progress: z.number().int().min(0).max(100).optional(),
  budget: z.number().finite().nonnegative().nullable().optional(),
  completed: z.boolean().optional(),
  startDate: strictCalendarDateSchema,
  endDate: strictCalendarDateSchema,
  sharePointLink: optionalSharePointLink,
  notes: z.string().optional(),
};

const endAfterStart = {
  message: "End date must be on or after start date.",
  path: ["endDate"],
};

export const projectInputSchema = z
  .object(projectBaseFields)
  .refine((project) => project.endDate >= project.startDate, endAfterStart);

// Creation also accepts the initial deliverables entered in the modal.
export const projectCreateSchema = z
  .object({
    ...projectBaseFields,
    deliverables: z.array(
      z
        .object({
          name: requiredText(200),
          startDate: z.coerce.date().optional(),
          endDate: z.coerce.date().optional(),
          dueDate: z.coerce.date().optional(),
          assigneeId: idSchema.optional(),
        })
        .refine((milestone) => milestone.endDate || milestone.dueDate, {
          message: "Milestone end date is required.",
          path: ["endDate"],
        })
        .refine(
          (milestone) => {
            const endDate = milestone.endDate ?? milestone.dueDate;
            const startDate = milestone.startDate ?? endDate;
            return Boolean(startDate && endDate && endDate >= startDate);
          },
          {
            message: "Milestone end date must be on or after its start date.",
            path: ["endDate"],
          },
        ),
    ),
  })
  .refine((project) => project.endDate >= project.startDate, endAfterStart);

export const milestoneInputSchema = z
  .object({
    name: requiredText(200),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    dueDate: z.coerce.date().optional(),
    done: z.boolean(),
    assigneeId: idSchema,
  })
  .refine((milestone) => milestone.endDate || milestone.dueDate, {
    message: "Milestone end date is required.",
    path: ["endDate"],
  })
  .refine(
    (milestone) => {
      const endDate = milestone.endDate ?? milestone.dueDate;
      const startDate = milestone.startDate ?? endDate;
      return Boolean(startDate && endDate && endDate >= startDate);
    },
    {
      message: "Milestone end date must be on or after its start date.",
      path: ["endDate"],
    },
  );

export const flagInputSchema = z.object({
  needs: requiredText(2_000),
  from: requiredText(200),
  raised: z.coerce.date(),
});

export const weeklyUpdateConfirmedInputSchema = z.object({
  weekOf: z.coerce.date(),
  summary: requiredText(20_000),
  priorities: requiredText(10_000),
  rawTranscript: z.string().max(100_000).optional(),
  confirmed: z.literal(true),
});

export const personNameSchema = requiredText(100);

export const loginSchema = z.object({
  personId: idSchema,
  password: z.string().min(1),
});

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.");

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((input) => input.newPassword === input.confirmPassword, {
    message: "New passwords do not match.",
    path: ["confirmPassword"],
  });

export const ideaSchema = requiredText(2_000);
