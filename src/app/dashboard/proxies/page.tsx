import { CustomerServicesClient } from "@/components/dashboard/CustomerServicesClient";

export default function MyProxiesPage() {
  return (
    <CustomerServicesClient
      category="proxy"
      title="My Proxies"
      emptyMessage="You have no active proxy packages yet."
    />
  );
}
