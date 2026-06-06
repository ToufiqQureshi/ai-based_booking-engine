# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Staybooker, please report it
responsibly:

- **Email:** security@staybooker.ai (or tech.revmerito@gmail.com)
- **Do not** open a public GitHub issue for security problems.
- Please include: a description of the issue, steps to reproduce, the
  affected endpoint/component, and the potential impact.

We aim to acknowledge reports within **2 business days** and to provide a
remediation timeline within **7 business days**, prioritised by severity
(Critical → High → Medium → Low).

## Scope

In scope: the backend API (`/api/v1/*`), the hotelier dashboard, the public
booking engine, the super-admin panel, and authentication/authorization.

Out of scope: denial-of-service testing against production, social
engineering, and physical attacks.

## Supported Versions

The latest `main` branch is the only supported version. Security fixes are
applied to `main` and deployed; older deploys are not separately patched.

## Disclosure

Please give us a reasonable window to remediate before any public
disclosure. We're happy to credit reporters who follow this policy.
