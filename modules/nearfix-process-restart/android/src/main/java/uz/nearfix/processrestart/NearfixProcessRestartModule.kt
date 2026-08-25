package uz.nearfix.processrestart

import com.jakewharton.processphoenix.ProcessPhoenix
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NearfixProcessRestartModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NearfixProcessRestart")

    Function("restart") {
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      ProcessPhoenix.triggerRebirth(context)
    }
  }
}
