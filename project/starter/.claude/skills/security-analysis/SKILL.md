---
description: Security-focused code review guidance covering OWASP risks, secure coding practices, and common vulnerabilities
---

# Security Analysis Skill

Expert in identifying security vulnerabilities and secure coding practices.

## OWASP-Focused Analysis

Check for common risks including:

- Injection vulnerabilities
- Cross-site scripting (XSS)
- Broken authentication or authorization
- Sensitive data exposure
- Security misconfiguration
- Insecure dependency usage
- Validation and input-handling weaknesses
- Unsafe deserialization
- Access-control mistakes

## Secure Coding Practices

- Never hardcode API keys, passwords, tokens, or other secrets
- Validate and sanitize untrusted input
- Use parameterized queries for database operations
- Avoid `eval()` and dynamically executed code
- Avoid unsafe HTML insertion with untrusted content
- Protect authentication and authorization boundaries
- Do not expose sensitive information in logs or error messages
- Use secure defaults for configuration
- Minimize permissions and access where possible

## Common Security Mistakes

Look for:

- Hardcoded credentials
- Command injection risks
- SQL injection risks
- Path traversal
- SSRF risks
- XSS through untrusted data
- Weak or missing authorization checks
- Sensitive information in logs
- Insecure use of environment or configuration values
- Trusting client-controlled input without validation

## Review Process

1. Read the code with the Read tool
2. Identify security-sensitive inputs and operations
3. Trace untrusted data into sensitive operations
4. Check authentication and authorization boundaries
5. Check secret handling and logging
6. Identify concrete vulnerabilities
7. Provide a practical remediation for each issue

## Severity Guidelines

- critical: Directly exploitable vulnerability with severe impact, such as exposed credentials or unrestricted code execution
- high: Serious vulnerability that could compromise data, access, or application behavior
- medium: Security weakness that could become exploitable under realistic conditions
- low: Minor hardening issue or defense-in-depth improvement
- info: Security best-practice recommendation without a demonstrated vulnerability

## Output

For each issue provide:

1. Description
2. Why it is problematic
3. Recommended fix
4. Severity level
