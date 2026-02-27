import usePipelineStore from '@/stores/pipelineStore'
import SlideOutPanel from '@/components/layout/SlideOutPanel'
import PipelineToolbar from './components/PipelineToolbar'
import KanbanBoard from './components/KanbanBoard'
import DealDetailPanel from './components/DealDetailPanel'

export default function PipelineBoard() {
  const selectedDealId = usePipelineStore((s) => s.selectedDealId)
  const deals = usePipelineStore((s) => s.deals)
  const contacts = usePipelineStore((s) => s.contacts)
  const stages = usePipelineStore((s) => s.stages)
  const selectDeal = usePipelineStore((s) => s.selectDeal)

  // Resolve selected deal + contact + stage
  const selectedDeal = selectedDealId ? deals.find((d) => d.id === selectedDealId) : null
  const selectedContact = selectedDeal ? contacts.find((c) => c.id === selectedDeal.contact_id) : null
  const selectedStage = selectedDeal ? stages.find((s) => s.id === selectedDeal.stage_id) : null

  const dealWithContact = selectedDeal && selectedContact
    ? { ...selectedDeal, contact: selectedContact }
    : null

  return (
    <div className="space-y-4">
      <PipelineToolbar />
      <KanbanBoard />

      <SlideOutPanel
        open={!!dealWithContact}
        onClose={() => selectDeal(null)}
        title={dealWithContact?.title ?? 'Deal Details'}
        width="md"
      >
        {dealWithContact && selectedStage && (
          <DealDetailPanel deal={dealWithContact} stage={selectedStage} />
        )}
      </SlideOutPanel>
    </div>
  )
}
