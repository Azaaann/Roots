(() => {
  const BOOKS = DICTIONARY.books || {};
  const mukhtar = BOOKS["mukhtar-alsihah"] || {};
  const rootKeys = Object.keys(mukhtar.roots || {}).sort((a, b) => a.localeCompare(b, "ar"));

  let alphaIndex = [];
  Object.entries(BOOKS).forEach(([src, book]) => {
    if (book.type === "alphabetical" && book.sections) {
      book.sections.forEach((s) => {
        alphaIndex.push({
          src,
          title: s.title.replace(/^\[|\]$/g, ""),
          content: s.content,
        });
      });
    }
  });

  const BOOK_ORDER = Object.keys(BOOKS);

  const c = (sel, el) => (el || document).querySelector(sel);
  const d = (sel, el) => Array.from((el || document).querySelectorAll(sel));

  const $ = {
    modal: c("#modal"),
    modalTitle: c(".modal-title"),
    modalBody: c(".modal-body"),
    modalFooter: c(".modal-footer"),
    wordSearch: c("#word-search"),
    suggester: c("#word-search-row .suggester"),
    spinner: c("#word-search-row .spinner"),
    inputBtn: c("#word-search-row .input-btn"),
    wordSearchLinks: d(".word-search-list a"),
  };

  let savedHtml = "";
  let currentWord = null;
  let currentSrc = null;

  const stripDiacritics = (t) => t.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "");
  const normRoot = (t) => stripDiacritics(t).replace(/[\s()\[\]]/g, "");
  const isValidRoot = (t) => {
    const e = stripDiacritics(t);
    return !!e && !/[^ء-ي* -]/.test(e);
  };

  function openModal() {
    $.modal.hidden = false;
    $.modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    c(".fix-scroll-overlay").style.display = "none";
  }
  function closeModal() {
    $.modal.setAttribute("aria-hidden", "true");
    $.modal.hidden = true;
    document.body.style.overflow = "";
  }

  function highlightRoot(text, root) {
    if (!root || root.length <= 2) return text;
    const pat = `(^|[^\\u0621-\\u0652])([\\u0621-\\u0652]*${root
      .split("")
      .map((ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("[\\u0621-\\u0652]*")}[\\u0621-\\u0652]*)(?=[^\\u0621-\\u0652]|$)`;
    try {
      const re = new RegExp(pat, "g");
      return text.replace(re, '$1<span class="word">$2</span>');
    } catch (e) {
      return text;
    }
  }

  function hlCitation(text) {
    if (!text) return "";
    return text.replace(/(قَالَ[\u0600-\u06FF\u0640 ]+?)(?=،|؛|\.|:|。|\?|!|$)/g, '<span class="hl">$1</span>');
  }

  function prepData(text) {
    return text
      .replace(/([«{﴿][\s\S]*?[﴾}»])/g, '<span class="hl">$1</span>')
      .replace(/\n/g, "<br>");
  }

  function cleanContent(text) {
    return text.replace(/_{2,}\s*\([٠-٩]+\)\s*/g, "<br><br>");
  }

  function renderWord(src, word) {
    const book = BOOKS[src];
    if (!book) return;
    currentSrc = src;
    currentWord = word;
    const card = c(`a[data-src="${src}"]`);
    $.modalTitle.textContent = card && card.querySelector(".short-title")
      ? card.querySelector(".short-title").textContent.trim()
      : (book.name || "");
    let body = "";

    if (book.type === "root") {
      const text = book.roots[word] || null;
      if (!text) {
        body = '<p class="bg-warning">عفواً، لا مادة لهذا الجذر في هذا المعجم.</p>';
      } else {
        body = `<div class="result-hding">${escapeHtml(word)}</div><div class="result-body">${highlightRoot(prepData(hlCitation(text)), word)}</div>`;
      }
     } else if (book.type === "alphabetical") {
      const section = alphaIndex.find(
        (s) => s.src === src && normRoot(s.title) === normRoot(word)
      );
      if (section) {
        body = `<div class="result-hding">${escapeHtml(section.title)}</div><div class="result-body">${highlightRoot(prepData(hlCitation(cleanContent(section.content))), normRoot(word))}</div>`;
      } else {
        body = '<p class="bg-warning">عفواً، لا مادة لهذا العنوان.</p>';
      }
    }

    $.modalBody.innerHTML = body;
    updateNav(src, word);
    openModal();
  }

  function updateNav(src, word) {
    const book = BOOKS[src];
    if (!book) return;
    const prevBtn = c(".prev-item");
    const nextBtn = c(".next-item");

    if (book.type === "root") {
      const wordList = Object.keys(book.roots || {}).sort((a, b) => a.localeCompare(b, "ar"));
      const idx = wordList.indexOf(word);
      const prev = wordList[idx - 1];
      const next = wordList[idx + 1];
      prevBtn.disabled = !prev;
      nextBtn.disabled = !next;
      c(".prev-item .diff").textContent = prev ? ` (${prev})` : "";
      c(".next-item .diff").textContent = next ? ` (${next})` : "";
    } else {
      const idx = alphaIndex.findIndex(
        (s) => s.src === src && normRoot(s.title) === normRoot(word)
      );
      const prev = idx > 0 ? alphaIndex[idx - 1] : null;
      const next = idx < alphaIndex.length - 1 ? alphaIndex[idx + 1] : null;
      prevBtn.disabled = !prev;
      nextBtn.disabled = !next;
      c(".prev-item .diff").textContent = prev ? ` (${prev.title.slice(0, 15)})` : "";
      c(".next-item .diff").textContent = next ? ` (${next.title.slice(0, 15)})` : "";
    }
  }

  function navWord(dir) {
    const book = BOOKS[currentSrc];
    if (!book) return;
    if (book.type === "root") {
      const wordList = Object.keys(book.roots || {}).sort((a, b) => a.localeCompare(b, "ar"));
      const idx = wordList.indexOf(currentWord);
      const target = wordList[idx + dir];
      if (target) renderWord(currentSrc, target);
    } else {
       const idx = alphaIndex.findIndex(
        (s) => s.src === currentSrc && normRoot(s.title) === normRoot(currentWord)
      );
      const target = alphaIndex[idx + dir];
      if (target) renderWord(currentSrc, target.title);
    }
  }

  c("#toggle-diacritics").onclick = () => {
    if (savedHtml) {
      $.modalBody.innerHTML = savedHtml;
      savedHtml = "";
    } else {
      savedHtml = $.modalBody.innerHTML;
      $.modalBody.innerHTML = $.modalBody.innerHTML.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "");
    }
  };

  c("#copy-btn").onclick = () => {
    const txt = $.modalBody.innerText || $.modalBody.textContent;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(txt);
    } else {
      const ta = document.createElement("textarea");
      ta.value = txt;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
  };

  let fontSize = parseFloat(getComputedStyle(document.body).fontSize) || 17;
  c("#font-plus").onclick = () => {
    fontSize = Math.min(fontSize + 2, 36);
    $.modalBody.style.fontSize = fontSize + "px";
  };
  c("#font-minus").onclick = () => {
    fontSize = Math.max(fontSize - 2, 12);
    $.modalBody.style.fontSize = fontSize + "px";
  };

  function renderSuggestions(query) {
    const q = stripDiacritics(query);
    if (!q) {
      $.suggester.innerHTML = "";
      return;
    }
    const groups = {};
    for (const src of BOOK_ORDER) {
      const book = BOOKS[src];
      if (!book) continue;
      if (book.type === "root" && book.roots) {
        const wordList = Object.keys(book.roots).sort((a, b) => a.localeCompare(b, "ar"));
        const matches = wordList
          .filter((w) => stripDiacritics(w).includes(q))
          .slice(0, 8);
        if (matches.length) groups[src] = { book, type: "root", items: matches };
       } else if (book.type === "alphabetical" && book.sections) {
        const matches = book.sections
          .filter((s) => normRoot(s.title).includes(q))
          .slice(0, 8);
        if (matches.length) groups[src] = { book, type: "alpha", items: matches };
      }
    }
    let html = "<ul>";
    for (const src of Object.keys(groups)) {
      const { book, type, items } = groups[src];
      const groupLabel =
        type === "root" ? `${book.name} (جذر)` : `${book.name} (ترتيب أبجدي)`;
      html += `<ul data-group="${escapeHtml(groupLabel)}"><li class="group-lbl">${escapeHtml(groupLabel)}</li>`;
       for (const item of items) {
        const rawTitle = type === "root" ? item : item.title;
         const text = rawTitle.replace(/^[\[\(]|[)\]]$/g, "");
        const display = normRoot(text).replace(q, `<mark>${q}</mark>`);
        html += `<li class="word-item"><a href="#" data-src="${src}" data-word="${escapeHtml(text)}">${display}</a></li>`;
      }
      html += "</ul>";
    }
    html += "</ul>";
    $.suggester.innerHTML = html;
    $.suggester.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const word = a.dataset.word;
        $.suggester.innerHTML = "";
        $.wordSearch.value = word;
        enableDicts(word);
        renderWord(a.dataset.src, word);
      });
    });
  }

  function enableDicts(word) {
    const w = stripDiacritics(word);
    $.wordSearchLinks.forEach((link) => {
      const src = link.dataset.src;
      const book = BOOKS[src];
      let has = false;
      if (book.type === "root" && book.roots) {
        const wordList = Object.keys(book.roots).sort((a, b) => a.localeCompare(b, "ar"));
        has = wordList.includes(w);
      }
      if (book.type === "alphabetical" && book.sections) {
        has = book.sections.some((s) => normRoot(s.title) === w);
      }
      link.classList.toggle("disabled", !has);
      link.href = has ? `#${src}/${w}` : "#";
    });
  }

  function onWordSearchChange() {
    const val = $.wordSearch.value.trim();
    const valid = isValidRoot(val);
    $.wordSearch.classList.toggle("has-error", !!val && !valid);
    $.inputBtn.classList.toggle("has-input", !!val);
    if (valid || val.length >= 1) {
      enableDicts(val);
    } else {
      $.wordSearchLinks.forEach((link) => link.classList.add("disabled"));
    }
    renderSuggestions(val);
  }

  $.wordSearch.addEventListener("input", onWordSearchChange);

  $.inputBtn.addEventListener("click", () => {
    if ($.inputBtn.classList.contains("has-input")) {
      $.wordSearch.value = "";
      $.wordSearch.focus();
      onWordSearchChange();
      return;
    }
    if (rootKeys.length === 0) return;
    const random = rootKeys[Math.floor(Math.random() * rootKeys.length)];
    $.wordSearch.value = random;
    onWordSearchChange();
    renderWord("mukhtar-alsihah", random);
  });

  $.wordSearchLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      const word = stripDiacritics($.wordSearch.value.trim());
      const src = link.dataset.src;
      const book = BOOKS[src];
      if (!book || !word) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      renderWord(src, word);
    });
  });

  d("[data-modal-close]").forEach((el) =>
    el.addEventListener("click", () => {
      closeModal();
      $.suggester.innerHTML = "";
      $.wordSearch.focus();
    })
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal();
      $.suggester.innerHTML = "";
      $.wordSearch.focus();
    }
  });
  c(".modal-container").addEventListener("click", (e) => e.stopPropagation());
  c(".prev-item").addEventListener("click", () => navWord(-1));
  c(".next-item").addEventListener("click", () => navWord(1));

  d("#section-tabs button").forEach((btn) => {
    btn.addEventListener("click", () => {
      d("#section-tabs button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const panes = d(".tab-content > .tab-pane");
      panes.forEach((p) => p.classList.remove("active"));
      const names = ["quran-search-grp", "ulum-grp", "masahif-grp", "word-search-grp"];
      const idx = d("#section-tabs button").indexOf(btn);
      const pane = c("#" + names[idx]);
      if (pane) pane.classList.add("active");
    });
  });

  const $keyboardBtn = c("#keyboard-btn");
  const $keyboard = c("#arabic-keyboard");
  let keyboardOpen = false;

  if ($keyboardBtn && $keyboard) {
    $keyboardBtn.addEventListener("click", () => {
      keyboardOpen = !keyboardOpen;
      $keyboard.classList.toggle("open", keyboardOpen);
      $keyboardBtn.classList.toggle("active", keyboardOpen);
      if (keyboardOpen) {
        $.wordSearch.focus();
      }
    });

    $keyboard.querySelectorAll(".kb-key").forEach((btn) => {
      btn.addEventListener("click", () => {
        const char = btn.dataset.char;
        if (char === "done") {
          keyboardOpen = false;
          $keyboard.classList.remove("open");
          $keyboardBtn.classList.remove("active");
          return;
        }
        if (char === "←") {
          const input = $.wordSearch;
          input.value = input.value.slice(0, -1);
          input.dispatchEvent(new Event("input"));
          return;
        }
        const input = $.wordSearch;
        const val = input.value;
        const newVal = val + char;
        input.value = newVal;
        input.selectionStart = input.selectionEnd = newVal.length;
        input.dispatchEvent(new Event("input"));
      });
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
})();