import { cn } from "@/lib/utils";

interface FieldErrorProps {
  error?: string;
  className?: string;
}

/**
 * Displays field-level validation errors
 */
export function FieldError({ error, className }: FieldErrorProps) {
  if (!error) return null;

  return (
    <p className={cn("text-destructive text-xs", className)} role="alert">
      {error}
    </p>
  );
}

interface FormFieldProps {
  children: React.ReactNode;
  error?: string;
  className?: string;
}

/**
 * Wrapper component that adds error styling to form fields
 */
export function FormField({ children, error, className }: FormFieldProps) {
  return (
    <div className={cn("", className)}>
      {children}
      <FieldError error={error} />
    </div>
  );
}
