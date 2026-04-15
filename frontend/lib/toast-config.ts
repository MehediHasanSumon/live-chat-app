import type { ApiErrorPayload } from "@/lib/api-client";

type CrudAction = "created" | "updated" | "deleted";

type CrudToastRule = {
  pattern: RegExp;
  label: string;
};

const CRUD_TOAST_RULES: CrudToastRule[] = [
  { pattern: /^\/api\/admin\/customers(?:\/\d+)?$/, label: "Customer" },
  { pattern: /^\/api\/admin\/users(?:\/\d+)?$/, label: "User" },
  { pattern: /^\/api\/admin\/roles(?:\/\d+)?$/, label: "Role" },
  { pattern: /^\/api\/admin\/permissions(?:\/\d+)?$/, label: "Permission" },
  { pattern: /^\/api\/admin\/products(?:\/\d+)?$/, label: "Product" },
  { pattern: /^\/api\/admin\/product-units(?:\/\d+)?$/, label: "Product unit" },
  { pattern: /^\/api\/admin\/product-prices(?:\/\d+)?$/, label: "Product price" },
  { pattern: /^\/api\/admin\/company-settings(?:\/\d+)?$/, label: "Company setting" },
  { pattern: /^\/api\/admin\/invoices(?:\/\d+)?$/, label: "Invoice" },
];

function normalizePath(path: string): string {
  if (!path.startsWith("http")) {
    return path.split("?")[0] ?? path;
  }

  try {
    return new URL(path).pathname;
  } catch {
    return path;
  }
}

function actionForMethod(method: string): CrudAction | null {
  switch (method.toUpperCase()) {
    case "POST":
      return "created";
    case "PATCH":
    case "PUT":
      return "updated";
    case "DELETE":
      return "deleted";
    default:
      return null;
  }
}

function titleCaseAction(action: CrudAction) {
  return action.charAt(0).toUpperCase() + action.slice(1);
}

function verbForAction(action: CrudAction) {
  switch (action) {
    case "created":
      return "create";
    case "updated":
      return "update";
    case "deleted":
      return "delete";
  }
}

export function getCrudToastConfig(path: string, method: string) {
  const normalizedPath = normalizePath(path);
  const action = actionForMethod(method);

  if (!action) {
    return null;
  }

  const rule = CRUD_TOAST_RULES.find((item) => item.pattern.test(normalizedPath));

  if (!rule) {
    return null;
  }

  const actionLabel = titleCaseAction(action);

  return {
    successTitle: `${rule.label} ${action}`,
    successMessage: `${rule.label} ${action} successfully.`,
    errorTitle: `${rule.label} ${actionLabel.toLowerCase()} failed`,
    fallbackErrorMessage: `We could not ${verbForAction(action)} this ${rule.label.toLowerCase()}.`,
  };
}

export function getToastErrorMessage(payload: ApiErrorPayload | undefined, fallback: string) {
  const firstValidationMessage = payload?.errors ? Object.values(payload.errors).flat().find(Boolean) : null;

  return firstValidationMessage ?? payload?.message ?? fallback;
}
