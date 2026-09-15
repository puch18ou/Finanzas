package personal.finanzas.app

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.core.content.FileProvider
import java.io.File

/**
 * Actividad invisible que abre el SELECTOR DE COMPARTIR de Android para un
 * fichero ya escrito por la app (p.ej. la copia de seguridad JSON exportada).
 *
 * Se invoca desde el frontend con `openUrl("finanzas-share://share?path=...")`
 * (el plugin opener lanza un Intent.ACTION_VIEW con ese esquema, que Android
 * enruta aqui). Construye un Intent.ACTION_SEND con una URI de FileProvider
 * (content://) y permiso de lectura, como exige Android 7+ para compartir
 * ficheros. Reutiliza el mismo FileProvider que la instalacion del APK.
 *
 * Asi el usuario decide que hacer con el fichero (guardarlo en Archivos/Drive,
 * enviarlo por email/WhatsApp, etc). Si algo falla, no hacemos nada.
 */
class ShareActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    try {
      val path = intent?.data?.getQueryParameter("path")
      if (!path.isNullOrEmpty()) {
        val file = File(path)
        val uri: Uri = FileProvider.getUriForFile(
          this,
          "$packageName.fileprovider",
          file,
        )
        val send = Intent(Intent.ACTION_SEND).apply {
          type = "application/json"
          putExtra(Intent.EXTRA_STREAM, uri)
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        val chooser = Intent.createChooser(send, "Compartir copia de seguridad")
          .apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
        startActivity(chooser)
      }
    } catch (_: Exception) {
      // Silencioso.
    }
    finish()
  }
}
