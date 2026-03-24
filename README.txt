SquatFlow v3.0

New features
- Start screen with all five exercises shown as cards
- Two modes:
  - Free Selection: start any exercise immediately
  - 5 Day Programme: ordered day-by-day workflow
- Programme screen highlights the currently available exercise
- Programme logging with day and completion date
- Next programme day becomes available the following day and remains valid for one additional day
- If more than 2 days pass between programme sessions, the programme restarts from Day 1

Existing workout features retained
- Uploaded counter logic for rep counting
- 40-sample calibration
- Adaptive baseline and dynamic threshold
- Peak/trough rep counting
- 3-second silence auto-end
- Load calculation, volume tracking, weekly totals, and left/right split


v3.1 changes
- Replaced exercise icon cards with the uploaded PNG exercise images
- Added image assets under /images and cached them in the service worker


v3.2 changes
- Embedded all five exercise PNGs directly into app.js as data URIs
- Removed dependency on an /images folder so GitHub upload is simpler
- Updated service worker cache version
