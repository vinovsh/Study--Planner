# Study Bloom 🌼

A fully offline Android study planner built with **React Native CLI**, matching the lavender, cream, flower, and sleepy-cat storyboard. Development branch: **study-planer**.

### 1.4.0 — Everyday study planning

- Repeat new study sessions on chosen weekdays for 1–12 weeks. The app previews the number of sessions before saving; generated sessions are independent and can be edited or deleted separately. Overlapping schedules prompt a warning before saving.
- Break assignments into up to 50 checklist steps. All steps complete the assignment; reopening a step reopens it. Completing or reopening the parent updates its steps too.
- Search assignment titles and checklist steps; combine subject filters with To do, Overdue, Completed, or All. Assignments are sorted by completion, due date, and priority.
- Home shows overdue assignments and deadlines in the next seven days, with direct links to their editors.
- Optional assignment and exam reminders: on the day, one day, three days, or one week before, at a chosen native-clock time. Local reminders must be enabled in Settings. Past new reminders are rejected; completed/deleted items cancel their alerts. Restore reschedules enabled reminders automatically.
- Legacy version-1 backups remain supported. New checklist/reminder data is validated on import. Valid device timers survive reload; invalid saved timers are discarded. Portable backups continue to exclude timers.

Research used for this release: [MyStudyLife feature tour](https://mystudylife.com/tour/) (schedules, deadlines, partial progress, reminders) and [Todoist getting started](https://www.todoist.com/help/todoist/get-started/get-started-with-todoist-OgNNJR) (assignment steps, priorities, upcoming work). These sources informed the selection; all new features work offline without those services.

### 1.3.0 — Expanded subject choices

The subject editor keeps five quick colors and three quick icons, each followed by a **More** button. Separate scrollable popups offer 40 colors and 31 named subject icons, with selection indicators and light/dark themes. Choosing an option returns to the editor; dismissing the popup preserves the draft. All choices work offline, survive reload and backup restore, and retain the styles from earlier builds.

### 1.2.1 — Mascot image sizing fix

Fixes the hero image rendering at its original bitmap dimensions on Android. The mascot now has explicit rendered width and height inside a clipped frame. Native screenshot checks verify its bounds and that its artwork stays inside the hero at standard and compact phone sizes.

### 1.2.0 — Approved Happy Bookworm design and native pickers

- Replaces the sleeping home mascot with the approved cheerful plush calico hugging a lavender book; the installed app icon uses Happy Bookworm too.
- Matches the approved cream/lavender home layout, compact progress card, subject rows, and visible **Tap to play** button. Real saved progress is preserved.
- Pet to bounce and release hearts, drag gently to tilt the layered character, tap its book for a reading cheer, hold to open Focus, and complete a session to celebrate. Motion runs natively, pauses in the background, and respects reduced-motion settings. This is a layered 2.5D presentation, not a 3D engine.
- Date fields open the native Android calendar. Start time opens a single analog clock with hours and minutes. Duration opens an hours-and-minutes clock and retains the existing 5-minute to 4-hour session limits. Cancel leaves the previous value untouched.
- All artwork is bundled; no network or account is needed. Existing planner records and backups keep their original schema.

### 1.1.0 — Interactive reference hero

The home hero now places a curled sleeping cat above a short lavender message banner, framed by illustrated flowers. Tap the hero for encouragement and floating hearts; hold it to open Focus. Native-driven breathing, flower sway, and spring press feedback pause while the app is in the background and respect Android's reduced-motion setting. Framer Motion is a web animation library; this native app uses React Native Animated instead. All illustration and animation assets remain offline.

## Included

- Today dashboard, daily completion, and editable weekly sessions
- Color-coded subjects and assignments with priorities and due dates
- Pomodoro timer with pause/resume and background-safe deadlines
- Focus-time charts, weekly goals, and study streaks (real data, no fabricated activity)
- Flashcards with spaced repetition
- Text notes and exam countdowns with revision planning
- Native local notifications; Android can delay alerts in battery saver
- Device-local AsyncStorage, dark mode, and JSON backup/restore through Android's file picker
- Original SVG cat and flower illustrations; no remote assets

Seed subjects, three example sessions, two tasks, and two flashcards help you get started; all can be edited or deleted. No account, ads, analytics, or internet permission in the standalone APK. No cloud or AI features.

## Get the APK

Open the **Actions** tab, choose a successful **Build Study Bloom APK** run for `study-planer`, and download the **StudyBloom-APK** artifact. Unzip it and install `StudyBloom.apk`. Android may ask you to allow installation from your browser or file manager. Supports Android 7.0+ (API 24), ARM64, ARMv7, and x86_64.

The release-variant APK contains the JS bundle and runs without Metro or internet. It uses a development signing key for sideload testing, not a Play Store production key. CI caches that key for repeat installs; if the cache is lost, export a backup before uninstalling the older build.

## Develop

Requires Node 20+, JDK 17, Android SDK platform 35/build tools 35.0.0, NDK 26.1.10909125, and Gradle 8.10.2.

```sh
npm install
npm test
# Generate the wrapper once when setting up a local checkout:
cd android
gradle wrapper --gradle-version 8.10.2
cd ..
# Set sdk.dir in android/local.properties to your Android SDK path.
# Generate a local development signing key:
keytool -genkeypair -keystore android/app/debug.keystore -storepass android -alias androiddebugkey -keypass android -dname 'CN=Study Bloom Development,O=Study Bloom,C=US' -keyalg RSA -keysize 2048 -validity 10000
npm start
# In another terminal:
npm run android
```

For a bundled sideload APK: `cd android && gradle assembleRelease`. Output: `android/app/build/outputs/apk/release/app-release.apk`.

This checkout targets Android. An iOS native project and iOS reminder/file-picker implementations are not included.

## Data and reminders

Backups replace the current planner after confirmation and are validated before import. Timer state is excluded from portable backups. Android system backups are disabled: export your backup before uninstalling or moving devices. Notifications are opt-in under Settings. Session alerts are rescheduled on reboot; force-stopping the app blocks Android alarms until it is opened again. Restoring a backup cancels old alarms and reschedules future alerts when the restored settings enable reminders.

## Validation

`npm test` covers date/time validation, month-boundary spaced repetition, week boundaries, deadline timers, streaks, and backup validation. CI builds the actual native APK, verifies its signature, and checks that the merged APK requests no INTERNET permission. Device UI validation is separate from build validation.
