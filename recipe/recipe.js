// Typewriter for About Section on Main Page
const text = "Welcome to my collection of personal recipes. I'm not a cheff, but I love to cook and show people I love a piece of my cooking art.";
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