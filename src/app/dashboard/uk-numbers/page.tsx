import { CustomerServicesClient } from "@/components/dashboard/CustomerServicesClient";

export default function MyUkNumbersPage() {
  return (
    <CustomerServicesClient
      category="uk-number"
      title="My UK Virtual Numbers (+44)"
      emptyMessage="You have no allocated UK virtual numbers yet."
    />
  );
}
