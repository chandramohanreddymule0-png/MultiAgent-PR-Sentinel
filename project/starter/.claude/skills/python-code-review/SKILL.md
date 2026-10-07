---
description: Python-focused code review guidance for idiomatic Python, common pitfalls, security, and maintainability
---

# Python Code Review Skill

Expert in modern, readable, safe, and maintainable Python code.

## Python Best Practices

- Prefer clear and idiomatic Python
- Use meaningful names and small focused functions
- Prefer comprehensions when they improve readability
- Use context managers for resources
- Use `enumerate()` and `zip()` instead of manual index handling where appropriate
- Avoid mutable default arguments
- Follow PEP 8 conventions
- Use type hints for public interfaces and complex code

## Common Pitfalls

Check for:

- Mutable default arguments
- Bare `except` clauses
- Swallowed exceptions
- Unnecessary global state
- Incorrect `is` versus `==` usage
- Modifying collections while iterating
- Resource leaks from files, sockets, or database connections
- Blocking operations inside asynchronous code
- Circular imports or unnecessary coupling

## Security

Look for:

- `eval()` and `exec()` with untrusted input
- Hardcoded credentials or secrets
- Unsafe subprocess usage
- SQL injection
- Path traversal
- Unsafe deserialization such as untrusted pickle data
- Insecure file handling
- Sensitive information exposed through logs or errors

## Review Process

1. Read the Python file with the Read tool
2. Check correctness and Python idioms
3. Check exception and resource handling
4. Check type safety and maintainability
5. Check security-sensitive operations
6. Provide practical fixes
7. Prioritize findings by severity

## Severity Guidelines

- critical: Severe security or correctness issue with major impact
- high: Significant bug, vulnerability, or reliability problem
- medium: Important maintainability or correctness concern
- low: Minor improvement
- info: Optional best-practice recommendation

## Output

For each issue provide:

1. Description
2. Why it is problematic
3. Recommended fix
4. Severity level
