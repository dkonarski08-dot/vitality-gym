// app/(dashboard)/requests/page.tsx
'use client'

import { useRequests } from './hooks/useRequests'
import { RequestsHeader } from './components/RequestsHeader'
import { ProductSearch } from './components/ProductSearch'
import { HistoryView } from './components/HistoryView'
import { DraftPanel } from './components/DraftPanel'

export default function RequestsPage() {
  const r = useRequests()

  return (
    <div className="min-h-screen">
      <RequestsHeader
        userRole={r.userRole}
        cleaning={r.cleaning}
        cleanResult={r.cleanResult}
        onCleanup={r.handleCleanup}
      />

      <div className="p-6">
        {r.loading ? (
          <div className="flex justify-center py-20">
            <div className="w-5 h-5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <ProductSearch
                search={r.search}
                setSearch={r.setSearch}
                suggestions={r.suggestions}
                showSuggestions={r.showSuggestions}
                setShowSuggestions={r.setShowSuggestions}
                searching={r.searching}
                searchRef={r.searchRef}
                draftItems={r.draftItems}
                filteredTop={r.filteredTop}
                availableCategories={r.availableCategories}
                selectedCategory={r.selectedCategory}
                setSelectedCategory={r.setSelectedCategory}
                onAddProduct={r.addProduct}
                onAddCustomProduct={r.addCustomProduct}
              />
              <HistoryView
                requests={r.pastRequests}
                statusFilter="all"
                userRole={r.userRole}
                onAddAllToNew={(req) => r.addMultipleProducts(req.delivery_request_items)}
                onApprove={r.handleApprove}
                onReject={r.handleReject}
              />
            </div>
            <div className="lg:col-span-1">
              <DraftPanel
                draftItems={r.draftItems}
                draftNotes={r.draftNotes}
                setDraftNotes={r.setDraftNotes}
                saving={r.saving}
                submitting={r.submitting}
                aiSuggestion={r.aiSuggestion}
                setAiSuggestion={r.setAiSuggestion}
                onUpdateQty={r.updateQty}
                onRemoveItem={r.removeItem}
                onSave={r.handleSave}
                onSubmit={r.handleSubmit}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
