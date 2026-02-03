---
name: python-dev
description: Python development best practices including code style, testing, type hints, and modern Python patterns. Use when writing Python code, debugging, or reviewing Python projects.
metadata:
  author: iker-agents
  version: "1.0"
---

# Python Development Skill

Follow these guidelines when writing Python code.

## Code Style

1. **Follow PEP 8** - Use 4 spaces for indentation, max 88 characters per line (black format)
2. **Use type hints** - Always annotate function parameters and return types
3. **Write docstrings** - Use Google-style docstrings for all public functions and classes

## Example Function

```python
def calculate_fibonacci(n: int) -> list[int]:
    """Calculate the first n Fibonacci numbers.

    Args:
        n: The number of Fibonacci numbers to generate.

    Returns:
        A list containing the first n Fibonacci numbers.

    Raises:
        ValueError: If n is negative.
    """
    if n < 0:
        raise ValueError("n must be non-negative")
    if n == 0:
        return []
    if n == 1:
        return [0]

    fib = [0, 1]
    for _ in range(2, n):
        fib.append(fib[-1] + fib[-2])
    return fib
```

## Modern Python Patterns

### Use dataclasses for data containers

```python
from dataclasses import dataclass

@dataclass
class User:
    name: str
    email: str
    age: int = 0
```

### Use pathlib for file paths

```python
from pathlib import Path

config_path = Path(__file__).parent / "config.yaml"
content = config_path.read_text()
```

### Use context managers

```python
from contextlib import contextmanager

@contextmanager
def timer(name: str):
    import time
    start = time.perf_counter()
    yield
    elapsed = time.perf_counter() - start
    print(f"{name}: {elapsed:.2f}s")
```

### Use f-strings for formatting

```python
name = "Alice"
age = 30
message = f"Hello, {name}! You are {age} years old."
```

## Error Handling

- Be specific with exception types
- Use custom exceptions for domain errors
- Always include helpful error messages

```python
class ValidationError(Exception):
    """Raised when input validation fails."""
    pass

def validate_email(email: str) -> str:
    if "@" not in email:
        raise ValidationError(f"Invalid email format: {email}")
    return email.lower()
```

## Testing

- Write tests using pytest
- Use fixtures for setup
- Aim for >80% coverage

```python
import pytest

@pytest.fixture
def sample_user():
    return User(name="Test", email="test@example.com")

def test_user_creation(sample_user):
    assert sample_user.name == "Test"
    assert sample_user.email == "test@example.com"
```

## Dependencies

- Use `uv` for package management
- Pin versions in `pyproject.toml`
- Separate dev dependencies
