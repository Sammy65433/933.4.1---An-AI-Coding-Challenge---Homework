/* Flashcards Study App - vanilla JS */
(function () {
  'use strict';

  const STORAGE_KEY = 'flashcards-app-state-v1';
  const THEME_KEY = 'flashcards-theme';

  let state = {
    version: 1,
    decks: [],
    cardsByDeck: {},
    activeDeckId: null,
    ui: { activeCardIndex: 0, searchQuery: '', shuffledIds: null }
  };

  let editingDeckId = null;
  let editingCardId = null;
  let confirmResolver = null;

  // ---------- utils ----------
  function uid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      state = {
        version: 1,
        decks: Array.isArray(parsed.decks) ? parsed.decks : [],
        cardsByDeck: (parsed.cardsByDeck && typeof parsed.cardsByDeck === 'object') ? parsed.cardsByDeck : {},
        activeDeckId: parsed.activeDeckId || null,
        ui: (parsed.ui && typeof parsed.ui === 'object') ? {
          activeCardIndex: Number.isInteger(parsed.ui.activeCardIndex) ? parsed.ui.activeCardIndex : 0,
          searchQuery: typeof parsed.ui.searchQuery === 'string' ? parsed.ui.searchQuery : '',
          shuffledIds: Array.isArray(parsed.ui.shuffledIds) ? parsed.ui.shuffledIds : null
        } : { activeCardIndex: 0, searchQuery: '', shuffledIds: null }
      };
      // ensure cardsByDeck for all decks
      state.decks.forEach(d => { if (!Array.isArray(state.cardsByDeck[d.id])) state.cardsByDeck[d.id] = []; });
      // validate activeDeckId
      if (!state.decks.some(d => d.id === state.activeDeckId)) {
        state.activeDeckId = state.decks.length ? state.decks[0].id : null;
      }
    } catch (e) {
      console.warn('Failed to load state, using defaults', e);
    }
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) { console.warn('Failed to save state', e); }
  }

  // ---------- data ops ----------
  function createDeck(name) {
    const deck = { id: uid(), name: name.trim(), createdAt: Date.now(), updatedAt: Date.now() };
    state.decks.push(deck);
    state.cardsByDeck[deck.id] = [];
    state.activeDeckId = deck.id;
    state.ui.activeCardIndex = 0;
    state.ui.searchQuery = '';
    state.ui.shuffledIds = null;
    saveState();
    return deck;
  }

  function updateDeck(id, name) {
    const d = state.decks.find(x => x.id === id);
    if (!d) return;
    d.name = name.trim();
    d.updatedAt = Date.now();
    saveState();
  }

  function deleteDeck(id) {
    const i = state.decks.findIndex(d => d.id === id);
    if (i >= 0) state.decks.splice(i, 1);
    delete state.cardsByDeck[id];
    if (state.activeDeckId === id) {
      state.activeDeckId = state.decks.length ? state.decks[0].id : null;
    }
    state.ui.activeCardIndex = 0;
    state.ui.searchQuery = '';
    state.ui.shuffledIds = null;
    saveState();
  }

  function createCard(deckId, front, back) {
    const card = {
      id: uid(), front: front.trim(), back: back.trim(),
      createdAt: Date.now(), updatedAt: Date.now(),
      reviews: 0, interval: 1, due: Date.now(), ease: 2.5
    };
    if (!Array.isArray(state.cardsByDeck[deckId])) state.cardsByDeck[deckId] = [];
    state.cardsByDeck[deckId].push(card);
    saveState();
    return card;
  }

  function updateCard(deckId, cardId, front, back) {
    const card = (state.cardsByDeck[deckId] || []).find(c => c.id === cardId);
    if (!card) return;
    card.front = front.trim();
    card.back = back.trim();
    card.updatedAt = Date.now();
    saveState();
  }

  function deleteCard(deckId, cardId) {
    const arr = state.cardsByDeck[deckId];
    if (!Array.isArray(arr)) return;
    const i = arr.findIndex(c => c.id === cardId);
    if (i >= 0) arr.splice(i, 1);
    saveState();
  }

  function rateCard(card, rating) {
    card.reviews = (card.reviews || 0) + 1;
    card.lastReviewed = Date.now();
    if (rating === 'again') { card.interval = 1; card.ease = Math.max(1.3, (card.ease || 2.5) - 0.2); }
    else if (rating === 'good') { card.interval = Math.round((card.interval || 1) * (card.ease || 2.5)); }
    else if (rating === 'easy') { card.interval = Math.round((card.interval || 1) * (card.ease || 2.5) * 1.3); card.ease = (card.ease || 2.5) + 0.15; }
    card.due = Date.now() + (card.interval || 1) * 24 * 60 * 60 * 1000;
    card.updatedAt = Date.now();
    saveState();
  }

  // ---------- view helpers ----------
  function getVisibleCards() {
    const deckId = state.activeDeckId;
    if (!deckId) return [];
    const cards = state.cardsByDeck[deckId] || [];
    const q = (state.ui.searchQuery || '').trim().toLowerCase();
    if (!q) return cards.slice();
    return cards.filter(c => (c.front + ' ' + c.back).toLowerCase().includes(q));
  }

  function getStudyCards() {
    const visible = getVisibleCards();
    const ids = state.ui.shuffledIds;
    if (Array.isArray(ids) && ids.length === visible.length && ids.every(id => visible.some(c => c.id === id))) {
      return ids.map(id => visible.find(c => c.id === id)).filter(Boolean);
    }
    return visible;
  }

  function clampIndex() {
    const cards = getStudyCards();
    if (!cards.length) { state.ui.activeCardIndex = 0; return; }
    if (state.ui.activeCardIndex < 0) state.ui.activeCardIndex = 0;
    if (state.ui.activeCardIndex >= cards.length) state.ui.activeCardIndex = cards.length - 1;
  }

  // ---------- DOM refs ----------
  const deckList = document.getElementById('deckList');
  const noDecks = document.getElementById('noDecks');
  const deckTitle = document.getElementById('deckTitle');
  const editDeckBtn = document.getElementById('editDeckBtn');
  const deleteDeckBtn = document.getElementById('deleteDeckBtn');
  const manageCardsBtn = document.getElementById('manageCardsBtn');
  const searchInput = document.getElementById('searchInput');
  const shuffleBtn = document.getElementById('shuffleBtn');
  const newCardBtn = document.getElementById('newCardBtn');
  const studyArea = document.getElementById('studyArea');
  const studyCard = document.getElementById('studyCard');
  const cardFront = document.getElementById('cardFront');
  const cardBack = document.getElementById('cardBack');
  const cardCounter = document.getElementById('cardCounter');
  const searchCount = document.getElementById('searchCount');
  const prevBtn = document.getElementById('prevBtn');
  const flipBtn = document.getElementById('flipBtn');
  const nextBtn = document.getElementById('nextBtn');
  const ratingControls = document.getElementById('ratingControls');
  const emptyCards = document.getElementById('emptyCards');

  const modalBackdrop = document.getElementById('modalBackdrop');
  const deckModal = document.getElementById('deckModal');
  const deckModalTitle = document.getElementById('deckModalTitle');
  const deckForm = document.getElementById('deckForm');
  const deckNameInput = document.getElementById('deckNameInput');

  const cardModal = document.getElementById('cardModal');
  const cardModalTitle = document.getElementById('cardModalTitle');
  const cardForm = document.getElementById('cardForm');
  const cardFrontInput = document.getElementById('cardFrontInput');
  const cardBackInput = document.getElementById('cardBackInput');

  const manageModal = document.getElementById('manageModal');
  const manageCardList = document.getElementById('manageCardList');

  const confirmModal = document.getElementById('confirmModal');
  const confirmMessage = document.getElementById('confirmMessage');
  const confirmCancel = document.getElementById('confirmCancel');
  const confirmOk = document.getElementById('confirmOk');

  const importModal = document.getElementById('importModal');
  const importText = document.getElementById('importText');
  const importOk = document.getElementById('importOk');

  // ---------- modal system ----------
  function getFocusable(modal) {
    return Array.from(modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
      .filter(el => !el.disabled);
  }

  let activeModal = null;
  let lastFocus = null;

  function openModal(modal) {
    lastFocus = document.activeElement;
    modal.hidden = false;
    modalBackdrop.hidden = false;
    activeModal = modal;
    const f = getFocusable(modal);
    if (f.length) setTimeout(() => f[0].focus(), 0);
    document.addEventListener('keydown', modalKeyHandler, true);
  }

  function closeModal(modal) {
    modal.hidden = true;
    activeModal = null;
    document.removeEventListener('keydown', modalKeyHandler, true);
    // hide backdrop if no modal open
    const anyOpen = [deckModal, cardModal, manageModal, confirmModal, importModal].some(m => !m.hidden);
    if (!anyOpen) modalBackdrop.hidden = true;
    if (lastFocus && typeof lastFocus.focus === 'function') {
      try { lastFocus.focus(); } catch (e) {}
    }
  }

  function modalKeyHandler(e) {
    if (!activeModal) return;
    if (e.key === 'Escape') {
      // don't close confirm? allow
      e.preventDefault();
      if (activeModal === confirmModal) {
        resolveConfirm(false);
      } else {
        closeModal(activeModal);
      }
      return;
    }
    if (e.key === 'Tab') {
      const f = getFocusable(activeModal);
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function confirmDialog(message) {
    return new Promise(resolve => {
      confirmResolver = resolve;
      confirmMessage.textContent = message;
      openModal(confirmModal);
    });
  }

  function resolveConfirm(val) {
    if (confirmResolver) { confirmResolver(val); confirmResolver = null; }
    closeModal(confirmModal);
  }

  // close buttons with data-close
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal');
      if (modal) closeModal(modal);
    });
  });
  confirmCancel.addEventListener('click', () => resolveConfirm(false));
  confirmOk.addEventListener('click', () => resolveConfirm(true));

  modalBackdrop.addEventListener('click', () => {
    if (activeModal === confirmModal) resolveConfirm(false);
    else if (activeModal) closeModal(activeModal);
  });

  // ---------- render ----------
  function renderDecks() {
    deckList.innerHTML = '';
    if (!state.decks.length) {
      noDecks.hidden = false;
      return;
    }
    noDecks.hidden = true;
    state.decks.forEach(d => {
      const li = document.createElement('li');
      li.className = 'deck-item' + (d.id === state.activeDeckId ? ' active' : '');
      li.dataset.deckId = d.id;
      li.innerHTML = `
        <span class="deck-name">${escapeHtml(d.name)}</span>
        <span class="deck-actions">
          <button type="button" data-action="edit-deck" data-deck-id="${d.id}" aria-label="Edit deck ${escapeHtml(d.name)}">Edit</button>
          <button type="button" data-action="delete-deck" data-deck-id="${d.id}" aria-label="Delete deck ${escapeHtml(d.name)}">Del</button>
        </span>`;
      deckList.appendChild(li);
    });
  }

  function renderStudyCard() {
    const cards = getStudyCards();
    clampIndex();
    if (!cards.length) {
      studyArea.hidden = true;
      emptyCards.hidden = false;
      cardCounter.textContent = '';
      searchCount.textContent = state.ui.searchQuery ? '0 matches' : '';
      return;
    }
    emptyCards.hidden = true;
    studyArea.hidden = false;
    const idx = state.ui.activeCardIndex;
    const card = cards[idx];
    cardFront.textContent = card.front;
    cardBack.textContent = card.back;
    studyCard.classList.remove('is-flipped');
    cardCounter.textContent = `Card ${idx + 1} of ${cards.length}`;
    const total = (state.cardsByDeck[state.activeDeckId] || []).length;
    searchCount.textContent = state.ui.searchQuery ? `${cards.length} of ${total} match` : `${total} cards`;
  }

  function renderDeckView() {
    const deck = state.decks.find(d => d.id === state.activeDeckId);
    if (!deck) {
      deckTitle.textContent = 'Select a deck';
      editDeckBtn.hidden = true;
      deleteDeckBtn.hidden = true;
      manageCardsBtn.hidden = true;
      shuffleBtn.hidden = true;
      newCardBtn.hidden = true;
      studyArea.hidden = true;
      emptyCards.hidden = true;
      searchInput.value = state.ui.searchQuery || '';
      return;
    }
    deckTitle.textContent = deck.name;
    editDeckBtn.hidden = false;
    deleteDeckBtn.hidden = false;
    manageCardsBtn.hidden = false;
    shuffleBtn.hidden = false;
    newCardBtn.hidden = false;
    searchInput.value = state.ui.searchQuery || '';
    renderStudyCard();
  }

  function render() {
    renderDecks();
    renderDeckView();
  }

  // ---------- deck list delegation ----------
  deckList.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (btn) {
      e.stopPropagation();
      const deckId = btn.dataset.deckId;
      if (btn.dataset.action === 'edit-deck') openDeckModal(deckId);
      else if (btn.dataset.action === 'delete-deck') {
        confirmDialog('Delete this deck and all its cards?').then(ok => {
          if (ok) { deleteDeck(deckId); render(); }
        });
      }
      return;
    }
    const item = e.target.closest('.deck-item');
    if (item) {
      state.activeDeckId = item.dataset.deckId;
      state.ui.activeCardIndex = 0;
      state.ui.searchQuery = '';
      state.ui.shuffledIds = null;
      searchInput.value = '';
      saveState();
      render();
    }
  });

  // ---------- actions ----------
  function flipCard() {
    studyCard.classList.toggle('is-flipped');
  }

  function go(delta) {
    const cards = getStudyCards();
    if (!cards.length) return;
    let idx = state.ui.activeCardIndex + delta;
    if (idx < 0) idx = 0;
    if (idx >= cards.length) idx = cards.length - 1;
    state.ui.activeCardIndex = idx;
    saveState();
    renderStudyCard();
  }

  function shuffle() {
    const visible = getVisibleCards();
    const ids = visible.map(c => c.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    state.ui.shuffledIds = ids;
    state.ui.activeCardIndex = 0;
    saveState();
    renderStudyCard();
  }

  // ---------- modals open helpers ----------
  function openDeckModal(deckId) {
    editingDeckId = deckId;
    deckModalTitle.textContent = deckId ? 'Edit Deck' : 'New Deck';
    if (deckId) {
      const d = state.decks.find(x => x.id === deckId);
      deckNameInput.value = d ? d.name : '';
    } else {
      deckNameInput.value = '';
    }
    openModal(deckModal);
  }

  function openCardModal(cardId) {
    editingCardId = cardId;
    cardModalTitle.textContent = cardId ? 'Edit Card' : 'New Card';
    if (cardId) {
      const card = (state.cardsByDeck[state.activeDeckId] || []).find(c => c.id === cardId);
      cardFrontInput.value = card ? card.front : '';
      cardBackInput.value = card ? card.back : '';
    } else {
      cardFrontInput.value = '';
      cardBackInput.value = '';
    }
    openModal(cardModal);
  }

  function renderManageList() {
    const cards = state.cardsByDeck[state.activeDeckId] || [];
    manageCardList.innerHTML = '';
    if (!cards.length) {
      manageCardList.innerHTML = '<li class="empty-state">No cards yet.</li>';
      return;
    }
    cards.forEach(c => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="card-preview"><strong>${escapeHtml(c.front)}</strong> — ${escapeHtml(c.back)}</span>
        <span class="item-actions">
          <button type="button" data-action="edit-card" data-card-id="${c.id}">Edit</button>
          <button type="button" data-action="delete-card" data-card-id="${c.id}">Delete</button>
        </span>`;
      manageCardList.appendChild(li);
    });
  }

  // ---------- event bindings ----------
  document.getElementById('newDeckBtn').addEventListener('click', () => openDeckModal(null));
  editDeckBtn.addEventListener('click', () => { if (state.activeDeckId) openDeckModal(state.activeDeckId); });
  deleteDeckBtn.addEventListener('click', () => {
    if (!state.activeDeckId) return;
    confirmDialog('Delete this deck and all its cards?').then(ok => {
      if (ok) { deleteDeck(state.activeDeckId); render(); }
    });
  });
  manageCardsBtn.addEventListener('click', () => {
    renderManageList();
    openModal(manageModal);
  });
  newCardBtn.addEventListener('click', () => openCardModal(null));
  shuffleBtn.addEventListener('click', shuffle);
  flipBtn.addEventListener('click', flipCard);
  prevBtn.addEventListener('click', () => go(-1));
  nextBtn.addEventListener('click', () => go(1));

  studyCard.addEventListener('click', flipCard);
  studyCard.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flipCard(); }
  });

  // rating
  ratingControls.addEventListener('click', e => {
    const btn = e.target.closest('[data-rating]');
    if (!btn) return;
    const cards = getStudyCards();
    const card = cards[state.ui.activeCardIndex];
    if (!card) return;
    rateCard(card, btn.dataset.rating);
    go(1);
  });

  // search debounced
  let searchTimer = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.ui.searchQuery = searchInput.value;
      state.ui.shuffledIds = null;
      state.ui.activeCardIndex = 0;
      saveState();
      render();
    }, 300);
  });

  // deck form
  deckForm.addEventListener('submit', e => {
    e.preventDefault();
    const name = deckNameInput.value.trim();
    if (!name) { deckNameInput.focus(); return; }
    if (editingDeckId) updateDeck(editingDeckId, name);
    else createDeck(name);
    closeModal(deckModal);
    render();
  });

  // card form
  cardForm.addEventListener('submit', e => {
    e.preventDefault();
    const front = cardFrontInput.value.trim();
    const back = cardBackInput.value.trim();
    if (!front || !back) {
      if (!front) cardFrontInput.focus(); else cardBackInput.focus();
      return;
    }
    if (editingCardId) updateCard(state.activeDeckId, editingCardId, front, back);
    else createCard(state.activeDeckId, front, back);
    const wasManageOpen = !manageModal.hidden;
    closeModal(cardModal);
    if (wasManageOpen) renderManageList();
    render();
  });

  // manage list delegation
  manageCardList.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const cardId = btn.dataset.cardId;
    if (btn.dataset.action === 'edit-card') {
      openCardModal(cardId);
    } else if (btn.dataset.action === 'delete-card') {
      confirmDialog('Delete this card?').then(ok => {
        if (!ok) return;
        deleteCard(state.activeDeckId, cardId);
        state.ui.activeCardIndex = 0;
        state.ui.shuffledIds = null;
        renderManageList();
        render();
      });
    }
  });

  // import/export
  document.getElementById('importBtn').addEventListener('click', () => {
    importText.value = '';
    openModal(importModal);
  });
  importOk.addEventListener('click', () => {
    let data;
    try { data = JSON.parse(importText.value); }
    catch (e) { alert('Invalid JSON'); return; }
    const name = (data && typeof data.name === 'string' && data.name.trim()) ? data.name.trim() : 'Imported Deck';
    const cards = (data && Array.isArray(data.cards)) ? data.cards : [];
    const deck = createDeck(name);
    cards.forEach(c => {
      if (c && typeof c.front === 'string' && typeof c.back === 'string') {
        createCard(deck.id, c.front, c.back);
      }
    });
    closeModal(importModal);
    render();
  });

  document.getElementById('exportBtn').addEventListener('click', () => {
    const deck = state.decks.find(d => d.id === state.activeDeckId);
    if (!deck) { alert('Select a deck to export.'); return; }
    const cards = (state.cardsByDeck[deck.id] || []).map(c => ({ front: c.front, back: c.back }));
    const payload = { name: deck.name, cards };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (deck.name.replace(/[^a-z0-9-_]+/gi, '_') || 'deck') + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  // keyboard shortcuts
  document.addEventListener('keydown', e => {
    // ignore when typing in inputs/textareas
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable);
    if (activeModal) return; // modal handles its own
    if (typing) return;
    if (e.key === ' ') { e.preventDefault(); flipCard(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
  });

  // ---------- theme ----------
  // basic: honor prefers-color-scheme; no manual toggle button in this build

  // ---------- init ----------
  loadState();
  render();

  // expose for debugging
  window.__flashcards = { state, saveState };
})();
