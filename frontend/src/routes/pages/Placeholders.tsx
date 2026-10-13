// Screen body belonging to T12 (details). T08 only fixes the route, so T12 replaces exactly this
// component.
import { copy } from "../../copy";

export function RequestDetailsPage() {
  return <h1>{copy.details.loading}</h1>;
}
