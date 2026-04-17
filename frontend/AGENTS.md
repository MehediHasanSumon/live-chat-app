<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Frontend Protection Rule

Do not modify anything in this `frontend/` directory unless the user has explicitly granted permission for that specific frontend task in the current conversation.

If permission has not been clearly given, stop and ask before making any change.
