(() => {
  const FILES_PATH = "files.json"; // all files
  const NEW_PATH = "new.json";     // newly added files
  const DB_PREFIX = "db/";         // actual folder where files are stored

  const resultsEl = document.getElementById("results");
  const searchBox = document.getElementById("searchBox");
  const refreshBtn = document.getElementById("refreshBtn");
  const newBtn = document.getElementById("newBtn");
  const emptyEl = document.getElementById("empty");

  let entries = [];

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));
  }

  function render(filter = "") {
    resultsEl.innerHTML = "";
    const q = (filter || "").toLowerCase().trim();
    const filtered = entries.filter(e => {
      const filename = e.split("/").pop();
      return !q || filename.toLowerCase().includes(q);
    });

    if (!filtered.length) {
      emptyEl.style.display = "block";
      resultsEl.style.display = "none";
      return;
    }

    emptyEl.style.display = "none";
    resultsEl.style.display = "grid";

    for (const relPath of filtered) {
      const card = document.createElement("div");
      card.className = "card flex flex-col";

      const filename = relPath.split("/").pop();

      card.innerHTML = `
        <div class="font-semibold">${escapeHtml(filename)}</div>
        <div class="mt-2 flex gap-3 text-xs">
          <a href="${DB_PREFIX + escapeHtml(relPath)}" target="_blank" class="text-emerald-300 hover:underline">Open</a>
          <a href="${DB_PREFIX + escapeHtml(relPath)}" download class="text-slate-300 hover:underline">Download</a>
        </div>
      `;

      resultsEl.appendChild(card);
    }
  }

  async function loadList(path) {
    try {
      const res = await fetch(path + "?_=" + Date.now(), { cache: "no-store" });
      if (!res.ok) throw new Error(path + " not found");
      const arr = await res.json();
      if (!Array.isArray(arr)) throw new Error(path + " must be an array");
      entries = arr;
      render(searchBox.value);
    } catch (err) {
      console.error(err);
      entries = [];
      render("");
      emptyEl.textContent = "Failed to load " + path + ". Ensure the file exists.";
    }
  }

  // events
  searchBox.addEventListener("input", () => render(searchBox.value));
  refreshBtn.addEventListener("click", () => loadList(FILES_PATH));
  newBtn.addEventListener("click", () => loadList(NEW_PATH));

  // initial load all
  loadList(FILES_PATH);
})();
