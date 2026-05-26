import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function CuentasPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Cuentas</h1>
        <p className="text-sm text-muted-foreground">
          Cuentas bancarias, broker y efectivo. Saldos en moneda nativa y convertidos.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Proximamente</CardTitle>
          <CardDescription>
            Esta seccion se construira en el Lote 4.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            La estructura de navegacion ya esta lista. Cuando lleguemos
            al Lote 4 esta pantalla tendra contenido funcional.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
