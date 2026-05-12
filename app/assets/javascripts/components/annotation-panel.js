;(function () {
  'use strict'

  var documentContent = document.getElementById('document-content')
  var popup = document.querySelector('.js-annotation-popup')
  var annotateBtn = document.querySelector('.js-annotate-btn')
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

  var currentRange = null
  var selectionMark = null

  if (!documentContent || !popup) return

  // ── Sticky toolbar border ─────────────────────────────────────────────────

  var sentinel = document.querySelector('.js-toolbar-sentinel')
  var toolbar = document.querySelector('.js-toolbar')

  if (sentinel && toolbar && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      toolbar.classList.toggle('is-stuck', !entries[0].isIntersecting)
    }).observe(sentinel)
  }

  function positionNewCard() {
    // Cards flow naturally — no absolute positioning needed
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
  }

  function showPopup(rect) {
    popup.hidden = false
    popup.removeAttribute('aria-hidden')

    var popupWidth = popup.offsetWidth
    var popupHeight = popup.offsetHeight
    var arrowHeight = 9

    // Centre popup over the selection midpoint
    var left = rect.left + rect.width / 2 - popupWidth / 2
    // Clamp so it doesn't go off-screen
    left = Math.max(8, Math.min(left, window.innerWidth - popupWidth - 8))

    // Position above the selection top, with room for the arrow
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
  }

  documentContent.addEventListener('mouseup', function () {
    setTimeout(function () {
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
      showPopup(rect)
    }, 10)
  })

  function insertFormCardAtSelectionY(selectionMidY) {
    if (!newAnnotationCard || !sidebarInner) return

    var cards = Array.from(document.querySelectorAll('.js-annotation-card'))
    var insertBefore = null

    for (var i = 0; i < cards.length; i++) {
      var id = cards[i].getAttribute('data-annotation-id')
      var mark = document.querySelector('.app-annotation[data-annotation-id="' + id + '"]')
      if (mark) {
        var markRect = mark.getBoundingClientRect()
        if (markRect.top + markRect.height / 2 > selectionMidY) {
          insertBefore = cards[i]
          break
        }
      }
    }

    if (insertBefore) {
      sidebarInner.insertBefore(newAnnotationCard, insertBefore)
    } else {
      var emptyEl = sidebarInner.querySelector('.js-sidebar-empty')
      if (emptyEl) {
        sidebarInner.insertBefore(newAnnotationCard, emptyEl)
      } else {
        sidebarInner.appendChild(newAnnotationCard)
      }
    }
  }

  // ── Annotate button → sidebar form ────────────────────────────────────────

  if (annotateBtn) {
    annotateBtn.addEventListener('click', function () {
      if (!currentRange) return

      var selectedText = currentRange.toString().trim()
      if (selectedTextInput) selectedTextInput.value = selectedText

      // Wrap selected text in a temporary highlight span
      clearSelectionHighlight()
      try {
        selectionMark = document.createElement('span')
        selectionMark.className = 'app-annotation-selecting'
        currentRange.surroundContents(selectionMark)
      } catch (e) {
        selectionMark = null
      }

      var rect = currentRange.getBoundingClientRect()
      var selectionMidY = rect.top + rect.height / 2

      window.getSelection().removeAllRanges()
      hidePopup()

      insertFormCardAtSelectionY(selectionMidY)

      if (newAnnotationCard) {
        newAnnotationCard.hidden = false
        if (sidebarEmpty) sidebarEmpty.hidden = true
        if (noteInput) noteInput.focus()
      }
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
    if (!popup.hidden && !popup.contains(e.target) && !documentContent.contains(e.target)) {
      hidePopup()
    }
  })

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (!popup.hidden) hidePopup()
      if (newAnnotationCard && !newAnnotationCard.hidden) hideNewCard()
    }
  })

  // ── Card expand/collapse ──────────────────────────────────────────────────

  function activateMark(annotationId) {
    document.querySelectorAll('.app-annotation').forEach(function (m) {
      m.classList.remove('app-annotation--active')
    })
    if (annotationId) {
      var mark = document.querySelector('.app-annotation[data-annotation-id="' + annotationId + '"]')
      if (mark) mark.classList.add('app-annotation--active')
    }
  }

  document.querySelectorAll('.js-card-toggle').forEach(function (toggle) {
    toggle.addEventListener('click', function () {
      var card = toggle.closest('.js-annotation-card')
      var expanded = card.querySelector('.js-card-expanded')
      var isExpanded = toggle.getAttribute('aria-expanded') === 'true'

      toggle.setAttribute('aria-expanded', isExpanded ? 'false' : 'true')
      if (expanded) expanded.hidden = isExpanded

      var annotationId = isExpanded ? null : card.getAttribute('data-annotation-id')
      activateMark(annotationId)
    })
  })


})()
