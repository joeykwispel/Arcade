// Starts the Godot engine. The page's CSP allows no inline script, so the export's settings come in as JSON.
const status = document.getElementById('status');
const config = JSON.parse(document.getElementById('godot-config').textContent);
const engine = new Engine(config);
engine
  .startGame({
    onProgress(current, total) {
      if (total > 0) status.textContent = `loading Godot… ${Math.round((current / total) * 100)}%`;
    }
  })
  .then(() => status.remove())
  .catch((err) => {
    status.textContent = String(err);
    console.error(err);
  });
