window.FleetTV = (function () {
  const tvModeBtn = document.getElementById("tvModeBtn");
  const tvExitBtn = document.getElementById("tvExitBtn");
  const fullscreenSupported =
    typeof document.documentElement.requestFullscreen === "function";

  function setActive(active) {
    document.body.classList.toggle("tv-mode", active);
  }

  function enter() {
    setActive(true);
    if (fullscreenSupported && !document.fullscreenElement) {
      try {
        const p = document.documentElement.requestFullscreen();
        if (p && p.catch) p.catch(() => {});
      } catch (err) {
      }
    }
  }

  function exit() {
    setActive(false);
    if (fullscreenSupported && document.fullscreenElement) {
      const p = document.exitFullscreen();
      if (p && p.catch) p.catch(() => {});
    }
  }

  if (fullscreenSupported) {
    document.addEventListener("fullscreenchange", () => {
      setActive(Boolean(document.fullscreenElement));
    });
  }

  if (tvModeBtn) {
    tvModeBtn.addEventListener("click", () => {
      if (document.body.classList.contains("tv-mode")) {
        exit();
      } else {
        enter();
      }
    });
  }
  if (tvExitBtn) tvExitBtn.addEventListener("click", exit);

  return { enter, exit };
})();