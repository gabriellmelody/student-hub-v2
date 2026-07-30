# Smart Planner beta usage controls

Smart Planner uses `SMART_PLANNER_USAGE_SECRET` to sign the HttpOnly
`student_hub_smart_planner_quota` cookie. `SMART_PLANNER_DAILY_LIMIT` defaults
to 3 and is clamped between 1 and 10. The quota is consumed immediately before
the one Anthropic request; validation failures, missing provider configuration,
and the local Basic planner do not consume it.

This is browser-level beta protection, not account-grade enforcement. Clearing
browser cookies starts a new quota because Student Hub does not have accounts
yet. The secondary IP limits are intentionally generous and stored only in a
serverless instance's memory, so they are not durable or shared across all
instances. Durable enforcement requires authenticated users and shared
server-side storage in a later stage.

Never expose either `SMART_PLANNER_USAGE_SECRET` or `ANTHROPIC_API_KEY` to the
browser, logs, or API responses.
