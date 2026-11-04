# Social Post Studio

A free beta for making social media drafts. Requires Node.js 20 or newer; no dependencies are needed.

Run `npm start`, then open http://localhost:3000. Run `npm test` for the automated checks. The product name is in `public/index.html` and can be changed there. Platform choices and guidance live in `config.js`.

Without credentials the app clearly displays demo mode and returns sample drafts. For live generation, set `OPENAI_API_KEY` in the server environment before running. Optionally set `OPENAI_MODEL` (default `gpt-6-luna`, which supports images), `MAX_UPLOAD_MB` (default 10), and `PORT` (default 3000). Use a vision-capable model when analyzing images.

Images are sent to OpenAI when live generation is configured. Videos are checked in the browser for type, size and duration, but are not sent or analyzed: describe the clip in the text field. Uploads and post content are processed in memory and are not logged by the app; the provider's own data handling policies apply. A counter in the service records successful request counts in memory only, and resets on restart. This beta has no posting, scheduling, payment, or generation limit. Demo revisions are illustrative and live generation needs a valid API key and network access.

Photo editing uses OpenAI's image edits API with `OPENAI_IMAGE_MODEL` (default `gpt-image-2.5-sunburst`) and can incur additional charges. It requires a supported JPEG, PNG, or WebP image and a configured API key; demo mode does not edit photos. Edited images are returned as PNG and replace the selected image in the current session. Video editing is not supported. Image editing availability depends on provider account access.

To collect counts-only API usage during testing, set `USAGE_LOGGING=true` before starting the server. Each successful provider response prints a JSON line containing the model, operation and available token counts; it never includes prompts, media, or draft text. Luna draft calls include an approximate USD estimate at standard text token rates (excluding regional, long-context, and other adjustments). Photo-edit costs are not estimated in the app; use the provider dashboard for billed costs. Logs are not persistent unless the operator captures them. No live usage has been measured without credentials.

“Help me draft” sends the user’s short notes and selected context to the text model when live generation is configured. In demo mode it provides a clearly labeled template. Selecting Other requires a short description of the topic.

## Privacy and security

The application keeps session inputs, uploaded files, and results in the browser's memory, and handles request content in server memory without saving it to disk or logging it. End session reloads and clears current browser state; closing the tab normally clears it as well. No localStorage, cookies, or database are used for content. Users can independently save or copy anything they choose. In live mode, text and photos are sent to OpenAI; the app cannot delete provider-side records or guarantee immediate deletion. Review the provider's current data controls and retention terms for your account.

The local server binds to 127.0.0.1 by default, adds security and no-cache headers, checks JSON requests, and rejects cross-site browser requests. HOST may be explicitly set by a hosting operator. This is not a production security boundary: there are no accounts, authorization, payment checks, rate limits, or distributed abuse controls. Never expose a keyed server publicly until HTTPS, user authentication, server-side payment/credit checks on every paid endpoint, request limits, secret management, logging controls, and security testing are in place. Count-only usage logs are optional and contain no content.
