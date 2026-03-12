// app/(dashboard)/requests/page.tsx
'use client'

import { useRequests } from './hooks/useRequests'
import { RequestsHeader } from './components/RequestsHeader'
import { HistoryView } from './components/HistoryView'
import { NewRequestView } from './components/NewRequestView'
import { AISuggestionsModal } from './components/AISuggestionsModal'

export default function RequestsPage() {
  const r = useRequests()

  if (r.loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-5 h-5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
      </div>
    )
  }

  if (r.view === 'new-request') {
    return (
      <>
        <NewRequestView
          month={r.draftMonth}
          userRole={r.userRole}
          topProducts={r.topProducts}
          draftItems={r.draftItems}
          draftNotes={r.draftNotes}
          setDraftNotes={r.setDraftNotes}
          saving={r.saving}
          submitting={r.submitting}
          onAddProduct={r.addProduct}
          onUpdateQty={r.updateQty}
          onUpdateNote={r.updateNote}
          onRemoveItem={r.removeItem}
          onSave={r.handleSave}
          onSubmit={r.handleSubmit}
          onBack={() => r.setView('history')}
          onShowHistory={() => r.setView('history')}
        />
        <AISuggestionsModal
          open={r.aiModal !== null}
          prose={r.aiModal?.prose ?? ''}
          suggestions={r.aiModal?.suggestions ?? []}
          onAddAndSubmit={r.handleAIAddAndSubmit}
          onSubmitWithout={r.handleAISubmitWithout}
          onDismiss={r.handleAISubmitWithout}
        />
      </>
    )
  }

  // History view (default)
  return (
    <div className="min-h-screen">
      <RequestsHeader
        userRole={r.userRole}
        statusFilter={r.statusFilter}
        onStatusFilter={r.setStatusFilter}
        onNewRequest={r.handleNewRequest}
        cleaning={r.cleaning}
        cleanResult={r.cleanResult}
        onCleanNames={r.handleCleanNames}
      />
      <HistoryView
        requests={r.pastRequests}
        statusFilter={r.statusFilter}
        userRole={r.userRole}
        onAddAllToNew={r.handleAddAllToNew}
        onApprove={r.handleApprove}
        onReject={r.handleReject}
      />
    </div>
  )
}
