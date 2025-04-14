// Typewriter for About Section on Main Page
const text = "I'm ghost.init — programmer, data engineer, cyber-dreamer. I love exploring the matrix of code, creating art, diving into sounds, and sharing this digital world with the real one and viceversa. I love code, art, music, and my Pili 💚";
let i = 0;
const speed = 40;
const typeTarget = document.getElementById('typeTarget');

function typeWriter() {
  if (i < text.length) {
    typeTarget.textContent += text.charAt(i);
    i++;
    setTimeout(typeWriter, speed);
  }
}

window.addEventListener('load', typeWriter);