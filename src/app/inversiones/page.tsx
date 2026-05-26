import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function InversionesPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Inversiones</h1>
        <p className="text-sm text-muted-foreground">
          Cartera de acciones, ETFs, fondos y cripto con P/L automatico.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Proximamente</CardTitle>
          <CardDescription>
            Esta seccion se construira en el Lote 5.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            La estructura de navegacion ya esta lista. Cuando lleguemos
            al Lote 5 esta pantalla tendra contenido funcional.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
