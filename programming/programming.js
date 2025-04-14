// Typewriter
const text = "Here you can find a compilation of books and resources, cool linux repos and code snippets that I use or are fun to use. I enjoy doing little strange things in the real and the virtual world.";
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

// Terminal Sim
const terminalInput = document.getElementById('terminal-input');
const terminalOutput = document.getElementById('terminal-output');

const commands = {
  help: "Available commands: help, whoami, glitch \"your text\", clear",
  whoami: "NEONBLADE // synthwave entity & code architect"
};

// Glitch function
function glitchText(input) {
  return input.split('')
    .map(c => Math.random() > 0.2
      ? c
      : String.fromCharCode(33 + Math.random() * 94))
    .join('');
}

terminalInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    const input = terminalInput.value.trim();
    printLine(`> ${input}`);

    const [cmd, ...args] = input.split(' ');
    const argStr = args.join(' ').replace(/"/g, '');

    if (cmd === 'clear') {
      terminalOutput.innerHTML = '';
    } else if (cmd === 'glitch') {
      const textToGlitch = argStr || "No text provided.";
      printLine(glitchText(textToGlitch), true);
    } else if (commands[cmd]) {
      printLine(commands[cmd]);
    } else {
      printLine(`Command not found: ${cmd}`);
    }

    terminalInput.value = '';
  }
});

function printLine(text, isGlitched = false) {
  const line = document.createElement('p');
  line.textContent = text;
  if (isGlitched) {
    line.classList.add('glitched-output');
  }
  terminalOutput.appendChild(line);
  terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

// Function to detect mobile devices
function isMobileDevice() {
  return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

if (!isMobileDevice()) {
  // Sync only the details inside each .snippets-grid
  const snippetGrids = document.querySelectorAll('.snippets-grid');

  snippetGrids.forEach(grid => {
    const cards = grid.querySelectorAll('.snippet-card');

    cards.forEach(card => {
      card.addEventListener('toggle', () => {
        const shouldOpen = card.open;
        cards.forEach(c => c.open = shouldOpen);
      });
    });
  });
}
