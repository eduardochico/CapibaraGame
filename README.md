# 🦫 Capibara Runner — Juego estilo "Dino de Chrome" con Música y Sonido

**Capibara Runner** es un mini juego en HTML5 Canvas inspirado en el dinosaurio sin internet de Chrome.  
El jugador controla a un capibara que salta **paletas heladas** para evitar chocar con ellas.  
Incluye **música de fondo** y **efectos de sonido** generados con la API de WebAudio.

## 🎮 Características
- **Sprite de capibara personalizado** (rotado horizontalmente y sin sombra).
- **Obstáculos más pequeños** para mayor jugabilidad.
- Fondo con nubes y piso animado.
- Música de fondo y efectos de salto y colisión.
- Contador de puntuación y récord.
- Controles para iniciar partida y silenciar sonido.
- Compatible con **teclado** y **pantalla táctil**.

## 🕹️ Controles
| Acción      | Tecla / Gesto                          |
|-------------|----------------------------------------|
| Saltar      | `Espacio` o `Flecha Arriba` o tocar pantalla |
| Silencio    | Botón `🔇 Silencio` o tecla `M`          |
| Iniciar     | Botón `▶️ Jugar` o cualquier salto       |

## 📂 Estructura
Este proyecto consta de un solo archivo HTML que contiene:
- **HTML**: Estructura del HUD y canvas.
- **CSS**: Estilos para el fondo, HUD y botones.
- **JavaScript**: Lógica del juego, renderizado en Canvas y sistema de audio con WebAudio.

## 🚀 Cómo ejecutar
1. Guarda el archivo como `capibara-runner.html`.
2. Ábrelo en cualquier navegador moderno (Chrome, Edge, Firefox).
3. Haz clic en **▶️ Jugar** para iniciar y habilitar el audio.

> ⚠️ Por políticas de los navegadores, el audio solo se reproduce después de una interacción del usuario (clic o toque).

## 🧪 Pruebas incluidas
El juego ejecuta tests automáticos al cargar:
- Detección de colisiones (AABB).
- Física de salto y caída.
- Carga correcta del sprite del capibara.

## 📜 Licencia
Este proyecto es de uso libre para fines educativos y recreativos.
Los sprites y assets personalizados pertenecen a su respectivo autor.

---
