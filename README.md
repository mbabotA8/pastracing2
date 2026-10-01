# Pastracing 2

## V3 — controles independientes y movimiento ampliado

Versión de prueba: https://mbabota8.github.io/pastracing2/

El joystick izquierdo desplaza la imagen sobre su plano (máximo 10 cm/s); el mando derecho conserva sus controles. Los gatillos y botones X/Y mantienen sus funciones. Disponible en modo manual y sobre paredes, también con anclajes recuperados.

Antes de entrar en AR se puede activar **Movimiento ampliado — experimental**. Solicita un espacio `unbounded` y vuelve a `local-floor` si no está disponible. El perímetro físico se configura en Quest. El efecto real sobre los avisos e interrupciones debe validarse en el visor.

Los trabajos de V3 se guardan por separado de V2. La calibración y precisión del guardado continúan en V2. Consulte [VALIDATION-V3.md](VALIDATION-V3.md) para los controles y las pruebas de aceptación. Pruebas automáticas: `node --test`.

**Drawing/tracing projector in Augmented Reality (Passthrough)**

This is a simple [WebXR](https://immersiveweb.dev) app built with [three.js](https://threejs.org) and [three-mesh-ui](https://felixmariotto.github.io/three-mesh-ui/) that lets you use your Meta Quest 2 and Meta Quest Pro to draw/trace on top of virtual images in Augmented Reality.

Inspired by [Easely](https://github.com/RalphVR/easely-meta-hackathon) and [Contour](https://sidequestvr.com/app/6643/contour-demo).

## Instructions

[Video](https://www.youtube.com/watch?v=tJqXpbIeRK8)

1. Navigate to [mbabota8.github.io/pastracing2](https://mbabota8.github.io/pastracing2) with your PC.

2. Copy an image URL and paste on the text field. For example, a public domain image from [rawpixel](https://www.rawpixel.com/public-domain).

*Keep in mind that some [CORS policies](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) might prevent the app from loading images from certain websites. You'll want to use URLs from websites that allow their content to be loaded from any origin* (`Access-Control-Allow-Origin: *`).

3. Click on "Load image" to reload the page with this image, or click on "Send link to Meta Quest" to send this to your Meta Quest 2 or Meta Quest Pro.

4. After opening the link on your Meta Quest 2 or Meta Quest Pro, click on "Start AR" to start.

5. Use the thumbsticks (analog sticks) to control the opacity and size of the image. Hold the trigger button to position the image on top of a sheet of paper.

6. Draw/Trace.

## Screenshots

<img src="Screenshots/0.jpg" width="320" />

<img src="Screenshots/1.jpg" width="320" />

<img src="Screenshots/2.jpg" width="320" />

<img src="Screenshots/3.jpg" width="320" />

## Requirements

Meta Quest 2 or Meta Quest Pro.


