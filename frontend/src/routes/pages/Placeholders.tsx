// Screen bodies belong to T11 (new request) and T12 (details).
// T08 only fixes the routes, so each task replaces exactly one of these components.
import { copy } from "../../copy";

export function NewRequestPage() {
  return <h1>{copy.newRequest.title}</h1>;
}

export function RequestDetailsPage() {
  return <h1>{copy.details.loading}</h1>;
}
