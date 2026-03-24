SquatFlow v2

What this build includes
- 5-day fixed exercise order based on the current weekday
- Voice countdown and calm/assertive coaching prompts
- Bodyweight and backpack load entry in kg
- Exercise load calculation = 70% bodyweight + backpack load
- Sensor-based rep counting using handheld motion
- Manual rep correction (+1 / -1)
- Set 1 to fatigue, ended by 3 seconds upright stillness or End Set button
- Sets 2-4 automatically timed at 75% of the previous set duration
- Rest periods equal to the duration of the previous set
- Weekly totals saved in localStorage
- Left/right volume handling and imbalance flag over 10%

Important notes
- Motion sensor behavior varies by Android phone and browser permissions.
- Best accuracy happens when the phone is held consistently at chest height.
- Bulgarian Squat and Side Step may need manual rep adjustment depending on technique.
- Open over HTTPS in Chrome, then install from Chrome's menu for the full PWA experience.

Files
- index.html
- styles.css
- app.js
- manifest.webmanifest
- sw.js
- icon-192.png
- icon-512.png


v2.1 changes
- More sensitive rep detection
- Added Very High sensitivity option
- Lowered movement thresholds and shorter rep cooldown


v2.2 changes
- Permanent cache-fix service worker
- Faster update pickup in Chrome
- Auto-reload when a newer app version is installed


v2.3 changes
- Switched from calendar-day exercise selection to programme progression mode
- App now advances to the next day only after exercise completion
- Added Reset programme button
\n\nv2.4 changes\n- Rebuilt rep detection to prioritize true squat-style tilt motion instead of quick phone pumping\n- Uses descent -> bottom -> rise cycle detection with hysteresis\n- Default sensitivity moved higher for normal squat motion\n

v2.5 changes
- Replaced SquatFlow rep engine with the uploaded counter logic
- Uses 40-sample calibration, adaptive baseline, dynamic threshold, peak/trough rep counting, and 3-second silence auto-end
- Sensitivity control changed to 1-5 to match the uploaded file
- Tuned for hand-held chest-height use, based on your successful test
