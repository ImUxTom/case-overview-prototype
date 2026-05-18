;(function () {
  'use strict'

  var documentContent = document.getElementById('document-content')
  var popup = document.querySelector('.js-annotation-popup')
  var annotateBtn = document.querySelector('.js-annotate-btn')
  var redactBtn = document.querySelector('.js-redact-btn')
  var newAnnotationCard = document.querySelector('.js-new-annotation-card')
  var sidebarInner = document.querySelector('.js-sidebar-inner')
  var sidebarEmpty = document.querySelector('.js-sidebar-empty')
  var annotationForm = document.getElementById('annotation-form')
  var selectedTextInput = document.getElementById('annotation-selected-text')
  var typeHiddenInput = document.getElementById('annotation-type-hidden')
  var noteHiddenInput = document.getElementById('annotation-note-hidden')
  var typeRadios = document.querySelectorAll('.js-type-radio')
  var noteInput = document.getElementById('annotation-note-input')
  var saveBtn = document.querySelector('.js-save-annotation')
  var cancelBtn = document.querySelector('.js-cancel-annotation')
  var redactionForm = document.getElementById('redaction-form')
  var redactionSelectedTextInput = document.getElementById('redaction-selected-text')
  var redactionRemoveForm = document.getElementById('redaction-remove-form')
  var toggleRedactionsBtn = document.querySelector('.js-toggle-redactions')
  var selectionActions = document.querySelector('.js-selection-actions')
  var redactionActions = document.querySelector('.js-redaction-actions')
  var removeRedactionBtn = document.querySelector('.js-remove-redaction-btn')

  var caseId = documentContent ? documentContent.getAttribute('data-case-id') : null
  var documentId = documentContent ? documentContent.getAttribute('data-document-id') : null

  var currentRange = null
  var selectionMark = null
  var redactionsHidden = false
  var pendingRemoveRedactionId = null
  var formSelectionDocumentY = null

  if (!documentContent || !popup) return

  // ── Sticky toolbar border ─────────────────────────────────────────────────

  var sentinel = document.querySelector('.js-toolbar-sentinel')
  var toolbar = document.querySelector('.js-toolbar')

  if (sentinel && toolbar && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      toolbar.classList.toggle('is-stuck', !entries[0].isIntersecting)
    }).observe(sentinel)
  }

  // ── Text selection → popup ─────────────────────────────────────────────────

  function clearSelectionHighlight() {
    if (selectionMark) {
      var parent = selectionMark.parentNode
      while (selectionMark.firstChild) {
        parent.insertBefore(selectionMark.firstChild, selectionMark)
      }
      parent.removeChild(selectionMark)
      selectionMark = null
    }
  }

  function hidePopup() {
    popup.hidden = true
    popup.setAttribute('aria-hidden', 'true')
    pendingRemoveRedactionId = null
    window.getSelection().removeAllRanges()
  }

  function showSelectionPopup(rect) {
    if (selectionActions) selectionActions.hidden = false
    if (redactionActions) redactionActions.hidden = true
    showPopup(rect)
  }

  function showRedactionPopup(rect, redactionId) {
    pendingRemoveRedactionId = redactionId
    if (selectionActions) selectionActions.hidden = true
    if (redactionActions) redactionActions.hidden = false
    showPopup(rect)
  }

  function showPopup(rect) {
    popup.hidden = false
    popup.removeAttribute('aria-hidden')

    var popupWidth = popup.offsetWidth
    var popupHeight = popup.offsetHeight
    var arrowHeight = 9

    var left = rect.left + rect.width / 2 - popupWidth / 2
    left = Math.max(8, Math.min(left, window.innerWidth - popupWidth - 8))

    var top = rect.top - popupHeight - arrowHeight - 4

    popup.style.left = left + 'px'
    popup.style.top = top + 'px'
  }

  function hideNewCard() {
    if (newAnnotationCard) {
      newAnnotationCard.hidden = true
    }
    clearSelectionHighlight()
    if (selectedTextInput) selectedTextInput.value = ''
    if (noteInput) noteInput.value = ''
    typeRadios.forEach(function (r) { r.checked = false })
    currentRange = null
    formSelectionDocumentY = null
    positionAllCards()
  }

  documentContent.addEventListener('mouseup', function (e) {
    setTimeout(function () {
      if (e.target.closest('.app-redaction')) return
      var selection = window.getSelection()
      if (!selection || selection.isCollapsed) {
        hidePopup()
        return
      }
      var selectedText = selection.toString().trim()
      if (!selectedText || selectedText.length < 3) {
        hidePopup()
        return
      }
      var range = selection.getRangeAt(0)
      if (!documentContent.contains(range.commonAncestorContainer)) {
        hidePopup()
        return
      }

      currentRange = range.cloneRange()
      var rect = range.getBoundingClientRect()
      showSelectionPopup(rect)
    }, 10)
  })

  // ── Position all cards (saved + form) inline with their marks ─────────────
  //
  // The form card uses selectionMark as its anchor, just like saved cards use
  // their <mark> element. Both are sorted together and pushed down as needed
  // so nothing overlaps or runs into the footer.

  function positionAllCards() {
    if (!sidebarInner) return

    var sidebarRect = sidebarInner.getBoundingClientRect()
    var MIN_GAP = 8
    var items = []

    // Saved annotation cards
    Array.from(document.querySelectorAll('.js-annotation-card[data-annotation-id]')).forEach(function (card) {
      var id = card.getAttribute('data-annotation-id')
      var mark = document.querySelector('.app-annotation[data-annotation-id="' + id + '"]')
      var markCentreY = 0
      if (mark) {
        var markRect = mark.getBoundingClientRect()
        markCentreY = markRect.top + markRect.height / 2 - sidebarRect.top
      }
      items.push({ card: card, height: card.offsetHeight, markCentreY: markCentreY, idealTop: markCentreY - card.offsetHeight / 2 })
    })

    // New annotation form card — use stored document-relative Y so it works
    // even when surroundContents threw and selectionMark is null
    if (newAnnotationCard && !newAnnotationCard.hidden && formSelectionDocumentY !== null) {
      var formViewportY = formSelectionDocumentY - window.scrollY
      var formMarkCentreY = formViewportY - sidebarRect.top
      var formIdealTop = formMarkCentreY - newAnnotationCard.offsetHeight / 2
      items.push({ card: newAnnotationCard, height: newAnnotationCard.offsetHeight, markCentreY: formMarkCentreY, idealTop: formIdealTop })
    }

    if (!items.length) return

    // Sort by mark centre position, not idealTop — idealTop includes card height
    // so taller cards (like the form) would wrongly sort before shorter ones
    items.sort(function (a, b) { return a.markCentreY - b.markCentreY })

    sidebarInner.style.position = 'relative'

    var nextMinTop = 0

    items.forEach(function (item) {
      var top = Math.max(0, item.idealTop, nextMinTop)
      item.card.style.position = 'absolute'
      item.card.style.top = top + 'px'
      item.card.style.left = '0'
      item.card.style.right = '0'
      item.card.style.marginBottom = '0'
      nextMinTop = top + item.height + MIN_GAP
    })

    var lastItem = items[items.length - 1]
    var lastBottom = parseFloat(lastItem.card.style.top) + lastItem.height
    sidebarInner.style.minHeight = lastBottom + 'px'
  }

  // ── Annotate button → sidebar form ────────────────────────────────────────

  if (annotateBtn) {
    annotateBtn.addEventListener('click', function () {
      if (!currentRange) return

      var selectedText = currentRange.toString().trim()
      if (selectedTextInput) selectedTextInput.value = selectedText

      var selectionRect = currentRange.getBoundingClientRect()
      formSelectionDocumentY = selectionRect.top + selectionRect.height / 2 + window.scrollY

      clearSelectionHighlight()
      try {
        selectionMark = document.createElement('span')
        selectionMark.className = 'app-annotation-selecting'
        currentRange.surroundContents(selectionMark)
      } catch (e) {
        selectionMark = null
      }

      window.getSelection().removeAllRanges()
      hidePopup()

      if (newAnnotationCard) {
        newAnnotationCard.hidden = false
        if (sidebarEmpty) sidebarEmpty.hidden = true
      }

      positionAllCards()

      if (noteInput) noteInput.focus()
    })
  }

  // ── Redact button → instant redaction ────────────────────────────────────

  if (redactBtn) {
    redactBtn.addEventListener('click', function () {
      if (!currentRange || !redactionForm || !redactionSelectedTextInput) return

      var selectedText = currentRange.toString().trim()
      if (!selectedText) return

      redactionSelectedTextInput.value = selectedText
      window.getSelection().removeAllRanges()
      hidePopup()
      redactionForm.submit()
    })
  }

  // ── Click document content → annotation mark or redaction ─────────────────

  documentContent.addEventListener('click', function (e) {
    var annotation = e.target.closest('.app-annotation')
    if (annotation) {
      var annotationId = annotation.getAttribute('data-annotation-id')
      activateCard(annotationId)
      activateMark(annotationId)
      return
    }

    if (redactionsHidden) return
    var redaction = e.target.closest('.app-redaction')
    if (!redaction) return

    var redactionId = redaction.getAttribute('data-redaction-id')
    if (!redactionId) return

    window.getSelection().removeAllRanges()
    var rect = redaction.getBoundingClientRect()
    showRedactionPopup(rect, redactionId)
  })

  // ── Remove redaction button ───────────────────────────────────────────────

  if (removeRedactionBtn) {
    removeRedactionBtn.addEventListener('click', function () {
      if (!pendingRemoveRedactionId || !redactionRemoveForm) return
      redactionRemoveForm.action = '/cases/' + caseId + '/review/documents/' + documentId + '/redactions/' + pendingRemoveRedactionId + '/remove'
      redactionRemoveForm.submit()
    })
  }

  // ── Show/hide redactions toggle ───────────────────────────────────────────

  if (toggleRedactionsBtn) {
    toggleRedactionsBtn.addEventListener('click', function () {
      redactionsHidden = !redactionsHidden
      documentContent.classList.toggle('app-redactions-hidden', redactionsHidden)
      toggleRedactionsBtn.textContent = redactionsHidden ? 'Show redactions' : 'Hide redactions'
    })
  }

  // ── Save annotation ───────────────────────────────────────────────────────

  if (saveBtn) {
    saveBtn.addEventListener('click', function () {
      var note = noteInput ? noteInput.value.trim() : ''
      var type = ''
      typeRadios.forEach(function (r) { if (r.checked) type = r.value })

      if (!note || !type) {
        if (!type) alert('Please select a type.')
        else if (!note) noteInput.focus()
        return
      }

      if (typeHiddenInput) typeHiddenInput.value = type
      if (noteHiddenInput) noteHiddenInput.value = note

      if (annotationForm) annotationForm.submit()
    })
  }

  // ── Cancel annotation ─────────────────────────────────────────────────────

  if (cancelBtn) {
    cancelBtn.addEventListener('click', function () {
      hideNewCard()
      if (sidebarEmpty && !document.querySelectorAll('.js-annotation-card').length) {
        sidebarEmpty.hidden = false
      }
    })
  }

  // ── Close popup when clicking outside ────────────────────────────────────

  document.addEventListener('mousedown', function (e) {
    if (!popup.hidden && !popup.contains(e.target)) {
      hidePopup()
    }
    if (!e.target.closest('.js-annotation-card')) {
      document.querySelectorAll('.js-annotation-card').forEach(function (c) {
        c.classList.remove('is-selected')
        c.classList.remove('app-annotation-card--active')
      })
      activateMark(null)
      repositionCards()
    }
  })

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (!popup.hidden) hidePopup()
      if (newAnnotationCard && !newAnnotationCard.hidden) hideNewCard()
    }
  })

  // ── Card click → highlight annotation in document ────────────────────────

  function activateMark(annotationId) {
    document.querySelectorAll('.app-annotation').forEach(function (m) {
      m.classList.remove('app-annotation--active')
    })
    if (annotationId) {
      var mark = document.querySelector('.app-annotation[data-annotation-id="' + annotationId + '"]')
      if (mark) {
        mark.classList.add('app-annotation--active')
        mark.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }
  }

  // ── Mark click → highlight annotation card ────────────────────────────────

  function activateCard(annotationId) {
    document.querySelectorAll('.js-annotation-card').forEach(function (c) {
      c.classList.remove('is-selected')
      c.classList.remove('app-annotation-card--active')
    })
    if (annotationId) {
      var card = document.querySelector('.js-annotation-card[data-annotation-id="' + annotationId + '"]')
      if (card) {
        card.classList.add('is-selected')
        card.classList.add('app-annotation-card--active')
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }
    repositionCards()
  }

  document.querySelectorAll('.js-annotation-card').forEach(function (card) {
    card.addEventListener('click', function (e) {
      if (e.target.closest('a')) return
      document.querySelectorAll('.js-annotation-card').forEach(function (c) {
        c.classList.remove('is-selected')
        c.classList.remove('app-annotation-card--active')
      })
      card.classList.add('is-selected')
      activateMark(card.getAttribute('data-annotation-id'))
      repositionCards()
    })
  })

  function repositionCards() {
    requestAnimationFrame(positionAllCards)
  }

  // ── Initial card positioning and resize handler ───────────────────────────

  positionAllCards()
  window.addEventListener('resize', positionAllCards)

})()
