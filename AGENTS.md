# Workspace Rules

## Production Safety

This project is already live and running on a VPS. Treat backend, deployment, database, environment, queue, cron, websocket, storage, and authentication changes as production-sensitive work.

Prefer the safest possible path. Do not make backend or deployment changes silently.

## App-First Delivery

For user-facing feature work, prefer implementing the change in the `app/` directory first when it can be done there without backend changes.

If backend changes are required to support the requested work, pause before editing backend files and explain:

1. What needs to change.
2. Why the backend change is necessary.
3. Which files are expected to be modified.
4. Any likely production impact or rollout concern.

Only proceed with backend edits after the user gives permission in the current conversation.

## Frontend Protection

Do not modify anything inside the `frontend/` directory unless the user has explicitly granted permission for that specific task in the current conversation.

If a request would require frontend changes and the user has not clearly approved them yet, stop and ask for permission before making any edit in `frontend/`.

## Cross-Platform Consistency

The `app/` directory is the mobile app (React Native). The `frontend/` directory is the Next.js web app.

If a requested change affects shared product behavior across mobile and web, first identify whether the logic, API contract, validation, copy, or data shape should stay aligned in both places.

When both React Native and Next.js are involved, avoid one-off behavior that drifts between platforms. Prefer changes that keep both implementations maintainable, using shared backend contracts, consistent field names, matching validation rules, and clearly mirrored behavior where appropriate.

Before editing both `app/` and `frontend/`, explain the cross-platform impact and get permission for the `frontend/` portion if it has not already been granted.
