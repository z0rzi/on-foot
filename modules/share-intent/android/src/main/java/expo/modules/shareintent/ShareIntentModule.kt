package expo.modules.shareintent

import android.content.Intent
import android.net.Uri
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ShareIntentModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ShareIntent")

    Events("onShareIntent")

    Function("getInitialShareIntentUri") {
      val activity = appContext.currentActivity ?: return@Function null
      val uri = extractSendUri(activity.intent)
      if (uri != null) {
        activity.intent.action = null
      }
      uri
    }

    OnNewIntent { intent ->
      extractSendUri(intent)?.let { uri ->
        sendEvent("onShareIntent", mapOf("uri" to uri))
      }
    }
  }

  private fun extractSendUri(intent: Intent?): String? {
    if (intent == null || intent.action != Intent.ACTION_SEND) return null
    val uri = intent.clipData?.takeIf { it.itemCount > 0 }?.getItemAt(0)?.uri
      ?: legacyStreamExtra(intent)
    return uri?.toString()
  }

  @Suppress("DEPRECATION")
  private fun legacyStreamExtra(intent: Intent): Uri? =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
    } else {
      intent.getParcelableExtra(Intent.EXTRA_STREAM)
    }
}
