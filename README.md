# Study Bloom 🌼

A fully offline Android study planner built with **React Native CLI**, matching the lavender, cream, flower, and sleepy-cat storyboard. Development branch: **study-planer**.

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

Backups replace the current planner after confirmation and are validated before import. Timer state is excluded from portable backups. Android system backups are disabled: export your backup before uninstalling or moving devices. Notifications are opt-in under Settings. Session alerts are rescheduled on reboot; force-stopping the app blocks Android alarms until it is opened again. Restoring a backup cancels old alarms; toggle reminders to enable the restored schedule.

## Validation

`npm test` covers date/time validation, month-boundary spaced repetition, week boundaries, deadline timers, streaks, and backup validation. CI builds the actual native APK, verifies its signature, and checks that the merged APK requests no INTERNET permission. Device UI validation is separate from build validation.
