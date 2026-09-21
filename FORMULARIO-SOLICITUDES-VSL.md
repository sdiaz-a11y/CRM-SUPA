# Formulario de Solicitudes para VSL

Este documento describe el formulario de "Solicitud de cliente" que usa el CRM del Club Sinergético (Solicitudes → Nueva solicitud), replicado en HTML puro para que el equipo de VSL lo use tal cual. Si los campos, nombres y valores coinciden exactamente con lo de aquí, el CRM va a leer los datos sin errores — es la causa de los datos mal cargados hasta ahora: el formulario de VSL no coincidía campo a campo con el nuestro.

## 1. Qué cambia respecto al formulario original

El formulario interno tiene un selector de evento que busca en **todo** el catálogo (presenciales, webinars, etc.). Este, en cambio, limita el campo Evento a los **3 eventos que le corresponden a VSL**, para que el vendedor solo tenga que elegir entre esas 3 opciones (él sabe cuál vendió — no se auto-selecciona por país):

- `VSL MX`
- `VSL USA`
- `VSL LATAM`

Todo lo demás (nombre, correos, teléfono, país, tipo de membresía, comprobantes) es exactamente igual al formulario interno.

## 2. Especificación de campos

El backend (`POST /api/solicitudes`) espera un `multipart/form-data` con estos nombres de campo **exactos** (respetar mayúsculas/minúsculas):

| Campo (`name`)   | Tipo               | Obligatorio | Valores / formato |
|---|---|---|---|
| `nombre`          | texto               | Sí | Nombre completo del cliente |
| `correoPago`      | email               | Sí | Correo con el que pagó |
| `correoAcceso`    | email               | Sí | Correo con el que va a entrar a la plataforma (puede ser el mismo que el de pago) |
| `telefono`        | texto               | Sí | Incluir lada. Ej. `+52 55 1234 5678` |
| `pais`             | select              | Recomendado* | Uno de la lista fija de países de América (sección 3) |
| `evento`           | select              | Sí | Exactamente uno de: `VSL MX`, `VSL USA`, `VSL LATAM` (sin espacios extra) |
| `tipoMembresia`    | select              | Sí | Exactamente uno de: `3 Meses`, `6 Meses`, `12 Meses` |
| `comprobantes`     | archivo (1 a 5)     | Sí, al menos 1 | Imagen o PDF, máx. **8 MB** cada uno. Tipos permitidos: JPG, PNG, WEBP, HEIC/HEIF, PDF |

\* `pais` no bloquea el envío en el backend, pero **sí es importante llenarlo** porque ayuda a completar la lada del teléfono y queda guardado en el perfil del cliente. Trátalo como obligatorio en la práctica.

Cualquier otro nombre de campo, o valores con espacios/mayúsculas distintos a los de arriba (ej. `"vsl mx"` en vez de `"VSL MX"`, o `"3 meses"` en vez de `"3 Meses"`), es justo lo que ha estado causando los datos mal cargados.

## 3. Lista de países (con lada)

Mismo orden que usa el CRM (los 3 más comunes primero, luego alfabético). El `value` del `<option>` debe ser el nombre tal cual, en español:

```
México (+52), Estados Unidos (+1), Colombia (+57), Antigua y Barbuda (+1), Argentina (+54),
Bahamas (+1), Barbados (+1), Belice (+501), Bolivia (+591), Brasil (+55), Canadá (+1),
Chile (+56), Costa Rica (+506), Cuba (+53), Dominica (+1), Ecuador (+593), El Salvador (+503),
Granada (+1), Guatemala (+502), Guyana (+592), Haití (+509), Honduras (+504), Jamaica (+1),
Nicaragua (+505), Panamá (+507), Paraguay (+595), Perú (+51), Puerto Rico (+1),
República Dominicana (+1), San Cristóbal y Nieves (+1), San Vicente y las Granadinas (+1),
Santa Lucía (+1), Surinam (+597), Trinidad y Tobago (+1), Uruguay (+598), Venezuela (+58)
```

(Ya vienen todos cargados en el `<select>` del código de abajo — no hace falta transcribirlos a mano.)

## 4. Código del formulario (HTML autocontenido)

Guarda esto como `formulario-vsl.html` y ábrelo en cualquier navegador para probarlo — no necesita build ni dependencias.

```html
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Solicitud de cliente — VSL</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 24px; background: #f4f5f7;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #1a1a2e;
  }
  .card {
    max-width: 560px; margin: 0 auto; background: #fff; border-radius: 20px;
    padding: 28px; box-shadow: 0 8px 30px rgba(0,0,0,0.08);
  }
  h1 { font-size: 18px; margin: 0 0 4px; }
  p.sub { font-size: 13px; color: #6b7280; margin: 0 0 20px; }
  label { display: block; font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 4px; }
  .field { margin-bottom: 14px; }
  input[type=text], input[type=email], select {
    width: 100%; padding: 9px 12px; border: 1px solid #d1d5db; border-radius: 10px;
    font-size: 14px; background: #f9fafb;
  }
  input:focus, select:focus { outline: 2px solid #6366f1; outline-offset: 1px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .archivos { border: 1px dashed #d1d5db; border-radius: 10px; padding: 10px; background: #f9fafb; }
  .archivo-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .archivo-row input[type=file] { flex: 1; font-size: 12px; }
  .btn-add { background: none; border: none; color: #6366f1; font-size: 12px; font-weight: 600; cursor: pointer; padding: 4px 0; }
  .btn-quitar { background: none; border: none; color: #9ca3af; cursor: pointer; font-size: 16px; line-height: 1; }
  button[type=submit] {
    width: 100%; margin-top: 8px; padding: 12px; border: none; border-radius: 12px;
    background: #4f46e5; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer;
  }
  button[type=submit]:disabled { opacity: 0.5; cursor: not-allowed; }
  .msg { font-size: 12px; margin-top: 10px; }
  .msg.error { color: #dc2626; }
  .msg.ok { color: #16a34a; }
  .req { color: #dc2626; }
</style>
</head>
<body>
  <div class="card">
    <h1>Nueva solicitud de cliente — VSL</h1>
    <p class="sub">Llena los datos del cliente y adjunta su comprobante de pago.</p>

    <form id="form-solicitud">
      <div class="field">
        <label>Nombre completo <span class="req">*</span></label>
        <input type="text" id="nombre" name="nombre" required />
      </div>

      <div class="grid2">
        <div class="field">
          <label>Correo de pago <span class="req">*</span></label>
          <input type="email" id="correoPago" name="correoPago" placeholder="Con el que pagó" required />
        </div>
        <div class="field">
          <label>Correo de acceso <span class="req">*</span></label>
          <input type="email" id="correoAcceso" name="correoAcceso" placeholder="Con el que entra a la plataforma" required />
        </div>
      </div>

      <div class="grid2">
        <div class="field">
          <label>País <span class="req">*</span></label>
          <select id="pais" name="pais" required></select>
        </div>
        <div class="field">
          <label>Teléfono <span class="req">*</span></label>
          <input type="text" id="telefono" name="telefono" required />
        </div>
      </div>

      <div class="grid2">
        <div class="field">
          <label>Evento (VSL) <span class="req">*</span></label>
          <select id="evento" name="evento" required>
            <option value="">Seleccionar…</option>
            <option value="VSL MX">VSL MX</option>
            <option value="VSL USA">VSL USA</option>
            <option value="VSL LATAM">VSL LATAM</option>
          </select>
        </div>
        <div class="field">
          <label>Tipo de membresía <span class="req">*</span></label>
          <select id="tipoMembresia" name="tipoMembresia" required>
            <option value="">Seleccionar…</option>
            <option value="3 Meses">3 Meses</option>
            <option value="6 Meses">6 Meses</option>
            <option value="12 Meses">12 Meses</option>
          </select>
        </div>
      </div>

      <div class="field">
        <label>Comprobante de pago <span class="req">*</span> (al menos 1, hasta 5)</label>
        <div class="archivos" id="archivos"></div>
        <button type="button" class="btn-add" id="btn-agregar-archivo">+ Agregar otro comprobante</button>
      </div>

      <button type="submit" id="btn-enviar">Enviar solicitud</button>
      <p id="mensaje" class="msg"></p>
    </form>
  </div>

<script>
  // ── Configuración ─────────────────────────────────────────────────────
  // URL a la que se manda el formulario. HOY NO EXISTE TODAVÍA — ver la
  // sección 5 del .md ("Pendiente del lado del CRM"). Mientras tanto, este
  // formulario funciona en "modo prueba": si el envío falla, muestra el
  // payload armado en pantalla para verificar que los datos van bien.
  const ENDPOINT_URL = "https://soporte.sinergeticos.com/api/solicitudes-externas?token=TOKEN_PENDIENTE";

  // ── Países (nombre + lada) ───────────────────────────────────────────
  const PAISES = [
    ["México", "+52"], ["Estados Unidos", "+1"], ["Colombia", "+57"],
    ["Antigua y Barbuda", "+1"], ["Argentina", "+54"], ["Bahamas", "+1"], ["Barbados", "+1"],
    ["Belice", "+501"], ["Bolivia", "+591"], ["Brasil", "+55"], ["Canadá", "+1"], ["Chile", "+56"],
    ["Costa Rica", "+506"], ["Cuba", "+53"], ["Dominica", "+1"], ["Ecuador", "+593"],
    ["El Salvador", "+503"], ["Granada", "+1"], ["Guatemala", "+502"], ["Guyana", "+592"],
    ["Haití", "+509"], ["Honduras", "+504"], ["Jamaica", "+1"], ["Nicaragua", "+505"],
    ["Panamá", "+507"], ["Paraguay", "+595"], ["Perú", "+51"], ["Puerto Rico", "+1"],
    ["República Dominicana", "+1"], ["San Cristóbal y Nieves", "+1"],
    ["San Vicente y las Granadinas", "+1"], ["Santa Lucía", "+1"], ["Surinam", "+597"],
    ["Trinidad y Tobago", "+1"], ["Uruguay", "+598"], ["Venezuela", "+58"],
  ];

  const selectPais = document.getElementById("pais");
  const inputTelefono = document.getElementById("telefono");
  selectPais.innerHTML =
    '<option value="">Seleccionar…</option>' +
    PAISES.map(([nombre]) => `<option value="${nombre}">${nombre}</option>`).join("");

  // Al elegir país, precarga la lada en teléfono (si el campo está vacío),
  // igual que el formulario interno.
  selectPais.addEventListener("change", () => {
    const pais = PAISES.find(([nombre]) => nombre === selectPais.value);
    if (pais && !inputTelefono.value.trim()) {
      inputTelefono.value = pais[1] + " ";
      inputTelefono.focus();
    }
  });

  // ── Comprobantes: slots dinámicos (mín. 1, máx. 5) ──────────────────
  const MAX_COMPROBANTES = 5;
  const contenedorArchivos = document.getElementById("archivos");
  const btnAgregarArchivo = document.getElementById("btn-agregar-archivo");
  let totalSlots = 0;

  function agregarSlotArchivo() {
    if (totalSlots >= MAX_COMPROBANTES) return;
    totalSlots++;
    const row = document.createElement("div");
    row.className = "archivo-row";
    row.innerHTML = `
      <input type="file" name="comprobantes" accept="image/*,application/pdf" />
      <button type="button" class="btn-quitar" title="Quitar">✕</button>
    `;
    row.querySelector(".btn-quitar").addEventListener("click", () => {
      if (contenedorArchivos.children.length <= 1) return; // siempre queda al menos 1 slot
      row.remove();
      totalSlots--;
      btnAgregarArchivo.style.display = totalSlots < MAX_COMPROBANTES ? "block" : "none";
    });
    contenedorArchivos.appendChild(row);
    btnAgregarArchivo.style.display = totalSlots < MAX_COMPROBANTES ? "block" : "none";
  }
  agregarSlotArchivo();
  agregarSlotArchivo();
  btnAgregarArchivo.addEventListener("click", agregarSlotArchivo);

  // ── Envío ─────────────────────────────────────────────────────────
  const form = document.getElementById("form-solicitud");
  const mensaje = document.getElementById("mensaje");
  const btnEnviar = document.getElementById("btn-enviar");
  const TAMANO_MAXIMO_BYTES = 8 * 1024 * 1024;
  const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    mensaje.textContent = "";
    mensaje.className = "msg";

    const archivos = [...form.querySelectorAll('input[name="comprobantes"]')]
      .map((i) => i.files[0])
      .filter(Boolean);

    if (archivos.length === 0) {
      mensaje.textContent = "Adjunta al menos un comprobante de pago.";
      mensaje.className = "msg error";
      return;
    }
    for (const archivo of archivos) {
      if (archivo.size > TAMANO_MAXIMO_BYTES) {
        mensaje.textContent = `"${archivo.name}" pesa más de 8 MB.`;
        mensaje.className = "msg error";
        return;
      }
      if (archivo.type && !TIPOS_PERMITIDOS.includes(archivo.type)) {
        mensaje.textContent = `"${archivo.name}" no es una imagen o PDF válido.`;
        mensaje.className = "msg error";
        return;
      }
    }

    const body = new FormData();
    body.set("nombre", document.getElementById("nombre").value.trim());
    body.set("correoPago", document.getElementById("correoPago").value.trim());
    body.set("correoAcceso", document.getElementById("correoAcceso").value.trim());
    body.set("telefono", inputTelefono.value.trim());
    body.set("pais", selectPais.value);
    body.set("evento", document.getElementById("evento").value);
    body.set("tipoMembresia", document.getElementById("tipoMembresia").value);
    for (const archivo of archivos) body.append("comprobantes", archivo);

    btnEnviar.disabled = true;
    btnEnviar.textContent = "Enviando…";

    try {
      const res = await fetch(ENDPOINT_URL, { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);

      mensaje.textContent = "Solicitud enviada correctamente.";
      mensaje.className = "msg ok";
      form.reset();
      contenedorArchivos.innerHTML = "";
      totalSlots = 0;
      agregarSlotArchivo();
      agregarSlotArchivo();
    } catch (err) {
      // Modo prueba: si el endpoint todavía no existe (ver sección 5 del
      // .md), muestra en consola el payload para verificar que los campos
      // van completos y bien nombrados, en vez de fallar en silencio.
      console.log("Payload de prueba (comprobantes no se listan aquí):", {
        nombre: body.get("nombre"),
        correoPago: body.get("correoPago"),
        correoAcceso: body.get("correoAcceso"),
        telefono: body.get("telefono"),
        pais: body.get("pais"),
        evento: body.get("evento"),
        tipoMembresia: body.get("tipoMembresia"),
        comprobantes: archivos.map((a) => a.name),
      });
      mensaje.textContent = "No se pudo enviar todavía (endpoint pendiente) — payload de prueba en la consola del navegador (F12).";
      mensaje.className = "msg error";
    } finally {
      btnEnviar.disabled = false;
      btnEnviar.textContent = "Enviar solicitud";
    }
  });
</script>
</body>
</html>
```

## 5. Pendiente del lado del CRM (Sinergéticos) — no es tarea de VSL

El endpoint actual (`POST /api/solicitudes`) solo acepta solicitudes de usuarios con sesión iniciada en este CRM — no está pensado para que un sistema externo le pegue directo. Para que este formulario funcione en producción falta, de nuestro lado:

1. Crear un endpoint público nuevo (ej. `/api/solicitudes-externas`), protegido con un token fijo en la URL — el mismo patrón que ya usan los webhooks de Kajabi/Hotmart en este CRM — que reciba exactamente estos mismos campos y cree la solicitud.
2. Entregarle a VSL la URL final + el token, para reemplazar `ENDPOINT_URL` en el código de arriba.

Hasta que eso exista, el formulario sirve para que VSL empiece a capturar los datos ya en el formato correcto (y probar en consola que el payload sale bien armado), pero no va a poder enviarlos solo todavía.

## 6. Qué evitar (causas conocidas de datos mal cargados)

- Escribir el nombre del evento a mano en vez de elegir una de las 3 opciones del select (`VSL MX` / `VSL USA` / `VSL LATAM`, sin variantes de mayúsculas/espacios).
- Usar `"3 meses"`, `"3M"`, `"trimestral"`, etc. en vez de exactamente `"3 Meses"` / `"6 Meses"` / `"12 Meses"`.
- Mandar el teléfono sin lada — el CRM no la agrega sola si el campo llega vacío de lada.
- No adjuntar comprobante (el CRM rechaza la solicitud sin al menos uno).
