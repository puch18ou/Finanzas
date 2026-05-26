import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function CategoriasPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Categorias</h1>
        <p className="text-sm text-muted-foreground">
          Listado editable de categorias de gasto con presupuesto mensual.
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
