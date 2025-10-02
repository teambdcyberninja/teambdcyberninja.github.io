let allFiles = [];
let filteredFiles = [];
let resultsPerPage = 40;
let currentPage = 0;
let currentSource = "files.json"; // track active dataset

// Load files from files.json or new.json
async function loadFiles(path = "files.json") {
  try {
    const res = await fetch(path + "?_=" + Date.now(), { cache: "no-store" }); // cache-busting
    let files = await res.json();

    // Prefix with db/ since files are stored there
    allFiles = files.map(f => ({
      path: "db/" + f,
      isNew: path === "new.json"
    }));

    currentSource = path;
    showResults(true);
  } catch (err) {
    console.error("Error loading " + path, err);
    document.getElementById("results").innerHTML =
      `<p class='text-red-500 text-center col-span-full'>⚠️ Could not load ${path}</p>`;
  }
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// High-contrast highlight: amber bg + black text
function highlightMatch(filename, query) {
  if (!query || query.includes("*") || /AND|OR|NOT|"/i.test(query)) return filename;

  const terms = query
    .trim()
    .replace(/["']/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map(escapeRegExp)
    .sort((a, b) => b.length - a.length);

  if (!terms.length) return filename;

  const regex = new RegExp(`(${terms.join("|")})`, "gi");
  return filename.replace(
    regex,
    "<span class='bg-amber-400 text-black font-bold rounded px-1'>$1</span>"
  );
}

function getFileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const map = {
    txt: "📄", pdf: "📑", doc: "📝", docx: "📝",
    xls: "📊", xlsx: "📊", ppt: "📽️", pptx: "📽️",
    csv: "📊", jpg: "🖼️", png: "🖼️", mp4: "🎞️", zip: "📦"
  };
  return map[ext] || "📁";
}

// --- Suggestions helpers ---
function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + 1
      );
    }
  }
  return dp[a.length][b.length];
}

function scoreMatch(query, filename) {
  const q = query.toLowerCase();
  const f = filename.toLowerCase();
  if (f === q) return 0;
  if (f.includes(q)) return 1;
  return levenshtein(f, q);
}

function buildSearchFunction(query) {
  query = query.trim();
  if (query.startsWith('"') && query.endsWith('"')) {
    const phrase = query.slice(1, -1).toLowerCase();
    return f => f.toLowerCase().includes(phrase);
  }
  if (/ OR | AND | NOT | -/.test(query)) {
    const parts = query.split(/\s+/);
    return f => {
      const lower = f.toLowerCase();
      let include = false;
      let mode = "OR";
      for (let i = 0; i < parts.length; i++) {
        let term = parts[i].toLowerCase();
        if (term === "or") { mode = "OR"; continue; }
        if (term === "and") { mode = "AND"; continue; }
        if (term === "not" || term.startsWith("-")) {
          const neg = term.replace(/^[-]/, "");
          if (lower.includes(neg)) return false;
          continue;
        }
        let match = lower.includes(term);
        if (mode === "OR") include = include || match;
        if (mode === "AND") include = include && match;
      }
      return include;
    };
  }
  if (query.includes("*")) {
    const regexPattern = "^" + query.split("*").map(escapeRegExp).join(".*") + "$";
    const regex = new RegExp(regexPattern, "i");
    return f => regex.test(f);
  }
  return f => f.toLowerCase().includes(query.toLowerCase());
}

// --- Main results + suggestions ---
function showResults(reset = true) {
  const query = document.getElementById("searchBox").value;
  const resultsDiv = document.getElementById("results");
  const defaultDiv = document.getElementById("defaultPage");
  const suggestionDiv = document.getElementById("suggestion");

  if (reset) {
    currentPage = 0;
    resultsDiv.innerHTML = "";
    suggestionDiv.innerHTML = "";
  }

  let results;
  if (!query) {
    results = allFiles; // show all if empty
    defaultDiv.style.display = "none";
  } else {
    const searchFn = buildSearchFunction(query);
    results = allFiles.filter(f => searchFn(f.path));

    // Suggestions
    let suggestions = [];
    if (query.length > 2) {
      const scored = allFiles.map(f => ({
        file: f,
        score: scoreMatch(query, f.path.split("/").pop())
      }));
      scored.sort((a, b) => a.score - b.score);
      suggestions = scored.slice(0, 5).map(s => s.file);

      if (suggestions.length > 0) {
        suggestionDiv.innerHTML = "Did you mean: ";
        suggestions.forEach(s => {
          const name = s.path.split("/").pop();
          const btn = document.createElement("button");
          btn.className = "text-amber-400 underline mx-1 suggestion-btn";
          btn.textContent = name;
          btn.dataset.name = name;
          btn.addEventListener("click", () => useSuggestion(name));
          suggestionDiv.appendChild(btn);
        });
      }
    }
  }

  filteredFiles = results;
  if (filteredFiles.length === 0) {
    resultsDiv.innerHTML = "<p class='muted text-center col-span-full'>No results found</p>";
    return;
  }

  const start = currentPage * resultsPerPage;
  const end = start + resultsPerPage;
  const chunk = filteredFiles.slice(start, end);

  chunk.forEach(fileObj => {
    const f = fileObj.path;
    const isNew = fileObj.isNew;
    const fileName = f.split("/").pop();

    const card = document.createElement("div");
    card.className = "card flex flex-col";

    let badge = isNew ? `<span class="ml-2 text-xs text-black bg-emerald-400 rounded px-1">NEW</span>` : "";

    card.innerHTML = `
      <div class="font-semibold">${getFileIcon(fileName)} ${highlightMatch(fileName, query)} ${badge}</div>
      <div class="mt-2 flex gap-3 text-xs">
        <a href="${encodeURI(f)}" target="_blank" class="text-emerald-400 hover:underline">Open</a>
        <a href="${encodeURI(f)}" download class="text-emerald-200 hover:underline">Download</a>
      </div>
    `;

    resultsDiv.appendChild(card);
  });

  currentPage++;
}

function useSuggestion(text) {
  document.getElementById("searchBox").value = text;
  showResults(true);
}

// Infinite scroll
window.addEventListener("scroll", () => {
  if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 200) {
    if (currentPage * resultsPerPage < filteredFiles.length) {
      showResults(false);
    }
  }
});

// Events
document.getElementById("searchBox").addEventListener("input", () => showResults(true));

document.getElementById("allBtn").addEventListener("click", () => {
  loadFiles("files.json");
});

document.getElementById("newBtn").addEventListener("click", () => {
  loadFiles("new.json");
});

window.addEventListener("load", () => {
  document.body.classList.add("ready");
});

// Default: load all
loadFiles("files.json");
 
