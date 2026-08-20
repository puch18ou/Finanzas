package personal.finanzas.app

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.core.content.FileProvider
import java.io.File

/**
 * Actividad invisible que lanza el instalador del sistema para un APK ya
 * descargado (auto-update in-app del movil).
 *
 * Se invoca desde el frontend con `openUrl("finanzas-install://install?path=...")`
 * (el plugin opener lanza un Intent.ACTION_VIEW con ese esquema, que Android
 * enruta aqui). Construye el intent de instalacion COMO DEBE hacerse en Android
 * 7+: una URI de FileProvider (content://) con el tipo MIME de APK y permiso de
 * lectura para el instalador. El plugin opener NO puede hacer esto (usa file://
 * sin MIME), por eso necesitamos esta actividad.
 *
 * Android pide SIEMPRE confirmar la instalacion; no hay instalacion silenciosa
 * fuera de Play Store. Si algo falla, no hacemos nada (el usuario conserva el
 * fallback de "Descargar en el navegador").
 */
class InstallActivity : Activity() {
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
        val install = Intent(Intent.ACTION_VIEW).apply {
          setDataAndType(uri, "application/vnd.android.package-archive")
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        startActivity(install)
      }
    } catch (_: Exception) {
      // Silencioso: el usuario conserva el fallback del navegador.
    }
    finish()
  }
}
