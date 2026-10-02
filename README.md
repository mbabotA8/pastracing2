# Pastracing 2

Proyector de imágenes en realidad aumentada para continuar un mural con Meta Quest. Preparado para validar encaje y guardado en **Quest 3S**.

**Abrir:** https://mbabota8.github.io/pastracing2/

## Preparar el mural

El [mural completo](Images/mural.png) está incluido y se carga por defecto; no depende de Catbox. Puede elegir otra imagen mediante una URL. Al continuar un trabajo guardado se utiliza su propia imagen y sus ajustes.

1. Abra la web en Meta Quest Browser, sin navegación privada. Configure la habitación en Ajustes de Quest si no aparecen paredes.
2. Marque tres detalles del dibujo en la vista de la imagen, formando un triángulo amplio. Recuerde su orden. También puede hacerlo en AR mediante **Encajar con 3 puntos**.
3. Entre en realidad aumentada. Apunte al muro principal con el mando derecho y pulse el gatillo para seleccionar su plano. No seleccione la cara de la columna.
4. Marque en la pared los mismos detalles en el mismo orden. Si los seleccionó en el panel del visor, pulse **Marcar en la pared** después del tercer punto.
5. Revise el encaje y su error calculado. La imagen conserva sus proporciones; no se estira para forzar la coincidencia. Use **Ajuste fino** o repita los puntos si hace falta.
6. Pulse **Bloquear y dibujar** y después **Guardar trabajo**. Compruebe las líneas desde varias posiciones antes de trazar.

La columna y las actualizaciones de otras paredes no cambian el plano elegido. Cambiarlo requiere **Elegir otra pared**. Bloquear evita cambios accidentales con los mandos; el seguimiento espacial del visor debe comprobarse físicamente.

## Controles

**Pulse el joystick derecho hacia dentro para abrir o cerrar el panel.** Al abrirlo aparece centrado frente a usted, con letras grandes y fondo opaco. Se queda en ese lugar: puede apartar la mirada para ver el mural. Se oculta al bloquear para dibujar o al pasar a marcar puntos de la pared. Apunte a los botones con el mando derecho y pulse el gatillo; también puede usar **Ocultar panel**.

| Control                                       | Función                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------- |
| Gatillo derecho, modo pared                   | Seleccionar el muro o marcar un punto; no recoloca una imagen ya ajustada |
| Joystick izquierdo, sin bloquear              | Desplazar sobre el plano de la imagen, máximo 10 cm/s                     |
| Joystick derecho arriba / abajo, sin bloquear | Aumentar / reducir tamaño                                                 |
| Joystick derecho derecha / izquierda          | Aumentar / reducir opacidad, también con la imagen bloqueada              |
| Ajuste fino                                   | Desplazamiento de 1 mm, giro de 0,05° y tamaño de 0,1 %                   |
| B o Y, modo pared                             | Guardar trabajo                                                           |
| A o X, modo pared sin paredes                 | Solicitar configuración de la habitación                                  |
| Mostrar / ocultar                             | Alternar la imagen sin cambiar su posición                                |
| Ajustar de nuevo                              | Desbloquear para corregir el encaje                                       |

**Modo manual:** no detecta paredes ni ofrece encaje por tres puntos. Mantenga un gatillo para colocar y orientar; gatillo derecho más joystick derecho vertical ajusta profundidad. A/X muestra u oculta la imagen y B/Y muestra u oculta la ayuda. Puede bloquear y guardar desde el panel.

## Guardar y recuperar

El guardado reutiliza la imagen cargada y conserva el último registro válido si falla. Solo confirma el éxito después de completar la escritura local. Si no hay anclajes persistentes, guarda imagen y ajustes y avisa de que habrá que recolocar.

Al continuar, espere a que se localice el anclaje, compruebe el dibujo y pulse **Confirmar encaje**. Si no se recupera en 30 segundos, use **Reintentar** o **Volver a encajar**. La imagen se oculta si el anclaje pierde seguimiento.

Los datos pertenecen al mismo visor, navegador y origen web. Borrar datos del sitio o usar navegación privada puede impedir recuperarlos. Pastracing 2 usa una base independiente (`pastracing2-v4`); **Importar trabajo de la versión anterior** copia el último trabajo de `passtracing-v3` sin modificarlo.

Tras una primera carga completa con conexión, se prepara una caché de la aplicación, la biblioteca y el mural para volver a abrir sin conexión. Una imagen externa nueva necesita conexión; un trabajo recuperado usa su archivo almacenado.

## Validación

La precisión objetivo es **3 mm**, pendiente de medición física. El error de los tres puntos no certifica la precisión real del visor. Siga [VALIDATION-V4.md](VALIDATION-V4.md).

Pruebas automatizadas: `npm ci` y `npm test`. Cubren geometría, controles, bloqueo, imágenes, importación, recuperación y fallos de guardado. No sustituyen las pruebas sobre la pared. Los documentos V2 y V3 son históricos.

El movimiento ampliado es experimental: solicita `unbounded` y vuelve a `local-floor` si no está disponible. No modifica el límite físico de Quest.

## Créditos

Basado en [Passtracing de Fabio914](https://github.com/fabio914/passtracing), con [Three.js](https://threejs.org/) y WebXR. Se conserva la [licencia original](LICENSE). El mural fue proporcionado por el usuario desde https://files.catbox.moe/6e17fb.png.
