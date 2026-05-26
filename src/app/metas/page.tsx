import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function MetasPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Metas</h1>
        <p className="text-sm text-muted-foreground">
          Objetivos de ahorro con fecha. Progreso y ahorro mensual necesario.
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
