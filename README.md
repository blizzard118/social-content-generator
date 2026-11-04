# Social Post Studio

A free beta for making social media drafts. Requires Node.js 20 or newer; no dependencies are needed.

Run `npm start`, then open http://localhost:3000. Run `npm test` for the automated checks. The product name is in `public/index.html` and can be changed there. Platform choices and guidance live in `config.js`.

Without credentials the app clearly displays demo mode and returns sample drafts. For live generation, set `OPENAI_API_KEY` in the server environment before running. Optionally set `OPENAI_MODEL` (default `gpt-4o-mini`, which supports images), `MAX_UPLOAD_MB` (default 10), and `PORT` (default 3000). Use a vision-capable model when analyzing images.

Images are sent to OpenAI when live generation is configured. Videos are checked in the browser for type, size and duration, but are not sent or analyzed: describe the clip in the text field. Uploads and post content are processed in memory and are not logged by the app; the provider's own data handling policies apply. A counter in the service records successful request counts in memory only, and resets on restart. This beta has no posting, scheduling, payment, or generation limit. Demo revisions are illustrative and live generation needs a valid API key and network access.

Photo editing uses OpenAI's image edits API with `OPENAI_IMAGE_MODEL` (default `gpt-image-1`) and can incur additional charges. It requires a supported JPEG, PNG, or WebP image and a configured API key; demo mode does not edit photos. Edited images are returned as PNG and replace the selected image in the current session. Video editing is not supported. Image editing availability depends on provider account access.
