// === Cyberroom JS ===
const terminalInput = document.getElementById('terminal-input');
const terminalOutput = document.getElementById('terminal-output');

const fakeMessages = [  { user: "bot001", text: "What's the latest on the glitch fix?" },
    { user: "bot001", text: "Still parsing the logs..." },
    { user: "bot001", text: "Detected unusual latency in the uplink." },
    { user: "bot001", text: "Querying remote node... stand by." },
    { user: "bot001", text: "Network sync restored." },
    { user: "bot001", text: "Compiling diagnostics." },
    { user: "bot001", text: "Alert: loop detected in ghost.sh" },
    { user: "bot001", text: "Report queued for review." },
    { user: "bot001", text: "Pinging syslogs." },
    { user: "bot001", text: "Running silent batch scan." },
  
    { user: "cyberfox", text: "Loving this vibe. Typing from Neo-Tokyo" },
    { user: "cyberfox", text: "Just brewed some synth-coffee." },
    { user: "cyberfox", text: "Anyone else hear that lo-fi beat drop?" },
    { user: "cyberfox", text: "Upgrading my Rofi themes rn." },
    { user: "cyberfox", text: "Hackin' with style." },
    { user: "cyberfox", text: "Tiling WM feels like digital origami." },
    { user: "cyberfox", text: "Booted into vibes." },
    { user: "cyberfox", text: "Neo-Tokyo sunsets never get old." },
    { user: "cyberfox", text: "curling playlists like a champ." },
    { user: "cyberfox", text: "Restarting polybar just for fun." },
  
    { user: "ghost", text: "Anyone up for a quick collab challenge?" },
    { user: "ghost", text: "Trying to fork neon.blink..." },
    { user: "ghost", text: "Compiling dreams in C++" },
    { user: "ghost", text: "Why does my bash alias feel haunted?" },
    { user: "ghost", text: "New dotfiles drop incoming." },
    { user: "ghost", text: "Updating aliases... again." },
    { user: "ghost", text: "npm install soul" },
    { user: "ghost", text: "terminal feels like home." },
    { user: "ghost", text: "New config. New me." },
    { user: "ghost", text: "You ever code and just... disappear?" },
  
    { user: "d3bugger", text: "Just pushed a weird terminal effect repo." },
    { user: "d3bugger", text: "Found a bug in my glitch parser... again." },
    { user: "d3bugger", text: "printf(\"Hello, void\");" },
    { user: "d3bugger", text: "Trying to fix a fix that fixed nothing." },
    { user: "d3bugger", text: "Segfault party" },
    { user: "d3bugger", text: "My log files are haunted." },
    { user: "d3bugger", text: "debugging dreams in dark mode." },
    { user: "d3bugger", text: "Accidentally removed my sanity." },
    { user: "d3bugger", text: "alias fixit='¯\\_(ツ)_/¯'" },
    { user: "d3bugger", text: "error 404: motivation not found." },
  
    { user: "noirblade", text: "Midnight coding hits different..." },
    { user: "noirblade", text: "This terminal is my church." },
    { user: "noirblade", text: "Tabs > spaces. Fight me." },
    { user: "noirblade", text: "Who needs sleep when there's style?" },
    { user: "noirblade", text: "echo \"Darkness compiled.\"" },
    { user: "noirblade", text: "Looking into polybar configs tonight." },
    { user: "noirblade", text: "dreaming in darkmode." },
    { user: "noirblade", text: "Reading source code like poetry." },
    { user: "noirblade", text: "Zen is a well-indented script." },
    { user: "noirblade", text: "Night is just a terminal with no prompt." },
  
    { user: "dothex", text: "Synthwave + bash scripts = bliss" },
    { user: "dothex", text: "curling through my feelings." },
    { user: "dothex", text: "Tuned my shell prompt to perfection." },
    { user: "dothex", text: "Reading man pages for fun now." },
    { user: "dothex", text: "My life is a while loop." },
    { user: "dothex", text: "alias chill='curl -s synthwave.fm'" },
    { user: "dothex", text: "chmod +x my soul." },
    { user: "dothex", text: "vibing on :wq" },
    { user: "dothex", text: "Sleeping inside a terminal pane." },
    { user: "dothex", text: "Syntax sugar is my addiction." },
  
    { user: "crypt0n", text: "Running test.sh again... fingers crossed." },
    { user: "crypt0n", text: "Decrypting reality." },
    { user: "crypt0n", text: "chmod 777 my soul" },
    { user: "crypt0n", text: "My uptime beats my sleep cycle." },
    { user: "crypt0n", text: "Compiling paranoia into comfort." },
    { user: "crypt0n", text: "Encrypting my snack stash." },
    { user: "crypt0n", text: "pinging dreams... timeout expected." },
    { user: "crypt0n", text: "Rooting for inner peace." },
    { user: "crypt0n", text: "My kernel just whispered secrets." },
    { user: "crypt0n", text: "Error 418: I'm a teapot." },
  
    { user: "sn0wave", text: "What theme is that terminal using?" },
    { user: "sn0wave", text: "Back in the matrix." },
    { user: "sn0wave", text: "Just joined. Love the glow here." },
    { user: "sn0wave", text: "Coding and chilling. The dream." },
    { user: "sn0wave", text: "How's everyone configuring their vim?" },
    { user: "sn0wave", text: "Ricing out my TTY today." },
    { user: "sn0wave", text: "Installing fonts like candy." },
    { user: "sn0wave", text: "Terminal opacity is art." },
    { user: "sn0wave", text: "Listening to synth and scripting." },
    { user: "sn0wave", text: "Got my prompt glowing" },
  
    { user: "hexkit", text: "Writing poetry in bash." },
    { user: "hexkit", text: "Emacs just asked me out." },
    { user: "hexkit", text: "Running arch btw." },
    { user: "hexkit", text: "Kernel panic? More like eternal panic." },
    { user: "hexkit", text: "Is this IRC? Feels nostalgic." },
    { user: "hexkit", text: "Just typed for 2 hours with no output." },
    { user: "hexkit", text: "printf or perish." },
    { user: "hexkit", text: "0xdeadbeef is my birthmark." },
    { user: "hexkit", text: "Binary dreams, ASCII screams." },
    { user: "hexkit", text: "Shellshock me gently." }
];

const usernameColors = {
    bot001: 'color1',
    cyberfox: 'color2',
    ghost: 'color3',
    d3bugger: 'color4',
    noirblade: 'color5',
    dothex: 'color6',
    crypt0n: 'color7',
    sn0wave: 'color8',
    hexkit: 'color9',
    guest: 'color10'
  };

  function printMessage(username, message) {
    const div = document.createElement('div');
    div.classList.add('terminal-message');
  
    const colorClass = usernameColors[username] || 'color-default';
  
    div.innerHTML = `<span class="username ${colorClass}">${username}:</span> ${message}`;
    terminalOutput.appendChild(div);
  
    const maxMessages = 20;
    while (terminalOutput.children.length > maxMessages) {
      terminalOutput.removeChild(terminalOutput.firstChild);
    }
  }
  

function randomMessage() {
  const index = Math.floor(Math.random() * fakeMessages.length);
  const { user, text } = fakeMessages[index];
  printMessage(user, text);
}

setInterval(randomMessage, 4000); // Simulate new messages every 4 seconds

terminalInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const input = terminalInput.value.trim();
    if (input) {
      printMessage("guest", input);
      terminalInput.value = '';
    }
  }
});

document.addEventListener("DOMContentLoaded", () => {
  // Pomodoro Timer
  let timer;
  let isRunning = false;
  let isWorkTime = true;
  let timeLeft = 25 * 60;

  const timerDisplay = document.getElementById('timer');
  const startBtn = document.getElementById('start-btn');
  const resetBtn = document.getElementById('reset-btn');
  const pomodoroStatus = document.getElementById('pomodoro-status');

  const sound = new Audio("../sounds/notification.mp3");

  function updateTimerDisplay() {
    const minutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const seconds = (timeLeft % 60).toString().padStart(2, '0');
    timerDisplay.textContent = `${minutes}:${seconds}`;
    pomodoroStatus.textContent = isWorkTime ? "focus" : "chill";
  }

  function startTimer() {
    if (isRunning) return;
    isRunning = true;
    timer = setInterval(() => {
      if (timeLeft > 0) {
        timeLeft--;
        updateTimerDisplay();
      } else {
        clearInterval(timer);
        isRunning = false;
        isWorkTime = !isWorkTime;
        sound.play();
        timeLeft = isWorkTime ? 25 * 60 : 5 * 60;
        updateTimerDisplay();
        startTimer();
      }
    }, 1000);
  }

  function resetTimer() {
    clearInterval(timer);
    isRunning = false;
    isWorkTime = true;
    timeLeft = 25 * 60;
    updateTimerDisplay();
  }

  startBtn.addEventListener('click', startTimer);
  resetBtn.addEventListener('click', resetTimer);

  updateTimerDisplay();
});


// MUSIC

const musicElement = document.getElementById("cyber-music");
const startMusicBtn = document.getElementById("start-music-btn");

// Attempt autoplay immediately (may fail on desktop)
musicElement.volume = 0.25;
musicElement.play().catch(() => {
  // Browser blocked autoplay, will trigger via click or keydown below
});

// Mobile manual trigger
startMusicBtn.addEventListener("click", () => {
  musicElement.play();
  startMusicBtn.style.display = "none";
});

// Desktop fallback: play on any user interaction
if (!/Mobi|Android/i.test(navigator.userAgent)) {
  const triggerPlay = () => {
    musicElement.play();
    window.removeEventListener("click", triggerPlay);
    window.removeEventListener("keydown", triggerPlay);
  };
  window.addEventListener("click", triggerPlay);
  window.addEventListener("keydown", triggerPlay);
}
