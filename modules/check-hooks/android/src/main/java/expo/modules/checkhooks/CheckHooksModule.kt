package expo.modules.checkhooks

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

// The check hooks' receiver: registered while JS listens, exported but held to the DUMP permission,
// which adb's shell has and no installed app can get. Each broadcast is held open until JS replies,
// and the reply is its result, which `am broadcast` prints (tools/device-check/hookReply.ts).
class CheckHooksModule : Module() {
  private val pending = ConcurrentHashMap<String, BroadcastReceiver.PendingResult>()
  private val main = Handler(Looper.getMainLooper())
  private var receiver: BroadcastReceiver? = null

  private val context: Context
    get() = appContext.reactContext?.applicationContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("CheckHooks")

    Events(EVENT)

    OnStartObserving(EVENT) { register() }

    OnStopObserving(EVENT) { unregister() }

    OnDestroy { unregister() }

    Function("reply") { id: String, data: String -> finish(id, REPLIED, data) }

    Function("hookFolder") { context.getExternalFilesDir(FOLDER)?.absolutePath }
  }

  private fun register() {
    if (receiver != null) return
    val created = object : BroadcastReceiver() {
      override fun onReceive(context: Context, intent: Intent) {
        val id = UUID.randomUUID().toString()
        pending[id] = goAsync()
        main.postDelayed({ finish(id, NO_REPLY, null) }, DEADLINE_MS)
        sendEvent(
          EVENT,
          mapOf(
            "id" to id,
            "hook" to (intent.getStringExtra("hook") ?: ""),
            "args" to (intent.getStringExtra("args") ?: "{}"),
          ),
        )
      }
    }
    val filter = IntentFilter(ACTION)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.registerReceiver(created, filter, Manifest.permission.DUMP, null, Context.RECEIVER_EXPORTED)
    } else {
      context.registerReceiver(created, filter, Manifest.permission.DUMP, null)
    }
    receiver = created
  }

  private fun unregister() {
    val registered = receiver ?: return
    receiver = null
    context.unregisterReceiver(registered)
    pending.keys.forEach { finish(it, NO_REPLY, null) }
  }

  private fun finish(id: String, code: Int, data: String?) {
    pending.remove(id)?.apply {
      setResult(code, data, null)
      finish()
    }
  }

  companion object {
    const val EVENT = "onCheckHook"
    const val ACTION = "com.zorzi.onfootrn.CHECK_HOOK"
    const val FOLDER = "hooks"

    // Result codes `am broadcast` prints; a broadcast no receiver took keeps the initial 0.
    const val REPLIED = 1
    const val NO_REPLY = 2

    // Inside the foreground broadcast's 10 s limit, past which the system calls the app not responding.
    const val DEADLINE_MS = 8_000L
  }
}
