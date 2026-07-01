import OmsStubPage from '../../OmsStubPage';

export default function CreditNoteDetailPage({ createMode = false }) {
  return (
    <OmsStubPage
      titleKey={createMode ? 'oms.creditNoteDetail.createTitle' : 'oms.creditNoteDetail.title'}
      fallbackTitle={createMode ? 'New credit note' : 'Credit note'}
    />
  );
}
