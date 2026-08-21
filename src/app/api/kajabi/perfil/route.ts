import { NextRequest, NextResponse } from "next/server";
import { obtenerUsuarioActual } from "@/lib/auth";
import { tienePermiso } from "@/lib/permisos";
import { obtenerPerfilKajabi } from "@/lib/kajabi";

// Versión agnóstica de id de /api/clientes/[id]/kajabi-perfil — busca el
// perfil en vivo de Kajabi por correo, no por el id de un cliente del CRM.
// La comparte tanto el panel de un cliente del Club como el detalle de
// "Otras Ofertas", que viven en tablas distintas. Acepta cualquiera de los
// dos permisos de lectura (hoy tienen el mismo criterio de roles, pero se
// revisan por separado para que esta ruta no quede mal gateada si algún día
// se desalinean).
export async function GET(req: NextRequest) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!tienePermiso(usuario.rol, "verClientes") && !tienePermiso(usuario.rol, "verOtrasOfertas")) {
    return NextResponse.json({ error: "No tienes permiso para esto" }, { status: 403 });
  }

  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "Falta el correo" }, { status: 400 });

  try {
    const perfil = await obtenerPerfilKajabi(email);
    return NextResponse.json({ perfil });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
