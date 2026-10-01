# Validación física de Pastracing 2 — Quest 3S

URL: https://mbabota8.github.io/pastracing2/

**Estado: pendiente.** Las pruebas automatizadas no certifican 3 mm ni la estabilidad real del seguimiento.

## Encaje y columna

1. Abra la imagen predeterminada y confirme que contiene el mural completo. Elija tres detalles del centro ya dibujado, separados y no alineados. Repita seleccionándolos desde la página y desde el visor.
2. Seleccione el muro principal, marque esos tres detalles en orden y compruebe nueve referencias repartidas por toda la imagen, incluidos los bordes. Encajar el centro puede ocultar errores en los extremos.
3. Use una regla o patrón cuya incertidumbre sea menor que 3 mm. Mida cada diferencia con las marcas físicas. Si la herramienta no permite medirla, anote **inconcluyente**.
4. Pruebe los pasos de 1 mm, giro de 0,05° y tamaño de 0,1 %. Bloquee: los joysticks y gatillos no deben cambiar posición, giro ni tamaño. Opacidad y visibilidad deben seguir disponibles.
5. Mire y apunte a la columna derecha y vuelva al dibujo. No debe cambiar el plano. Repita sin bloquear: cambiar de pared requiere **Elegir otra pared**, no simplemente pulsar el gatillo.

## Guardado y recuperación

1. Guarde y espere el mensaje de éxito. No debe descargarse otra vez la imagen ni cambiar su transformación al completar el guardado.
2. Salga y continúe el trabajo. Confirme el encaje tras comprobar las nueve referencias.
3. Repita tres veces tras cierre inmediato, reinicio, varias horas, 24 horas y 72 horas. Pruebe lados mayores de 0,5, 1, 2 y 4 m, además del tamaño real del mural.
4. Repita sin conexión después de una carga completa con conexión que haya preparado la caché. El trabajo debe usar su imagen local; cargar una imagen externa nueva debe explicar el fallo.
5. Guarde dos veces con ajustes distintos y compruebe que recupera el último. Simule un fallo de almacenamiento o anclaje: el guardado anterior debe seguir disponible.
6. Termine AR durante el guardado y vuelva a entrar. Debe permitir reintentar sin confirmar un registro fallido.
7. Fuerce una recuperación fallida o espere 30 segundos sin localización. Compruebe **Reintentar** y **Volver a encajar** sin perder imagen y ajustes.
8. Interrumpa el seguimiento. La imagen debe ocultarse cuando no hay pose del anclaje y no debe acumular entradas durante la interrupción.
9. Importe un trabajo V3 y vuelva a abrir el sitio anterior: su trabajo debe seguir intacto.
10. Mantenga una sesión de 30 minutos. Mida las nueve referencias al comienzo, a los 10, 20 y 30 minutos, desde distintas posiciones de trazado.

Para aprobar, cada referencia debe quedar a **3 mm o menos** en todas las mediciones. Si no se cumple, la precisión no está validada: vuelva a encajar y registre el escenario. El error calculado en el asistente no sustituye las mediciones.

| Fecha     | Quest / Browser | Tamaño (m) | Escenario | Luz | Error máximo de nueve referencias (mm) | Tiempo de recuperación | Error o salto observado | Resultado |
| --------- | --------------- | ---------: | --------- | --- | -------------------------------------: | ---------------------- | ----------------------- | --------- |
| Pendiente |                 |            |           |     |                                        |                        |                         | Pendiente |

## Comprobación automática

Ejecute `npm ci` y `npm test`. Las pruebas usan también la geometría real de Three.js en una pared girada. Los documentos V2 y V3 son históricos; esta guía corresponde al sitio actual.
