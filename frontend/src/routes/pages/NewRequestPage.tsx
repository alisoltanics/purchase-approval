import { NewRequestDialog } from "./NewRequestDialog";
import { RequestsListPage } from "./RequestsListPage";

// The design opens the form as a dialog over the list (docs/purchase-approval.html), while the
// route /requests/new (plan 7.1) stays addressable: the list is the page behind the dialog.
export function NewRequestPage() {
  return (
    <>
      <RequestsListPage />
      <NewRequestDialog />
    </>
  );
}
