import type { FormErrors } from "@mantine/form";

type ArkIssue = {
  path: (string | number)[];
  message: string;
  code: string;
  expected: string;
};

function isArkErrors(result: unknown): result is Iterable<ArkIssue> {
  return (
    result !== null && typeof result === "object" && Symbol.iterator in result
  );
}

export function arkResolver(
  schema: (values: unknown) => unknown,
): (values: unknown) => FormErrors {
  return (values: unknown) => {
    const result = schema(values);
    if (!isArkErrors(result)) return {};

    const errors: FormErrors = {};
    for (const issue of result) {
      const path = issue.path.join(".");
      if (errors[path]) continue;
      errors[path] =
        issue.code === "predicate" ? issue.expected : issue.message;
    }
    return errors;
  };
}
