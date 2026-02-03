---
name: typescript-dev
description: TypeScript development best practices including type safety, modern patterns, and Node.js development. Use when writing TypeScript or JavaScript code.
metadata:
  author: iker-agents
  version: "1.0"
---

# TypeScript Development Skill

Follow these guidelines when writing TypeScript code.

## Type Safety

### Use strict types

```typescript
// Good - explicit types
function greet(name: string): string {
  return `Hello, ${name}!`;
}

// Good - interface for objects
interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

// Good - union types
type Status = "pending" | "active" | "inactive";
```

### Avoid `any`

```typescript
// Bad
function process(data: any): any {
  return data.value;
}

// Good - use generics
function process<T extends { value: unknown }>(data: T): T["value"] {
  return data.value;
}
```

## Modern Patterns

### Use const assertions

```typescript
const CONFIG = {
  apiUrl: "https://api.example.com",
  timeout: 5000,
} as const;

// Type is readonly
type Config = typeof CONFIG;
```

### Use template literal types

```typescript
type HTTPMethod = "GET" | "POST" | "PUT" | "DELETE";
type Endpoint = `/api/${string}`;
type Route = `${HTTPMethod} ${Endpoint}`;

const route: Route = "GET /api/users"; // Valid
```

### Discriminated unions

```typescript
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function handleResult<T>(result: Result<T>): T | null {
  if (result.success) {
    return result.data; // TypeScript knows data exists
  }
  console.error(result.error);
  return null;
}
```

## Async Patterns

### Async/await with error handling

```typescript
async function fetchUser(id: number): Promise<User> {
  try {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch user: ${error.message}`);
    }
    throw error;
  }
}
```

### Promise utilities

```typescript
// Parallel execution
const [users, posts] = await Promise.all([
  fetchUsers(),
  fetchPosts(),
]);

// With timeout
async function withTimeout<T>(
  promise: Promise<T>,
  ms: number
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Timeout")), ms)
  );
  return Promise.race([promise, timeout]);
}
```

## Utility Types

```typescript
// Partial - make all properties optional
type PartialUser = Partial<User>;

// Pick - select specific properties
type UserPreview = Pick<User, "id" | "name">;

// Omit - exclude properties
type UserWithoutId = Omit<User, "id">;

// Record - create object type
type UserMap = Record<number, User>;
```

## Error Handling

```typescript
// Custom error classes
class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

// Type guard for errors
function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}
```

## Best Practices

1. **Enable strict mode** - In tsconfig.json
2. **Use interfaces for objects** - Better error messages
3. **Prefer const** - Immutability by default
4. **Use nullish coalescing** - `value ?? default`
5. **Use optional chaining** - `obj?.property?.nested`
