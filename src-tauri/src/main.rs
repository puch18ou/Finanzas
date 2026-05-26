// Evita que se abra una consola adicional en Windows release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    finanzas_lib::run()
}
