package com.studybloom

import android.app.Activity
import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.*
import com.facebook.react.uimanager.ViewManager
import org.json.JSONObject

class BloomPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(BloomDevice(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}

class BloomDevice(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context), ActivityEventListener {
  private var pending: Promise? = null
  private var payload: String? = null
  init { context.addActivityEventListener(this) }
  override fun getName() = "BloomDevice"
  @ReactMethod fun scheduleReminder(id: String, title: String, body: String, timestamp: Double, promise: Promise) {
    try {
      Reminders.schedule(context, id, title, body, timestamp.toLong())
      promise.resolve(true)
    } catch (e: Exception) { promise.reject("REMINDER", "Could not schedule reminder", e) }
  }
  @ReactMethod fun cancelReminder(id: String) { Reminders.cancel(context, id) }
  @ReactMethod fun cancelAllReminders() {
    val keys = Reminders.preferences(context).all.keys.toList()
    keys.forEach { Reminders.cancel(context, it) }
  }
  @ReactMethod fun exportBackup(json: String, promise: Promise) {
    if (pending != null) {promise.reject("BUSY", "A file picker is already open"); return}
    val activity = currentActivity ?: run { promise.reject("NO_ACTIVITY", "Open the app first"); return }
    pending = promise; payload = json
    try {
      val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
        addCategory(Intent.CATEGORY_OPENABLE); type = "application/json"
        putExtra(Intent.EXTRA_TITLE, "study-bloom-backup.json")
      }
      activity.startActivityForResult(intent, 701)
    } catch (e: Exception) { pending = null; payload = null; promise.reject("EXPORT", "No file picker available", e) }
  }
  @ReactMethod fun importBackup(promise: Promise) {
    if (pending != null) {promise.reject("BUSY", "A file picker is already open"); return}
    val activity = currentActivity ?: run { promise.reject("NO_ACTIVITY", "Open the app first"); return }
    pending = promise
    try {
      val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply { addCategory(Intent.CATEGORY_OPENABLE); type = "*/*" }
      activity.startActivityForResult(intent, 702)
    } catch (e: Exception) { pending = null; promise.reject("IMPORT", "No file picker available", e) }
  }
  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != 701 && requestCode != 702) return
    val promise = pending ?: return
    val json = payload; pending = null; payload = null
    val uri = data?.data
    if (resultCode != Activity.RESULT_OK || uri == null) { promise.reject("CANCELLED", "Cancelled"); return }
    Thread {
      try {
        if (requestCode == 701) {
          val output = context.contentResolver.openOutputStream(uri) ?: throw Exception("Cannot write file")
          output.use { it.write((json ?: "").toByteArray(Charsets.UTF_8)) }
          promise.resolve(true)
        } else {
          val input = context.contentResolver.openInputStream(uri) ?: throw Exception("Cannot read file")
          val bytes = input.use { stream ->
            val buffer = ByteArray(8192)
            val output = java.io.ByteArrayOutputStream()
            var count = stream.read(buffer)
            while (count != -1) {
              if (output.size() + count > 5 * 1024 * 1024) throw Exception("Backup is too large")
              output.write(buffer, 0, count)
              count = stream.read(buffer)
            }
            output.toByteArray()
          }
          promise.resolve(String(bytes, Charsets.UTF_8))
        }
      } catch (e: Exception) { promise.reject("FILE", "Could not access backup", e) }
    }.start()
  }
  override fun onNewIntent(intent: Intent) {}
}

object Reminders {
  fun preferences(context: Context) = context.getSharedPreferences("bloom-reminders", Context.MODE_PRIVATE)
  private fun intent(context: Context, id: String) = Intent(context, ReminderReceiver::class.java).apply { data = Uri.parse("bloom://reminder/${Uri.encode(id)}"); putExtra("id", id) }
  private fun pending(context: Context, id: String) = PendingIntent.getBroadcast(context, 0, intent(context, id), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  fun schedule(context: Context, id: String, title: String, body: String, timestamp: Long) {
    if (timestamp <= System.currentTimeMillis()) return
    val record = JSONObject().put("title", title).put("body", body).put("time", timestamp)
    preferences(context).edit().putString(id, record.toString()).apply()
    val alarms = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, timestamp, pending(context, id))
  }
  fun cancel(context: Context, id: String) {
    (context.getSystemService(Context.ALARM_SERVICE) as AlarmManager).cancel(pending(context, id))
    preferences(context).edit().remove(id).apply()
  }
}

class ReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val id = intent.getStringExtra("id") ?: return
    val raw = Reminders.preferences(context).getString(id, null) ?: return
    Reminders.preferences(context).edit().remove(id).apply()
    try {
      val record = JSONObject(raw)
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(NotificationChannel("study-bloom", "Study & focus reminders", NotificationManager.IMPORTANCE_DEFAULT))
      val open = PendingIntent.getActivity(context, 0, Intent(context, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(context, "study-bloom") else Notification.Builder(context)
      val notification = builder.setSmallIcon(R.drawable.ic_notification).setContentTitle(record.getString("title")).setContentText(record.getString("body")).setContentIntent(open).setAutoCancel(true).build()
      manager.notify(id.hashCode(), notification)
    } catch (_: Exception) { /* Permission may have been revoked outside the app. */ }
  }
}

class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
    Reminders.preferences(context).all.forEach { (id, raw) ->
      try {
        val record = JSONObject(raw as String)
        if (record.getLong("time") > System.currentTimeMillis()) Reminders.schedule(context, id, record.getString("title"), record.getString("body"), record.getLong("time"))
        else Reminders.cancel(context, id)
      } catch (_: Exception) { Reminders.cancel(context, id) }
    }
  }
}
