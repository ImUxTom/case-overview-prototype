App.AnnotationPanel = function(params) {
  this.container = params.container

  this.popup                         = $('.js-annotation-popup')
  this.annotateBtns                  = $('.js-annotate-btn')
  this.redactBtn                     = $('.js-redact-btn')
  this.newAnnotationCards            = $('.js-new-annotation-card')
  this.activeAnnotationCard          = null
  this.sidebarInner                  = $('.js-sidebar-inner')
  this.sidebarEmpty                  = $('.js-sidebar-empty')
  this.annotationForm                = $('#annotation-form')
  this.selectedTextInput             = $('#annotation-selected-text')
  this.typeHiddenInput               = $('#annotation-type-hidden')
  this.noteHiddenInput               = $('#annotation-note-hidden')
  this.saveBtn                       = $('.js-save-annotation')
  this.cancelBtn                     = $('.js-cancel-annotation')
  this.redactionForm                 = $('#redaction-form')
  this.redactionSelectedTextInput    = $('#redaction-selected-text')
  this.redactionRemoveForm           = $('#redaction-remove-form')
  this.toggleRedactionsBtn           = $('.js-toggle-redactions')
  this.selectionActions              = $('.js-selection-actions')
  this.redactionActions              = $('.js-redaction-actions')
  this.removeRedactionBtn            = $('.js-remove-redaction-btn')
  this.inadmissibleBtn               = $('.js-inadmissible-btn')
  this.inadmissibleActions           = $('.js-inadmissible-actions')
  this.removeInadmissibleBtn         = $('.js-remove-inadmissible-btn')
  this.inadmissibleForm              = $('#inadmissible-form')
  this.inadmissibleSelectedTextInput = $('#inadmissible-selected-text')
  this.inadmissibleRemoveForm        = $('#inadmissible-remove-form')

  this.caseId     = this.container.data('case-id')
  this.documentId = this.container.data('document-id')

  this.currentRange                = null
  this.selectionMark               = null
  this.redactionsHidden            = false
  this.pendingAnnotationType       = null
  this.pendingRemoveRedactionId    = null
  this.pendingRemoveInadmissibleId = null
  this.formSelectionDocumentY      = null

  this.setupEvents()
  this.positionAllCards()
  this.handleUrlHash()
}

App.AnnotationPanel.prototype.setupEvents = function() {
  this.container.on('mouseup', $.proxy(this, 'onDocumentMouseup'))
  this.container.on('click', $.proxy(this, 'onDocumentClick'))
  this.annotateBtns.on('click', $.proxy(this, 'onAnnotateBtnClick'))
  this.redactBtn.on('click', $.proxy(this, 'onRedactClick'))
  this.inadmissibleBtn.on('click', $.proxy(this, 'onInadmissibleClick'))
  this.removeRedactionBtn.on('click', $.proxy(this, 'onRemoveRedactionClick'))
  this.removeInadmissibleBtn.on('click', $.proxy(this, 'onRemoveInadmissibleClick'))
  this.toggleRedactionsBtn.on('click', $.proxy(this, 'onToggleRedactionsClick'))
  this.saveBtn.on('click', $.proxy(this, 'onSaveClick'))
  this.cancelBtn.on('click', $.proxy(this, 'onCancelClick'))
  this.sidebarInner.on('click', '.js-annotation-card', $.proxy(this, 'onCardClick'))
  $(document).on('mousedown', $.proxy(this, 'onDocumentMousedown'))
  $(document).on('keydown', $.proxy(this, 'onDocumentKeydown'))
  $(window).on('resize', $.proxy(this, 'positionAllCards'))
}

// ── Popup ─────────────────────────────────────────────────────────────────────

App.AnnotationPanel.prototype.hidePopup = function() {
  this.popup.prop('hidden', true).attr('aria-hidden', 'true')
  this.pendingRemoveRedactionId = null
  this.pendingRemoveInadmissibleId = null
  window.getSelection().removeAllRanges()
}

App.AnnotationPanel.prototype.showPopup = function(rect) {
  var popupEl = this.popup[0]
  this.popup.prop('hidden', false).removeAttr('aria-hidden')

  var popupWidth = popupEl.offsetWidth
  var popupHeight = popupEl.offsetHeight
  var arrowHeight = 9

  var left = rect.left + window.scrollX + rect.width / 2 - popupWidth / 2
  left = Math.max(8, Math.min(left, window.scrollX + window.innerWidth - popupWidth - 8))
  var top = rect.top + window.scrollY - popupHeight - arrowHeight - 4

  this.popup.css({ left: left + 'px', top: top + 'px' })
}

App.AnnotationPanel.prototype.showSelectionPopup = function(rect) {
  this.selectionActions.prop('hidden', false)
  this.redactionActions.prop('hidden', true)
  this.inadmissibleActions.prop('hidden', true)
  this.showPopup(rect)
}

App.AnnotationPanel.prototype.showRedactionPopup = function(rect, redactionId) {
  this.pendingRemoveRedactionId = redactionId
  this.selectionActions.prop('hidden', true)
  this.redactionActions.prop('hidden', false)
  this.inadmissibleActions.prop('hidden', true)
  this.showPopup(rect)
}

App.AnnotationPanel.prototype.showInadmissiblePopup = function(rect, inadmissibleId) {
  this.pendingRemoveInadmissibleId = inadmissibleId
  this.selectionActions.prop('hidden', true)
  this.redactionActions.prop('hidden', true)
  this.inadmissibleActions.prop('hidden', false)
  this.showPopup(rect)
}

// ── Cards ─────────────────────────────────────────────────────────────────────

App.AnnotationPanel.prototype.clearSelectionHighlight = function() {
  if (!this.selectionMark) return
  var parent = this.selectionMark.parentNode
  while (this.selectionMark.firstChild) {
    parent.insertBefore(this.selectionMark.firstChild, this.selectionMark)
  }
  parent.removeChild(this.selectionMark)
  this.selectionMark = null
}

App.AnnotationPanel.prototype.hideNewCard = function() {
  this.newAnnotationCards.prop('hidden', true)
  this.newAnnotationCards.find('.js-annotation-note-input').val('')
  this.activeAnnotationCard = null
  this.clearSelectionHighlight()
  this.selectedTextInput.val('')
  this.pendingAnnotationType = null
  this.currentRange = null
  this.formSelectionDocumentY = null
  this.positionAllCards()
}

// Positions saved annotation cards and the in-progress form card inline with
// their document marks, pushing cards down to prevent overlap.
App.AnnotationPanel.prototype.positionAllCards = function() {
  if (!this.sidebarInner.length) return

  var sidebarRect = this.sidebarInner[0].getBoundingClientRect()
  var MIN_GAP = 8
  var items = []

  $('.js-annotation-card[data-annotation-id]').each(function() {
    var card = this
    var id = $(card).data('annotation-id')
    var mark = document.querySelector('.app-annotation[data-annotation-id="' + id + '"]')
    var markCentreY = 0
    if (mark) {
      var markRect = mark.getBoundingClientRect()
      markCentreY = markRect.top + markRect.height / 2 - sidebarRect.top
    }
    items.push({ card: card, height: card.offsetHeight, markCentreY: markCentreY, idealTop: markCentreY - card.offsetHeight / 2 })
  })

  var formCard = this.activeAnnotationCard ? this.activeAnnotationCard[0] : null
  if (formCard && !formCard.hidden && this.formSelectionDocumentY !== null) {
    var formViewportY = this.formSelectionDocumentY - window.scrollY
    var formMarkCentreY = formViewportY - sidebarRect.top
    items.push({ card: formCard, height: formCard.offsetHeight, markCentreY: formMarkCentreY, idealTop: formMarkCentreY - formCard.offsetHeight / 2 })
  }

  if (!items.length) return

  // Sort by mark centre position, not idealTop — idealTop includes card height
  // so taller cards (like the form) would wrongly sort before shorter ones
  items.sort(function(a, b) { return a.markCentreY - b.markCentreY })

  this.sidebarInner.css('position', 'relative')

  var nextMinTop = 0
  items.forEach(function(item) {
    var top = Math.max(0, item.idealTop, nextMinTop)
    $(item.card).css({ position: 'absolute', top: top + 'px', left: '0', right: '0', marginBottom: '0' })
    nextMinTop = top + item.height + MIN_GAP
  })

  var lastItem = items[items.length - 1]
  var lastBottom = parseFloat($(lastItem.card).css('top')) + lastItem.height
  this.sidebarInner.css('min-height', lastBottom + 'px')
}

App.AnnotationPanel.prototype.repositionCards = function() {
  requestAnimationFrame($.proxy(this, 'positionAllCards'))
}

App.AnnotationPanel.prototype.activateMark = function(annotationId) {
  $('.app-annotation').removeClass('app-annotation--active')
  if (!annotationId) return
  var mark = $('.app-annotation[data-annotation-id="' + annotationId + '"]')
  mark.addClass('app-annotation--active')
  if (mark[0]) mark[0].scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

App.AnnotationPanel.prototype.activateCard = function(annotationId) {
  $('.js-annotation-card').removeClass('is-selected app-annotation-card--active')
  if (annotationId) {
    var card = $('.js-annotation-card[data-annotation-id="' + annotationId + '"]')
    card.addClass('is-selected app-annotation-card--active')
    if (card[0]) card[0].scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }
  this.repositionCards()
}

App.AnnotationPanel.prototype.handleUrlHash = function() {
  var match = window.location.hash.match(/^#annotation-(\d+)$/)
  if (!match) return
  this.activateCard(match[1])
  this.activateMark(match[1])
}

// ── Event handlers ────────────────────────────────────────────────────────────

App.AnnotationPanel.prototype.onDocumentMouseup = function(e) {
  var self = this
  setTimeout(function() {
    if ($(e.target).closest('.app-redaction').length || $(e.target).closest('.app-inadmissible').length) return
    var selection = window.getSelection()
    if (!selection || selection.isCollapsed) { self.hidePopup(); return }
    var selectedText = selection.toString().trim()
    if (!selectedText || selectedText.length < 3) { self.hidePopup(); return }
    var range = selection.getRangeAt(0)
    if (!self.container[0].contains(range.commonAncestorContainer)) { self.hidePopup(); return }
    self.currentRange = range.cloneRange()
    self.showSelectionPopup(range.getBoundingClientRect())
  }, 10)
}

App.AnnotationPanel.prototype.onAnnotateBtnClick = function(e) {
  if (!this.currentRange) return

  this.pendingAnnotationType = $(e.currentTarget).data('type')
  this.selectedTextInput.val(this.currentRange.toString().trim())

  var rect = this.currentRange.getBoundingClientRect()
  this.formSelectionDocumentY = rect.top + rect.height / 2 + window.scrollY

  this.clearSelectionHighlight()
  try {
    this.selectionMark = document.createElement('span')
    this.selectionMark.className = 'app-annotation-selecting'
    this.currentRange.surroundContents(this.selectionMark)
  } catch(err) {
    this.selectionMark = null
  }

  window.getSelection().removeAllRanges()
  this.hidePopup()
  this.newAnnotationCards.prop('hidden', true)
  this.activeAnnotationCard = this.newAnnotationCards.filter('.js-new-annotation-card--' + this.pendingAnnotationType)
  this.activeAnnotationCard.prop('hidden', false)
  this.sidebarEmpty.prop('hidden', true)
  this.positionAllCards()
  this.activeAnnotationCard.find('.js-annotation-note-input').focus()
}

App.AnnotationPanel.prototype.onRedactClick = function() {
  if (!this.currentRange) return
  var selectedText = this.currentRange.toString().trim()
  if (!selectedText) return
  this.redactionSelectedTextInput.val(selectedText)
  window.getSelection().removeAllRanges()
  this.hidePopup()
  this.redactionForm[0].submit()
}

App.AnnotationPanel.prototype.onDocumentClick = function(e) {
  var annotation = $(e.target).closest('.app-annotation')
  if (annotation.length) {
    var annotationId = annotation.data('annotation-id')
    this.activateCard(annotationId)
    this.activateMark(annotationId)
    return
  }

  var inadmissible = $(e.target).closest('.app-inadmissible')
  if (inadmissible.length) {
    var inadmissibleId = inadmissible.data('inadmissible-id')
    if (!inadmissibleId) return
    window.getSelection().removeAllRanges()
    this.showInadmissiblePopup(inadmissible[0].getBoundingClientRect(), inadmissibleId)
    return
  }

  if (this.redactionsHidden) return
  var redaction = $(e.target).closest('.app-redaction')
  if (!redaction.length) return
  var redactionId = redaction.data('redaction-id')
  if (!redactionId) return
  window.getSelection().removeAllRanges()
  this.showRedactionPopup(redaction[0].getBoundingClientRect(), redactionId)
}

App.AnnotationPanel.prototype.onRemoveRedactionClick = function() {
  if (!this.pendingRemoveRedactionId) return
  this.redactionRemoveForm.attr('action', '/cases/' + this.caseId + '/review/documents/' + this.documentId + '/redactions/' + this.pendingRemoveRedactionId + '/remove')
  this.redactionRemoveForm[0].submit()
}

App.AnnotationPanel.prototype.onInadmissibleClick = function() {
  if (!this.currentRange) return
  var selectedText = this.currentRange.toString().trim()
  if (!selectedText) return
  this.inadmissibleSelectedTextInput.val(selectedText)
  window.getSelection().removeAllRanges()
  this.hidePopup()
  this.inadmissibleForm[0].submit()
}

App.AnnotationPanel.prototype.onRemoveInadmissibleClick = function() {
  if (!this.pendingRemoveInadmissibleId) return
  this.inadmissibleRemoveForm.attr('action', '/cases/' + this.caseId + '/review/documents/' + this.documentId + '/inadmissibles/' + this.pendingRemoveInadmissibleId + '/remove')
  this.inadmissibleRemoveForm[0].submit()
}

App.AnnotationPanel.prototype.onToggleRedactionsClick = function() {
  this.redactionsHidden = !this.redactionsHidden
  this.container.toggleClass('app-redactions-hidden', this.redactionsHidden)
  this.toggleRedactionsBtn.text(this.redactionsHidden ? 'Show redactions' : 'Hide redactions')
}

App.AnnotationPanel.prototype.onSaveClick = function() {
  var noteInput = this.activeAnnotationCard.find('.js-annotation-note-input')
  var note = noteInput.val().trim()
  if (!note) { noteInput.focus(); return }
  this.typeHiddenInput.val(this.pendingAnnotationType)
  this.noteHiddenInput.val(note)
  this.annotationForm[0].submit()
}

App.AnnotationPanel.prototype.onCancelClick = function(e) {
  e.preventDefault()
  this.hideNewCard()
  if (!$('.js-annotation-card').length) {
    this.sidebarEmpty.prop('hidden', false)
  }
}

App.AnnotationPanel.prototype.onCardClick = function(e) {
  if ($(e.target).closest('a').length) return
  var card = $(e.currentTarget)
  $('.js-annotation-card').removeClass('is-selected app-annotation-card--active')
  card.addClass('is-selected')
  this.activateMark(card.data('annotation-id'))
  this.repositionCards()
}

App.AnnotationPanel.prototype.onDocumentMousedown = function(e) {
  if (!this.popup[0].hidden && !$.contains(this.popup[0], e.target)) {
    this.hidePopup()
  }
  if (!$(e.target).closest('.js-annotation-card').length) {
    $('.js-annotation-card').removeClass('is-selected app-annotation-card--active')
    this.activateMark(null)
    this.repositionCards()
  }
}

App.AnnotationPanel.prototype.onDocumentKeydown = function(e) {
  if (e.key !== 'Escape') return
  if (!this.popup[0].hidden) this.hidePopup()
  if (this.newAnnotationCard.length && !this.newAnnotationCard[0].hidden) this.hideNewCard()
}
